import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { CoverageEngine, formatCoverageText } from '../src/coverage/coverageEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

describe('AgentRuleMap Coverage Engine', () => {
  it('discovers repository-wide, nested instruction scopes, and coverage boundaries', () => {
    const repoDir = path.join(fixturesDir, 'fixture-s-coverage-boundaries');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const coverageEngine = new CoverageEngine(engine);

    const fullReport = coverageEngine.generateCoverage('codex');
    const codexReport = fullReport.profiles.codex;

    expect(codexReport).toBeDefined();
    expect(codexReport.profile).toBe('codex');

    // Repository wide instruction
    expect(codexReport.repositoryWide).toContain('AGENTS.md');

    // Nested scope
    expect(codexReport.nestedScopes.some((s) => s.filePath === 'src/api/AGENTS.md')).toBe(true);

    // Check discovered areas
    const apiArea = codexReport.areas.find((a) => a.directory.includes('src/api'));
    expect(apiArea).toBeDefined();
    expect(apiArea?.status).toBe('nested');
    expect(apiArea?.statusLabel).toContain('nested instructions');

    const uiArea = codexReport.areas.find((a) => a.directory.includes('src/ui'));
    expect(uiArea).toBeDefined();
    expect(uiArea?.status).toBe('root');
    expect(uiArea?.statusLabel).toContain('root instructions only');

    // Text format verification
    const formatted = formatCoverageText(codexReport);
    expect(formatted).toContain('AgentRuleMap Coverage');
    expect(formatted).toContain('Profile: codex');
    expect(formatted).toContain('Repository-wide:');
    expect(formatted).toContain('AGENTS.md');
    expect(formatted).toContain('Nested instruction scopes:');
    expect(formatted).toContain('Source areas discovered:');
    expect(formatted).toContain('src/api/');
    expect(formatted).toContain('src/ui/');
  });

  it('reports gaps neutrally without marketing percentages or fake scores', () => {
    // Test a directory with uncovered areas
    const repoDir = path.join(fixturesDir, 'fixture-s-coverage-boundaries');
    const engine = new InstructionEngine({ rootDir: repoDir });
    const coverageEngine = new CoverageEngine(engine);

    const fullReport = coverageEngine.generateCoverage('copilot');
    const copilotReport = fullReport.profiles.copilot;

    // In fixture-s, copilot has no instructions at all
    expect(copilotReport.gaps.length).toBeGreaterThan(0);
    const text = formatCoverageText(copilotReport);
    expect(text).not.toContain('%');
    expect(text).not.toContain('AI-ready');
    expect(text).toContain('no discovered instruction scope');
  });
});
