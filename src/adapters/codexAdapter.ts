import path from 'node:path';
import type {
  InstructionProfileAdapter,
} from './types.js';
import type {
  InstructionProfileId,
  InstructionSource,
  InstructionResolution,
  TargetPath,
  DiscoveryOptions,
  ResolutionOptions,
  Specificity,
  SourceType,
  InstructionStack,
  Diagnostic,
} from '../types/engine.js';
import {
  findFilesRecursively,
  readInstructionFileCached,
  type InstructionContentCache,
} from '../scanners/instructionFileScanner.js';
import {
  getDirectoryChain,
  getPathDepth,
  normalizePath,
} from '../utils/pathUtils.js';

export class CodexAdapter implements InstructionProfileAdapter {
  readonly id: InstructionProfileId = 'codex';
  readonly name = 'Codex / Autonomous Coding Agent Profile';
  readonly description =
    'Discovers and resolves hierarchical AGENTS.md and AGENTS.override.md files from repository root to target path.';
  readonly supportedFiles = ['AGENTS.md', 'AGENTS.override.md'];

  discover(
    rootDir: string,
    _options?: DiscoveryOptions,
    cache?: InstructionContentCache
  ): InstructionSource[] {
    const discoveredPaths = findFilesRecursively(
      rootDir,
      (_relPath, filename) =>
        filename === 'AGENTS.md' || filename === 'AGENTS.override.md'
    );

    // Deterministic sort by path
    discoveredPaths.sort((a, b) => a.localeCompare(b));

    const sources: InstructionSource[] = [];

    for (const relPath of discoveredPaths) {
      const absPath = path.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);

      const filename = path.posix.basename(relPath);
      const dir = path.posix.dirname(relPath);
      const scopeRoot = dir === '.' ? '' : normalizePath(dir);
      const depth = getPathDepth(scopeRoot);
      const isOverride = filename === 'AGENTS.override.md';
      const priority = isOverride ? 10 : 0;
      const score = depth * 100 + priority;

      const sourceType: SourceType = isOverride
        ? 'override'
        : scopeRoot === ''
        ? 'root'
        : 'directory';

      const specificity: Specificity = {
        depth,
        priority,
        isOverride,
        hasPattern: false,
        score,
      };

      sources.push({
        id: `codex:${relPath}`,
        profile: 'codex',
        sourceType,
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot,
        scope: {
          kind: scopeRoot === '' ? 'repository' : 'directory',
          root: scopeRoot,
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          isOverride,
          scopeDirectory: scopeRoot || '/',
          frontmatter: fileData.frontmatter.data,
        },
        parsingState: fileData.parsingState,
        diagnostics: fileData.diagnostics,
      });
    }

    return sources;
  }

  resolveForTarget(
    target: TargetPath,
    sources: InstructionSource[],
    _options?: ResolutionOptions
  ): InstructionResolution {
    const diagnostics: Diagnostic[] = [];
    const matchedSources: InstructionSource[] = [];
    const rejectedSources: Array<{ source: InstructionSource; reason: string }> = [];

    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: 'codex',
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: 'Target path is invalid or outside repository boundaries',
        })),
        stack: {
          profile: 'codex',
          targetPath: target.normalized,
          layers: [],
        },
        diagnostics,
      };
    }

    // Directory chain from repository root to target's containing directory
    // e.g. for "src/api/users.ts" -> ["", "src", "src/api"]
    const dirChain = new Set(getDirectoryChain(target.directory));

    for (const source of sources) {
      // Codex applies hierarchical instructions where source.scopeRoot is in the directory ancestor chain
      if (dirChain.has(source.scopeRoot)) {
        matchedSources.push(source);
      } else {
        rejectedSources.push({
          source,
          reason: `Scope root "${source.scopeRoot || '/'}" is not an ancestor directory of target directory "${target.directory || '/'}"`,
        });
      }
    }

    // Order deterministically from least specific to most specific (lowest score to highest score)
    // If scores match, sort by filePath lexicographically
    matchedSources.sort((a, b) => {
      if (a.specificity.score !== b.specificity.score) {
        return a.specificity.score - b.specificity.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });

    const stack: InstructionStack = {
      profile: 'codex',
      targetPath: target.normalized,
      layers: matchedSources.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason: source.specificity.isOverride
          ? `Override instruction applying to directory scope "${source.scopeRoot || '/'}"`
          : source.scopeRoot === ''
          ? 'Repository-level baseline instruction'
          : `Hierarchical directory-level instruction applying to "${source.scopeRoot}"`,
      })),
    };

    return {
      targetPath: target,
      profile: 'codex',
      matchedSources,
      rejectedSources,
      stack,
      diagnostics,
    };
  }
}
