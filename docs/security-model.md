# AgentRuleMap Security Model

AgentRuleMap is designed with an offline-first, read-only static analysis security model. Because it is intended to run both on local developer machines and in continuous integration (CI) pipelines, it operates under strict safety constraints.

---

## Core Security Guarantees

1. **Zero Code Execution**:
   AgentRuleMap never executes code, scripts, or instructions found in scanned repositories.
   - It reads Markdown files as plain text and parses YAML frontmatter with strict, non-executable parsers.
   - It verifies that script names exist in `package.json` through static JSON inspection; it never executes `npm test`, `npm run build`, or any shell commands found in documentation.

2. **Offline-First & Zero Network Access**:
   All core analysis—including instruction discovery, scope resolution, conflict detection, coverage calculation, and git diff mapping—runs entirely locally.
   - Zero outbound HTTP/HTTPS requests.
   - Zero telemetry, tracking, or usage beacons.
   - Zero AI model API calls (e.g., OpenAI, Google Gemini, Anthropic). No tokens or repository data are ever sent over the network.

3. **Repository Boundary Enforcement**:
   AgentRuleMap treats the repository root as a strict trust boundary:
   - **Path Traversal Prevention**: Target paths containing `..` or attempting to resolve files outside the repository root are rejected immediately with diagnostic `ARM009_PATH_OUTSIDE_REPOSITORY`.
   - **Symlink Escape Defense**: Symlinks pointing outside the repository root boundary are detected and flagged with `ARM010_SYMLINK_ESCAPE`.
   - **Cyclic Symlink Defense**: Recursive circular symlinks are trapped and flagged with `ARM014_CYCLIC_SYMLINK` to prevent infinite loops.

4. **Resource Exhaustion Defense**:
   - To guard against memory exhaustion or denial-of-service from maliciously large generated instruction files, files exceeding 1 MB (1,048,576 bytes) are skipped with diagnostic `ARM020_OVERSIZED_INSTRUCTION_FILE`.
   - All child processes (`git status`, `git diff`) have bounded execution timeouts (max 10,000ms) and output buffer limits.

---

## Known Security Limitations

- **Natural Language Parsing**: AgentRuleMap does not evaluate whether natural-language instructions in Markdown pose prompt-injection risks or recommend dangerous development actions.
- **Pre-Commit / Uncommitted State**: When analyzing working trees, AgentRuleMap reads whatever files currently exist on disk in the local workspace.
- **Read Permissions**: Files that cannot be read due to operating system file permissions (`chmod 000`) will emit `ARM013_UNREADABLE_SOURCE`.
