# Generic Profile (`generic`)

The `generic` profile provides an impartial, informational inventory of all recognized AI coding-agent instruction files across the repository.

---

## Supported Instruction Files

The generic profile discovers all files supported across all adapters:
- `AGENTS.md`, `AGENTS.override.md`
- `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`
- `GEMINI.md`
- `CLAUDE.md`
- `.cursorrules`, `.cursor/rules/*.mdc`

---

## Behavior & Design Goals

1. **Informational Inventory**:
   The generic adapter does not assert an authoritative cross-vendor precedence rule between competing standards (e.g. it does not claim `AGENTS.md` takes precedence over `CLAUDE.md` or vice-versa).

2. **Multi-File Discovery**:
   Useful for maintaining an exhaustive inventory of all instruction files present in a monorepo or legacy multi-tool codebase.

3. **Diagnostics & Conflicts**:
   Under `--profile generic`, AgentRuleMap detects cross-standard duplication, conflicting scripts, or broken path references present across any discovered instruction file.
