/**
 * AgentRuleMap - Public API
 * Deterministic AI coding-agent instruction discovery, scope resolution, conflicts & coverage engine.
 */

// Version
export { getVersion } from './version.js';

// Core instruction engine & models
export { InstructionEngine } from './core/instructionEngine.js';
export type { InstructionEngineConfig } from './core/instructionEngine.js';
export { analyzeRepository, calculateReadinessLabel } from './core/engine.js';

// Diagnostics & Conflicts
export { ConflictEngine } from './diagnostics/conflictEngine.js';
export type { ConflictEngineOptions } from './diagnostics/conflictEngine.js';
export { RepositoryInventory } from './diagnostics/repositoryInventory.js';
export {
  DIAGNOSTIC_REGISTRY,
  createDiagnostic,
  sortDiagnostics,
} from './diagnostics/registry.js';
export type {
  Diagnostic,
  DiagnosticDefinition,
  DiagnosticSeverity,
  ConflictReport,
  ConflictReportSummary,
} from './diagnostics/types.js';

// Coverage Engine
export { CoverageEngine } from './coverage/coverageEngine.js';
export type {
  AreaCoverage,
  ProfileCoverageReport,
  FullCoverageReport,
} from './coverage/coverageEngine.js';

// Changed Files Engine
export { ChangedEngine } from './changed/changedEngine.js';
export type {
  ChangedAnalysisReport,
  ChangedFileAnalysis,
  ChangedInstructionFile,
  ScopeSpanSummary,
  ChangedSummary,
  ChangedAnalysisOptions,
  ProfileMatchedSources,
} from './changed/types.js';

// Adapters & Profiles
export {
  defaultAdapterRegistry,
  AdapterRegistry,
} from './adapters/registry.js';
export { CodexAdapter } from './adapters/codexAdapter.js';
export { CopilotAdapter } from './adapters/copilotAdapter.js';
export { GeminiAdapter } from './adapters/geminiAdapter.js';
export { GenericAdapter } from './adapters/genericAdapter.js';

// Reporters
export { formatSarifReport } from './reporters/sarifReporter.js';
export { formatJsonReport } from './reporters/jsonReporter.js';
export { formatTerminalReport } from './reporters/terminalReporter.js';

// Types
export type * from './types/engine.js';
export type * from './types/index.js';
