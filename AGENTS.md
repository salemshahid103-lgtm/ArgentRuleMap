# AGENTS.md - Instructions for AI Coding Agents

## Project Overview
- **Name**: agentready
- **Description**: Rule-based CLI tool to analyze software repositories and verify readiness for AI coding agents
- **Detected Stack**: nodejs, typescript, react, vite

## Repository Structure
Key directories in this codebase:
- `src/`: Primary application source code
- `tests/`: Automated unit and integration test suites
- `bin/`: bin directory

## Development Setup
1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify environment configuration:
   - Copy `.env.example` to `.env` if present.
   - Never commit private secrets or credentials.

## Build Commands
```bash
npm run build
```

## Test Commands
Run the automated test suite before proposing changes:
```bash
npm test
```

## Lint & Quality Verification
Verify static analysis and formatting:
```bash
npm run lint
```

## Coding Guidelines
- **TypeScript**: Strict mode enabled. Avoid arbitrary `any` types; declare explicit interfaces.
- **Modularity**: Keep modules focused and avoid oversized multi-responsibility files.
- **Clean Architecture**: Place reusable utilities in appropriate subdirectories.
- **Verification**: Always run tests and type checking after modifying code.

## Important Files
- `package.json`: Project manifest, scripts, and dependency definitions.
- `tsconfig.json`: TypeScript compiler options and path aliases.
- `README.md`: High-level human documentation.
- `.gitignore`: Git exclusion rules.

## Safety Rules
- **Secrets**: Never commit `.env`, API keys, private certificates, or session tokens.
- **Destructive Actions**: Do not delete critical configuration files or force-push without confirmation.
- **Command Safety**: Do not run arbitrary shell scripts without explicit user review.
