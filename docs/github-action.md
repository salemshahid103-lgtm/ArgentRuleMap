# AgentRuleMap GitHub Action

AgentRuleMap provides an official, zero-dependency composite GitHub Action (`action.yml`) that analyzes incoming pull requests and commits in CI to verify AI coding-agent instruction health, compute change impact, and report actionable findings.

---

## Features

- **Automatic Base Branch Detection**: Resolves comparison base ref automatically using `GITHUB_BASE_REF` or PR event payloads.
- **Shallow Clone Defense**: Detects `fetch-depth: 1` shallow clones and outputs clear instructions to set `fetch-depth: 0`.
- **Rich GitHub Step Summaries**: Writes markdown tables of changed instruction files, governing scopes, and reproduction CLI commands to `$GITHUB_STEP_SUMMARY`.
- **Sticky PR Comments**: Posts or updates a single markdown comment on pull requests with `pr-comment: true`.
- **SARIF 2.1.0 Code Scanning**: Emits SARIF logs for integration with GitHub Advanced Security / Code Scanning.
- **Strict Failure Modes**: Configurable failure thresholds (`fail-on: error`, `warning`, or `never`).

---

## Quick Example Workflow

Create `.github/workflows/agent-rules.yml`:

```yaml
name: Agent Instructions Check

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write # Required only if pr-comment: true
  security-events: write # Required only if uploading SARIF

jobs:
  agent-rules:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Full history required for git diff comparisons

      - name: Run AgentRuleMap Action
        uses: ./ # Or agentrulemap/agentrulemap-action@v1 once published
        with:
          profile: 'all'
          fail-on: 'error'
          output: 'summary'
          sarif-file: 'agentrulemap.sarif'
          pr-comment: true
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload SARIF report to GitHub Code Scanning
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: agentrulemap.sarif
          category: agentrulemap
```

---

## Action Inputs

| Input | Description | Default | Allowed Values |
|---|---|---|---|
| `base` | Target branch or commit ref to compare against | Auto-detected from PR base | Any git ref (e.g. `main`, `HEAD~1`) |
| `profile` | Target agent ecosystem | `all` | `codex`, `copilot`, `gemini`, `generic`, `all` |
| `fail-on` | Severity threshold that causes job failure | `error` | `error`, `warning`, `never` |
| `output` | Summary reporting mode | `summary` | `summary`, `sarif`, `json` |
| `sarif-file` | File path to write SARIF 2.1.0 log | `agentrulemap.sarif` | Any relative file path |
| `pr-comment` | Post sticky comment on pull requests | `false` | `true`, `false` |
| `github-token` | Token for PR commenting | `${{ github.token }}` | GitHub API token |
| `cwd` | Working directory to analyze | `.` | Directory path |

---

## Action Outputs

| Output | Description |
|---|---|
| `changed-files` | Count of files changed in the git comparison |
| `instruction-sources` | Count of instruction files governing changed files |
| `error-count` | Number of error-level diagnostics detected |
| `warning-count` | Number of warning-level diagnostics detected |
| `profiles` | Comma-separated list of evaluated profiles |
| `sarif-file` | Path where the SARIF report was written |

---

## Git Shallow Clone Notice

> **Important**: When running in GitHub Actions, `actions/checkout` defaults to `fetch-depth: 1` (shallow clone). Because AgentRuleMap compares changed files against the target base branch (e.g., `origin/main`), you **must** specify `fetch-depth: 0` in your checkout step.
>
> If a shallow clone is detected, AgentRuleMap emits a diagnostic and provides clear instructions.
