# JSON Schema & Machine Output Specification

AgentRuleMap provides first-class, machine-readable JSON outputs across its commands (`scan`, `explain`, `conflicts`, `coverage`, `changed`). All JSON outputs adhere to formal specifications designed for deterministic integration with CI bots, IDE plugins, and build tooling.

The authoritative JSON Schema definition is available at [`schema/agentrulemap-report.schema.json`](../schema/agentrulemap-report.schema.json).

---

## Top-Level Schema Conventions

All structured command reports include the following top-level metadata:

- **`schemaVersion`** (`integer`): Current schema version is `1`. Incremented only on breaking changes to the report contract.
- **`command`** (`string`): The command that produced the report (`"conflicts"`, `"coverage"`, `"changed"`, etc.).
- **`repositoryRoot`** (`string`): Absolute or normalized path to the analyzed repository.
- **`deterministicModeNotice`** (`string`): Notice confirming deterministic, offline execution.

---

## Report Types

### 1. Conflicts Report (`agentrulemap conflicts --json`)
Emits structural defects, broken path references, malformed globs, and shadowed files.

```json
{
  "schemaVersion": 1,
  "command": "conflicts",
  "profile": "all",
  "repositoryRoot": "/repo",
  "diagnostics": [
    {
      "id": "ARM006_STALE_PATH_REFERENCE",
      "severity": "warning",
      "title": "Stale Path Reference",
      "message": "Referenced path \"src/legacy/api.ts\" does not exist in this repository.",
      "sourcePath": "AGENTS.md",
      "remediation": "Update or remove reference to the nonexistent file or directory."
    }
  ],
  "summary": {
    "total": 1,
    "errors": 0,
    "warnings": 1,
    "info": 0
  }
}
```

### 2. Changed Files Report (`agentrulemap changed --base main --json`)
Emits mapping of git-changed files to governing instruction stacks, scope summaries, and diff impact.

```json
{
  "schemaVersion": 1,
  "command": "changed",
  "repositoryRoot": "/repo",
  "comparison": {
    "type": "base",
    "base": "main",
    "description": "Working tree compared to Git base \"main\""
  },
  "summary": {
    "totalChanged": 2,
    "added": 1,
    "modified": 1,
    "deleted": 0,
    "renamed": 0,
    "copied": 0,
    "instructionFilesChanged": 0,
    "instructionSourcesInvolved": { "codex": 2, "copilot": 1 },
    "distinctScopes": { "codex": 2, "copilot": 1 }
  },
  "changedInstructionFiles": [],
  "scopeSummary": {
    "codex": {
      "profile": "codex",
      "distinctScopes": ["/", "src"],
      "multipleScopesDetected": true
    }
  },
  "files": [
    {
      "status": "modified",
      "path": "src/api/users.ts",
      "isInstructionFile": false,
      "profiles": {
        "codex": {
          "profile": "codex",
          "profileName": "Codex / Autonomous Coding Agent",
          "matchedSources": ["AGENTS.md", "src/AGENTS.md"],
          "scopeChain": ["/", "src"]
        }
      }
    }
  ],
  "diagnostics": []
}
```

### 3. Resolution Report (`agentrulemap explain <path> --json`)
Emits the calculated active instruction stack for a single target file, including matched and rejected instruction candidates.

---

## Ordering Guarantees

AgentRuleMap guarantees deterministic output:
1. **Diagnostics Sorting**: Sorted first by severity (`error` -> `warning` -> `info`), then alphabetically by `id`, `sourcePath`, `targetPath`, `line`, and `message`.
2. **Instruction Stack Sorting**: Stack layers are consistently ordered by ascending specificity (`score`), placing broad root baselines first (Layer 0) and specific directory/file patterns at the top (Layer N).
3. **Files Sorting**: Changed file lists are sorted lexicographically by POSIX relative path.

---

## Backward-Compatibility Expectations

- Additive property additions (new optional fields in diagnostics or metadata) may occur in minor versions.
- Removal or renaming of fields, change of severity values, or modification of diagnostic IDs will require a major version and an update to `schemaVersion`.
