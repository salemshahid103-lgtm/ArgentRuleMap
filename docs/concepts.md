# AgentRuleMap Concepts & Terminology

AgentRuleMap provides deterministic instruction discovery, scope resolution, provenance tracking, and change impact analysis for AI coding agents. This document defines the core concepts and terminology used throughout the CLI, API, schema, and diagnostics.

---

## 1. Repository Root
The top-level root directory of the repository being analyzed. All internal paths, instruction scopes, and target file references are normalized to POSIX-compliant paths relative to the repository root (for example, `src/api/users.ts` or `AGENTS.md`).

---

## 2. Instruction Source (`InstructionSource`)
A discrete file or configuration unit discovered within the repository that provides behavioral instructions, architectural guidance, or constraints to an AI coding agent.

Examples:
- `AGENTS.md` (root or directory-nested)
- `AGENTS.override.md`
- `.github/copilot-instructions.md`
- `.github/instructions/*.instructions.md`
- `GEMINI.md` (root or directory-nested)

Every instruction source is tracked with an immutable metadata record containing:
- `id`: Unique identifier (e.g., `codex:src/AGENTS.md`)
- `profile`: The target AI agent profile (`codex`, `copilot`, `gemini`, `generic`)
- `sourceType`: `root`, `directory`, `override`, `file-pattern`, or `informational`
- `filePath`: Repository-relative POSIX path
- `scope`: The defined reach of the instructions (`InstructionScope`)
- `specificity`: Mathematical precedence score (`Specificity`)
- `parsingState`: `parsed`, `warning`, or `error`

---

## 3. Profile (`InstructionProfile`)
An adapter model representing a distinct AI coding agent ecosystem. Profiles encapsulate vendor-specific discovery locations, scope rules, and specificity algorithms:

- **`codex`**: Autonomous coding agents supporting hierarchical `AGENTS.md`, nested directory instructions, and `AGENTS.override.md`.
- **`copilot`**: GitHub Copilot instructions supporting global `.github/copilot-instructions.md` and scoped `.github/instructions/*.instructions.md` with YAML frontmatter `applyTo` glob patterns.
- **`gemini`**: Google Gemini CLI instructions following hierarchical `GEMINI.md` directory trees.
- **`generic`**: Discovers all known instruction files without asserting vendor-specific precedence.

---

## 4. Scope (`InstructionScope`)
The boundary or set of repository paths to which an instruction source applies:

- **Repository-wide (`kind: "repository"`)**: Applies unconditionally to all files in the repository (e.g., root `AGENTS.md`, `.github/copilot-instructions.md`).
- **Directory-scoped (`kind: "directory"`)**: Applies exclusively to files residing within the instruction file's parent directory or its child subdirectories (e.g., `apps/web/AGENTS.md` applies to `apps/web/**`).
- **Glob-scoped (`kind: "glob"`)**: Applies to files whose relative paths match one or more glob patterns (e.g., `applyTo: "src/api/**/*.ts"`).
- **Informational (`kind: "informational"`)**: Contextual instructions without enforced precedence.

---

## 5. Target File (`TargetPath`)
The candidate repository file whose governing instructions are being resolved or explained (e.g., `src/api/users.ts`).
Target paths are validated against path traversal (`..`), verified to reside within the repository root, and parsed into directory, filename, and extension components.

---

## 6. Specificity (`Specificity`)
A deterministic, calculated scoring tuple that establishes precedence ordering among competing instruction sources:
- **`depth`**: Directory nesting level (e.g., root = 0, `src/` = 1, `src/api/` = 2).
- **`priority`**: Fixed profile tiebreaker (e.g., override files score +10, path-specific patterns score +50).
- **`score`**: Composite scalar integer (`depth * 100 + priority`).

Higher specificity scores represent more localized, tailored instructions that take precedence over broader repository baselines.

---

## 7. Effective Stack (`InstructionStack`)
The deterministically ordered sequence of applicable instruction layers for a specific target file:
- **Layer 0**: Broadest, least-specific baseline instruction (e.g., root `AGENTS.md`).
- **Layer N**: Most specific, localized instruction (e.g., `src/api/AGENTS.md` or `backend.instructions.md`).

The effective stack represents the true hierarchical instruction context an agent receives when operating on that file.

---

## 8. Provenance
The exact origin, matching reason, and audit trail explaining *why* an instruction file was included in or excluded from a target's effective stack:
- **Included**: Matched ancestor directory, root baseline, or matched glob pattern.
- **Excluded**: Out-of-scope directory, non-matching glob pattern, or shadowed by an explicit override.

---

## 9. Diagnostic (`Diagnostic`)
A structured static-analysis finding identifying an objective defect, conflict, or risk in repository instruction files.
Every diagnostic includes:
- `id`: Stable identifier (e.g., `ARM002_INVALID_GLOB`, `ARM006_STALE_PATH_REFERENCE`)
- `severity`: `error`, `warning`, or `info`
- `message`: Clear, factual description of the issue
- `remediation`: Specific, actionable steps to fix the defect
- `sourcePath`: The offending instruction file path

---

## 10. Changed-File Analysis
The evaluation of pull requests, git diffs, or working tree modifications against the repository's instruction map:
- Identifies which instruction files apply to newly modified, added, or renamed files.
- Detects if an edited instruction file alters the governing rules for other files in the pull request.
- Detects scope transitions when files are renamed across directory or glob boundaries.
