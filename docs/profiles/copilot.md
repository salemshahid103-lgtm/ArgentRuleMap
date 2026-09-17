# GitHub Copilot Profile (`copilot`)

The `copilot` profile models instructions for GitHub Copilot Workspace, Copilot Chat, and custom instruction repositories.

---

## Supported Instruction Files

| File | Scope Kind | Precedence Priority |
|---|---|---|
| `.github/copilot-instructions.md` | Repository-wide | Baseline (`score = 0`) |
| `.github/instructions/*.instructions.md` | Path-specific (glob) via YAML frontmatter | High specificity (`score = 50`) |

---

## Scoping & Specificity Mechanics

1. **Repository-Wide Instructions**:
   `.github/copilot-instructions.md` applies to all conversations and file edits in the repository.

2. **Scoped Instruction Files**:
   Files in `.github/instructions/` named `*.instructions.md` define an `applyTo` field in YAML frontmatter:
   ```markdown
   ---
   applyTo: "src/api/**/*.ts"
   ---
   # Backend Guidelines
   - Use strict request typing.
   ```
   - AgentRuleMap validates the `applyTo` glob pattern.
   - If the target path matches the glob, the instruction file is included in the effective stack with specificity score 50.
   - If `applyTo` is empty or invalid, diagnostic `ARM002_INVALID_GLOB` or `ARM003_EMPTY_SCOPE` is emitted.

---

## Limitations

- Non-standard file extensions in `.github/instructions/` (e.g. `.txt` or `.md` without `.instructions.md`) are not recognized by Copilot.
- Complex brace expansions in `applyTo` are evaluated according to standard glob semantics.
