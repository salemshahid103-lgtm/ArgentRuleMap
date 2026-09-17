import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectRepoTypes } from '../src/scanners/repoTypeScanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Repository Type Detection', () => {
  it('detects TypeScript, React, and Node.js in valid fixture', () => {
    const fixturePath = path.join(__dirname, 'fixtures/valid-repo');
    const types = detectRepoTypes(fixturePath, ['package.json', 'tsconfig.json'], {
      name: 'valid-fixture',
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });

    expect(types).toContain('nodejs');
    expect(types).toContain('typescript');
    expect(types).toContain('react');
  });

  it('detects Python repositories', () => {
    const fixturePath = path.join(__dirname, 'fixtures/python-repo');
    const types = detectRepoTypes(fixturePath, ['pyproject.toml', 'requirements.txt', 'main.py']);
    expect(types).toContain('python');
  });

  it('returns unknown for an unrecognized empty directory', () => {
    const types = detectRepoTypes('/tmp', []);
    expect(types).toEqual(['unknown']);
  });

  it('detects Next.js and Vite', () => {
    const nextTypes = detectRepoTypes('/app', ['next.config.js'], {
      dependencies: { next: '14.0.0' },
    });
    expect(nextTypes).toContain('nextjs');

    const viteTypes = detectRepoTypes('/app', ['vite.config.ts'], {
      dependencies: { vite: '^5.0.0' },
    });
    expect(viteTypes).toContain('vite');
  });
});
