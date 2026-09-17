export type ActionFailOn = 'never' | 'error' | 'warning';
export type ActionOutputFormat = 'summary' | 'sarif' | 'json';

export interface ActionInputs {
  base?: string;
  profile?: string;
  failOn?: ActionFailOn;
  output?: ActionOutputFormat;
  sarifFile?: string;
  prComment?: boolean;
  githubToken?: string;
  cwd?: string;
}

export interface ActionEnvironment {
  isGitHubActions: boolean;
  baseRef?: string;
  headRef?: string;
  sha?: string;
  repository?: string;
  stepSummaryPath?: string;
  eventPath?: string;
  token?: string;
  inputs?: ActionInputs;
  cwd?: string;
}

export interface ActionExecutionResult {
  exitCode: number;
  changedFilesCount: number;
  instructionSourcesCount: number;
  errorCount: number;
  warningCount: number;
  profiles: string[];
  sarifFilePath?: string;
  stepSummaryMarkdown?: string;
  prCommentPosted?: boolean;
  error?: string;
}
