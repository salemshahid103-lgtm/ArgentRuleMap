import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { analyzeRepository } from '../src/core/engine.js';
import { formatJsonReport } from '../src/reporters/jsonReporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AnalysisResultSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  repository: z.object({
    name: z.string(),
    path: z.string(),
    detectedTypes: z.array(z.string()),
    instructionFiles: z.array(z.string()),
    structure: z.object({
      importantDirs: z.record(z.string(), z.string()),
      totalFiles: z.number(),
    }),
  }),
  score: z.number().min(0).max(100),
  readinessLabel: z.enum(['EXCELLENT', 'GOOD', 'NEEDS IMPROVEMENT', 'NOT READY']),
  categories: z.record(
    z.string(),
    z.object({
      label: z.string(),
      score: z.number(),
      maxScore: z.number(),
    })
  ),
  checks: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      name: z.string(),
      description: z.string(),
      status: z.enum(['pass', 'warn', 'fail', 'info']),
      message: z.string(),
      pointsAwarded: z.number(),
      pointsPossible: z.number(),
    })
  ),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});

describe('JSON Reporter & Schema Validation', () => {
  it('formats valid JSON compliant with CI systems schema', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const result = analyzeRepository(fixturePath);
    const jsonStr = formatJsonReport(result);

    const parsed = JSON.parse(jsonStr);
    const validation = AnalysisResultSchema.safeParse(parsed);

    expect(validation.success).toBe(true);
  });
});
