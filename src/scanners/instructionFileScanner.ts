import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { Diagnostic, ParsingState } from '../types/engine.js';
import { normalizePath } from '../utils/pathUtils.js';
import { verifySymlinkSafety } from '../utils/symlinkUtils.js';

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  contentBody: string;
  hasFrontmatter: boolean;
  diagnostics: Diagnostic[];
}

export interface CachedFileContent {
  rawContent: string;
  frontmatter: ParsedFrontmatter;
  diagnostics: Diagnostic[];
}

export const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'vendor',
  '.venv',
  'venv',
  'target',
]);

/**
 * Maximum allowed size for an instruction file in bytes (default 1 MB).
 * Protects against excessive memory consumption or denial of service from unbounded files.
 */
export const DEFAULT_MAX_INSTRUCTION_FILE_SIZE = 1024 * 1024; // 1 MB

/**
 * Cache for file contents and frontmatter parsing across resolution operations.
 */
export class InstructionContentCache {
  private cache = new Map<string, CachedFileContent>();

  get(filePath: string): CachedFileContent | undefined {
    return this.cache.get(filePath);
  }

  set(filePath: string, value: CachedFileContent): void {
    this.cache.set(filePath, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Extracts and parses YAML frontmatter safely from markdown text.
 * Returns structured data, remaining content body, and diagnostics on failure.
 */
export function parseFrontmatter(
  rawContent: string,
  sourcePath?: string
): ParsedFrontmatter {
  const diagnostics: Diagnostic[] = [];

  if (!rawContent.startsWith('---')) {
    return {
      data: {},
      contentBody: rawContent,
      hasFrontmatter: false,
      diagnostics,
    };
  }

  // Find end of frontmatter
  const endIdx = rawContent.indexOf('\n---', 3);
  if (endIdx === -1) {
    diagnostics.push({
      id: 'INVALID_FRONTMATTER',
      severity: 'warning',
      message: 'Unclosed YAML frontmatter: missing closing "---"',
      sourcePath,
    });
    return {
      data: {},
      contentBody: rawContent,
      hasFrontmatter: true,
      diagnostics,
    };
  }

  const rawYaml = rawContent.slice(3, endIdx).trim();
  const contentBody = rawContent.slice(endIdx + 4).trimStart();

  try {
    const parsed = YAML.parse(rawYaml);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        data: parsed as Record<string, unknown>,
        contentBody,
        hasFrontmatter: true,
        diagnostics,
      };
    } else if (parsed === null || parsed === undefined) {
      return {
        data: {},
        contentBody,
        hasFrontmatter: true,
        diagnostics,
      };
    } else {
      diagnostics.push({
        id: 'INVALID_FRONTMATTER',
        severity: 'warning',
        message: 'Frontmatter must be a key-value mapping',
        sourcePath,
        details: { parsed },
      });
      return {
        data: {},
        contentBody,
        hasFrontmatter: true,
        diagnostics,
      };
    }
  } catch (err) {
    diagnostics.push({
      id: 'INVALID_FRONTMATTER',
      severity: 'warning',
      message: `Failed to parse YAML frontmatter: ${
        err instanceof Error ? err.message : String(err)
      }`,
      sourcePath,
      details: { rawYaml },
    });
    return {
      data: {},
      contentBody,
      hasFrontmatter: true,
      diagnostics,
    };
  }
}

/**
 * Reads and caches an instruction file while enforcing symlink security checks.
 */
export function readInstructionFileCached(
  absolutePath: string,
  repoRoot: string,
  cache?: InstructionContentCache,
  maxFileSize: number = DEFAULT_MAX_INSTRUCTION_FILE_SIZE
): {
  rawContent: string;
  frontmatter: ParsedFrontmatter;
  parsingState: ParsingState;
  diagnostics: Diagnostic[];
} {
  const relativePath = normalizePath(path.relative(repoRoot, absolutePath));
  const cached = cache?.get(absolutePath);
  if (cached) {
    const parsingState: ParsingState = cached.diagnostics.some(
      (d) => d.severity === 'error'
    )
      ? 'error'
      : cached.diagnostics.length > 0
      ? 'warning'
      : 'parsed';
    return {
      rawContent: cached.rawContent,
      frontmatter: cached.frontmatter,
      parsingState,
      diagnostics: [...cached.diagnostics],
    };
  }

  const diagnostics: Diagnostic[] = [];

  // Symlink check
  const symlinkResult = verifySymlinkSafety(absolutePath, repoRoot);
  if (!symlinkResult.safe) {
    diagnostics.push(...symlinkResult.diagnostics);
    return {
      rawContent: '',
      frontmatter: {
        data: {},
        contentBody: '',
        hasFrontmatter: false,
        diagnostics: [],
      },
      parsingState: 'error',
      diagnostics,
    };
  }

  // Size limit check to prevent unbounded memory consumption
  try {
    const stat = fs.statSync(absolutePath);
    if (stat.size > maxFileSize) {
      diagnostics.push({
        id: 'ARM020_OVERSIZED_INSTRUCTION_FILE',
        severity: 'warning',
        message: `Instruction file "${relativePath}" (${stat.size} bytes) exceeds the maximum allowed size limit of ${maxFileSize} bytes. Parsing skipped to prevent unbounded resource consumption.`,
        sourcePath: relativePath,
        details: { size: stat.size, maxSize: maxFileSize },
      });
      return {
        rawContent: '',
        frontmatter: {
          data: {},
          contentBody: '',
          hasFrontmatter: false,
          diagnostics: [],
        },
        parsingState: 'warning',
        diagnostics,
      };
    }
  } catch {
    // If stat fails, readFileSync below will produce the appropriate error diagnostic
  }

  let rawContent = '';
  try {
    rawContent = fs.readFileSync(absolutePath, 'utf8');
  } catch (err) {
    diagnostics.push({
      id: 'UNREADABLE_INSTRUCTION_SOURCE',
      severity: 'error',
      message: `Unable to read instruction file at "${relativePath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
      sourcePath: relativePath,
    });
    return {
      rawContent: '',
      frontmatter: {
        data: {},
        contentBody: '',
        hasFrontmatter: false,
        diagnostics: [],
      },
      parsingState: 'error',
      diagnostics,
    };
  }

  const frontmatter = parseFrontmatter(rawContent, relativePath);
  diagnostics.push(...frontmatter.diagnostics);

  const parsingState: ParsingState = diagnostics.some((d) => d.severity === 'error')
    ? 'error'
    : diagnostics.length > 0
    ? 'warning'
    : 'parsed';

  const entry: CachedFileContent = {
    rawContent,
    frontmatter,
    diagnostics,
  };

  cache?.set(absolutePath, entry);

  return {
    rawContent,
    frontmatter,
    parsingState,
    diagnostics,
  };
}

/**
 * Traverses directories starting at rootDir to find specific target filenames or glob patterns.
 * Prunes ignored directories (node_modules, .git, dist, etc.).
 * Does not read file contents during traversal.
 */
export function findFilesRecursively(
  rootDir: string,
  isCandidate: (relPath: string, filename: string) => boolean,
  currentRelDir = '',
  maxDepth = 20,
  currentDepth = 0
): string[] {
  if (currentDepth > maxDepth) return [];

  const currentAbsDir = currentRelDir
    ? path.join(rootDir, currentRelDir)
    : rootDir;

  if (!fs.existsSync(currentAbsDir)) return [];

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(currentAbsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  // Deterministic sorting of filesystem entries
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const results: string[] = [];

  for (const entry of entries) {
    const entryName = entry.name;
    const relPath = currentRelDir
      ? `${currentRelDir}/${entryName}`
      : entryName;

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entryName)) {
        continue;
      }
      results.push(
        ...findFilesRecursively(
          rootDir,
          isCandidate,
          relPath,
          maxDepth,
          currentDepth + 1
        )
      );
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (isCandidate(relPath, entryName)) {
        results.push(normalizePath(relPath));
      }
    }
  }

  return results;
}
