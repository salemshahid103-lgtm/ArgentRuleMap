# Gemini Profile (`gemini`)

The `gemini` profile models instruction conventions used by Google Gemini CLI and associated tooling.

---

## Supported Instruction Files

| File | Scope Kind | Precedence Priority |
|---|---|---|
| `GEMINI.md` (root) | Repository-wide | Baseline (`depth = 0`, `score = 0`) |
| `GEMINI.md` (nested in subdirectory) | Directory-scoped | `depth * 100` |

---

## Scoping & Specificity Mechanics

1. **Hierarchical Directory Discovery**:
   Similar to nested AGENTS, `GEMINI.md` files placed in subdirectories apply contextually to files within that subtree.
   Root `GEMINI.md` provides global architectural guidelines, while nested files provide localized component or package conventions.

2. **Resolution Ordering**:
   Resolved stacks place root `GEMINI.md` at Layer 0 and nested instructions at higher layers ordered by directory depth.

---

## Limitations

- Local user Gemini configuration files (such as `~/.gemini/config`) outside the repository are not analyzed.
