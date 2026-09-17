import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeRepository, calculateReadinessLabel } from '../src/core/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Score Calculation & Labels', () => {
  it('correctly maps scores to readiness labels', () => {
    expect(calculateReadinessLabel(100)).toBe('EXCELLENT');
    expect(calculateReadinessLabel(90)).toBe('EXCELLENT');
    expect(calculateReadinessLabel(89)).toBe('GOOD');
    expect(calculateReadinessLabel(75)).toBe('GOOD');
    expect(calculateReadinessLabel(74)).toBe('NEEDS IMPROVEMENT');
    expect(calculateReadinessLabel(50)).toBe('NEEDS IMPROVEMENT');
    expect(calculateReadinessLabel(49)).toBe('NOT READY');
    expect(calculateReadinessLabel(0)).toBe('NOT READY');
  });

  it('calculates a high score (GOOD or EXCELLENT) for valid-fixture repository', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const result = analyzeRepository(fixturePath);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(['GOOD', 'EXCELLENT']).toContain(result.readinessLabel);

    expect(result.categories.agent_instructions.score).toBe(30);
    expect(result.categories.build_test.score).toBe(25);
    expect(result.categories.instruction_accuracy.score).toBe(20);
    expect(result.categories.security.score).toBe(10);
    expect(result.categories.repo_structure.score).toBe(15);
  });

  it('penalizes security and instruction risks', () => {
    const fixturePath = path.join(__dirname, 'fixtures/security-risk-repo');
    const result = analyzeRepository(fixturePath);

    expect(result.categories.security.score).toBeLessThan(10);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
