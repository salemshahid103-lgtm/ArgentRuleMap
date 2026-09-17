import path from 'node:path';
import type { RepoPackageJson, RepoType } from '../types/index.js';
import { fileExists } from '../utils/fsUtils.js';

export function detectRepoTypes(
  rootDir: string,
  rootFiles: string[],
  packageJson?: RepoPackageJson
): RepoType[] {
  const types = new Set<RepoType>();

  const hasFile = (name: string) => rootFiles.includes(name) || fileExists(path.join(rootDir, name));

  const allDeps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };

  // Node.js
  if (hasFile('package.json')) {
    types.add('nodejs');
  }

  // TypeScript
  if (
    hasFile('tsconfig.json') ||
    'typescript' in allDeps ||
    rootFiles.some((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
  ) {
    types.add('typescript');
  }

  // JavaScript
  if (hasFile('package.json') && (!types.has('typescript') || rootFiles.some((f) => f.endsWith('.js') || f.endsWith('.mjs')))) {
    types.add('javascript');
  }

  // React
  if ('react' in allDeps || rootFiles.some((f) => f.endsWith('.jsx') || f.endsWith('.tsx'))) {
    types.add('react');
  }

  // Next.js
  if (
    'next' in allDeps ||
    hasFile('next.config.js') ||
    hasFile('next.config.mjs') ||
    hasFile('next.config.ts')
  ) {
    types.add('nextjs');
  }

  // Vite
  if (
    'vite' in allDeps ||
    hasFile('vite.config.js') ||
    hasFile('vite.config.mjs') ||
    hasFile('vite.config.ts')
  ) {
    types.add('vite');
  }

  // Python
  if (
    hasFile('pyproject.toml') ||
    hasFile('requirements.txt') ||
    hasFile('Pipfile') ||
    hasFile('setup.py') ||
    rootFiles.some((f) => f.endsWith('.py'))
  ) {
    types.add('python');
  }

  if (types.size === 0) {
    return ['unknown'];
  }

  return Array.from(types);
}
