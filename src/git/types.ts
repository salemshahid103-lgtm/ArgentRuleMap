export type GitChangeStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked';

export interface ChangedFile {
  /**
   * The nature of the change (added, modified, deleted, renamed, copied, untracked).
   */
  status: GitChangeStatus;
  /**
   * Repository-relative normalized path to the file in its current/new state.
   */
  path: string;
  /**
   * Original repository-relative normalized path before rename/copy, if applicable.
   */
  oldPath?: string;
  /**
   * Git similarity percentage (e.g. 100 for R100), if applicable.
   */
  similarityScore?: number;
}

export type ComparisonType = 'base' | 'staged' | 'unstaged' | 'default';

export interface GitDiffComparison {
  type: ComparisonType;
  base?: string;
  target?: string;
  description: string;
}

export interface GitExecutionOptions {
  cwd?: string;
  timeoutMs?: number;
  maxBuffer?: number;
}

export interface GitErrorDetails {
  code:
    | 'NOT_GIT_REPO'
    | 'INVALID_BASE'
    | 'AMBIGUOUS_BASE'
    | 'SHALLOW_HISTORY'
    | 'GIT_COMMAND_FAILED'
    | 'UNSAFE_ARGUMENT';
  message: string;
  command?: string;
  args?: string[];
  rawError?: string;
}
