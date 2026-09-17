import fs from 'node:fs';
import path from 'node:path';
import type { Diagnostic } from '../types/engine.js';
import { normalizePath } from './pathUtils.js';

export interface SymlinkCheckResult {
  isSymlink: boolean;
  safe: boolean;
  realPath?: string;
  relativeRealPath?: string;
  diagnostics: Diagnostic[];
}

/**
 * Checks a file or directory path for symlinks.
 * Verifies that the target resolved by the symlink remains strictly inside the repository root.
 * Detects cyclic symlinks using a visited realpath set.
 */
export function verifySymlinkSafety(
  targetPath: string,
  repoRoot: string,
  visitedRealPaths: Set<string> = new Set()
): SymlinkCheckResult {
  const diagnostics: Diagnostic[] = [];
  const resolvedRoot = path.resolve(repoRoot);

  try {
    const lstat = fs.lstatSync(targetPath);
    if (!lstat.isSymbolicLink()) {
      return { isSymlink: false, safe: true, realPath: targetPath, diagnostics };
    }

    // It's a symlink - resolve real path
    const realPath = fs.realpathSync(targetPath);

    // Check for circular symlink
    if (visitedRealPaths.has(realPath)) {
      diagnostics.push({
        id: 'CYCLIC_SYMLINK_DETECTED',
        severity: 'error',
        message: `Cyclic symlink detected at "${targetPath}" resolving to "${realPath}"`,
        sourcePath: targetPath,
      });
      return { isSymlink: true, safe: false, realPath, diagnostics };
    }

    visitedRealPaths.add(realPath);

    // Verify boundary
    const relativeFromRoot = path.relative(resolvedRoot, realPath);
    const isEscaping =
      relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot);

    if (isEscaping) {
      diagnostics.push({
        id: 'SYMLINK_ESCAPE',
        severity: 'error',
        message: `Symlink at "${targetPath}" points outside the repository root to "${realPath}"`,
        sourcePath: targetPath,
        details: { targetPath, realPath, resolvedRoot },
      });
      return { isSymlink: true, safe: false, realPath, diagnostics };
    }

    return {
      isSymlink: true,
      safe: true,
      realPath,
      relativeRealPath: normalizePath(relativeFromRoot),
      diagnostics,
    };
  } catch (err) {
    diagnostics.push({
      id: 'UNREADABLE_INSTRUCTION_SOURCE',
      severity: 'warning',
      message: `Failed to inspect file or symlink metadata at "${targetPath}": ${
        err instanceof Error ? err.message : String(err)
      }`,
      sourcePath: targetPath,
    });
    return { isSymlink: false, safe: false, diagnostics };
  }
}
