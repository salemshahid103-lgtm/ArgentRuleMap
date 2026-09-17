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
import {
  getDirectoryChain,
  getPathDepth,
  normalizePath,
} from '../utils/pathUtils.js';

export class GeminiAdapter implements InstructionProfileAdapter {
  readonly id: InstructionProfileId = 'gemini';
  readonly name = 'Gemini CLI Profile';
  readonly description =
    'Discovers and hierarchically resolves GEMINI.md instruction files from repository root down to target path.';
  readonly supportedFiles = ['GEMINI.md'];

  discover(
    rootDir: string,
    _options?: DiscoveryOptions,
    cache?: InstructionContentCache
  ): InstructionSource[] {
    const discoveredPaths = findFilesRecursively(
      rootDir,
      (_relPath, filename) => filename === 'GEMINI.md'
    );

    discoveredPaths.sort((a, b) => a.localeCompare(b));

    const sources: InstructionSource[] = [];

    for (const relPath of discoveredPaths) {
      const absPath = path.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);

      const dir = path.posix.dirname(relPath);
      const scopeRoot = dir === '.' ? '' : normalizePath(dir);
      const depth = getPathDepth(scopeRoot);
      const score = depth * 100;

      const sourceType: SourceType = scopeRoot === '' ? 'root' : 'directory';

      const specificity: Specificity = {
        depth,
        priority: 0,
        isOverride: false,
        hasPattern: false,
        score,
      };

      sources.push({
        id: `gemini:${relPath}`,
        profile: 'gemini',
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
          scopeDirectory: scopeRoot || '/',
          normalizedSpecificity: score,
          note: 'AgentRuleMap normalized directory specificity; vendor hierarchy preserves all directory layers',
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
    const matchedSources: InstructionSource[] = [];
    const rejectedSources: Array<{ source: InstructionSource; reason: string }> = [];
    const diagnostics: Diagnostic[] = [];

    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: 'gemini',
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: 'Target path is invalid or outside repository boundaries',
        })),
        stack: {
          profile: 'gemini',
          targetPath: target.normalized,
          layers: [],
        },
        diagnostics,
      };
    }

    const dirChain = new Set(getDirectoryChain(target.directory));

    for (const source of sources) {
      diagnostics.push(...source.diagnostics);

      if (dirChain.has(source.scopeRoot)) {
        matchedSources.push(source);
      } else {
        rejectedSources.push({
          source,
          reason: `GEMINI.md at "${source.scopeRoot || '/'}" is outside the directory ancestry of target "${target.normalized}"`,
        });
      }
    }

    // Deterministic ordering: least specific (root) to most specific (deepest directory)
    matchedSources.sort((a, b) => {
      if (a.specificity.score !== b.specificity.score) {
        return a.specificity.score - b.specificity.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });

    const stack: InstructionStack = {
      profile: 'gemini',
      targetPath: target.normalized,
      layers: matchedSources.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason:
          source.scopeRoot === ''
            ? 'Root GEMINI.md repository context'
            : `Directory GEMINI.md context applying to "${source.scopeRoot}"`,
      })),
    };

    return {
      targetPath: target,
      profile: 'gemini',
      matchedSources,
      rejectedSources,
      stack,
      diagnostics,
    };
  }
}
