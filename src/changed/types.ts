import type {
  Diagnostic,
  InstructionProfileId,
} from '../types/engine.js';
import type {
  ChangedFile,
  GitChangeStatus,
  GitDiffComparison,
} from '../git/types.js';

export interface ProfileMatchedSources {
  profile: InstructionProfileId;
  profileName: string;
  matchedSources: string[];
  scopeChain: string[];
  primaryScope?: string;
}

export interface RenameScopeDiff {
  changed: boolean;
  oldSources: Record<InstructionProfileId, string[]>;
  newSources: Record<InstructionProfileId, string[]>;
  details: string[];
}

export interface InstructionComparisonDiff {
  changed: boolean;
  baseSources: Record<InstructionProfileId, string[]>;
  currentSources: Record<InstructionProfileId, string[]>;
  details: string[];
}

export interface ChangedFileAnalysis {
  status: GitChangeStatus;
  path: string;
  oldPath?: string;
  similarityScore?: number;
  isInstructionFile: boolean;
  profiles: Record<InstructionProfileId, ProfileMatchedSources>;
  renameScopeDiff?: RenameScopeDiff;
  instructionComparison?: InstructionComparisonDiff;
}

export interface ChangedInstructionFile {
  path: string;
  status: GitChangeStatus;
  profiles: InstructionProfileId[];
  affectedChangedFiles: string[];
}

export interface ScopeSpanSummary {
  profile: InstructionProfileId;
  distinctScopes: string[];
  multipleScopesDetected: boolean;
}

export interface ChangedSummary {
  totalChanged: number;
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
  copied: number;
  instructionFilesChanged: number;
  instructionSourcesInvolved: Record<InstructionProfileId, number>;
  distinctScopes: Record<InstructionProfileId, number>;
}

export interface ChangedAnalysisReport {
  schemaVersion: number;
  command: 'changed';
  repositoryRoot: string;
  comparison: GitDiffComparison;
  summary: ChangedSummary;
  changedInstructionFiles: ChangedInstructionFile[];
  scopeSummary: Record<InstructionProfileId, ScopeSpanSummary>;
  files: ChangedFileAnalysis[];
  diagnostics: Diagnostic[];
  deterministicModeNotice: string;
}

export interface ChangedAnalysisOptions {
  profile?: string; // codex, copilot, gemini, generic, all
  base?: string;
  staged?: boolean;
  unstaged?: boolean;
  compareInstructions?: boolean;
  json?: boolean;
  sarif?: boolean;
  format?: 'text' | 'json' | 'sarif';
  strict?: boolean;
  cwd?: string;
}
