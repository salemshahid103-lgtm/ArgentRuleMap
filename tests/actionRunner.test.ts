import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { detectActionBase, getBaseRefFromEvent } from '../src/action/baseDetector.js';
import { formatStepSummaryMarkdown, sanitizeMarkdown } from '../src/action/summaryFormatter.js';
import { runAction } from '../src/action/runner.js';
import type { ActionEnvironment } from '../src/action/types.js';
import type { ChangedAnalysisReport } from '../src/changed/types.js';

describe('GitHub Action Base Detector & Environment', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-action-test-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: tempRepo });
    execFileSync('git', ['config', 'user.name', 'Test Runner'], { cwd: tempRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRepo });

    fs.writeFileSync(path.join(tempRepo, 'README.md'), '# Test\n');
    execFileSync('git', ['add', '.'], { cwd: tempRepo });
    execFileSync('git', ['commit', '-m', 'initial commit'], { cwd: tempRepo });
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('detects user-specified base ref if provided in inputs', async () => {
    const env: ActionEnvironment = {
      isGitHubActions: true,
      inputs: { base: 'main' },
    };

    const result = await detectActionBase(env, tempRepo);
    expect(result.error).toBeUndefined();
    expect(result.base).toBe('main');
  });

  it('detects PR base from GITHUB_BASE_REF', async () => {
    // Create branch feature
    execFileSync('git', ['checkout', '-b', 'feature'], { cwd: tempRepo });

    const env: ActionEnvironment = {
      isGitHubActions: true,
      baseRef: 'main',
    };

    const result = await detectActionBase(env, tempRepo);
    expect(result.error).toBeUndefined();
    expect(result.base).toBe('main');
  });

  it('detects PR base from event JSON payload', () => {
    const eventFile = path.join(tempRepo, 'event.json');
    fs.writeFileSync(
      eventFile,
      JSON.stringify({
        pull_request: {
          number: 42,
          base: { ref: 'release-1.0' },
        },
      })
    );

    const baseRef = getBaseRefFromEvent(eventFile);
    expect(baseRef).toBe('release-1.0');
  });

  it('provides a clear error when repository is shallow', async () => {
    // Mock shallow file in git directory
    const shallowFile = path.join(tempRepo, '.git', 'shallow');
    fs.writeFileSync(shallowFile, 'deadbeef\n');

    const env: ActionEnvironment = {
      isGitHubActions: true,
      baseRef: 'main',
    };

    const result = await detectActionBase(env, tempRepo);
    expect(result.base).toBeUndefined();
    expect(result.error).toContain('fetch-depth: 1');
    expect(result.error).toContain('fetch-depth: 0');
  });
});

describe('Step Summary & Markdown Formatting', () => {
  it('sanitizes dangerous Markdown and HTML injection', () => {
    const unsafe = 'File <script>alert(1)</script> with `code` & "quotes"';
    const sanitized = sanitizeMarkdown(unsafe);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
    expect(sanitized).toContain('&amp;');
  });

  it('formats clean markdown step summary with reproduction command and findings', () => {
    const mockReport: ChangedAnalysisReport = {
      schemaVersion: 1,
      command: 'changed',
      repositoryRoot: '/repo',
      comparison: {
        type: 'base',
        base: 'main',
        description: 'Working tree compared to Git base "main"',
      },
      summary: {
        totalChanged: 3,
        added: 1,
        modified: 2,
        deleted: 0,
        renamed: 0,
        copied: 0,
        instructionFilesChanged: 1,
        instructionSourcesInvolved: { codex: 1, copilot: 1, gemini: 0, generic: 1 },
        distinctScopes: { codex: 1, copilot: 1, gemini: 0, generic: 1 },
      },
      changedInstructionFiles: [
        {
          path: 'AGENTS.md',
          status: 'modified',
          profiles: ['generic', 'codex'],
          affectedChangedFiles: ['src/index.ts', 'src/api.ts'],
        },
      ],
      scopeSummary: {
        codex: { profile: 'codex', distinctScopes: ['/'], multipleScopesDetected: false },
        copilot: { profile: 'copilot', distinctScopes: ['/'], multipleScopesDetected: false },
        gemini: { profile: 'gemini', distinctScopes: [], multipleScopesDetected: false },
        generic: { profile: 'generic', distinctScopes: ['/'], multipleScopesDetected: false },
      },
      files: [
        {
          status: 'modified',
          path: 'src/index.ts',
          isInstructionFile: false,
          profiles: {
            codex: {
              profile: 'codex',
              profileName: 'OpenAI Codex',
              matchedSources: ['AGENTS.md'],
              scopeChain: ['/'],
            },
            copilot: {
              profile: 'copilot',
              profileName: 'GitHub Copilot',
              matchedSources: [],
              scopeChain: [],
            },
            gemini: {
              profile: 'gemini',
              profileName: 'Google Gemini',
              matchedSources: [],
              scopeChain: [],
            },
            generic: {
              profile: 'generic',
              profileName: 'Generic Agent Instructions',
              matchedSources: ['AGENTS.md'],
              scopeChain: ['/'],
            },
          },
        },
      ],
      diagnostics: [
        {
          id: 'ARM006_STALE_TARGET_PATH',
          severity: 'warning',
          title: 'Stale Target Path',
          message: 'Scoped target path does not exist.',
          sourcePath: 'AGENTS.md',
          remediation: 'Update path in AGENTS.md.',
        },
      ],
      deterministicModeNotice: 'Deterministic analysis.',
    };

    const summary = formatStepSummaryMarkdown(mockReport, 'origin/main', false);

    expect(summary).toContain('AgentRuleMap');
    expect(summary).toContain('Changed Files');
    expect(summary).toContain('`3`');
    expect(summary).toContain('Instruction Files Modified');
    expect(summary).toContain('`1`');
    expect(summary).toContain('`AGENTS.md`');
    expect(summary).toContain('agentrulemap changed --base origin/main');
    expect(summary).toContain('ARM006_STALE_TARGET_PATH');
  });
});

describe('Action Runner Execution & Fail-on Policies', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-runner-test-'));
    execFileSync('git', ['init', '-b', 'main'], { cwd: tempRepo });
    execFileSync('git', ['config', 'user.name', 'Test Runner'], { cwd: tempRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRepo });

    fs.writeFileSync(path.join(tempRepo, 'AGENTS.md'), '# Root Agents Instructions\n');
    execFileSync('git', ['add', '.'], { cwd: tempRepo });
    execFileSync('git', ['commit', '-m', 'initial'], { cwd: tempRepo });
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('runs action successfully and sets outputs and summary file', async () => {
    // Modify a file in branch
    execFileSync('git', ['checkout', '-b', 'test-branch'], { cwd: tempRepo });
    fs.writeFileSync(path.join(tempRepo, 'file.txt'), 'hello world\n');

    const summaryFile = path.join(tempRepo, 'summary.md');
    const sarifFile = path.join(tempRepo, 'results.sarif');

    const env: ActionEnvironment = {
      isGitHubActions: true,
      baseRef: 'main',
      stepSummaryPath: summaryFile,
      cwd: tempRepo,
      inputs: {
        base: 'main',
        profile: 'all',
        failOn: 'error',
        sarifFile,
      },
    };

    const result = await runAction(env);

    expect(result.exitCode).toBe(0);
    expect(result.changedFilesCount).toBe(1);
    expect(fs.existsSync(summaryFile)).toBe(true);
    expect(fs.existsSync(sarifFile)).toBe(true);

    const summaryContent = fs.readFileSync(summaryFile, 'utf8');
    expect(summaryContent).toContain('AgentRuleMap');
    expect(summaryContent).toContain('agentrulemap changed --base main');

    const sarifContent = fs.readFileSync(sarifFile, 'utf8');
    const parsedSarif = JSON.parse(sarifContent);
    expect(parsedSarif.version).toBe('2.1.0');
  });

  it('obeys fail-on policy (fail-on: error vs warning vs never)', async () => {
    // Introduce an error by creating an invalid instruction file
    execFileSync('git', ['checkout', '-b', 'diag-branch'], { cwd: tempRepo });
    fs.mkdirSync(path.join(tempRepo, '.github'), { recursive: true });
    fs.writeFileSync(
      path.join(tempRepo, '.github/copilot-instructions.md'),
      '---\ninvalid yaml: [unclosed\n---\n'
    );

    // 1. With fail-on: warning -> should fail with exit code 1 due to the warning
    const envWarning: ActionEnvironment = {
      isGitHubActions: true,
      cwd: tempRepo,
      inputs: {
        base: 'main',
        failOn: 'warning',
      },
    };
    const resWarning = await runAction(envWarning);
    expect(resWarning.exitCode).toBe(1);
    expect(resWarning.warningCount).toBeGreaterThanOrEqual(1);

    // 2. With fail-on: error -> should pass with exit code 0 because there are only warnings
    const envError: ActionEnvironment = {
      isGitHubActions: true,
      cwd: tempRepo,
      inputs: {
        base: 'main',
        failOn: 'error',
      },
    };
    const resError = await runAction(envError);
    expect(resError.exitCode).toBe(0);

    // 3. With fail-on: never -> should exit with 0
    const envNever: ActionEnvironment = {
      isGitHubActions: true,
      cwd: tempRepo,
      inputs: {
        base: 'main',
        failOn: 'never',
      },
    };
    const resNever = await runAction(envNever);
    expect(resNever.exitCode).toBe(0);
  });
});
