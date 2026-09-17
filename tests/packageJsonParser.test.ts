import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepository } from '../src/scanners/fileScanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('package.json and File Scanner Parsing', () => {
  it('parses scripts and dependencies correctly from package.json', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const context = scanRepository(fixturePath);

    expect(context.packageJson).toBeDefined();
    expect(context.packageJson?.name).toBe('valid-fixture');
    expect(context.packageJson?.scripts?.build).toBe('tsc');
    expect(context.packageJson?.scripts?.test).toBe('vitest run');
    expect(context.packageJson?.scripts?.lint).toBe('eslint .');
    expect(context.packageJson?.dependencies?.react).toBe('^18.0.0');
    expect(context.hasTsConfig).toBe(true);
    expect(context.hasGitignore).toBe(true);
  });

  it('handles repositories without package.json gracefully', () => {
    const fixturePath = path.join(__dirname, 'fixtures/python-repo');
    const context = scanRepository(fixturePath);

    expect(context.packageJson).toBeUndefined();
    expect(context.detectedTypes).toContain('python');
    expect(context.name).toBe('python-repo');
  });
});
