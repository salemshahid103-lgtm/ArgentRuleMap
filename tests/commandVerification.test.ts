import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepository } from '../src/scanners/fileScanner.js';
import { runInstructionAccuracyRule } from '../src/rules/instructionAccuracyRule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Command Verification', () => {
  it('passes when commands mentioned in instructions exist in package.json', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const context = scanRepository(fixturePath);
    const result = runInstructionAccuracyRule(context);

    const cmdCheck = result.checks.find((c) => c.id === 'instruction-accuracy-commands');
    expect(cmdCheck).toBeDefined();
    expect(cmdCheck?.status).toBe('pass');
    expect(cmdCheck?.pointsAwarded).toBe(10);
  });

  it('detects unconfigured or missing scripts mentioned in instructions', () => {
    const fixturePath = path.join(__dirname, 'fixtures/broken-paths-repo');
    const context = scanRepository(fixturePath);
    const result = runInstructionAccuracyRule(context);

    const cmdCheck = result.checks.find((c) => c.id === 'instruction-accuracy-commands');
    expect(cmdCheck).toBeDefined();
    expect(cmdCheck?.status).toBe('warn');
    expect(result.warnings.some((w) => w.includes('lint') || w.includes('test:e2e'))).toBe(true);
  });
});
