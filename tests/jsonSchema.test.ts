import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { ConflictEngine } from '../src/diagnostics/conflictEngine.js';
import { CoverageEngine } from '../src/coverage/coverageEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('JSON Schema and Report Validation', () => {
  it('loads and verifies formal JSON schema definition file', () => {
    const schemaPath = path.join(rootDir, 'schema/agentrulemap-report.schema.json');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const raw = fs.readFileSync(schemaPath, 'utf8');
    const parsed = JSON.parse(raw);

    expect(parsed.$schema).toContain('json-schema.org');
    expect(parsed.$defs).toBeDefined();
    expect(parsed.$defs.Diagnostic).toBeDefined();
    expect(parsed.$defs.ConflictReport).toBeDefined();
    expect(parsed.$defs.ChangedReport).toBeDefined();
    expect(parsed.$defs.CoverageReport).toBeDefined();
  });

  it('validates conflicts report structure against schema definition', () => {
    const fixtureDir = path.join(rootDir, 'examples/broken-repo');
    const engine = new InstructionEngine({ rootDir: fixtureDir });
    const conflictEngine = new ConflictEngine(engine);
    const report = conflictEngine.runConflicts({ profile: 'all' });

    expect(report.schemaVersion).toBe(1);
    expect(report.command).toBe('conflicts');
    expect(report.repositoryRoot).toBe(fixtureDir);
    expect(Array.isArray(report.diagnostics)).toBe(true);
    expect(report.summary).toHaveProperty('total');
    expect(report.summary).toHaveProperty('errors');
    expect(report.summary).toHaveProperty('warnings');
    expect(report.summary).toHaveProperty('info');

    for (const d of report.diagnostics) {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('severity');
      expect(d).toHaveProperty('message');
      expect(['info', 'warning', 'error']).toContain(d.severity);
    }
  });

  it('validates coverage report structure against schema definition', () => {
    const fixtureDir = path.join(rootDir, 'examples/basic');
    const engine = new InstructionEngine({ rootDir: fixtureDir });
    const coverageEngine = new CoverageEngine(engine);
    const report = coverageEngine.generateCoverage('codex');

    expect(report.schemaVersion).toBe(1);
    expect(report.command).toBe('coverage');
    expect(report.repositoryRoot).toBe(fixtureDir);
    expect(report.profiles).toHaveProperty('codex');
    expect(report.profiles.codex.repositoryWide).toContain('AGENTS.md');
  });

  it('validates resolution report structure against schema definition', () => {
    const fixtureDir = path.join(rootDir, 'examples/basic');
    const engine = new InstructionEngine({ rootDir: fixtureDir });
    const resolution = engine.resolve('src/index.ts', 'codex');

    expect(resolution).toHaveProperty('targetPath');
    expect(resolution).toHaveProperty('profile', 'codex');
    expect(Array.isArray(resolution.matchedSources)).toBe(true);
    expect(Array.isArray(resolution.rejectedSources)).toBe(true);
    expect(resolution).toHaveProperty('stack');
    expect(Array.isArray(resolution.stack.layers)).toBe(true);
    expect(Array.isArray(resolution.diagnostics)).toBe(true);
  });
});
