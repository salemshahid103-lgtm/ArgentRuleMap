import path from 'node:path';
import type { TargetPath, Diagnostic } from '../types/engine.js';

/**
 * Normalizes any path to use POSIX slashes (/), trims leading slashes and trailing slashes,
 * and strips redundant './' components without altering Unicode characters.
 */
export function normalizePath(inputPath: string): string {
  if (!inputPath) return '';
  // Replace Windows backslashes with forward slashes
  let normalized = inputPath.replace(/\\/g, '/').trim();

  // Normalize duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  // Strip leading './'
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  // Strip leading '/'
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  // Strip trailing '/'
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Validates and safely resolves a target path relative to a repository root.
 * Returns a TargetPath descriptor and diagnostics if any security or validity violations exist.
 */
export function parseAndValidateTargetPath(
  rawPath: string,
  repoRoot: string
): { target: TargetPath; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const normalized = normalizePath(rawPath);

  // Check for empty or invalid path
  if (!rawPath || rawPath.trim() === '' || rawPath === '.') {
    return {
      target: {
        raw: rawPath,
        normalized: '',
        directory: '',
        filename: '',
        extension: '',
        isValid: false,
        isInsideRepo: true,
      },
      diagnostics: [
        {
          id: 'INVALID_TARGET_PATH',
          severity: 'error',
          message: 'Target path cannot be empty or root reference "."',
          targetPath: rawPath,
        },
      ],
    };
  }

  const resolvedRoot = path.resolve(repoRoot);
  // Resolve raw path against repository root
  const resolvedTarget = path.resolve(resolvedRoot, normalized);

  // Check if target escapes repository root (e.g. "../../secret.txt")
  const relativeFromRoot = path.relative(resolvedRoot, resolvedTarget);
  const isEscaped =
    relativeFromRoot.startsWith('..') ||
    path.isAbsolute(relativeFromRoot) ||
    resolvedTarget === resolvedRoot;

  if (isEscaped) {
    diagnostics.push({
      id: 'PATH_OUTSIDE_REPOSITORY',
      severity: 'error',
      message: `Target path "${rawPath}" resolves outside of repository root "${repoRoot}"`,
      targetPath: rawPath,
      details: {
        rawPath,
        resolvedTarget,
        resolvedRoot,
      },
    });

    return {
      target: {
        raw: rawPath,
        normalized,
        directory: '',
        filename: path.basename(normalized),
        extension: path.extname(normalized),
        isValid: false,
        isInsideRepo: false,
      },
      diagnostics,
    };
  }

  const posixRelative = normalizePath(relativeFromRoot);
  const directory = path.posix.dirname(posixRelative) === '.' ? '' : path.posix.dirname(posixRelative);
  const filename = path.posix.basename(posixRelative);
  const extension = path.posix.extname(posixRelative);

  return {
    target: {
      raw: rawPath,
      normalized: posixRelative,
      directory,
      filename,
      extension,
      isValid: true,
      isInsideRepo: true,
    },
    diagnostics,
  };
}

/**
 * Computes the ascending directory chain from root to target path directory.
 * E.g., for "src/api/users.ts", returns ["", "src", "src/api"]
 * E.g., for "index.ts", returns [""]
 */
export function getDirectoryChain(targetDirectory: string): string[] {
  const normalized = normalizePath(targetDirectory);
  if (!normalized || normalized === '.') {
    return [''];
  }

  const segments = normalized.split('/').filter(Boolean);
  const chain: string[] = [''];
  let current = '';

  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg;
    chain.push(current);
  }

  return chain;
}

/**
 * Calculates directory nesting depth.
 * Root "" -> 0
 * "src" -> 1
 * "src/api" -> 2
 */
export function getPathDepth(posixPath: string): number {
  const norm = normalizePath(posixPath);
  if (!norm || norm === '.') return 0;
  return norm.split('/').filter(Boolean).length;
}
