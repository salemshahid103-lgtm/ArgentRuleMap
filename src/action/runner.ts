import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import { InstructionEngine } from '../core/instructionEngine.js';
import { ChangedEngine } from '../changed/changedEngine.js';
import { getChangedFiles } from '../git/safeGit.js';
import { generateSarifReport, formatSarifReport } from '../reporters/sarifReporter.js';
import { detectActionBase } from './baseDetector.js';
import { formatStepSummaryMarkdown } from './summaryFormatter.js';
import { postOrUpdatePrComment } from './prCommenter.js';
import type {
  ActionEnvironment,
  ActionExecutionResult,
  ActionInputs,
  ActionFailOn,
  ActionOutputFormat,
} from './types.js';
import type { ChangedAnalysisReport } from '../changed/types.js';
import type { InstructionProfileId } from '../types/engine.js';

/**
 * Loads default action environment from process.env and @actions/core inputs.
 */
export function getActionEnvironment(): ActionEnvironment {
  const isGitHubActions = Boolean(process.env.GITHUB_ACTIONS);
  const cwd = core.getInput('cwd') || process.cwd();

  const inputs: ActionInputs = {
    base: core.getInput('base') || undefined,
    profile: core.getInput('profile') || 'all',
    failOn: (core.getInput('fail-on') as ActionFailOn) || 'error',
    output: (core.getInput('output') as ActionOutputFormat) || 'summary',
    sarifFile: core.getInput('sarif-file') || 'agentrulemap.sarif',
    prComment: core.getInput('pr-comment') === 'true',
    githubToken: core.getInput('github-token') || process.env.GITHUB_TOKEN || undefined,
    cwd,
  };

  return {
    isGitHubActions,
    baseRef: process.env.GITHUB_BASE_REF || undefined,
    headRef: process.env.GITHUB_HEAD_REF || undefined,
    sha: process.env.GITHUB_SHA || undefined,
    repository: process.env.GITHUB_REPOSITORY || undefined,
    stepSummaryPath: process.env.GITHUB_STEP_SUMMARY || undefined,
    eventPath: process.env.GITHUB_EVENT_PATH || undefined,
    token: inputs.githubToken,
    inputs,
    cwd,
  };
}

/**
 * Main execution logic for the AgentRuleMap GitHub Action.
 * Fully decoupled and mockable for unit and integration testing.
 */
export async function runAction(
  customEnv?: ActionEnvironment
): Promise<ActionExecutionResult> {
  const env = customEnv || getActionEnvironment();
  const cwd = env.cwd ? path.resolve(env.cwd) : process.cwd();
  const inputs = env.inputs || {};
  const failOn: ActionFailOn = inputs.failOn || 'error';
  const profile = inputs.profile || 'all';

  core.info('🔍 Running AgentRuleMap in GitHub Actions environment...');
  core.info(`Repository directory: ${cwd}`);

  // 1. Detect base reference
  const baseDetection = await detectActionBase(env, cwd);
  if (baseDetection.error || !baseDetection.base) {
    const errorMsg = baseDetection.error || 'Failed to detect a comparison base.';
    core.error(errorMsg);
    core.setOutput('changed-files', '0');
    core.setOutput('instruction-sources', '0');
    core.setOutput('error-count', '1');
    core.setOutput('warning-count', '0');
    core.setOutput('profiles', profile);

    if (failOn !== 'never') {
      core.setFailed(errorMsg);
      return {
        exitCode: 1,
        changedFilesCount: 0,
        instructionSourcesCount: 0,
        errorCount: 1,
        warningCount: 0,
        profiles: [profile],
        error: errorMsg,
      };
    }

    return {
      exitCode: 0,
      changedFilesCount: 0,
      instructionSourcesCount: 0,
      errorCount: 1,
      warningCount: 0,
      profiles: [profile],
      error: errorMsg,
    };
  }

  const baseRef = baseDetection.base;
  core.info(`Comparison base resolved to: ${baseRef}`);

  // 2. Fetch changed files
  let changedFilesResult;
  try {
    changedFilesResult = await getChangedFiles(
      {
        type: 'base',
        base: baseRef,
      },
      cwd
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    core.error(`Git error during changed file detection: ${msg}`);
    core.setOutput('changed-files', '0');
    core.setOutput('instruction-sources', '0');
    core.setOutput('error-count', '1');
    core.setOutput('warning-count', '0');
    core.setOutput('profiles', profile);

    if (failOn !== 'never') {
      core.setFailed(msg);
      return {
        exitCode: 1,
        changedFilesCount: 0,
        instructionSourcesCount: 0,
        errorCount: 1,
        warningCount: 0,
        profiles: [profile],
        error: msg,
      };
    }

    return {
      exitCode: 0,
      changedFilesCount: 0,
      instructionSourcesCount: 0,
      errorCount: 1,
      warningCount: 0,
      profiles: [profile],
      error: msg,
    };
  }

  const { files: changedFiles, comparisonInfo } = changedFilesResult;
  core.info(`Detected ${changedFiles.length} changed file(s).`);

  // 3. Analyze changed files against instruction rules
  const instructionEngine = new InstructionEngine({ rootDir: cwd });
  const changedEngine = new ChangedEngine(instructionEngine);

  let report: ChangedAnalysisReport;
  if (changedFiles.length === 0) {
    report = {
      schemaVersion: 1,
      command: 'changed',
      repositoryRoot: cwd,
      comparison: comparisonInfo,
      summary: {
        totalChanged: 0,
        added: 0,
        modified: 0,
        deleted: 0,
        renamed: 0,
        copied: 0,
        instructionFilesChanged: 0,
        instructionSourcesInvolved: {
          codex: 0,
          copilot: 0,
          gemini: 0,
          generic: 0,
        },
        distinctScopes: {
          codex: 0,
          copilot: 0,
          gemini: 0,
          generic: 0,
        },
      },
      changedInstructionFiles: [],
      scopeSummary: {
        codex: { profile: 'codex', distinctScopes: [], multipleScopesDetected: false },
        copilot: { profile: 'copilot', distinctScopes: [], multipleScopesDetected: false },
        gemini: { profile: 'gemini', distinctScopes: [], multipleScopesDetected: false },
        generic: { profile: 'generic', distinctScopes: [], multipleScopesDetected: false },
      },
      files: [],
      diagnostics: [],
      deterministicModeNotice:
        'Deterministic analysis performed. Only structural instruction mappings and verifiable Git changes are reported.',
    };
  } else {
    report = await changedEngine.analyzeChangedFiles(
      changedFiles,
      comparisonInfo,
      {
        profile,
        compareInstructions: true,
      }
    );
  }

  const errorCount = report.diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = report.diagnostics.filter((d) => d.severity === 'warning').length;

  // 4. Emit workflow command annotations safely via official @actions/core
  for (const diag of report.diagnostics) {
    const annotationProperties: core.AnnotationProperties = {};
    if (diag.sourcePath) {
      annotationProperties.file = diag.sourcePath;
    }
    if (typeof diag.line === 'number' && diag.line > 0) {
      annotationProperties.startLine = diag.line;
    }
    if (typeof diag.column === 'number' && diag.column > 0) {
      annotationProperties.startColumn = diag.column;
    }
    annotationProperties.title = `AgentRuleMap: ${diag.id}`;

    if (diag.severity === 'error') {
      core.error(diag.message, annotationProperties);
    } else if (diag.severity === 'warning') {
      core.warning(diag.message, annotationProperties);
    } else {
      core.notice(diag.message, annotationProperties);
    }
  }

  // 5. Generate SARIF if configured or requested
  let sarifFilePath: string | undefined;
  const sarifFileName = inputs.sarifFile || 'agentrulemap.sarif';
  const shouldWriteSarif = inputs.output === 'sarif' || Boolean(inputs.sarifFile);

  if (shouldWriteSarif) {
    const targetSarifPath = path.isAbsolute(sarifFileName)
      ? sarifFileName
      : path.join(cwd, sarifFileName);
    const sarifLog = generateSarifReport(report.diagnostics, {
      toolName: 'AgentRuleMap',
      version: '1.0.0',
    });
    fs.writeFileSync(targetSarifPath, formatSarifReport(sarifLog), 'utf8');
    sarifFilePath = targetSarifPath;
    core.setOutput('sarif-file', targetSarifPath);
    core.info(`Generated SARIF 2.1.0 report at: ${targetSarifPath}`);
  }

  // 6. Format Markdown Step Summary
  const summaryMarkdown = formatStepSummaryMarkdown(report, baseRef, false);

  // Write to GITHUB_STEP_SUMMARY
  const summaryFile = env.stepSummaryPath || process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      fs.appendFileSync(summaryFile, summaryMarkdown + '\n', 'utf8');
      core.info('Step summary successfully written to GITHUB_STEP_SUMMARY.');
    } catch (err) {
      core.warning(
        `Failed writing to GITHUB_STEP_SUMMARY: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // 7. PR Commenting (Opt-in)
  let prCommentPosted = false;
  if (inputs.prComment) {
    const commentMarkdown = formatStepSummaryMarkdown(report, baseRef, true);
    const commentResult = await postOrUpdatePrComment(commentMarkdown, env);
    prCommentPosted = commentResult.success;
  }

  // 8. Set compact machine-readable outputs
  const activeSourcesSet = new Set<string>();
  for (const f of report.files) {
    for (const p of Object.values(f.profiles)) {
      for (const s of p.matchedSources) {
        activeSourcesSet.add(s);
      }
    }
  }
  const profilesList = Object.keys(report.scopeSummary).join(',');

  core.setOutput('changed-files', String(report.summary.totalChanged));
  core.setOutput('instruction-sources', String(activeSourcesSet.size));
  core.setOutput('error-count', String(errorCount));
  core.setOutput('warning-count', String(warningCount));
  core.setOutput('profiles', profilesList);

  // 9. Evaluate exit status based on fail-on policy
  let exitCode = 0;
  if (failOn === 'error' && errorCount > 0) {
    exitCode = 1;
  } else if (failOn === 'warning' && (errorCount > 0 || warningCount > 0)) {
    exitCode = 1;
  }

  if (exitCode === 1) {
    core.setFailed(
      `AgentRuleMap identified ${errorCount} error(s) and ${warningCount} warning(s) with policy fail-on="${failOn}".`
    );
  } else {
    core.info(
      `AgentRuleMap check completed successfully (${errorCount} errors, ${warningCount} warnings).`
    );
  }

  return {
    exitCode,
    changedFilesCount: report.summary.totalChanged,
    instructionSourcesCount: activeSourcesSet.size,
    errorCount,
    warningCount,
    profiles: Object.keys(report.scopeSummary),
    sarifFilePath,
    stepSummaryMarkdown: summaryMarkdown,
    prCommentPosted,
  };
}
