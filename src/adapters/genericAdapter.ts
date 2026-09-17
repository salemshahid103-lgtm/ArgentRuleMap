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
  InstructionStack,
  Diagnostic,
} from '../types/engine.js';
import {
  findFilesRecursively,
  readInstructionFileCached,
  type InstructionContentCache,
} from '../scanners/instructionFileScanner.js';
import { normalizePath } from '../utils/pathUtils.js';

export class GenericAdapter implements InstructionProfileAdapter {
  readonly id: InstructionProfileId = 'generic';
  readonly name = 'Generic Informational Profile';
  readonly description =
    'Informational profile that discovers all common AI instruction files (AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md) without enforcing vendor-specific precedence.';
  readonly supportedFiles = [
    'AGENTS.md',
    'AGENTS.override.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    '.cursorrules',
  ];

  discover(
    rootDir: string,
    _options?: DiscoveryOptions,
    cache?: InstructionContentCache
  ): InstructionSource[] {
    const candidateFiles = findFilesRecursively(rootDir, (relPath, filename) => {
      if (
        filename === 'AGENTS.md' ||
        filename === 'AGENTS.override.md' ||
        filename === 'CLAUDE.md' ||
        filename === 'GEMINI.md' ||
        filename === '.cursorrules' ||
        relPath === '.github/copilot-instructions.md'
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

      const dir = path.posix.dirname(relPath);
      const scopeRoot = dir === '.' ? '' : normalizePath(dir);

      const specificity: Specificity = {
        depth: 0,
        priority: 0,
        score: 0,
      };

      sources.push({
        id: `generic:${relPath}`,
        profile: 'generic',
        sourceType: 'informational',
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot,
        scope: {
          kind: 'informational',
          root: scopeRoot,
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          scopeDirectory: scopeRoot || '/',
          informationalOnly: true,
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

    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: 'generic',
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: 'Target path is invalid or outside repository boundaries',
        })),
        stack: {
          profile: 'generic',
          targetPath: target.normalized,
          layers: [],
        },
        diagnostics,
      };
    }

    // In generic informational mode, all discovered repo-level/directory instruction files
    // are reported informationally without applying vendor-specific overriding
    for (const s of sources) {
      diagnostics.push(...s.diagnostics);
    }

    const matched = [...sources].sort((a, b) => a.filePath.localeCompare(b.filePath));

    const stack: InstructionStack = {
      profile: 'generic',
      targetPath: target.normalized,
      layers: matched.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason:
          'Informational candidate discovery (vendor precedence not applied)',
      })),
    };

    return {
      targetPath: target,
      profile: 'generic',
      matchedSources: matched,
      rejectedSources: [],
      stack,
      diagnostics,
    };
  }
}
