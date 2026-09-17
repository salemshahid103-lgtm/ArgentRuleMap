# Broken Example Repository

> **NOTICE: THIS REPOSITORY IS INTENTIONALLY BROKEN.**
> It is created specifically for testing and demonstrating AgentRuleMap's diagnostic conflict detection engine.
>
> It intentionally contains:
> - `ARM002_INVALID_GLOB`: Unclosed bracket in `.github/instructions/malformed.instructions.md` (`applyTo: "src/[a-"`).
> - `ARM003_EMPTY_SCOPE`: Empty `applyTo` field in `.github/instructions/empty.instructions.md`.
> - `ARM006_STALE_PATH_REFERENCE`: Reference to nonexistent `src/legacy/auth/old_handler.ts` in `AGENTS.md`.
> - `ARM007_MISSING_PACKAGE_SCRIPT`: Reference to nonexistent `npm run lint:types` in `AGENTS.md`.
