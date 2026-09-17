# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `1.x` | Yes |
| `< 1.0` | No |

---

## Reporting a Vulnerability

The AgentRuleMap maintainers take repository security and local data handling seriously. Because AgentRuleMap inspects local files and git history in developer and CI environments, maintaining strict boundaries and safe parsing is paramount.

If you discover a security vulnerability in AgentRuleMap (such as path traversal, unintended file read, or denial-of-service via malformed files):

1. **Do NOT report the issue publicly** on public GitHub issues, discussions, or social media.
2. Submit a report privately via **GitHub Private Vulnerability Reporting** on the repository, or email:
   `HUMAN_REQUIRED: security@example.com`

Please include:
- A description of the vulnerability and its potential impact.
- Steps to reproduce or a minimal proof-of-concept repository fixture.
- Affected versions or commits.

### Response Timeline
- **Initial Acknowledgment**: Within 48 business hours.
- **Triage & Assessment**: Within 5 business days.
- **Patch & Advisory**: Coordinated disclosure following standard CVE/GHSA procedures.

---

## Security Guarantees & Constraints

- **No Code Execution**: AgentRuleMap statically parses markdown files and JSON manifests. It never executes arbitrary code or scripts found in repositories.
- **Offline-First**: The core analysis runs entirely locally without sending source code or tokens to any external server.
- **Boundary Checks**: All path resolutions strictly prevent escaping the repository root directory.
