export type InstructionProfileId = 'codex' | 'copilot' | 'gemini' | 'generic';

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  title?: string;
  message: string;
  sourcePath?: string;
  targetPath?: string;
  line?: number;
  column?: number;
  details?: unknown;
  remediation?: string;
}

export interface SourceLocation {
  filePath: string;
  line?: number;
  column?: number;
}

export interface TargetPath {
  raw: string;
  normalized: string;
  directory: string;
  filename: string;
  extension: string;
  isValid: boolean;
  isInsideRepo: boolean;
}

export type ScopeKind = 'repository' | 'directory' | 'glob' | 'informational';

export interface InstructionScope {
  kind: ScopeKind;
  root: string; // Directory relative to repository root, e.g. "" or "src/api"
  patterns?: string[];
  rawApplyTo?: string;
}

export interface Specificity {
  depth: number; // Directory nesting depth (0 for root, 1 for src, 2 for src/api)
  priority: number; // Profile-specific priority tiebreaker (e.g. override = 10, standard = 0)
  isOverride?: boolean;
  hasPattern?: boolean;
  score: number; // Deterministic composite scalar for sorting: depth * 100 + priority
}

export type ParsingState = 'parsed' | 'warning' | 'error';

export type SourceType =
  | 'root'
  | 'directory'
  | 'override'
  | 'file-pattern'
  | 'informational';

export interface InstructionSource {
  id: string; // Unique deterministic ID, e.g. "codex:src/AGENTS.md"
  profile: InstructionProfileId;
  sourceType: SourceType;
  filePath: string; // Repository-relative POSIX path (e.g. "src/AGENTS.md")
  absolutePath: string;
  scopeRoot: string; // Directory scope root (e.g. "src")
  scope: InstructionScope;
  specificity: Specificity;
  rawContent: string;
  metadata?: Record<string, unknown>;
  parsingState: ParsingState;
  diagnostics: Diagnostic[];
}

export interface InstructionMatch {
  source: InstructionSource;
  matched: boolean;
  reason: string;
  specificity: Specificity;
}

export interface InstructionStackLayer {
  source: InstructionSource;
  layerIndex: number;
  specificity: Specificity;
  matchedReason: string;
}

export interface InstructionStack {
  profile: InstructionProfileId;
  targetPath: string;
  layers: InstructionStackLayer[];
}

export interface InstructionResolution {
  targetPath: TargetPath;
  profile: InstructionProfileId;
  matchedSources: InstructionSource[];
  rejectedSources: Array<{ source: InstructionSource; reason: string }>;
  stack: InstructionStack;
  diagnostics: Diagnostic[];
}

export interface DiscoveryOptions {
  includeDiagnostics?: boolean;
  maxDepth?: number;
}

export interface ResolutionOptions {
  allowOutsideRepo?: boolean;
  includeRejected?: boolean;
}

export interface InstructionProfile {
  id: InstructionProfileId;
  name: string;
  description: string;
  supportedFiles: string[];
  supportedPatterns?: string[];
}
