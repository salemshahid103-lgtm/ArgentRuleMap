import type { InstructionProfileId } from '../types/engine.js';

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
  details?: Record<string, unknown>;
  remediation?: string;
  profile?: InstructionProfileId | string;
}

export interface DiagnosticDefinition {
  id: string;
  title: string;
  defaultSeverity: DiagnosticSeverity;
  description: string;
  trigger: string;
  example: string;
  remediation: string;
  causesStrictModeFailure: boolean;
}

export interface ConflictReportSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export interface ConflictReport {
  schemaVersion: number;
  command: 'conflicts';
  profile: string;
  repositoryRoot: string;
  diagnostics: Diagnostic[];
  summary: ConflictReportSummary;
  deterministicModeNotice: string;
}
