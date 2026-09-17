import path from 'node:path';
import { normalizePath } from '../utils/pathUtils.js';

export interface ExtractedPathReference {
  rawReference: string;
  normalizedPath: string;
  sourceType: 'link' | 'code';
  line: number;
  column: number;
}

const COMMON_PACKAGES_AND_TOOLS = new Set([
  'react',
  'react-dom',
  'vite',
  'vitest',
  'chalk',
  'commander',
  'express',
  'lodash',
  'typescript',
  'node',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'git',
  'docker',
  'esbuild',
  'picomatch',
  'yaml',
  'zod',
  'tailwindcss',
  'eslint',
  'prettier',
]);

const PROGRAMMING_KEYWORDS = new Set([
  'import',
  'export',
  'default',
  'from',
  'function',
  'class',
  'interface',
  'type',
  'const',
  'let',
  'var',
  'true',
  'false',
  'null',
  'undefined',
  'void',
  'never',
  'unknown',
  'any',
  'string',
  'number',
  'boolean',
  'return',
  'async',
  'await',
  'new',
  'this',
  'super',
]);

const FILE_EXTENSIONS = new Set([
  '.md',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.css',
  '.scss',
  '.html',
  '.sh',
  '.bash',
  '.sql',
  '.env',
  '.txt',
  '.svg',
  '.png',
  '.jpg',
  '.lock',
]);

/**
 * Extracts potential repository-relative path references from Markdown text.
 * Discards external URLs, mailto, anchor-only links, CLI flags, package names, version strings, etc.
 */
export function extractPathReferences(
  markdownContent: string
): ExtractedPathReference[] {
  const results: ExtractedPathReference[] = [];
  const lines = markdownContent.split(/\r?\n/);

  let insideCodeFence = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // Track code block fences ``` or ~~~
    const trimmed = line.trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      insideCodeFence = !insideCodeFence;
      continue;
    }

    if (insideCodeFence) {
      // Do not extract path references from inside multi-line code blocks
      continue;
    }

    // 1. Extract Markdown links: [text](target)
    const linkRegex = /\[(?:[^\]]*)\]\(([^)]+)\)/g;
    let linkMatch: RegExpExecArray | null;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      const fullTarget = linkMatch[1].trim();
      const col = linkMatch.index + 1;

      // Extract url part before any title or quotes: e.g. "path/to/file 'title'"
      let urlPart = fullTarget.split(/\s+/)[0];
      // Strip angle brackets if `<path>`
      if (urlPart.startsWith('<') && urlPart.endsWith('>')) {
        urlPart = urlPart.slice(1, -1);
      }

      // Ignore external protocols or mailto
      if (
        /^(?:https?:\/\/|ftp:\/\/|mailto:|data:)/i.test(urlPart) ||
        urlPart.startsWith('#')
      ) {
        continue;
      }

      // Strip query parameters and anchors
      const cleaned = urlPart.split('#')[0].split('?')[0].trim();
      if (!cleaned) {
        continue;
      }

      results.push({
        rawReference: urlPart,
        normalizedPath: normalizePath(cleaned),
        sourceType: 'link',
        line: lineNumber,
        column: col,
      });
    }

    // 2. Extract Inline code references: `target`
    const codeRegex = /`([^`\n]+)`/g;
    let codeMatch: RegExpExecArray | null;
    while ((codeMatch = codeRegex.exec(line)) !== null) {
      const raw = codeMatch[1].trim();
      const col = codeMatch.index + 1;

      // Filter non-path candidates
      if (!looksLikePathReference(raw)) {
        continue;
      }

      let cleaned = raw;
      // Strip trailing punctuation like comma, dot, colon, or parenthesis
      cleaned = cleaned.replace(/[,.:;)]+$/, '');
      // Strip trailing slash for checking
      if (cleaned.endsWith('/') && cleaned.length > 1) {
        cleaned = cleaned.slice(0, -1);
      }

      results.push({
        rawReference: raw,
        normalizedPath: normalizePath(cleaned),
        sourceType: 'code',
        line: lineNumber,
        column: col,
      });
    }
  }

  return results;
}

/**
 * Determines whether an inline code string conservatively looks like a filesystem path reference.
 */
export function looksLikePathReference(raw: string): boolean {
  if (!raw || raw.includes(' ') || raw.includes('\t') || raw.includes('\n')) {
    return false;
  }

  // Check for external URLs or emails
  if (
    /^(?:https?:\/\/|ftp:\/\/|mailto:)/i.test(raw) ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
  ) {
    return false;
  }

  // Check for CLI flags: -f, --profile, etc.
  if (raw.startsWith('-')) {
    return false;
  }

  // Check for semver / version numbers: v1.2.3, ^1.0.0, ~2.0, 1.0.0
  if (/^v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/.test(raw) || /^[\^~><=]/.test(raw)) {
    return false;
  }

  // Check for scoped package names: @org/pkg
  if (raw.startsWith('@')) {
    return false;
  }

  // Check for programming keywords
  if (PROGRAMMING_KEYWORDS.has(raw)) {
    return false;
  }

  // Check for common tools / packages
  if (COMMON_PACKAGES_AND_TOOLS.has(raw.toLowerCase())) {
    return false;
  }

  // Check for anchors
  if (raw.startsWith('#')) {
    return false;
  }

  // Check for environment variables: ALL_CAPS_WITH_UNDERSCORES
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(raw)) {
    return false;
  }

  // Check for wildcards / glob expressions (handled separately in glob scopes)
  if (raw.includes('*') || raw.includes('?') || raw.includes('{') || raw.includes('}')) {
    return false;
  }

  // Must either:
  // A. Contain a path separator (and not be a simple division or regex)
  if (raw.includes('/') || raw.startsWith('./') || raw.startsWith('../')) {
    // Avoid double slashes or regex-like //
    if (raw.includes('//')) return false;
    return true;
  }

  // B. Or have a recognized file extension
  const ext = path.extname(raw).toLowerCase();
  if (ext && FILE_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}
