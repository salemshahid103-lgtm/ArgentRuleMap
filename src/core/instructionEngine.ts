import path from 'node:path';
import type {
  InstructionProfileId,
  InstructionSource,
  InstructionResolution,
  Diagnostic,
  DiscoveryOptions,
  ResolutionOptions,
} from '../types/engine.js';
import {
  AdapterRegistry,
  defaultAdapterRegistry,
} from '../adapters/registry.js';
import {
  InstructionContentCache,
} from '../scanners/instructionFileScanner.js';
import {
  parseAndValidateTargetPath,
} from '../utils/pathUtils.js';

export interface InstructionEngineConfig {
  rootDir?: string;
  registry?: AdapterRegistry;
}

export class InstructionEngine {
  readonly rootDir: string;
  readonly registry: AdapterRegistry;
  readonly cache: InstructionContentCache;

  constructor(config: InstructionEngineConfig = {}) {
    this.rootDir = path.resolve(config.rootDir || process.cwd());
    this.registry = config.registry || defaultAdapterRegistry;
    this.cache = new InstructionContentCache();
  }

  /**
   * Discovers all instruction sources for a given profile in the repository.
   */
  discover(
    profileId: InstructionProfileId,
    options?: DiscoveryOptions
  ): InstructionSource[] {
    const adapter = this.registry.get(profileId);
    return adapter.discover(this.rootDir, options, this.cache) as InstructionSource[];
  }

  /**
   * Resolves instructions for a target file path according to the specified profile.
   */
  resolve(
    rawTargetPath: string,
    profileId: InstructionProfileId,
    options?: ResolutionOptions
  ): InstructionResolution {
    const adapter = this.registry.get(profileId);

    // Validate and parse target path safely
    const { target, diagnostics: pathDiagnostics } = parseAndValidateTargetPath(
      rawTargetPath,
      this.rootDir
    );

    if (!target.isValid || !target.isInsideRepo) {
      const emptyResolution: InstructionResolution = {
        targetPath: target,
        profile: profileId,
        matchedSources: [],
        rejectedSources: [],
        stack: {
          profile: profileId,
          targetPath: target.normalized || rawTargetPath,
          layers: [],
        },
        diagnostics: pathDiagnostics,
      };
      return emptyResolution;
    }

    // Discover sources
    const sources = this.discover(profileId);

    // Resolve for target
    const resolution = adapter.resolveForTarget(
      target,
      sources,
      options
    ) as InstructionResolution;

    // Combine path diagnostics if any
    const allDiagnostics: Diagnostic[] = [
      ...pathDiagnostics,
      ...resolution.diagnostics,
    ];

    // Deduplicate diagnostics by ID and source/target path
    const seen = new Set<string>();
    const dedupedDiagnostics = allDiagnostics.filter((d) => {
      const key = `${d.id}:${d.sourcePath || ''}:${d.targetPath || ''}:${d.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      ...resolution,
      diagnostics: dedupedDiagnostics,
    };
  }

  /**
   * Resolves instructions for a target path across all supported profiles.
   */
  resolveAll(
    rawTargetPath: string,
    options?: ResolutionOptions
  ): Record<InstructionProfileId, InstructionResolution> {
    const profiles: InstructionProfileId[] = [
      'codex',
      'copilot',
      'gemini',
      'generic',
    ];
    const results = {} as Record<InstructionProfileId, InstructionResolution>;

    for (const p of profiles) {
      results[p] = this.resolve(rawTargetPath, p, options);
    }

    return results;
  }

  /**
   * Clears the instruction file cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
