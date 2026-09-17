import path from 'node:path';
import type { InstructionProfileAdapter } from './types.js';
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
import { normalizePath } from '../utils/pathUtils.js';
import { parseApplyTo, matchesGlobPatterns } from '../globs/matcher.js';

export class CopilotAdapter implements InstructionProfileAdapter {
  readonly id: InstructionProfileId = 'copilot';
  readonly name = 'GitHub Copilot Profile';
  readonly description =
    'Discovers .github/copilot-instructions.md and scoped .github/instructions/**/*.instructions.md with frontmatter applyTo rules.';
  readonly supportedFiles = [
    '.github/copilot-instructions.md',
    '.github/instructions/**/*.instructions.md',
  ];

  discover(
    rootDir: string,
    _options?: DiscoveryOptions,
    cache?: InstructionContentCache
  ): InstructionSource[] {
    const discoveredPaths: string[] = [];

    // 1. Check for .github/copilot-instructions.md
    const repoInstructionsPath = path.join(
      rootDir,
      '.github',
      'copilot-instructions.md'
    );
    try {
      if (
        readInstructionFileCached(repoInstructionsPath, rootDir, cache).rawContent !== '' ||
        // Check if file physically exists
        path.join(rootDir, '.github', 'copilot-instructions.md')
      ) {
        // Will check if it exists via findFilesRecursively or fs
      }
    } catch {
      // Ignore
    }

    const candidateFiles = findFilesRecursively(rootDir, (relPath, filename) => {
      if (relPath === '.github/copilot-instructions.md') return true;
      if (
        relPath.startsWith('.github/instructions/') &&
        filename.endsWith('.instructions.md')
      ) {
        return true;
      }
      return false;
    });

    candidateFiles.sort((a, b) => a.localeCompare(b));

    const sources: InstructionSource[] = [];

    for (const relPath of candidateFiles) {
      const absPath = path.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);

      const isRepoLevel = relPath === '.github/copilot-instructions.md';
      const sourceType: SourceType = isRepoLevel ? 'root' : 'file-pattern';

      // Parse applyTo if scoped instructions
      const rawApplyTo = fileData.frontmatter.data['applyTo'];
      const globParse = parseApplyTo(rawApplyTo, relPath);

      const combinedDiagnostics = [
        ...fileData.diagnostics,
        ...globParse.diagnostics,
      ];

      const depth = isRepoLevel ? 0 : 1;
      const priority = isRepoLevel ? 0 : 50;
      const specificity: Specificity = {
        depth,
        priority,
        isOverride: false,
        hasPattern: !isRepoLevel,
        score: depth * 100 + priority,
      };

      sources.push({
        id: `copilot:${relPath}`,
        profile: 'copilot',
        sourceType,
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot: '',
        scope: {
          kind: isRepoLevel ? 'repository' : 'glob',
          root: '',
          patterns: isRepoLevel ? ['**/*'] : globParse.patterns,
          rawApplyTo: globParse.rawApplyTo,
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          isRepoLevel,
          frontmatter: fileData.frontmatter.data,
          applyTo: globParse.rawApplyTo,
          parsedPatterns: globParse.patterns,
        },
        parsingState: combinedDiagnostics.some((d) => d.severity === 'error')
          ? 'error'
          : combinedDiagnostics.length > 0
          ? 'warning'
          : 'parsed',
        diagnostics: combinedDiagnostics,
      });
    }

    return sources;
  }

  resolveForTarget(
    target: TargetPath,
    sources: InstructionSource[],
    _options?: ResolutionOptions
  ): InstructionResolution {
    const matchedSources: InstructionSource[] = [];
    const rejectedSources: Array<{ source: InstructionSource; reason: string }> = [];
    const diagnostics: Diagnostic[] = [];

    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: 'copilot',
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: 'Target path is invalid or outside repository boundaries',
        })),
        stack: {
          profile: 'copilot',
          targetPath: target.normalized,
          layers: [],
        },
        diagnostics,
      };
    }

    for (const source of sources) {
      // Propagate source diagnostics
      diagnostics.push(...source.diagnostics);

      // Repository-level copilot instructions apply to all files
      if (source.filePath === '.github/copilot-instructions.md') {
        matchedSources.push(source);
        continue;
      }

      // Pattern-scoped instructions: test patterns
      const patterns = source.scope.patterns || [];
      const matchResult = matchesGlobPatterns(target.normalized, patterns);

      if (matchResult.matched) {
        matchedSources.push(source);
      } else {
        rejectedSources.push({
          source,
          reason: `Target path "${target.normalized}" does not match patterns: ${patterns.join(', ') || '(none)'}`,
        });
      }
    }

    // Sort deterministically from least specific to most specific
    matchedSources.sort((a, b) => {
      if (a.specificity.score !== b.specificity.score) {
        return a.specificity.score - b.specificity.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });

    const stack: InstructionStack = {
      profile: 'copilot',
      targetPath: target.normalized,
      layers: matchedSources.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason:
          source.filePath === '.github/copilot-instructions.md'
            ? 'Repository-level Copilot instruction applies to all target paths'
            : `Matched pattern (${source.scope.rawApplyTo || source.scope.patterns?.join(', ')}) for target path "${target.normalized}"`,
      })),
    };

    return {
      targetPath: target,
      profile: 'copilot',
      matchedSources,
      rejectedSources,
      stack,
      diagnostics,
    };
  }
}
