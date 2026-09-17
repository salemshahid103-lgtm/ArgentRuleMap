# Instruction Model & Normalization

AgentRuleMap provides a vendor-neutral, normalized internal representation for AI coding-agent instruction files. This document explains how diverse external instruction formats are mapped into a unified data structure, and clarifies boundaries between documented vendor specifications and AgentRuleMap's modeling.

---

## Important Notice: Non-Authoritative Mapping

> **AgentRuleMap does NOT define or enforce official vendor standards.**
>
> AgentRuleMap is an independent, third-party analysis tool. Specifications for `AGENTS.md`, GitHub Copilot instructions, `GEMINI.md`, and other files are defined by their respective creators and working groups. AgentRuleMap models these conventions to help developers audit their repositories deterministically.
>
> Where vendor tooling behavior is evolving, unspecified, or implementation-dependent, AgentRuleMap explicitly documents its modeling assumptions.

---

## Three-Tier Boundary Separation

To maintain architectural clarity, AgentRuleMap strictly distinguishes between three tiers:

### 1. Documented Vendor Behavior
Behavior backed by official public documentation from vendors or community specifications:
- `AGENTS.md`: Root-level instruction file for autonomous coding agents.
- GitHub Copilot: Root `.github/copilot-instructions.md` applies repository-wide.
- GitHub Copilot: Path-specific instructions in `.github/instructions/*.instructions.md` using YAML frontmatter `applyTo` with glob patterns.
- Google Gemini CLI: `GEMINI.md` hierarchical directory traversal.

### 2. AgentRuleMap Normalized Representation
The internal model used to unify heterogeneous instruction formats into a single deterministic engine:
- Every instruction file is mapped to an `InstructionSource` record.
- Scoping rules are converted into standardized `InstructionScope` definitions (`repository`, `directory`, `glob`, `informational`).
- Precedence is modeled through mathematical `Specificity` scores (`depth * 100 + priority`).
- Resolved rules for any file form an `InstructionStack` ordered from least specific to most specific.

### 3. Unsupported or Uncertain Behavior
Behaviors that are not yet officially specified, or vary across agent client versions:
- **Conflicting instructions resolution**: How an LLM interprets two contradictory natural language paragraphs within the same file or across two active files is non-deterministic and cannot be statically proven. AgentRuleMap flags structural overlaps and duplicates, but does not claim to resolve semantic natural-language disputes.
- **Dynamic runtime variables**: Template variables (such as environment variables or custom runtime interpolations) in markdown files are parsed as literal text.
- **Client-specific overrides**: Local agent flags (such as `--ignore-instructions` or custom system prompt injections) set on a user's machine outside the repository are outside AgentRuleMap's static analysis scope.

---

## Normalized Data Model

### `InstructionSource`
The fundamental unit representing an instruction file:

```typescript
export interface InstructionSource {
  id: string;                      // Deterministic ID (e.g. "codex:src/AGENTS.md")
  profile: InstructionProfileId;   // "codex" | "copilot" | "gemini" | "generic"
  sourceType: SourceType;          // "root" | "directory" | "override" | "file-pattern" | "informational"
  filePath: string;                // Normalized POSIX relative path ("src/AGENTS.md")
  absolutePath: string;            // Absolute filesystem path
  scopeRoot: string;               // Anchor directory ("src" or "")
  scope: InstructionScope;         // Boundary definition
  specificity: Specificity;        // Calculated precedence score
  rawContent: string;              // File text content
  parsingState: ParsingState;      // "parsed" | "warning" | "error"
  diagnostics: Diagnostic[];       // Any syntax/parsing findings
}
```

### `InstructionScope`
Describes where the instruction source applies:

```typescript
export interface InstructionScope {
  kind: 'repository' | 'directory' | 'glob' | 'informational';
  root: string;            // Anchor directory
  patterns?: string[];     // Glob patterns (if kind === "glob")
  rawApplyTo?: string;     // Raw unparsed applyTo declaration
}
```

### `Specificity`
Determines the relative precedence of instruction sources:

```typescript
export interface Specificity {
  depth: number;       // Nesting depth in directory hierarchy (0 for root)
  priority: number;    // Profile tiebreaker (+10 for override, +50 for glob)
  isOverride?: boolean;// True for explicit override files
  hasPattern?: boolean;// True for path-specific pattern rules
  score: number;       // Composite score: depth * 100 + priority
}
```

### `InstructionStack`
Represents the effective layered instruction stack for a resolved target path:

```typescript
export interface InstructionStack {
  profile: InstructionProfileId;
  targetPath: string;
  layers: InstructionStackLayer[]; // Ordered: least specific -> most specific
}
```
Each layer documents its exact matching reason and specificity rank, providing full provenance for auditing and debugging.
