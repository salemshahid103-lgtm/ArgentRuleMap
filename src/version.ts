import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __PACKAGE_VERSION__: string | undefined;

/**
 * Resolves the AgentRuleMap package version dynamically.
 * Uses compile-time define if injected by esbuild, or safely reads package.json at runtime.
 */
export function getVersion(): string {
  if (typeof __PACKAGE_VERSION__ !== 'undefined' && __PACKAGE_VERSION__) {
    return __PACKAGE_VERSION__;
  }

  try {
    const filename = fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);
    const candidatePaths = [
      path.resolve(dirname, '../package.json'),
      path.resolve(dirname, '../../package.json'),
      path.resolve(dirname, './package.json'),
      path.resolve(process.cwd(), 'package.json'),
    ];

    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        const pkg = JSON.parse(fs.readFileSync(cand, 'utf8'));
        if (pkg.name === 'agentrulemap' && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch {
    // Fallback if filesystem read is restricted
  }

  return '0.1.0';
}
