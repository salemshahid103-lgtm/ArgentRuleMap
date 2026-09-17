import path from 'node:path';
import chalk from 'chalk';
import { InstructionEngine } from '../core/instructionEngine.js';
import { ChangedEngine } from '../changed/changedEngine.js';
import {
  getChangedFiles,
  GitError,
} from '../git/safeGit.js';
import type {
  ChangedAnalysisOptions,
  ChangedAnalysisReport,
} from '../changed/types.js';
import type { Diagnostic } from '../types/engine.js';
import { generateSarifReport, formatSarifReport } from '../reporters/sarifReporter.js';

export async function changedCommand(
  options: ChangedAnalysisOptions = {}
): Promise<{ report?: ChangedAnalysisReport; exitCode: number }> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const isSarif = options.sarif || options.format === 'sarif';
  const isJson = options.json || options.format === 'json';

  // Validate flags: mutual exclusion between staged, unstaged, base
  if (options.staged && options.unstaged) {
    console.error(
      chalk.red('Error: Cannot specify both --staged and --unstaged together.')
    );
    process.exitCode = 1;
    return { exitCode: 1 };
  }

  if (options.base && (options.staged || options.unstaged)) {
    console.error(
      chalk.red(
        'Error: Cannot specify --base together with --staged or --unstaged.'
      )
    );
    process.exitCode = 1;
    return { exitCode: 1 };
  }

  // Determine comparison mode
  let comparisonType: 'base' | 'staged' | 'unstaged' | 'default' = 'default';
  if (options.staged) comparisonType = 'staged';
  else if (options.unstaged) comparisonType = 'unstaged';
  else if (options.base) comparisonType = 'base';

  let changedFilesResult;
  try {
    changedFilesResult = await getChangedFiles(
      {
        type: comparisonType,
        base: options.base,
      },
      cwd
    );
  } catch (err: unknown) {
    if (err instanceof GitError) {
      if (isSarif) {
        const sarifLog = generateSarifReport([
          {
            id: `GIT_${err.details.code}`,
            severity: 'error',
            title: 'Git Operation Error',
            message: err.details.message,
          },
        ]);
        console.log(formatSarifReport(sarifLog));
      } else if (isJson) {
        console.log(
          JSON.stringify(
            {
              schemaVersion: 1,
              command: 'changed',
              error: {
                code: err.details.code,
                message: err.details.message,
              },
            },
            null,
            2
          )
        );
      } else {
        console.error(chalk.red(`Git Error: ${err.message}`));
      }
      process.exitCode = 1;
      return { exitCode: 1 };
    }

    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Unexpected Error: ${msg}`));
    process.exitCode = 1;
    return { exitCode: 1 };
  }

  const { files: changedFiles, comparisonInfo } = changedFilesResult;

  // Initialize instruction and changed engines
  const instructionEngine = new InstructionEngine({ rootDir: cwd });
  const changedEngine = new ChangedEngine(instructionEngine);

  // If no files changed
  if (changedFiles.length === 0) {
    const emptyReport: ChangedAnalysisReport = {
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

    if (isSarif) {
      const sarifLog = generateSarifReport([]);
      console.log(formatSarifReport(sarifLog));
    } else if (isJson) {
      console.log(JSON.stringify(emptyReport, null, 2));
    } else {
      console.log(chalk.bold('AgentRuleMap Changed Files Analysis'));
      console.log(`Repository: ${cwd}`);
      console.log(`Comparison: ${comparisonInfo.description}`);
      console.log('');
      console.log('No changed files found for this comparison.');
    }
    process.exitCode = 0;
    return { report: emptyReport, exitCode: 0 };
  }

  const report = await changedEngine.analyzeChangedFiles(
    changedFiles,
    comparisonInfo,
    {
      profile: options.profile || 'all',
      compareInstructions: Boolean(options.compareInstructions),
    }
  );

  if (isSarif) {
    const sarifLog = generateSarifReport(report.diagnostics);
    console.log(formatSarifReport(sarifLog));
  } else if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanChangedReport(report, options);
  }

  // Strict mode: exit code 1 if error diagnostics exist
  const hasErrors = report.diagnostics.some((d) => d.severity === 'error');
  const exitCode = options.strict && hasErrors ? 1 : 0;
  process.exitCode = exitCode;

  return { report, exitCode };
}

function printHumanChangedReport(
  report: ChangedAnalysisReport,
  options: ChangedAnalysisOptions
): void {
  console.log(chalk.bold.cyan('AgentRuleMap Changed Files Analysis'));
  console.log(`Repository: ${chalk.gray(report.repositoryRoot)}`);
  console.log(`Comparison: ${chalk.blue(report.comparison.description)}`);
  console.log(`Profile:    ${options.profile || 'all'}`);
  console.log('');

  // 1. Changed files breakdown
  console.log(chalk.bold(`Changed files: ${report.summary.totalChanged}`));
  for (const file of report.files) {
    let statusLabel: string = file.status;
    if (file.status === 'added') statusLabel = chalk.green('added');
    else if (file.status === 'modified') statusLabel = chalk.yellow('modified');
    else if (file.status === 'deleted') statusLabel = chalk.red('deleted');
    else if (file.status === 'renamed') statusLabel = chalk.magenta('renamed');
    else if (file.status === 'copied') statusLabel = chalk.blue('copied');

    const renameExtra =
      file.oldPath && file.oldPath !== file.path
        ? ` (${chalk.gray(file.oldPath)} → ${chalk.cyan(file.path)})`
        : '';

    console.log(`  ${chalk.bold(file.path)}`);
    console.log(`    status: ${statusLabel}${renameExtra}`);

    // Show per-profile instruction sources
    for (const [profileId, profileData] of Object.entries(file.profiles)) {
      const pName =
        profileId === 'codex'
          ? 'Codex'
          : profileId === 'copilot'
          ? 'GitHub Copilot'
          : profileId === 'gemini'
          ? 'Gemini'
          : 'Generic';

      console.log(`    ${chalk.bold(pName)}:`);
      if (profileData.matchedSources.length === 0) {
        console.log(`      ${chalk.gray('(no instructions apply)')}`);
      } else {
        for (const src of profileData.matchedSources) {
          console.log(`      ${src}`);
        }
      }
    }

    // Rename scope change details
    if (file.renameScopeDiff?.changed) {
      console.log(
        chalk.yellow('    Instruction scope changed after rename:')
      );
      for (const [pId, oldList] of Object.entries(
        file.renameScopeDiff.oldSources
      )) {
        const newList =
          (file.renameScopeDiff.newSources as Record<string, string[]>)[pId] ||
          [];
        const oldStr = oldList.length ? oldList.join(', ') : '(none)';
        const newStr = newList.length ? newList.join(', ') : '(none)';
        if (oldStr !== newStr) {
          console.log(`      ${pId}:`);
          console.log(`        Old: ${chalk.gray(oldStr)}`);
          console.log(`        New: ${chalk.cyan(newStr)}`);
        }
      }
    }

    // Compare instructions details
    if (file.instructionComparison?.changed) {
      console.log(
        chalk.yellow('    Instruction mapping difference vs base:')
      );
      for (const detail of file.instructionComparison.details) {
        console.log(`      ${detail}`);
      }
    }

    console.log('');
  }

  // 2. Changed instruction files section
  if (report.changedInstructionFiles.length > 0) {
    console.log(chalk.bold.yellow('Instruction sources modified in this change set:'));
    for (const cif of report.changedInstructionFiles) {
      console.log(`  ${chalk.bold(cif.path)} (${cif.status})`);
      if (cif.affectedChangedFiles.length > 0) {
        console.log(`  Potentially affected changed targets:`);
        for (const affected of cif.affectedChangedFiles) {
          console.log(`    ${chalk.cyan(affected)}`);
        }
      } else {
        console.log(`    (No other changed files fall under this scope)`);
      }
    }
    console.log('');
  }

  // 3. Multiple instruction scopes detection
  const multiScopeProfiles = Object.values(report.scopeSummary).filter(
    (s) => s.multipleScopesDetected
  );

  if (multiScopeProfiles.length > 0) {
    console.log(
      chalk.bold.cyan('Scope Analysis: Multiple Instruction Scopes Detected')
    );
    console.log(
      'The changed files span multiple instruction scopes. Review each scope before using a coding agent across the entire change set.'
    );

    for (const s of multiScopeProfiles) {
      const pName =
        s.profile === 'codex'
          ? 'Codex'
          : s.profile === 'copilot'
          ? 'GitHub Copilot'
          : s.profile === 'gemini'
          ? 'Gemini'
          : 'Generic';

      console.log(`  ${pName} (${s.distinctScopes.length} scopes):`);
      s.distinctScopes.forEach((sc, idx) => {
        console.log(`    ${idx + 1}. ${sc}`);
      });
    }
    console.log('');
  }

  // 4. Aggregate factual summary counts
  console.log(chalk.bold('Summary:'));
  console.log(`  Changed files: ${report.summary.totalChanged}`);
  console.log(`  Added: ${report.summary.added}`);
  console.log(`  Modified: ${report.summary.modified}`);
  console.log(`  Deleted: ${report.summary.deleted}`);
  console.log(`  Renamed: ${report.summary.renamed}`);
  if (report.summary.copied > 0) {
    console.log(`  Copied: ${report.summary.copied}`);
  }

  console.log('  Instruction sources involved:');
  for (const [pId, count] of Object.entries(
    report.summary.instructionSourcesInvolved
  )) {
    const pName =
      pId === 'codex'
        ? 'Codex'
        : pId === 'copilot'
        ? 'GitHub Copilot'
        : pId === 'gemini'
        ? 'Gemini'
        : 'Generic';
    console.log(`    ${pName}: ${count}`);
  }

  console.log(
    `  Changed instruction files: ${report.summary.instructionFilesChanged}`
  );

  for (const [pId, count] of Object.entries(report.summary.distinctScopes)) {
    const pName =
      pId === 'codex'
        ? 'Codex'
        : pId === 'copilot'
        ? 'GitHub Copilot'
        : pId === 'gemini'
        ? 'Gemini'
        : 'Generic';
    console.log(`  Distinct ${pName} scopes: ${count}`);
  }

  // 5. Diagnostics for involved instruction files
  if (report.diagnostics.length > 0) {
    console.log('');
    console.log(
      chalk.bold.yellow(
        `Diagnostics for involved instruction files (${report.diagnostics.length}):`
      )
    );
    for (const d of report.diagnostics) {
      const tag =
        d.severity === 'error'
          ? chalk.bgRed.black(' ERROR ')
          : d.severity === 'warning'
          ? chalk.bgYellow.black(' WARN ')
          : chalk.bgBlue.black(' INFO ');
      const src = d.sourcePath ? chalk.gray(` ${d.sourcePath}`) : '';
      console.log(`${tag} ${chalk.bold(d.id)}${src}`);
      console.log(`  ${d.message}`);
    }
  }

  console.log('');
  console.log(chalk.gray(`Notice: ${report.deterministicModeNotice}`));
}
