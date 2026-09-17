import path from 'node:path';
import type {
  InstructionEngine,
} from '../core/instructionEngine.js';
import type {
  InstructionProfileId,
  InstructionSource,
  TargetPath,
} from '../types/engine.js';
import type {
  ChangedFile,
  GitDiffComparison,
} from '../git/types.js';
import type {
  ChangedAnalysisReport,
  ChangedFileAnalysis,
  ChangedInstructionFile,
  ChangedSummary,
  ProfileMatchedSources,
  RenameScopeDiff,
  ScopeSpanSummary,
  InstructionComparisonDiff,
} from './types.js';
import { gitShowFileContent } from '../git/safeGit.js';
import { ConflictEngine } from '../diagnostics/conflictEngine.js';
import { normalizePath, parseAndValidateTargetPath } from '../utils/pathUtils.js';
import { parseFrontmatter } from '../scanners/instructionFileScanner.js';
import { parseApplyTo, matchesGlobPatterns } from '../globs/matcher.js';

export interface ChangedEngineOptions {
  profile?: string;
  compareInstructions?: boolean;
}

export class ChangedEngine {
  readonly engine: InstructionEngine;
  readonly rootDir: string;

  constructor(engine: InstructionEngine) {
    this.engine = engine;
    this.rootDir = engine.rootDir;
  }

  /**
   * Identifies whether a file path corresponds to a known AI agent instruction file.
   */
  isInstructionFilePath(
    relPath: string,
    discoveredSources: Map<string, InstructionSource>
  ): boolean {
    const norm = normalizePath(relPath);
    if (discoveredSources.has(norm)) return true;

    const filename = path.posix.basename(norm);
    if (
      filename === 'AGENTS.md' ||
      filename === 'AGENTS.override.md' ||
      filename === 'GEMINI.md' ||
      filename === 'GEMINI.override.md' ||
      filename === 'CLAUDE.md' ||
      filename === '.cursorrules' ||
      filename === '.windsurfrules' ||
      filename === 'COPILOT.md'
    ) {
      return true;
    }

    if (
      norm === '.github/copilot-instructions.md' ||
      (norm.startsWith('.github/instructions/') &&
        norm.endsWith('.instructions.md')) ||
      (norm.startsWith('.cursor/rules/') && norm.endsWith('.mdc'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Analyzes a list of changed files against repository instructions.
   */
  async analyzeChangedFiles(
    changedFiles: ChangedFile[],
    comparison: GitDiffComparison,
    options: ChangedEngineOptions = {}
  ): Promise<ChangedAnalysisReport> {
    const rawProfile = options.profile || 'all';
    const activeProfiles: InstructionProfileId[] =
      rawProfile === 'all'
        ? ['codex', 'copilot', 'gemini', 'generic']
        : [rawProfile as InstructionProfileId];

    // 1. Discover all instruction sources ONCE per profile for maximum performance
    const profileSources = new Map<InstructionProfileId, InstructionSource[]>();
    const allDiscoveredMap = new Map<string, InstructionSource>();

    for (const profileId of activeProfiles) {
      const sources = this.engine.discover(profileId);
      profileSources.set(profileId, sources);
      for (const s of sources) {
        allDiscoveredMap.set(s.filePath, s);
      }
    }

    // 2. Identify changed instruction files in this diff
    const changedInstructionFilesMap = new Map<string, ChangedFile>();
    for (const file of changedFiles) {
      if (this.isInstructionFilePath(file.path, allDiscoveredMap)) {
        changedInstructionFilesMap.set(file.path, file);
      }
      if (
        file.oldPath &&
        this.isInstructionFilePath(file.oldPath, allDiscoveredMap)
      ) {
        changedInstructionFilesMap.set(file.oldPath, file);
      }
    }

    // 3. Analyze each changed file
    const analyzedFiles: ChangedFileAnalysis[] = [];
    const involvedSourcesByProfile: Record<InstructionProfileId, Set<string>> = {
      codex: new Set<string>(),
      copilot: new Set<string>(),
      gemini: new Set<string>(),
      generic: new Set<string>(),
    };

    const distinctScopesByProfile: Record<InstructionProfileId, Set<string>> = {
      codex: new Set<string>(),
      copilot: new Set<string>(),
      gemini: new Set<string>(),
      generic: new Set<string>(),
    };

    for (const file of changedFiles) {
      const isInstruction = changedInstructionFilesMap.has(file.path);
      const profilesData: Record<InstructionProfileId, ProfileMatchedSources> =
        {} as Record<InstructionProfileId, ProfileMatchedSources>;

      // Create target object safely (works even if target file does not exist on disk, e.g. deleted)
      const { target } = parseAndValidateTargetPath(file.path, this.rootDir);

      for (const profileId of activeProfiles) {
        const adapter = this.engine.registry.get(profileId);
        const sources = profileSources.get(profileId) || [];

        const resolution = adapter.resolveForTarget(
          target,
          sources
        ) as unknown as import('../types/engine.js').InstructionResolution;
        const matchedSourcePaths = resolution.matchedSources.map(
          (s) => s.filePath
        );

        for (const src of matchedSourcePaths) {
          involvedSourcesByProfile[profileId].add(src);
        }

        // Determine scope chain and primary scope representation
        let primaryScope = 'repository root';
        const scopeChain: string[] = [];

        if (profileId === 'codex' || profileId === 'gemini') {
          // Identify most specific directory scope
          if (resolution.matchedSources.length > 0) {
            // Find most specific matched source
            const deepest = resolution.matchedSources[
              resolution.matchedSources.length - 1
            ];
            const dir = path.posix.dirname(deepest.filePath);
            primaryScope = dir === '.' ? 'repository root' : `${dir}/`;
            for (const s of resolution.matchedSources) {
              const d = path.posix.dirname(s.filePath);
              scopeChain.push(d === '.' ? 'repository root' : `${d}/`);
            }
          }
        } else if (profileId === 'copilot') {
          // Check for path-specific rules vs root instructions
          const pathSpecific = resolution.matchedSources.filter(
            (s) => s.sourceType === 'file-pattern'
          );
          if (pathSpecific.length > 0) {
            primaryScope = `path-specific: ${pathSpecific
              .map((s) => s.filePath)
              .join(', ')}`;
          } else if (resolution.matchedSources.length > 0) {
            primaryScope = 'repository instructions (.github/copilot-instructions.md)';
          } else {
            primaryScope = 'no instructions';
          }
          for (const s of resolution.matchedSources) {
            scopeChain.push(s.filePath);
          }
        } else {
          // Generic
          if (resolution.matchedSources.length > 0) {
            primaryScope = resolution.matchedSources
              .map((s) => s.filePath)
              .join(', ');
            for (const s of resolution.matchedSources) {
              scopeChain.push(s.filePath);
            }
          } else {
            primaryScope = 'no instructions';
          }
        }

        if (primaryScope) {
          distinctScopesByProfile[profileId].add(primaryScope);
        }

        profilesData[profileId] = {
          profile: profileId,
          profileName: adapter.name,
          matchedSources: matchedSourcePaths,
          scopeChain,
          primaryScope,
        };
      }

      // Check rename scope differences if oldPath exists
      let renameScopeDiff: RenameScopeDiff | undefined;
      if (file.oldPath && file.oldPath !== file.path) {
        const { target: oldTarget } = parseAndValidateTargetPath(
          file.oldPath,
          this.rootDir
        );
        const oldSources: Record<InstructionProfileId, string[]> = {} as Record<
          InstructionProfileId,
          string[]
        >;
        const newSources: Record<InstructionProfileId, string[]> = {} as Record<
          InstructionProfileId,
          string[]
        >;
        const details: string[] = [];
        let anyChanged = false;

        for (const profileId of activeProfiles) {
          const adapter = this.engine.registry.get(profileId);
          const sources = profileSources.get(profileId) || [];
          const oldRes = adapter.resolveForTarget(
            oldTarget,
            sources
          ) as unknown as import('../types/engine.js').InstructionResolution;
          const oldPaths = oldRes.matchedSources.map((s) => s.filePath);
          const newPaths = profilesData[profileId].matchedSources;

          oldSources[profileId] = oldPaths;
          newSources[profileId] = newPaths;

          const oldSet = new Set(oldPaths);
          const newSet = new Set(newPaths);
          const same =
            oldPaths.length === newPaths.length &&
            oldPaths.every((p) => newSet.has(p));

          if (!same) {
            anyChanged = true;
            const added = newPaths.filter((p) => !oldSet.has(p));
            const removed = oldPaths.filter((p) => !newSet.has(p));
            const parts: string[] = [];
            if (added.length > 0) parts.push(`added [${added.join(', ')}]`);
            if (removed.length > 0) parts.push(`removed [${removed.join(', ')}]`);
            details.push(
              `Scope changed for ${profileId}: ${parts.join(', ')} (Old: ${
                oldPaths.length ? oldPaths.join(', ') : 'none'
              } → New: ${newPaths.length ? newPaths.join(', ') : 'none'})`
            );
          }
        }

        renameScopeDiff = {
          changed: anyChanged,
          oldSources,
          newSources,
          details,
        };
      }

      analyzedFiles.push({
        status: file.status,
        path: file.path,
        oldPath: file.oldPath,
        similarityScore: file.similarityScore,
        isInstructionFile: isInstruction,
        profiles: profilesData,
        renameScopeDiff,
      });
    }

    // 4. Correlate changed instruction files with affected changed target files
    const changedInstructionFilesList: ChangedInstructionFile[] = [];
    for (const [instrPath, changedFile] of changedInstructionFilesMap.entries()) {
      const applicableProfiles: InstructionProfileId[] = [];
      for (const p of activeProfiles) {
        const sources = profileSources.get(p) || [];
        if (
          sources.some((s) => s.filePath === instrPath) ||
          this.isInstructionFilePath(instrPath, allDiscoveredMap)
        ) {
          applicableProfiles.push(p);
        }
      }

      // Find which other changed targets fall under this instruction file's scope
      const affectedTargets: string[] = [];
      const instrDir = path.posix.dirname(instrPath);
      const isRootInstr = instrDir === '.' || instrDir === '';

      for (const targetFile of changedFiles) {
        if (targetFile.path === instrPath) continue; // Don't include self

        let matches = false;
        // Check if target file matched this instruction file in any profile
        for (const p of activeProfiles) {
          const matched = analyzedFiles.find(
            (af) => af.path === targetFile.path
          )?.profiles[p]?.matchedSources;
          if (matched && matched.includes(instrPath)) {
            matches = true;
            break;
          }
        }

        // If file is deleted or newly added, check directory prefix as fallback
        if (!matches) {
          if (isRootInstr) {
            matches = true;
          } else if (
            targetFile.path.startsWith(`${instrDir}/`) ||
            targetFile.path === instrDir
          ) {
            matches = true;
          }
        }

        if (matches) {
          affectedTargets.push(targetFile.path);
        }
      }

      affectedTargets.sort((a, b) => a.localeCompare(b));

      changedInstructionFilesList.push({
        path: instrPath,
        status: changedFile.status,
        profiles: applicableProfiles,
        affectedChangedFiles: affectedTargets,
      });
    }

    changedInstructionFilesList.sort((a, b) => a.path.localeCompare(b.path));

    // 5. Optional before/after comparison (--compare-instructions)
    if (options.compareInstructions && comparison.base) {
      await this.performInstructionComparison(
        comparison.base,
        analyzedFiles,
        changedInstructionFilesList,
        activeProfiles
      );
    }

    // 6. Build Scope Span Summary
    const scopeSummary: Record<InstructionProfileId, ScopeSpanSummary> =
      {} as Record<InstructionProfileId, ScopeSpanSummary>;

    for (const profileId of activeProfiles) {
      const distinct = Array.from(distinctScopesByProfile[profileId]).sort();
      scopeSummary[profileId] = {
        profile: profileId,
        distinctScopes: distinct,
        multipleScopesDetected: distinct.length > 1,
      };
    }

    // 7. Calculate aggregate summary counts
    let added = 0;
    let modified = 0;
    let deleted = 0;
    let renamed = 0;
    let copied = 0;

    for (const f of changedFiles) {
      switch (f.status) {
        case 'added':
          added++;
          break;
        case 'modified':
          modified++;
          break;
        case 'deleted':
          deleted++;
          break;
        case 'renamed':
          renamed++;
          break;
        case 'copied':
          copied++;
          break;
      }
    }

    const instructionSourcesInvolved: Record<InstructionProfileId, number> = {
      codex: involvedSourcesByProfile.codex.size,
      copilot: involvedSourcesByProfile.copilot.size,
      gemini: involvedSourcesByProfile.gemini.size,
      generic: involvedSourcesByProfile.generic.size,
    };

    const distinctScopesCount: Record<InstructionProfileId, number> = {
      codex: distinctScopesByProfile.codex.size,
      copilot: distinctScopesByProfile.copilot.size,
      gemini: distinctScopesByProfile.gemini.size,
      generic: distinctScopesByProfile.generic.size,
    };

    const summary: ChangedSummary = {
      totalChanged: changedFiles.length,
      added,
      modified,
      deleted,
      renamed,
      copied,
      instructionFilesChanged: changedInstructionFilesList.length,
      instructionSourcesInvolved,
      distinctScopes: distinctScopesCount,
    };

    // 8. Run existing diagnostics against instruction files involved in this analysis
    const conflictEngine = new ConflictEngine(this.engine);
    const fullReport = conflictEngine.runConflicts({
      profile: rawProfile === 'all' ? 'all' : (rawProfile as InstructionProfileId),
    });

    // Filter diagnostics: only include diagnostics whose sourcePath is involved in this change set
    const involvedSourcePaths = new Set<string>();
    for (const p of activeProfiles) {
      for (const s of involvedSourcesByProfile[p]) {
        involvedSourcePaths.add(s);
      }
    }
    for (const cif of changedInstructionFilesList) {
      involvedSourcePaths.add(cif.path);
    }

    const filteredDiagnostics = fullReport.diagnostics.filter((d) => {
      if (!d.sourcePath) return false;
      return (
        involvedSourcePaths.has(d.sourcePath) ||
        involvedSourcePaths.has(normalizePath(d.sourcePath))
      );
    });

    // Deterministic sort of files
    analyzedFiles.sort((a, b) => a.path.localeCompare(b.path));

    return {
      schemaVersion: 1,
      command: 'changed',
      repositoryRoot: this.rootDir,
      comparison,
      summary,
      changedInstructionFiles: changedInstructionFilesList,
      scopeSummary,
      files: analyzedFiles,
      diagnostics: filteredDiagnostics,
      deterministicModeNotice:
        'Deterministic analysis performed. Only structural instruction mappings and verifiable Git changes are reported.',
    };
  }

  /**
   * Performs read-only historical comparison of instruction files at base ref without checkout.
   */
  private async performInstructionComparison(
    baseRef: string,
    analyzedFiles: ChangedFileAnalysis[],
    changedInstructionFiles: ChangedInstructionFile[],
    activeProfiles: InstructionProfileId[]
  ): Promise<void> {
    // If no instruction files changed, base and current instruction definitions are identical
    if (changedInstructionFiles.length === 0) {
      for (const file of analyzedFiles) {
        const baseSources: Record<InstructionProfileId, string[]> = {} as Record<
          InstructionProfileId,
          string[]
        >;
        const currentSources: Record<InstructionProfileId, string[]> =
          {} as Record<InstructionProfileId, string[]>;
        for (const p of activeProfiles) {
          const cur = file.profiles[p]?.matchedSources || [];
          baseSources[p] = cur;
          currentSources[p] = cur;
        }
        file.instructionComparison = {
          changed: false,
          baseSources,
          currentSources,
          details: ['No instruction files modified; instruction scope unchanged.'],
        };
      }
      return;
    }

    // Inspect base contents of changed instruction files
    const baseContents = new Map<string, string | null>();
    for (const cif of changedInstructionFiles) {
      const content = await gitShowFileContent(baseRef, cif.path, this.rootDir);
      baseContents.set(cif.path, content);
    }

    // Compare for each changed file
    for (const file of analyzedFiles) {
      const baseSources: Record<InstructionProfileId, string[]> = {} as Record<
        InstructionProfileId,
        string[]
      >;
      const currentSources: Record<InstructionProfileId, string[]> =
        {} as Record<InstructionProfileId, string[]>;
      const details: string[] = [];
      let anyDiff = false;

      for (const p of activeProfiles) {
        const cur = file.profiles[p]?.matchedSources || [];
        currentSources[p] = cur;

        // Approximate base matching for this profile:
        // If an instruction file was added in this diff, it was NOT present at base.
        // If an instruction file was deleted in this diff, it WAS present at base.
        // If an instruction file was modified, check if applyTo changed (for copilot).
        const baseList: string[] = [];
        for (const src of cur) {
          const cif = changedInstructionFiles.find((c) => c.path === src);
          if (cif && cif.status === 'added') {
            // Did not exist at base
            continue;
          }
          baseList.push(src);
        }

        // Add any instruction file that was deleted in this diff if it applied to this file
        for (const cif of changedInstructionFiles) {
          if (cif.status === 'deleted') {
            const rawBase = baseContents.get(cif.path);
            if (rawBase !== null) {
              // Check if deleted instruction file would have applied to this file
              if (p === 'codex' && (cif.path.endsWith('AGENTS.md') || cif.path.endsWith('AGENTS.override.md'))) {
                const dir = path.posix.dirname(cif.path);
                const scopeRoot = dir === '.' ? '' : normalizePath(dir);
                if (file.path.startsWith(scopeRoot ? `${scopeRoot}/` : '')) {
                  baseList.push(cif.path);
                }
              } else if (p === 'copilot' && cif.path.startsWith('.github/instructions/')) {
                const fm = parseFrontmatter(rawBase || '', cif.path);
                const { patterns } = parseApplyTo(fm.data.applyTo, cif.path);
                if (matchesGlobPatterns(file.path, patterns).matched) {
                  baseList.push(cif.path);
                }
              }
            }
          }
        }

        baseList.sort();
        baseSources[p] = baseList;

        const curSorted = [...cur].sort();
        const same =
          baseList.length === curSorted.length &&
          baseList.every((val, idx) => val === curSorted[idx]);

        if (!same) {
          anyDiff = true;
          const added = curSorted.filter((x) => !baseList.includes(x));
          const removed = baseList.filter((x) => !curSorted.includes(x));
          const parts: string[] = [];
          if (added.length) parts.push(`+ ${added.join(', ')}`);
          if (removed.length) parts.push(`- ${removed.join(', ')}`);
          details.push(`${p}: ${parts.join(', ')}`);
        }
      }

      file.instructionComparison = {
        changed: anyDiff,
        baseSources,
        currentSources,
        details,
      };
    }
  }
}
