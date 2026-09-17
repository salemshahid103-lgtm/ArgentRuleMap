import path from 'node:path';
import crypto from 'node:crypto';
import type { InstructionEngine } from '../core/instructionEngine.js';
import type {
  InstructionProfileId,
  InstructionSource,
} from '../types/engine.js';
import type {
  Diagnostic,
  ConflictReport,
  ConflictReportSummary,
} from './types.js';
import {
  createDiagnostic,
  sortDiagnostics,
} from './registry.js';
import { RepositoryInventory } from './repositoryInventory.js';
import { extractPathReferences } from './markdownParser.js';
import { extractCommandReferences } from './commandParser.js';
import { normalizePath } from '../utils/pathUtils.js';

export interface ConflictEngineOptions {
  profile?: InstructionProfileId | 'all';
  strict?: boolean;
}

export class ConflictEngine {
  readonly engine: InstructionEngine;
  readonly inventory: RepositoryInventory;

  constructor(engine: InstructionEngine) {
    this.engine = engine;
    this.inventory = new RepositoryInventory(engine.rootDir);
  }

  /**
   * Runs all deterministic conflict and structural diagnostics.
   */
  runConflicts(options: ConflictEngineOptions = {}): ConflictReport {
    const rawProfile = options.profile || 'all';
    const profilesToRun: InstructionProfileId[] =
      rawProfile === 'all'
        ? ['codex', 'copilot', 'gemini', 'generic']
        : [rawProfile as InstructionProfileId];

    const allDiagnostics: Diagnostic[] = [];

    for (const profileId of profilesToRun) {
      const sources = this.engine.discover(profileId);
      const diagnosticsForProfile = this.analyzeSourcesForProfile(
        sources,
        profileId
      );
      allDiagnostics.push(...diagnosticsForProfile);
    }

    // Run repository-wide content duplication check across distinct instruction sources
    const contentDiagnostics = this.checkContentDuplication(profilesToRun);
    allDiagnostics.push(...contentDiagnostics);

    // Deduplicate diagnostics
    const deduped = this.deduplicateDiagnostics(allDiagnostics);
    const sorted = sortDiagnostics(deduped);

    const summary: ConflictReportSummary = {
      total: sorted.length,
      errors: sorted.filter((d) => d.severity === 'error').length,
      warnings: sorted.filter((d) => d.severity === 'warning').length,
      info: sorted.filter((d) => d.severity === 'info').length,
    };

    return {
      schemaVersion: 1,
      command: 'conflicts',
      profile: rawProfile,
      repositoryRoot: this.engine.rootDir,
      diagnostics: sorted,
      summary,
      deterministicModeNotice:
        'Potential semantic conflict detection is not performed in deterministic mode. Only structural and objectively detectable findings are reported.',
    };
  }

  private analyzeSourcesForProfile(
    sources: InstructionSource[],
    profileId: InstructionProfileId
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // 1. Ingest structural diagnostics attached to sources (e.g. YAML parse errors, symlink errors)
    for (const source of sources) {
      for (const d of source.diagnostics) {
        // Map any existing ID to stable ARM registry ID
        const normalizedId = this.mapToArmId(d.id);
        diagnostics.push(
          createDiagnostic(normalizedId, {
            severity: d.severity,
            message: d.message,
            sourcePath: d.sourcePath || source.filePath,
            targetPath: d.targetPath,
            line: d.line,
            column: d.column,
            details: (d.details as Record<string, unknown>) || undefined,
            profile: profileId,
          })
        );
      }
    }

    // 2. Scope validation: ARM003_EMPTY_SCOPE & ARM008_SCOPE_MATCHES_NO_FILES
    for (const source of sources) {
      if (source.scope.rawApplyTo !== undefined) {
        const raw = source.scope.rawApplyTo.trim();
        if (!raw || (source.scope.patterns && source.scope.patterns.length === 0)) {
          diagnostics.push(
            createDiagnostic('ARM003_EMPTY_SCOPE', {
              sourcePath: source.filePath,
              profile: profileId,
              message: `Instruction file "${source.filePath}" declares an empty or whitespace-only scope.`,
              details: { rawApplyTo: source.scope.rawApplyTo },
            })
          );
        }
      }

      if (source.scope.patterns && source.scope.patterns.length > 0) {
        const matched = this.inventory.findMatchingFiles(source.scope.patterns);
        if (matched.length === 0) {
          diagnostics.push(
            createDiagnostic('ARM008_SCOPE_MATCHES_NO_FILES', {
              sourcePath: source.filePath,
              profile: profileId,
              message: `Path-specific instruction file "${source.filePath}" with scope "${source.scope.rawApplyTo || source.scope.patterns.join(', ')}" matches 0 files in repository.`,
              details: {
                patterns: source.scope.patterns,
                rawApplyTo: source.scope.rawApplyTo,
              },
            })
          );
        }
      }
    }

    // 3. Duplicate Scope (ARM004_DUPLICATE_SCOPE) & Overlapping Scope (ARM011_OVERLAPPING_SCOPE)
    diagnostics.push(...this.checkScopesForProfile(sources, profileId));

    // 4. Stale Path References (ARM006_STALE_PATH_REFERENCE)
    for (const source of sources) {
      diagnostics.push(...this.checkStalePathsInSource(source, profileId));
    }

    // 5. Command Reference Validation (ARM007_MISSING_PACKAGE_SCRIPT)
    for (const source of sources) {
      diagnostics.push(...this.checkCommandReferencesInSource(source, profileId));
    }

    // 6. Shadowed Sources (ARM012_SHADOWED_SOURCE)
    diagnostics.push(...this.checkShadowedSources(sources, profileId));

    return diagnostics;
  }

  /**
   * Checks for duplicate and overlapping scopes among path-specific sources.
   */
  private checkScopesForProfile(
    sources: InstructionSource[],
    profileId: InstructionProfileId
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const pathSources = sources.filter(
      (s) => s.scope.patterns && s.scope.patterns.length > 0
    );

    // Group by exact pattern key for ARM004_DUPLICATE_SCOPE
    const patternGroups = new Map<string, InstructionSource[]>();

    for (const s of pathSources) {
      const key = [...s.scope.patterns!].sort().join('||');
      const list = patternGroups.get(key) || [];
      list.push(s);
      patternGroups.set(key, list);
    }

    for (const [patternKey, group] of patternGroups) {
      if (group.length > 1) {
        const filePaths = group.map((s) => s.filePath);
        for (const s of group) {
          const others = filePaths.filter((p) => p !== s.filePath);
          diagnostics.push(
            createDiagnostic('ARM004_DUPLICATE_SCOPE', {
              sourcePath: s.filePath,
              profile: profileId,
              message: `Instruction file "${s.filePath}" shares identical scope "${s.scope.rawApplyTo || patternKey}" with: ${others.join(', ')}. Both rules may apply to the same targets.`,
              details: {
                sharedScope: s.scope.rawApplyTo || patternKey,
                conflictingSources: others,
              },
            })
          );
        }
      }
    }

    // Overlapping scopes: check pairs with different patterns
    for (let i = 0; i < pathSources.length; i++) {
      for (let j = i + 1; j < pathSources.length; j++) {
        const sA = pathSources[i];
        const sB = pathSources[j];
        const keyA = [...sA.scope.patterns!].sort().join('||');
        const keyB = [...sB.scope.patterns!].sort().join('||');
        if (keyA === keyB) {
          // Already handled as duplicate
          continue;
        }

        const filesA = this.inventory.findMatchingFiles(sA.scope.patterns!);
        const filesB = this.inventory.findMatchingFiles(sB.scope.patterns!);
        const setB = new Set(filesB);

        const overlap = filesA.filter((f) => setB.has(f));
        if (overlap.length > 0) {
          const sample = overlap[0];
          diagnostics.push(
            createDiagnostic('ARM011_OVERLAPPING_SCOPE', {
              sourcePath: sA.filePath,
              profile: profileId,
              message: `Overlapping instruction scopes between "${sA.filePath}" (${sA.scope.rawApplyTo || keyA}) and "${sB.filePath}" (${sB.scope.rawApplyTo || keyB}). Example overlap: ${sample}`,
              details: {
                sourceA: sA.filePath,
                sourceB: sB.filePath,
                patternsA: sA.scope.patterns,
                patternsB: sB.scope.patterns,
                overlappingFileCount: overlap.length,
                sampleFiles: overlap.slice(0, 5),
              },
            })
          );
        }
      }
    }

    return diagnostics;
  }

  /**
   * Validates markdown links and inline code paths against the repository inventory.
   */
  private checkStalePathsInSource(
    source: InstructionSource,
    profileId: InstructionProfileId
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const references = extractPathReferences(source.rawContent);

    const sourceDir = path.posix.dirname(source.filePath) === '.'
      ? ''
      : path.posix.dirname(source.filePath);

    for (const ref of references) {
      const rawTarget = ref.normalizedPath;

      // Resolve candidate 1: relative to the instruction file directory
      const candidateRelativeToFile = sourceDir
        ? normalizePath(`${sourceDir}/${rawTarget}`)
        : rawTarget;

      // Resolve candidate 2: relative to the repository root
      const candidateRelativeToRoot = rawTarget;

      const existsRelativeToFile = this.inventory.hasPath(candidateRelativeToFile);
      const existsRelativeToRoot = this.inventory.hasPath(candidateRelativeToRoot);

      if (!existsRelativeToFile && !existsRelativeToRoot) {
        diagnostics.push(
          createDiagnostic('ARM006_STALE_PATH_REFERENCE', {
            sourcePath: source.filePath,
            targetPath: rawTarget,
            line: ref.line,
            column: ref.column,
            profile: profileId,
            message: `Referenced path "${ref.rawReference}" does not exist in this repository.`,
            details: {
              referencedPath: ref.rawReference,
              referenceType: ref.sourceType,
              checkedPaths: [candidateRelativeToFile, candidateRelativeToRoot],
            },
          })
        );
      }
    }

    return diagnostics;
  }

  /**
   * Validates npm/pnpm/yarn/bun script commands against package.json.
   */
  private checkCommandReferencesInSource(
    source: InstructionSource,
    profileId: InstructionProfileId
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const commands = extractCommandReferences(source.rawContent);

    if (commands.length === 0) return diagnostics;

    const closestPkg = this.inventory.getClosestPackageJson(source.filePath);
    if (!closestPkg || !closestPkg.packageJson) {
      // No package.json in repository; do not warn conservatively
      return diagnostics;
    }

    const scripts = closestPkg.packageJson.scripts || {};
    const pkgRelPath = closestPkg.dir
      ? `${closestPkg.dir}/package.json`
      : 'package.json';

    for (const cmd of commands) {
      const scriptName = cmd.scriptName;
      if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
        diagnostics.push(
          createDiagnostic('ARM007_MISSING_PACKAGE_SCRIPT', {
            sourcePath: source.filePath,
            line: cmd.line,
            column: cmd.column,
            profile: profileId,
            message: `Instruction references script "${scriptName}" via "${cmd.rawCommand}", but script is not defined in "${pkgRelPath}".`,
            details: {
              script: scriptName,
              command: cmd.rawCommand,
              packageManager: cmd.packageManager,
              packageJsonPath: pkgRelPath,
            },
          })
        );
      }
    }

    return diagnostics;
  }

  /**
   * Checks for content duplication across instruction files.
   */
  private checkContentDuplication(
    profiles: InstructionProfileId[]
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const seenFiles = new Map<string, InstructionSource>();

    for (const profileId of profiles) {
      const sources = this.engine.discover(profileId);
      for (const s of sources) {
        if (!seenFiles.has(s.filePath)) {
          seenFiles.set(s.filePath, s);
        }
      }
    }

    const fingerprintGroups = new Map<string, InstructionSource[]>();

    for (const [, source] of seenFiles) {
      const normalizedContent = this.computeContentFingerprint(source.rawContent);
      if (normalizedContent.length < 20) {
        // Ignore trivial/empty files for duplicate content
        continue;
      }

      const hash = crypto
        .createHash('sha256')
        .update(normalizedContent)
        .digest('hex');

      const list = fingerprintGroups.get(hash) || [];
      list.push(source);
      fingerprintGroups.set(hash, list);
    }

    for (const [, group] of fingerprintGroups) {
      if (group.length > 1) {
        const fileList = group.map((s) => s.filePath);
        for (const s of group) {
          const others = fileList.filter((f) => f !== s.filePath);
          diagnostics.push(
            createDiagnostic('ARM005_DUPLICATE_CONTENT', {
              sourcePath: s.filePath,
              message: `Instruction file "${s.filePath}" contains identical effective content to: ${others.join(', ')}.`,
              details: {
                duplicateWith: others,
              },
            })
          );
        }
      }
    }

    return diagnostics;
  }

  /**
   * Identifies shadowed instruction sources (e.g. override files shadowing base files).
   */
  private checkShadowedSources(
    sources: InstructionSource[],
    profileId: InstructionProfileId
  ): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check if an override file exists in the same scope directory as a standard file
    const overrides = sources.filter((s) => s.sourceType === 'override');
    for (const ov of overrides) {
      const shadowed = sources.find(
        (s) =>
          s.sourceType === 'root' &&
          s.scopeRoot === ov.scopeRoot &&
          s.filePath !== ov.filePath
      );
      if (shadowed) {
        diagnostics.push(
          createDiagnostic('ARM012_SHADOWED_SOURCE', {
            sourcePath: shadowed.filePath,
            profile: profileId,
            message: `Instruction file "${shadowed.filePath}" is shadowed by override "${ov.filePath}".`,
            details: {
              shadowedBy: ov.filePath,
            },
          })
        );
      }
    }

    return diagnostics;
  }

  /**
   * Normalizes content ignoring trailing whitespaces and line endings.
   */
  private computeContentFingerprint(content: string): string {
    return content
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .join('\n')
      .trim();
  }

  /**
   * Maps existing or raw diagnostic IDs to canonical ARM IDs.
   */
  private mapToArmId(rawId: string): string {
    if (rawId.startsWith('ARM')) return rawId;
    switch (rawId) {
      case 'INVALID_FRONTMATTER':
        return 'ARM001_INVALID_FRONTMATTER';
      case 'INVALID_APPLY_TO':
      case 'INVALID_GLOB':
        return 'ARM002_INVALID_GLOB';
      case 'PATH_OUTSIDE_REPOSITORY':
        return 'ARM009_PATH_OUTSIDE_REPOSITORY';
      case 'SYMLINK_ESCAPE':
        return 'ARM010_SYMLINK_ESCAPE';
      case 'CYCLIC_SYMLINK_DETECTED':
        return 'ARM014_CYCLIC_SYMLINK';
      case 'UNREADABLE_INSTRUCTION_SOURCE':
        return 'ARM013_UNREADABLE_SOURCE';
      default:
        return rawId;
    }
  }

  private deduplicateDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
    const seen = new Set<string>();
    const result: Diagnostic[] = [];

    for (const d of diagnostics) {
      const key = `${d.id}:${d.sourcePath || ''}:${d.targetPath || ''}:${d.line || ''}:${d.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(d);
      }
    }

    return result;
  }
}
