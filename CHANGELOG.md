# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-17

### Added
- **Core Instruction Discovery**: Filesystem scanners supporting `AGENTS.md`, nested `AGENTS.md`, `AGENTS.override.md`, `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, and `GEMINI.md`.
- **Profile-Aware Scope Resolution**: Deterministic specificity scoring engine (`codex`, `copilot`, `gemini`, `generic`) calculating layered instruction stacks for target paths.
- **Commands**:
  - `agentrulemap scan` / `discover`: Discovers all instruction sources and prints metadata.
  - `agentrulemap explain` / `trace`: Resolves the effective instruction stack and explains inclusion/exclusion provenance.
  - `agentrulemap conflicts`: Static audit engine detecting broken paths, missing package scripts, malformed globs, and empty scopes.
  - `agentrulemap coverage`: Computes repository-wide and path-specific instruction coverage maps.
  - `agentrulemap changed`: Maps git diffs and pull request changes to governing instruction stacks.
- **GitHub Action**: Reusable composite action (`action.yml`) with automatic base branch detection, step summary tables, PR commenting, and SARIF export.
- **Reporting**:
  - Colored, accessible terminal output with Chalk.
  - Formal machine-readable JSON reports matching `schema/agentrulemap-report.schema.json`.
  - OASIS SARIF 2.1.0 output for GitHub Code Scanning integration.
- **Offline & Security Model**: Zero AI API calls, zero telemetry, zero code execution, boundary traversal checks, and symlink escape defenses.
- **Examples**: Reference repositories for basic setups, nested agents, Copilot scoped rules, monorepos, and diagnostic conflict reproduction (`examples/`).
