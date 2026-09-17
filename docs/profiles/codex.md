# Codex Profile (`codex`)

The `codex` profile models instructions for autonomous AI coding agents operating across modern repositories.

---

## Supported Instruction Files

| File | Scope Kind | Precedence Priority |
|---|---|---|
| `AGENTS.md` (root) | Repository-wide | Baseline (`depth = 0`, `score = 0`) |
| `AGENTS.md` (nested in subdirectory) | Directory-scoped | `depth * 100` |
| `AGENTS.override.md` (nested or root) | Explicit override | `depth * 100 + 10` |

---

## Scoping & Specificity Mechanics

1. **Root Baseline**:
   An `AGENTS.md` at the repository root applies to all files in the repository unless explicitly overridden.

2. **Hierarchical Directory Scoping**:
   Nested `AGENTS.md` files (e.g. `packages/auth/AGENTS.md`) apply only to files residing within that directory or its subdirectories.
   - When resolving `packages/auth/src/token.ts`, the active stack includes:
     - Layer 0: Root `AGENTS.md` (depth 0, specificity 0)
     - Layer 1: `packages/auth/AGENTS.md` (depth 2, specificity 200)

3. **Overrides (`AGENTS.override.md`)**:
   An `AGENTS.override.md` in the same directory shadows standard `AGENTS.md` in that directory and receives a +10 priority boost, indicating explicit precedence.

---

## Limitations

- Does not attempt to reconcile contradictory natural-language directives inside markdown text.
- Client-side system prompt customizations set in user-level configuration files outside the repository are not analyzed.
