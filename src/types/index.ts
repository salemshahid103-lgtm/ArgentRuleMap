export type RepoType =
  | 'nodejs'
  | 'typescript'
  | 'javascript'
  | 'react'
  | 'nextjs'
  | 'vite'
  | 'python'
  | 'unknown';

export type CategoryName =
  | 'agent_instructions'
  | 'build_test'
  | 'repo_structure'
  | 'instruction_accuracy'
  | 'security';

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type ReadinessLabel = 'EXCELLENT' | 'GOOD' | 'NEEDS IMPROVEMENT' | 'NOT READY';

export interface CategoryScore {
  name: CategoryName;
  label: string;
  score: number;
  maxScore: number;
}

export interface RuleCheck {
  id: string;
  category: CategoryName;
  name: string;
  description: string;
  status: CheckStatus;
  message: string;
  details?: string[];
  pointsAwarded: number;
  pointsPossible: number;
}

export interface AgentInstructionFile {
  relativePath: string;
  absolutePath: string;
  agentType: 'agents' | 'claude' | 'gemini' | 'copilot' | 'cursor' | 'custom';
  content: string;
  exists: boolean;
  sizeBytes: number;
}

export interface RepoPackageJson {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  type?: 'module' | 'commonjs';
}

export interface RepoStructure {
  directories: string[];
  importantDirs: {
    src?: string;
    app?: string;
    pages?: string;
    components?: string;
    tests?: string;
    docs?: string;
    scripts?: string;
    [key: string]: string | undefined;
  };
  rootFiles: string[];
  totalFilesScanned: number;
}

export interface RepoContext {
  rootDir: string;
  name: string;
  detectedTypes: RepoType[];
  packageJson?: RepoPackageJson;
  hasTsConfig: boolean;
  hasGitignore: boolean;
  gitignoreContent?: string;
  hasEnvFile: boolean;
  hasEnvExample: boolean;
  envFiles: string[];
  structure: RepoStructure;
  instructionFiles: AgentInstructionFile[];
  readmeFile?: {
    path: string;
    content: string;
  };
}

export interface AnalysisResult {
  version: string;
  timestamp: string;
  repository: {
    name: string;
    path: string;
    detectedTypes: RepoType[];
    instructionFiles: string[];
    structure: {
      importantDirs: Record<string, string>;
      totalFiles: number;
    };
  };
  score: number;
  readinessLabel: ReadinessLabel;
  categories: Record<CategoryName, { label: string; score: number; maxScore: number }>;
  checks: RuleCheck[];
  warnings: string[];
  errors: string[];
}

export interface CheckCommandOptions {
  cwd?: string;
  json?: boolean;
  verbose?: boolean;
}

export interface InitCommandOptions {
  cwd?: string;
  force?: boolean;
}

export interface FixCommandOptions {
  cwd?: string;
  dryRun?: boolean;
}

export interface FixAction {
  id: string;
  title: string;
  description: string;
  file: string;
  diffOrPreview: string;
  apply: () => Promise<void> | void;
}

export * from './engine.js';
