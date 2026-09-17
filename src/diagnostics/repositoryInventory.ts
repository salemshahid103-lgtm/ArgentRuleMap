import fs from 'node:fs';
import path from 'node:path';
import picomatch from 'picomatch';
import { normalizePath } from '../utils/pathUtils.js';
import { readJsonSafe } from '../utils/fsUtils.js';
import type { RepoPackageJson } from '../types/index.js';
import { IGNORED_DIRECTORIES } from '../scanners/instructionFileScanner.js';

export class RepositoryInventory {
  readonly rootDir: string;
  readonly files = new Set<string>();
  readonly directories = new Set<string>();
  private packageJsons = new Map<string, RepoPackageJson>();
  private globMatchesCache = new Map<string, string[]>();

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
    this.buildInventory();
  }

  private buildInventory(): void {
    this.directories.add(''); // root directory

    const queue: string[] = [''];

    while (queue.length > 0) {
      const currentRel = queue.shift()!;
      const currentAbs = currentRel ? path.join(this.rootDir, currentRel) : this.rootDir;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(currentAbs, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const name = entry.name;
        if (IGNORED_DIRECTORIES.has(name)) {
          continue;
        }

        const childRel = currentRel ? `${currentRel}/${name}` : name;
        const normalized = normalizePath(childRel);

        if (entry.isDirectory()) {
          this.directories.add(normalized);
          queue.push(normalized);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          this.files.add(normalized);

          // If this is a package.json, parse and store it
          if (name === 'package.json') {
            const absPath = path.join(this.rootDir, normalized);
            const parsed = readJsonSafe<RepoPackageJson>(absPath);
            if (parsed) {
              const dirOfPkg = path.posix.dirname(normalized) === '.' ? '' : path.posix.dirname(normalized);
              this.packageJsons.set(dirOfPkg, parsed);
            }
          }
        }
      }
    }
  }

  /**
   * Checks whether a repository-relative file exists.
   */
  hasFile(relPath: string): boolean {
    const normalized = normalizePath(relPath);
    return this.files.has(normalized);
  }

  /**
   * Checks whether a repository-relative directory exists.
   */
  hasDirectory(relDir: string): boolean {
    const normalized = normalizePath(relDir);
    return this.directories.has(normalized);
  }

  /**
   * Checks whether a repository-relative path exists either as a file or as a directory.
   */
  hasPath(relPath: string): boolean {
    const normalized = normalizePath(relPath);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  /**
   * Returns all repository files as a list.
   */
  getAllFiles(): string[] {
    return Array.from(this.files);
  }

  /**
   * Returns all repository directories as a list.
   */
  getAllDirectories(): string[] {
    return Array.from(this.directories);
  }

  /**
   * Finds the closest package.json starting from the given relative path and walking up to repo root.
   */
  getClosestPackageJson(fromRelPath: string): { dir: string; packageJson: RepoPackageJson } | undefined {
    let currentDir = normalizePath(fromRelPath);
    if (this.files.has(currentDir)) {
      currentDir = path.posix.dirname(currentDir) === '.' ? '' : path.posix.dirname(currentDir);
    }

    while (true) {
      const found = this.packageJsons.get(currentDir);
      if (found) {
        return { dir: currentDir, packageJson: found };
      }
      if (!currentDir) {
        break;
      }
      const parent = path.posix.dirname(currentDir);
      currentDir = parent === '.' ? '' : parent;
    }

    // Root check fallback
    const rootPkg = this.packageJsons.get('');
    if (rootPkg) {
      return { dir: '', packageJson: rootPkg };
    }

    return undefined;
  }

  /**
   * Finds all files matching the given glob patterns, with caching.
   */
  findMatchingFiles(patterns: string[]): string[] {
    const cacheKey = patterns.join('|||');
    const cached = this.globMatchesCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const posixPatterns = patterns.map((p) => normalizePath(p));
    const isMatch = picomatch(posixPatterns, { dot: true });

    const matched: string[] = [];
    for (const f of this.files) {
      if (isMatch(f)) {
        matched.push(f);
      }
    }

    matched.sort();
    this.globMatchesCache.set(cacheKey, matched);
    return matched;
  }
}
