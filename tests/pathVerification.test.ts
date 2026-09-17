import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepository } from '../src/scanners/fileScanner.js';
import { runInstructionAccuracyRule } from '../src/rules/instructionAccuracyRule.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Path Verification', () => {
  it('passes when referenced paths actually exist on disk', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const context = scanRepository(fixturePath);
    const result = runInstructionAccuracyRule(context);

    const pathCheck = result.checks.find((c) => c.id === 'instruction-accuracy-paths');
    expect(pathCheck).toBeDefined();
    expect(pathCheck?.status).toBe('pass');
    expect(pathCheck?.pointsAwarded).toBe(10);
  });

  it('detects and reports broken paths that do not exist', () => {
    const fixturePath = path.join(__dirname, 'fixtures/broken-paths-repo');
    const context = scanRepository(fixturePath);
    const result = runInstructionAccuracyRule(context);

    const pathCheck = result.checks.find((c) => c.id === 'instruction-accuracy-paths');
    expect(pathCheck).toBeDefined();
    expect(pathCheck?.status).toBe('warn');
    expect(result.warnings.some((w) => w.includes('src/api') && w.includes('does not exist'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('components/Modal.tsx') && w.includes('does not exist'))).toBe(true);
  });
});
