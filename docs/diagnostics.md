# AgentRuleMap Diagnostic Registry

This document provides the reference catalog of deterministic diagnostics emitted by AgentRuleMap. Every diagnostic is identified by a stable `ARMxxx` code, has a defined default severity, explicit trigger conditions, and actionable remediation steps.

---

## Diagnostics Overview

| ID | Title | Default Severity | Strict-Mode Failure (`--strict`) |
|---|---|---|---|
| `ARM001_INVALID_FRONTMATTER` | Invalid YAML Frontmatter | `warning` | No |
| `ARM002_INVALID_GLOB` | Invalid Glob Pattern | `error` | **Yes (`exit 1`)** |
| `ARM003_EMPTY_SCOPE` | Empty Instruction Scope | `warning` | No |
| `ARM004_DUPLICATE_SCOPE` | Duplicate Scope Definition | `warning` | No |
| `ARM005_DUPLICATE_CONTENT` | Identical Instruction Content | `info` | No |
| `ARM006_STALE_PATH_REFERENCE` | Stale Path Reference | `warning` | No |
| `ARM007_MISSING_PACKAGE_SCRIPT` | Missing Package Script | `warning` | No |
| `ARM008_SCOPE_MATCHES_NO_FILES` | Scope Matches No Files | `warning` | No |
| `ARM009_PATH_OUTSIDE_REPOSITORY` | Path Traverses Outside Repository | `error` | **Yes (`exit 1`)** |
| `ARM010_SYMLINK_ESCAPE` | Symlink Escapes Repository | `error` | **Yes (`exit 1`)** |
| `ARM011_OVERLAPPING_SCOPE` | Overlapping Instruction Scopes | `info` | No |
| `ARM012_SHADOWED_SOURCE` | Shadowed Instruction Source | `info` | No |
| `ARM013_UNREADABLE_SOURCE` | Unreadable Instruction Source | `error` | **Yes (`exit 1`)** |
| `ARM014_CYCLIC_SYMLINK` | Cyclic Symlink Detected | `error` | **Yes (`exit 1`)** |
| `ARM020_OVERSIZED_INSTRUCTION_FILE` | Oversized Instruction File | `warning` | No |

---

## Detailed Diagnostic Reference

### `ARM001_INVALID_FRONTMATTER`: Invalid YAML Frontmatter
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: YAML frontmatter in an instruction file is malformed, unclosed, or cannot be parsed.
- **Trigger**: An instruction markdown file contains unclosed `---` delimiters or invalid YAML key-value syntax.
- **Example**:
  ```markdown
  ---
  applyTo: [invalid: yaml
  ---
  ```
- **Remediation**: Ensure YAML frontmatter is a valid YAML mapping enclosed between matching `---` markers.

---

### `ARM002_INVALID_GLOB`: Invalid Glob Pattern
- **Severity**: `error`
- **Causes Strict Failure**: Yes (`exit 1`)
- **Description**: A glob pattern specified in an instruction file is invalid or malformed.
- **Trigger**: An `applyTo` pattern contains unclosed brackets or syntax that the pattern engine cannot parse.
- **Example**:
  ```yaml
  applyTo: "src/[a-"
  ```
- **Remediation**: Check glob pattern syntax and close all brackets, braces, and wildcards properly.

---

### `ARM003_EMPTY_SCOPE`: Empty Instruction Scope
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: An instruction file declares an empty or whitespace-only scope or `applyTo` field.
- **Trigger**: `applyTo` is specified as an empty string, empty list, or whitespace.
- **Example**:
  ```yaml
  applyTo: ""
  ```
- **Remediation**: Provide a valid glob pattern or remove the empty `applyTo` field.

---

### `ARM004_DUPLICATE_SCOPE`: Duplicate Scope Definition
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: Multiple path-specific instruction files declare identical or equivalent scopes.
- **Trigger**: Two or more instruction files define the exact same `applyTo` glob patterns within the same profile.
- **Example**: Two instruction files both specifying `applyTo: "src/api/**/*.ts"`.
- **Remediation**: Consolidate the rules into one file or differentiate their scopes.

---

### `ARM005_DUPLICATE_CONTENT`: Identical Instruction Content
- **Severity**: `info`
- **Causes Strict Failure**: No
- **Description**: Multiple instruction files contain identical effective content.
- **Trigger**: Two or more instruction files have identical normalized content (ignoring line endings and trailing whitespace).
- **Example**: `AGENTS.md` and `packages/api/AGENTS.md` have identical text.
- **Remediation**: Keep common instructions in the root or refactor instructions to avoid duplication.

---

### `ARM006_STALE_PATH_REFERENCE`: Stale Path Reference
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: An instruction file references a repository-relative path that does not exist.
- **Trigger**: A file or directory path in Markdown inline code or relative link cannot be found in the repository.
- **Example**: `Read "src/legacy-api/README.md" before editing.`
- **Remediation**: Update or remove the reference to the nonexistent file or directory.

---

### `ARM007_MISSING_PACKAGE_SCRIPT`: Missing Package Script
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: An instruction file directs the agent to run an npm/pnpm/yarn/bun script that is not in `package.json`.
- **Trigger**: Instruction contains `npm run lint` or `npm test`, but the scripts field in `package.json` lacks it.
- **Example**: Directing the agent to run `npm run lint:types` when `package.json` has no `lint:types` script.
- **Remediation**: Add the missing script to `package.json` `"scripts"` or correct the command in the instruction file.

---

### `ARM008_SCOPE_MATCHES_NO_FILES`: Scope Matches No Files
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: A path-specific instruction scope matches zero files in the repository.
- **Trigger**: An `applyTo` glob pattern evaluates to zero files in the current repository tree.
- **Example**: `applyTo: "src/legacy/**/*.ts"` when `src/legacy/` does not exist or contains no matching files.
- **Remediation**: Verify the glob pattern matches existing files or remove the unused instruction file.

---

### `ARM009_PATH_OUTSIDE_REPOSITORY`: Path Traverses Outside Repository
- **Severity**: `error`
- **Causes Strict Failure**: Yes (`exit 1`)
- **Description**: A target path or referenced path escapes the repository boundary.
- **Trigger**: A path uses `..` to escape the repository root.
- **Example**: `npx agentrulemap explain ../../etc/passwd`
- **Remediation**: Restrict all target paths to within the repository root.

---

### `ARM010_SYMLINK_ESCAPE`: Symlink Escapes Repository
- **Severity**: `error`
- **Causes Strict Failure**: Yes (`exit 1`)
- **Description**: A symbolic link points to a target outside the repository root.
- **Trigger**: A symlinked instruction file points to an external filesystem location.
- **Example**: `ln -s /etc/passwd AGENTS.md`
- **Remediation**: Remove or repoint the symbolic link to an internal repository target.

---

### `ARM011_OVERLAPPING_SCOPE`: Overlapping Instruction Scopes
- **Severity**: `info`
- **Causes Strict Failure**: No
- **Description**: Multiple path-specific instruction rules overlap for one or more files.
- **Trigger**: Patterns like `src/**/*.ts` and `src/api/**/*.ts` both match common repository files.
- **Example**: Both rules apply to `src/api/users.ts`.
- **Remediation**: Ensure instruction precedence is intentional or refine scopes to be mutually exclusive.

---

### `ARM012_SHADOWED_SOURCE`: Shadowed Instruction Source
- **Severity**: `info`
- **Causes Strict Failure**: No
- **Description**: An instruction source is shadowed by a higher-precedence rule.
- **Trigger**: An override instruction file shadows a baseline instruction file in the same directory scope.
- **Example**: `AGENTS.override.md` taking precedence over `AGENTS.md` in the root directory.
- **Remediation**: Review precedence ordering if the shadowed file was expected to remain active.

---

### `ARM013_UNREADABLE_SOURCE`: Unreadable Instruction Source
- **Severity**: `error`
- **Causes Strict Failure**: Yes (`exit 1`)
- **Description**: An instruction file cannot be read due to file system or permission errors.
- **Trigger**: `fs.readFileSync` fails with `EACCES` or filesystem errors.
- **Example**: An instruction file with restricted file permissions (`chmod 000`).
- **Remediation**: Check file permissions and ensure the file exists and is readable.

---

### `ARM014_CYCLIC_SYMLINK`: Cyclic Symlink Detected
- **Severity**: `error`
- **Causes Strict Failure**: Yes (`exit 1`)
- **Description**: A circular symbolic link loop was detected.
- **Trigger**: Symlink resolution loops back to an already-visited inode or path.
- **Example**: Symlink A points to Symlink B which points back to Symlink A.
- **Remediation**: Break the cyclic symlink loop.

---

### `ARM020_OVERSIZED_INSTRUCTION_FILE`: Oversized Instruction File
- **Severity**: `warning`
- **Causes Strict Failure**: No
- **Description**: An instruction file exceeds the maximum allowed file size (1 MB / 1,048,576 bytes) and was skipped to prevent excessive memory consumption.
- **Trigger**: An instruction file exceeds 1 MB.
- **Example**: A large auto-generated markdown file exceeding 1 MB.
- **Remediation**: Reduce file size or split repository instructions into smaller, path-scoped instruction files.
