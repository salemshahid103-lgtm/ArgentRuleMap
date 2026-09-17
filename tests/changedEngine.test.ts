import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { ChangedEngine } from '../src/changed/changedEngine.js';
import {
  runGitReadOnly,
  parseRawDiffZ,
  getChangedFiles,
  GitError,
} from '../src/git/safeGit.js';

describe('Safe Git Layer & Diff Parser', () => {
  it('rejects mutating or non-whitelisted git subcommands', async () => {
    await expect(runGitReadOnly(['checkout', 'main'], { cwd: process.cwd() })).rejects.toThrow(
      /Mutating Git command.*is forbidden/
    );
    await expect(runGitReadOnly(['commit', '-m', 'test'], { cwd: process.cwd() })).rejects.toThrow(
      /Mutating Git command.*is forbidden/
    );
    await expect(runGitReadOnly(['reset', '--hard'], { cwd: process.cwd() })).rejects.toThrow(
      /Mutating Git command.*is forbidden/
    );
    await expect(runGitReadOnly(['clean', '-fd'], { cwd: process.cwd() })).rejects.toThrow(
      /Mutating Git command.*is forbidden/
    );
    await expect(runGitReadOnly(['push'], { cwd: process.cwd() })).rejects.toThrow(
      /Mutating Git command.*is forbidden/
    );
  });

  it('parses raw git diff -z output deterministically including renames and copies', () => {
    // Construct NUL-delimited diff stream:
    // :100644 100644 abc def M\0src/api/users.ts\0
    // :100644 100644 000 def A\0src/new-feature.ts\0
    // :100644 100644 abc 000 D\0src/legacy.ts\0
    // :100644 100644 abc def R100\0src/old.ts\0src/new.ts\0
    const rawTokens = [
      ':100644 100644 111 222 M',
      'src/api/users.ts',
      ':100644 100644 000 222 A',
      'src/new-feature.ts',
      ':100644 100644 111 000 D',
      'src/legacy.ts',
      ':100644 100644 111 222 R100',
      'src/old.ts',
      'src/new.ts',
    ];
    const raw = rawTokens.join('\0') + '\0';

    const parsed = parseRawDiffZ(raw);
    expect(parsed).toHaveLength(4);

    expect(parsed[0]).toEqual({
      path: 'src/api/users.ts',
      status: 'modified',
    });

    expect(parsed[1]).toEqual({
      path: 'src/legacy.ts',
      status: 'deleted',
    });

    expect(parsed[2]).toEqual({
      path: 'src/new-feature.ts',
      status: 'added',
    });

    expect(parsed[3]).toEqual({
      path: 'src/new.ts',
      oldPath: 'src/old.ts',
      status: 'renamed',
      similarityScore: 100,
    });
  });

  it('handles non-git directory cleanly with GitError code NOT_GIT_REPO', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-git-'));
    try {
      await expect(
        getChangedFiles({ type: 'default' }, tmpDir)
      ).rejects.toThrow(GitError);
      try {
        await getChangedFiles({ type: 'default' }, tmpDir);
      } catch (e) {
        expect(e).toBeInstanceOf(GitError);
        expect((e as GitError).details.code).toBe('NOT_GIT_REPO');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('ChangedEngine in Real Git Repository Fixture', () => {
  let testRepoDir: string;

  beforeAll(() => {
    testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentrulemap-git-test-'));

    // Initialize git repository
    execFileSync('git', ['init', '-b', 'main'], { cwd: testRepoDir });
    execFileSync('git', ['config', 'user.name', 'Test Agent'], { cwd: testRepoDir });
    execFileSync('git', ['config', 'user.email', 'agent@example.com'], { cwd: testRepoDir });

    // Set up directories
    fs.mkdirSync(path.join(testRepoDir, 'src', 'api'), { recursive: true });
    fs.mkdirSync(path.join(testRepoDir, 'src', 'ui'), { recursive: true });
    fs.mkdirSync(path.join(testRepoDir, '.github', 'instructions'), { recursive: true });

    // Base instruction files
    fs.writeFileSync(
      path.join(testRepoDir, 'AGENTS.md'),
      '# Global Agent Instructions\nAlways write tests.\n'
    );
    fs.writeFileSync(
      path.join(testRepoDir, 'src', 'api', 'AGENTS.md'),
      '# API Instructions\nStrict typing on API routes.\n'
    );
    fs.writeFileSync(
      path.join(testRepoDir, '.github', 'copilot-instructions.md'),
      '# Copilot Instructions\nRepo-wide copilot rules.\n'
    );
    fs.writeFileSync(
      path.join(testRepoDir, '.github', 'instructions', 'backend.instructions.md'),
      '---\napplyTo: "src/api/**/*.ts"\n---\nBackend rules.\n'
    );
    fs.writeFileSync(
      path.join(testRepoDir, 'src', 'api', 'users.ts'),
      'export const getUsers = () => [];\n'
    );
    fs.writeFileSync(
      path.join(testRepoDir, 'src', 'legacy.ts'),
      'export const legacy = true;\n'
    );
    fs.writeFileSync(
      path.join(testRepoDir, 'src', 'rename-me.ts'),
      'export const oldItem = 1;\n'
    );

    // Initial commit (main)
    execFileSync('git', ['add', '.'], { cwd: testRepoDir });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: testRepoDir });

    // Create changes for test:
    // 1. Modify src/api/users.ts
    fs.writeFileSync(
      path.join(testRepoDir, 'src', 'api', 'users.ts'),
      'export const getUsers = () => [{ id: "1" }];\n'
    );

    // 2. Add src/ui/Button.tsx
    fs.writeFileSync(
      path.join(testRepoDir, 'src', 'ui', 'Button.tsx'),
      'export const Button = () => null;\n'
    );

    // 3. Delete src/legacy.ts
    fs.rmSync(path.join(testRepoDir, 'src', 'legacy.ts'));

    // 4. Rename src/rename-me.ts to src/api/renamed.ts (moving into src/api/ changes its Codex & Copilot scopes!)
    fs.renameSync(
      path.join(testRepoDir, 'src', 'rename-me.ts'),
      path.join(testRepoDir, 'src', 'api', 'renamed.ts')
    );

    // 5. Modify AGENTS.md (instruction file modified!)
    fs.writeFileSync(
      path.join(testRepoDir, 'AGENTS.md'),
      '# Global Agent Instructions\nAlways write tests.\nUpdated rule.\n'
    );

    // Stage changes so git detects the rename with similarity
    execFileSync('git', ['add', '-A'], { cwd: testRepoDir });
  });

  afterAll(() => {
    if (testRepoDir && fs.existsSync(testRepoDir)) {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    }
  });

  it('analyzes working tree vs base main with added, modified, deleted, and renamed files', async () => {
    const changedFilesResult = await getChangedFiles(
      { type: 'base', base: 'main' },
      testRepoDir
    );

    expect(changedFilesResult.files.length).toBeGreaterThanOrEqual(4);

    const instructionEngine = new InstructionEngine({ rootDir: testRepoDir });
    const changedEngine = new ChangedEngine(instructionEngine);

    const report = await changedEngine.analyzeChangedFiles(
      changedFilesResult.files,
      changedFilesResult.comparisonInfo,
      { profile: 'all', compareInstructions: true }
    );

    expect(report.schemaVersion).toBe(1);
    expect(report.command).toBe('changed');
    expect(report.summary.totalChanged).toBe(5);

    // Status counts
    expect(report.summary.modified).toBe(2); // users.ts and AGENTS.md
    expect(report.summary.added).toBe(1); // Button.tsx
    expect(report.summary.deleted).toBe(1); // legacy.ts
    expect(report.summary.renamed).toBe(1); // rename-me.ts -> src/api/renamed.ts

    // Verify changed instruction file detection
    expect(report.summary.instructionFilesChanged).toBe(1);
    expect(report.changedInstructionFiles).toHaveLength(1);
    expect(report.changedInstructionFiles[0].path).toBe('AGENTS.md');
    // AGENTS.md affects all changed files
    expect(report.changedInstructionFiles[0].affectedChangedFiles.length).toBeGreaterThan(0);

    // Verify scope mapping for src/api/users.ts
    const usersFile = report.files.find((f) => f.path === 'src/api/users.ts');
    expect(usersFile).toBeDefined();
    expect(usersFile?.status).toBe('modified');
    expect(usersFile?.profiles.codex.matchedSources).toEqual([
      'AGENTS.md',
      'src/api/AGENTS.md',
    ]);
    expect(usersFile?.profiles.copilot.matchedSources).toContain(
      '.github/copilot-instructions.md'
    );
    expect(usersFile?.profiles.copilot.matchedSources).toContain(
      '.github/instructions/backend.instructions.md'
    );

    // Verify rename scope diff: moving src/rename-me.ts -> src/api/renamed.ts gained src/api/AGENTS.md and backend.instructions.md!
    const renamedFile = report.files.find((f) => f.path === 'src/api/renamed.ts');
    expect(renamedFile).toBeDefined();
    expect(renamedFile?.status).toBe('renamed');
    expect(renamedFile?.oldPath).toBe('src/rename-me.ts');
    expect(renamedFile?.renameScopeDiff).toBeDefined();
    expect(renamedFile?.renameScopeDiff?.changed).toBe(true);
    expect(renamedFile?.renameScopeDiff?.newSources.codex).toContain('src/api/AGENTS.md');
    expect(renamedFile?.renameScopeDiff?.oldSources.codex).not.toContain('src/api/AGENTS.md');

    // Verify multiple scopes detected across changed files (api vs ui)
    expect(report.summary.distinctScopes.codex).toBeGreaterThanOrEqual(2);
    expect(report.scopeSummary.codex.multipleScopesDetected).toBe(true);

    // Verify deterministic mode notice
    expect(report.deterministicModeNotice).toContain('Deterministic analysis performed');
  });

  it('handles empty change set when compared against HEAD after committing', async () => {
    // Stage and commit all changes
    execFileSync('git', ['add', '.'], { cwd: testRepoDir });
    execFileSync('git', ['commit', '-m', 'feature commit'], { cwd: testRepoDir });

    const changedFilesResult = await getChangedFiles(
      { type: 'default' },
      testRepoDir
    );

    expect(changedFilesResult.files).toHaveLength(0);
  });

  it('rejects invalid git ref cleanly without crashing', async () => {
    await expect(
      getChangedFiles(
        { type: 'base', base: 'nonexistent-branch-xyz-987' },
        testRepoDir
      )
    ).rejects.toThrow(GitError);

    try {
      await getChangedFiles(
        { type: 'base', base: 'nonexistent-branch-xyz-987' },
        testRepoDir
      );
    } catch (e) {
      expect(e).toBeInstanceOf(GitError);
      expect((e as GitError).details.code).toBe('INVALID_BASE');
    }
  });
});
