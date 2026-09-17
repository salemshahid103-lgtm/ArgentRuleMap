import fs from 'node:fs';
import path from 'node:path';

export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function isDirectory(dirPath: string): boolean {
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function readFileSafe(filePath: string): string | null {
  try {
    if (!fileExists(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export function readJsonSafe<T = unknown>(filePath: string): T | null {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function listDirSafe(dirPath: string): string[] {
  try {
    if (!fileExists(dirPath) || !isDirectory(dirPath)) return [];
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}

const IGNORED_SCAN_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.idea',
  '.vscode',
  'venv',
  '.venv',
  '__pycache__',
]);

/**
 * Collects all directory paths relative to rootDir up to a maximum depth.
 */
export function scanDirectoryStructure(
  rootDir: string,
  maxDepth = 3
): { directories: string[]; rootFiles: string[]; totalFilesScanned: number } {
  const directories: string[] = [];
  let rootFiles: string[] = [];
  let totalFilesScanned = 0;

  function traverse(currentDir: string, relativeCurrent: string, depth: number) {
    if (depth > maxDepth) return;
    const entries = listDirSafe(currentDir);

    if (depth === 0) {
      rootFiles = entries.filter((entry) => {
        try {
          const stats = fs.statSync(path.join(currentDir, entry));
          return !stats.isDirectory();
        } catch {
          return false;
        }
      });
    }

    for (const entry of entries) {
      if (IGNORED_SCAN_DIRS.has(entry)) continue;
      const fullPath = path.join(currentDir, entry);
      const relPath = relativeCurrent ? `${relativeCurrent}/${entry}` : entry;

      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          directories.push(relPath);
          traverse(fullPath, relPath, depth + 1);
        } else {
          totalFilesScanned++;
        }
      } catch {
        // Skip inaccessible entries
      }
    }
  }

  traverse(rootDir, '', 0);

  return {
    directories,
    rootFiles,
    totalFilesScanned,
  };
}
