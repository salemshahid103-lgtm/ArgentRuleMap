# Contributing to AgentRuleMap

Thank you for your interest in contributing to AgentRuleMap! We welcome contributions that improve AI coding-agent instruction discovery, scoping precision, diagnostics, and developer workflows.

---

## Quick Reference

- **Full Contributing Guide**: Please read [`docs/contributing-guide.md`](docs/contributing-guide.md) for full architectural guidelines, development setup, and code patterns.
- **Adding a Profile Adapter**: See [`docs/adding-a-profile.md`](docs/adding-a-profile.md).
- **Security Policy**: See [`SECURITY.md`](SECURITY.md).
- **Code of Conduct**: See [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

---

## Development Setup

```bash
# 1. Clone repository
git clone https://github.com/agentrulemap/agentrulemap.git
cd agentrulemap

# 2. Install dependencies
npm install

# 3. Run test suites
npm test

# 4. Run type checker
npm run typecheck

# 5. Run the deterministic demo
npm run demo

# 6. Build the CLI and Action binaries
npm run build
```

---

## Ground Rules

1. **Zero External AI / Zero Telemetry**: AgentRuleMap core analysis runs 100% offline and locally. Never introduce outbound network dependencies into the core engine.
2. **Determinism**: Outputs must remain predictable and reproducible across environments.
3. **Repository Boundaries**: Always enforce path sanitization and boundary checks.
4. **Modularity & Types**: Maintain strict TypeScript typing; avoid `any`.

---

## Submitting Pull Requests

1. Fork the repository and create a branch: `git checkout -b feat/your-feature`.
2. Ensure `npm test`, `npm run typecheck`, and `npm run demo` pass cleanly.
3. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
4. Open a pull request describing your changes and verification steps.
