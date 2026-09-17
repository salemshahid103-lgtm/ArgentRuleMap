# AgentRuleMap Contributing Guide

Thank you for contributing to AgentRuleMap! We welcome contributions that improve the accuracy, performance, security, and developer experience of AI coding-agent instruction analysis.

---

## Development Prerequisites

- **Node.js**: `v18.0.0` or later (tested on Node 18, 20, 22)
- **npm**: `v9.0.0` or later
- **Git**: `v2.30.0` or later

---

## Quick Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/agentrulemap/agentrulemap.git
   cd agentrulemap
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the automated test suite:
   ```bash
   npm test
   ```

4. Run the static type checker:
   ```bash
   npm run typecheck
   ```

5. Run the deterministic demo across example repositories:
   ```bash
   npm run demo
   ```

6. Build the CLI and GitHub Action binaries:
   ```bash
   npm run build
   ```

---

## Core Engineering Principles

- **Zero AI APIs / Zero Network**: Core analysis must execute offline and locally without calling external APIs or uploading user repository code.
- **Deterministic Outcomes**: Given the same filesystem structure, outputs must be identical every run. Do not rely on nondeterministic timestamps or unseeded random values.
- **Fail-Safe Filesystem Access**: All target paths and instruction references must be boundary-checked against directory traversal (`..`) and symlink escapes.
- **Strict Typing**: TypeScript `strict` mode is enabled. Avoid `any` types; declare explicit interfaces.

---

## Adding a New Diagnostic Rule

1. Open `src/diagnostics/registry.ts`.
2. Assign a new stable diagnostic ID following the `ARMxxx` convention.
3. Define its `title`, `defaultSeverity` (`error`, `warning`, `info`), `description`, `trigger`, `example`, `remediation`, and `causesStrictModeFailure`.
4. Implement the detection logic in `src/diagnostics/conflictEngine.ts` or appropriate parser.
5. Document the diagnostic in `docs/diagnostics.md`.
6. Add unit tests in `tests/` covering positive and negative cases.

---

## Adding a New Profile

To add support for a new AI coding agent or instruction specification:
- Review the comprehensive walkthrough in [`docs/adding-a-profile.md`](./adding-a-profile.md).

---

## Pull Request Submission Process

1. Create a feature branch:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Ensure all tests and type checks pass:
   ```bash
   npm run typecheck
   npm test
   npm run demo
   ```
3. Commit using conventional commit format (`feat: ...`, `fix: ...`, `docs: ...`).
4. Push and submit a pull request with a clear description of the change and rationale.
