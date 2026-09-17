import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { ConflictEngine } from '../src/diagnostics/conflictEngine.js';
import { sortDiagnostics } from '../src/diagnostics/registry.js';
import type { Diagnostic } from '../src/diagnostics/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

describe('AgentRuleMap Conflict & Diagnostics Engine', () => {
  // 1. Stale path reference detection (ARM006)
  it('detects stale path references while ignoring valid paths and external URLs', () => {
    const repoDir = path.join(fixturesDir, 'fixture-m-conflicts-stale-path');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'codex' });

    const staleFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM006_STALE_PATH_REFERENCE'
    );

    // Should detect missing-guide.md and service.ts
    expect(staleFindings.length).toBe(2);

    const missingDoc = staleFindings.find((d) =>
      d.message.includes('docs/missing-guide.md')
    );
    expect(missingDoc).toBeDefined();
    expect(missingDoc?.line).toBe(7);

    const missingCode = staleFindings.find((d) =>
      d.message.includes('src/nonexistent/service.ts')
    );
    expect(missingCode).toBeDefined();
    expect(missingCode?.line).toBe(8);

    // Must NOT flag valid src/index.ts or https://google.com or code keywords
    const invalidFlag = staleFindings.find(
      (d) =>
        d.message.includes('src/index.ts') ||
        d.message.includes('google.com') ||
        d.message.includes('react')
    );
    expect(invalidFlag).toBeUndefined();
  });

  // 2. Missing package.json script validation (ARM007)
  it('detects unmapped npm scripts while recognizing valid commands', () => {
    const repoDir = path.join(fixturesDir, 'fixture-n-conflicts-missing-script');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'codex' });

    const scriptFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM007_MISSING_PACKAGE_SCRIPT'
    );

    // Should flag missing 'lint' and 'format', but NOT 'build' or 'test'
    expect(scriptFindings.length).toBe(2);

    const lintFinding = scriptFindings.find((d) =>
      (d.details as { script?: string })?.script === 'lint'
    );
    expect(lintFinding).toBeDefined();
    expect(lintFinding?.line).toBe(10);
    expect(lintFinding?.remediation).toBeDefined();

    const formatFinding = scriptFindings.find((d) =>
      (d.details as { script?: string })?.script === 'format'
    );
    expect(formatFinding).toBeDefined();

    // build & test should NOT be flagged
    expect(
      scriptFindings.some(
        (d) => (d.details as { script?: string })?.script === 'test'
      )
    ).toBe(false);
    expect(
      scriptFindings.some(
        (d) => (d.details as { script?: string })?.script === 'build'
      )
    ).toBe(false);
  });

  // 3. Duplicate Scope detection (ARM004)
  it('detects duplicate scopes between distinct instruction files', () => {
    const repoDir = path.join(fixturesDir, 'fixture-o-conflicts-duplicate-scope');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'copilot' });

    const dupScopeFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM004_DUPLICATE_SCOPE'
    );
    expect(dupScopeFindings.length).toBe(2);
    expect(dupScopeFindings[0].sourcePath).toContain('api');
  });

  // 4. Overlapping Scope detection (ARM011)
  it('detects overlapping scopes when rules match intersecting repository files', () => {
    const repoDir = path.join(fixturesDir, 'fixture-p-conflicts-overlapping-scope');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'copilot' });

    const overlapFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM011_OVERLAPPING_SCOPE'
    );
    expect(overlapFindings.length).toBeGreaterThanOrEqual(1);
    expect(overlapFindings[0].message).toContain('Overlapping instruction scopes');
    expect(overlapFindings[0].message).toContain('src/api/users.ts');
  });

  // 5. Empty Scope (ARM003) and Scope Matching Zero Files (ARM008)
  it('detects empty scopes and scopes matching zero files', () => {
    const repoDir = path.join(fixturesDir, 'fixture-q-conflicts-empty-scope');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'copilot' });

    const emptyFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM003_EMPTY_SCOPE'
    );
    expect(emptyFindings.length).toBe(1);

    const noMatchFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM008_SCOPE_MATCHES_NO_FILES'
    );
    expect(noMatchFindings.length).toBe(1);
    expect(noMatchFindings[0].message).toContain('nonexistent-dir');
  });

  // 6. Duplicate Content detection (ARM005)
  it('identifies identical effective content between different instruction files', () => {
    const repoDir = path.join(fixturesDir, 'fixture-r-conflicts-duplicate-content');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'codex' });

    const dupContentFindings = report.diagnostics.filter(
      (d) => d.id === 'ARM005_DUPLICATE_CONTENT'
    );
    expect(dupContentFindings.length).toBe(2);
    expect(dupContentFindings[0].severity).toBe('info');
  });

  // 7. Deterministic sorting order test
  it('sorts diagnostics deterministically by severity, id, sourcePath, line, message', () => {
    const unsorted: Diagnostic[] = [
      {
        id: 'ARM007_MISSING_PACKAGE_SCRIPT',
        severity: 'warning',
        title: 'Script',
        message: 'B',
        sourcePath: 'src/b.md',
      },
      {
        id: 'ARM009_PATH_OUTSIDE_REPOSITORY',
        severity: 'error',
        title: 'Error Path',
        message: 'A',
        sourcePath: 'src/a.md',
      },
      {
        id: 'ARM005_DUPLICATE_CONTENT',
        severity: 'info',
        title: 'Duplicate',
        message: 'C',
        sourcePath: 'src/c.md',
      },
      {
        id: 'ARM006_STALE_PATH_REFERENCE',
        severity: 'warning',
        title: 'Stale',
        message: 'A',
        sourcePath: 'src/a.md',
      },
    ];

    const sorted = sortDiagnostics(unsorted);

    // Errors first
    expect(sorted[0].severity).toBe('error');
    expect(sorted[0].id).toBe('ARM009_PATH_OUTSIDE_REPOSITORY');

    // Warnings second (ordered by ID)
    expect(sorted[1].severity).toBe('warning');
    expect(sorted[1].id).toBe('ARM006_STALE_PATH_REFERENCE');
    expect(sorted[2].severity).toBe('warning');
    expect(sorted[2].id).toBe('ARM007_MISSING_PACKAGE_SCRIPT');

    // Info last
    expect(sorted[3].severity).toBe('info');
    expect(sorted[3].id).toBe('ARM005_DUPLICATE_CONTENT');
  });

  // 8. Deterministic disclaimer notice
  it('includes deterministic mode notice in reports', () => {
    const repoDir = path.join(fixturesDir, 'fixture-a-root-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts();
    expect(report.deterministicModeNotice).toContain(
      'Potential semantic conflict detection is not performed in deterministic mode'
    );
  });

  // 9. Malformed YAML frontmatter & invalid glob error handling
  it('detects malformed frontmatter and invalid glob patterns', () => {
    const repoDir = path.join(fixturesDir, 'fixture-t-strict-error');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const conflictEngine = new ConflictEngine(engine);

    const report = conflictEngine.runConflicts({ profile: 'copilot', strict: true });

    const frontmatterWarnings = report.diagnostics.filter(
      (d) => d.id === 'ARM001_INVALID_FRONTMATTER'
    );
    expect(frontmatterWarnings.length).toBe(1);
    expect(frontmatterWarnings[0].severity).toBe('warning');

    const globErrors = report.diagnostics.filter(
      (d) => d.id === 'ARM002_INVALID_GLOB'
    );
    expect(globErrors.length).toBe(1);
    expect(globErrors[0].severity).toBe('error');
    expect(report.summary.errors).toBe(1);
  });
});
