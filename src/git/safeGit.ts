import fs from 'node:fs';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  ChangedFile,
  GitChangeStatus,
  GitDiffComparison,
  GitErrorDetails,
  GitExecutionOptions,
} from './types.js';
import { normalizePath } from '../utils/pathUtils.js';

const execFileAsync = promisify(execFile);

/**
 * Disallowed Git subcommands that mutate repository state.
 * AgentRuleMap is strictly read-only.
 */
const BANNED_GIT_SUBCOMMANDS = new Set([
  'checkout',
  'reset',
  'clean',
  'commit',
  'push',
  'merge',
  'rebase',
  'stash',
  'pull',
  'branch',
  'tag',
  'rm',
  'mv',
  'apply',
  'cherry-pick',
  'revert',
]);

/**
 * Allowed safe read-only subcommands.
 */
const ALLOWED_READ_ONLY_SUBCOMMANDS = new Set([
  'rev-parse',
  'diff',
  'show',
  'merge-base',
  'status',
  'cat-file',
  'log',
  'ls-files',
]);

export class GitError extends Error {
  readonly details: GitErrorDetails;

  constructor(details: GitErrorDetails) {
    super(details.message);
    this.name = 'GitError';
    this.details = details;
  }
}

/**
 * Executes a Git command safely with an array of arguments, strictly without shell interpolation.
 */
export async function runGitReadOnly(
  args: string[],
  options: GitExecutionOptions = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const subcommand = args[0];

  if (!subcommand) {
    throw new GitError({
      code: 'UNSAFE_ARGUMENT',
      message: 'No Git subcommand specified.',
    });
  }

  if (BANNED_GIT_SUBCOMMANDS.has(subcommand)) {
    throw new GitError({
      code: 'UNSAFE_ARGUMENT',
      message: `Mutating Git command "git ${subcommand}" is forbidden. AgentRuleMap only executes read-only operations.`,
      command: subcommand,
      args,
    });
  }

  if (!ALLOWED_READ_ONLY_SUBCOMMANDS.has(subcommand)) {
    throw new GitError({
      code: 'UNSAFE_ARGUMENT',
      message: `Unrecognized or non-read-only Git command "git ${subcommand}" is not permitted.`,
      command: subcommand,
      args,
    });
  }

  // Defend against option injection in arguments where dangerous flags might be passed
  for (const arg of args) {
    if (typeof arg !== 'string') {
      throw new GitError({
        code: 'UNSAFE_ARGUMENT',
        message: 'All Git arguments must be strings.',
      });
    }
  }

  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const maxBuffer = options.maxBuffer || 20 * 1024 * 1024; // 20MB
  const timeoutMs = options.timeoutMs || 30_000; // 30s timeout

  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer,
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
    });

    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const error = err as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    const stderr = (error.stderr || '').toString().trim();
    const stdout = (error.stdout || '').toString().trim();
    const exitCode = typeof error.code === 'number' ? error.code : 1;

    // Check for common Git errors
    if (
      stderr.includes('not a git repository') ||
      stderr.includes('fatal: not a git repository')
    ) {
      throw new GitError({
        code: 'NOT_GIT_REPO',
        message: `Directory "${cwd}" is not inside a Git repository.`,
        command: subcommand,
        args,
        rawError: stderr,
      });
    }

    return { stdout, stderr, exitCode };
  }
}

/**
 * Checks if a directory is inside a Git working tree.
 */
export async function isInsideGitRepo(cwd: string): Promise<boolean> {
  try {
    const res = await runGitReadOnly(
      ['rev-parse', '--is-inside-work-tree'],
      { cwd }
    );
    return res.exitCode === 0 && res.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Gets the absolute path of the Git repository top-level root.
 */
export async function getGitRepoRoot(cwd: string): Promise<string> {
  const res = await runGitReadOnly(['rev-parse', '--show-toplevel'], { cwd });
  if (res.exitCode !== 0 || !res.stdout.trim()) {
    throw new GitError({
      code: 'NOT_GIT_REPO',
      message: `Directory "${cwd}" is not inside a Git repository.`,
      rawError: res.stderr,
    });
  }
  return path.resolve(res.stdout.trim());
}

/**
 * Checks if the repository is a shallow clone.
 */
export async function isShallowRepository(cwd: string): Promise<boolean> {
  // Check on-disk marker directly first
  try {
    const shallowPath = path.join(cwd, '.git', 'shallow');
    if (fs.existsSync(shallowPath)) {
      return true;
    }
  } catch {
    // Ignore filesystem check errors
  }

  try {
    const res = await runGitReadOnly(['rev-parse', '--is-shallow-repository'], {
      cwd,
    });
    return res.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Validates a Git reference conservatively.
 * Disallows leading dashes, whitespace, or invalid syntax.
 */
export function validateRefSyntax(ref: string): boolean {
  if (!ref || typeof ref !== 'string') return false;
  const trimmed = ref.trim();
  if (!trimmed) return false;
  // Disallow options masquerading as refs
  if (trimmed.startsWith('-')) return false;
  // Disallow whitespace or null bytes
  if (/[\s\0\r\n]/.test(trimmed)) return false;
  // Disallow obvious control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;
  return true;
}

/**
 * Resolves whether a given Git reference actually exists in the local repository history.
 */
export async function verifyGitRef(
  ref: string,
  cwd: string
): Promise<{ exists: boolean; commitSha?: string; error?: string }> {
  if (!validateRefSyntax(ref)) {
    return {
      exists: false,
      error: `Invalid Git reference format: "${ref}". References cannot start with "-" or contain control characters.`,
    };
  }

  // Check commit object
  const res = await runGitReadOnly(
    ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`],
    { cwd }
  );

  if (res.exitCode === 0 && res.stdout.trim()) {
    return { exists: true, commitSha: res.stdout.trim() };
  }

  // Fallback: check any valid git object ref (tags, trees)
  const objRes = await runGitReadOnly(
    ['rev-parse', '--verify', '--quiet', ref],
    { cwd }
  );
  if (objRes.exitCode === 0 && objRes.stdout.trim()) {
    return { exists: true, commitSha: objRes.stdout.trim() };
  }

  const isShallow = await isShallowRepository(cwd);
  const shallowNote = isShallow
    ? ' (Note: The repository is a shallow clone; requested base history may not be fetched).'
    : '';

  return {
    exists: false,
    error: `Git base could not be resolved: "${ref}"${shallowNote}`,
  };
}

/**
 * Detects an appropriate Git base if not explicitly provided.
 * If ambiguous or not found, throws a clear GitError asking the user to specify --base.
 */
export async function resolveDefaultBase(cwd: string): Promise<string> {
  // 1. Try tracking branch for current HEAD
  const upstreamRes = await runGitReadOnly(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    { cwd }
  );

  if (upstreamRes.exitCode === 0 && upstreamRes.stdout.trim()) {
    const upstream = upstreamRes.stdout.trim();
    const verified = await verifyGitRef(upstream, cwd);
    if (verified.exists) {
      return upstream;
    }
  }

  // 2. Check candidate branches: origin/main, main, origin/master, master
  const candidates = ['origin/main', 'main', 'origin/master', 'master'];
  const validCandidates: string[] = [];

  for (const candidate of candidates) {
    const check = await verifyGitRef(candidate, cwd);
    if (check.exists) {
      validCandidates.push(candidate);
    }
  }

  // If exactly one candidate exists, or if origin/main and main exist (prefer origin/main or main)
  if (validCandidates.length === 1) {
    return validCandidates[0];
  }

  if (validCandidates.includes('origin/main')) {
    return 'origin/main';
  }
  if (validCandidates.includes('main')) {
    return 'main';
  }
  if (validCandidates.includes('origin/master')) {
    return 'origin/master';
  }
  if (validCandidates.includes('master')) {
    return 'master';
  }

  throw new GitError({
    code: 'AMBIGUOUS_BASE',
    message:
      'No Git comparison base specified and default base could not be determined unambiguously. Please specify a base explicitly, e.g.: agentrulemap changed --base main (or --staged for staged changes).',
  });
}

/**
 * Parses NUL-delimited output from `git diff --name-status -z`.
 * Handles Added (A), Modified (M), Deleted (D), Renamed (R<score>), Copied (C<score>), Type changed (T).
 */
export function parseNameStatusZ(rawZOutput: string): ChangedFile[] {
  if (!rawZOutput) return [];

  // Split on NUL delimiter
  const tokens = rawZOutput.split('\0');
  // Trailing empty token after last NUL
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') {
    tokens.pop();
  }

  const results: ChangedFile[] = [];
  let i = 0;

  while (i < tokens.length) {
    const statusToken = tokens[i].trim();
    i++;

    if (!statusToken) continue;

    let codePart = statusToken;
    if (codePart.startsWith(':')) {
      const parts = codePart.split(/\s+/);
      codePart = parts[parts.length - 1];
    }

    const statusCode = codePart[0];
    const scoreStr = codePart.slice(1);
    const score = /^\d+$/.test(scoreStr) ? parseInt(scoreStr, 10) : undefined;

    if (statusCode === 'R' || statusCode === 'C') {
      // Renamed or Copied: followed by oldPath then newPath
      const oldPathRaw = tokens[i];
      i++;
      const newPathRaw = tokens[i];
      i++;

      if (oldPathRaw !== undefined && newPathRaw !== undefined) {
        const normOld = normalizePath(oldPathRaw);
        const normNew = normalizePath(newPathRaw);
        const status: GitChangeStatus = statusCode === 'R' ? 'renamed' : 'copied';

        results.push({
          status,
          path: normNew,
          oldPath: normOld,
          similarityScore: score,
        });
      }
    } else {
      // Single path: A, M, D, T, etc.
      const pathRaw = tokens[i];
      i++;

      if (pathRaw !== undefined) {
        const normPath = normalizePath(pathRaw);
        let status: GitChangeStatus = 'modified';

        switch (statusCode) {
          case 'A':
            status = 'added';
            break;
          case 'D':
            status = 'deleted';
            break;
          case 'M':
          case 'T':
          default:
            status = 'modified';
            break;
        }

        results.push({
          status,
          path: normPath,
        });
      }
    }
  }

  // Deterministic sort by path
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}

export const parseRawDiffZ = parseNameStatusZ;

/**
 * Gets changed files for the requested comparison mode.
 */
export async function getChangedFiles(
  comparison: {
    type: 'base' | 'staged' | 'unstaged' | 'default';
    base?: string;
  },
  cwd: string
): Promise<{ files: ChangedFile[]; comparisonInfo: GitDiffComparison }> {
  // Ensure inside git repository
  const inside = await isInsideGitRepo(cwd);
  if (!inside) {
    throw new GitError({
      code: 'NOT_GIT_REPO',
      message: `Directory "${cwd}" is not inside a Git repository.`,
    });
  }

  if (comparison.type === 'staged') {
    // HEAD <-> index
    const args = ['diff', '--cached', '--name-status', '-z', '--find-renames'];
    const res = await runGitReadOnly(args, { cwd });
    if (res.exitCode !== 0) {
      throw new GitError({
        code: 'GIT_COMMAND_FAILED',
        message: `Failed to inspect staged changes: ${res.stderr}`,
        args,
        rawError: res.stderr,
      });
    }

    return {
      files: parseNameStatusZ(res.stdout),
      comparisonInfo: {
        type: 'staged',
        description: 'Staged changes (HEAD ↔ index)',
      },
    };
  }

  if (comparison.type === 'unstaged') {
    // index <-> working tree
    const args = ['diff', '--name-status', '-z', '--find-renames'];
    const res = await runGitReadOnly(args, { cwd });
    if (res.exitCode !== 0) {
      throw new GitError({
        code: 'GIT_COMMAND_FAILED',
        message: `Failed to inspect unstaged changes: ${res.stderr}`,
        args,
        rawError: res.stderr,
      });
    }

    const files = await appendUntrackedFiles(
      parseNameStatusZ(res.stdout),
      cwd
    );

    return {
      files,
      comparisonInfo: {
        type: 'unstaged',
        description: 'Unstaged changes (index ↔ working tree)',
      },
    };
  }

  // Base comparison
  let baseRef = comparison.base;
  if (!baseRef) {
    baseRef = await resolveDefaultBase(cwd);
  }

  // Verify the base reference exists
  const verified = await verifyGitRef(baseRef, cwd);
  if (!verified.exists) {
    throw new GitError({
      code: 'INVALID_BASE',
      message: verified.error || `Git base could not be resolved: "${baseRef}"`,
    });
  }

  // Compare base to working tree
  // Using `git diff --name-status -z --find-renames <baseRef>...` or `<baseRef>`
  // `<baseRef>` compares base commit to current working tree (including unstaged and staged)
  const args = ['diff', '--name-status', '-z', '--find-renames', baseRef, '--'];
  const res = await runGitReadOnly(args, { cwd });

  if (res.exitCode !== 0) {
    throw new GitError({
      code: 'GIT_COMMAND_FAILED',
      message: `Failed to compute diff against base "${baseRef}": ${res.stderr}`,
      args,
      rawError: res.stderr,
    });
  }

  const files = await appendUntrackedFiles(
    parseNameStatusZ(res.stdout),
    cwd
  );

  return {
    files,
    comparisonInfo: {
      type: 'base',
      base: baseRef,
      target: 'working tree',
      description: `Comparison against base "${baseRef}" (base ↔ working tree)`,
    },
  };
}

async function appendUntrackedFiles(
  files: ChangedFile[],
  cwd: string
): Promise<ChangedFile[]> {
  try {
    const res = await runGitReadOnly(
      ['ls-files', '--others', '--exclude-standard', '-z'],
      { cwd }
    );
    if (res.exitCode === 0 && res.stdout) {
      const existingPaths = new Set(files.map((f) => f.path));
      const tokens = res.stdout.split('\0');
      for (const token of tokens) {
        if (!token.trim()) continue;
        const norm = normalizePath(token.trim());
        if (!existingPaths.has(norm)) {
          files.push({
            status: 'added',
            path: norm,
          });
          existingPaths.add(norm);
        }
      }
      files.sort((a, b) => a.path.localeCompare(b.path));
    }
  } catch {
    // Graceful fallback
  }
  return files;
}

/**
 * Safely reads the text content of a file at a specific Git revision without checking it out.
 * Returns null if the file does not exist at that revision.
 */
export async function gitShowFileContent(
  ref: string,
  repoRelativePath: string,
  cwd: string
): Promise<string | null> {
  if (!validateRefSyntax(ref)) return null;

  const normalized = normalizePath(repoRelativePath);
  if (!normalized) return null;

  // Execute `git show <ref>:<path>`
  const args = ['show', `${ref}:${normalized}`];
  const res = await runGitReadOnly(args, { cwd });

  if (res.exitCode === 0) {
    return res.stdout;
  }
  return null;
}
