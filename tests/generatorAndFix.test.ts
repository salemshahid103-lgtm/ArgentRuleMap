import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAgentsTemplate } from '../src/generators/agentDocGenerator.js';
import { scanRepository } from '../src/scanners/fileScanner.js';
import { runFixCommand } from '../src/commands/fixCommand.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AGENTS.md Generator & Fixer', () => {
  it('generates a complete AGENTS.md template with real repo data', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const context = scanRepository(fixturePath);
    const template = generateAgentsTemplate(context);

    expect(template).toContain('# AGENTS.md');
    expect(template).toContain('Project Overview');
    expect(template).toContain('valid-fixture');
    expect(template).toContain('Build Commands');
    expect(template).toContain('npm run build');
    expect(template).toContain('Test Commands');
    expect(template).toContain('npm test');
    expect(template).toContain('Safety Rules');
  });

  it('runs fix in dry-run mode without mutating files', () => {
    const fixturePath = path.join(__dirname, 'fixtures/broken-paths-repo');
    const fixResult = runFixCommand({
      cwd: fixturePath,
      dryRun: true,
    });

    expect(fixResult.actionsProposed).toBeGreaterThanOrEqual(1);
    expect(fixResult.actionsApplied).toBe(0);
  });
});
