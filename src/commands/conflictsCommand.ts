import chalk from 'chalk';
import { InstructionEngine } from '../core/instructionEngine.js';
import { ConflictEngine } from '../diagnostics/conflictEngine.js';
import type { InstructionProfileId } from '../types/engine.js';
import type { ConflictReport, Diagnostic } from '../diagnostics/types.js';
import { generateSarifReport, formatSarifReport } from '../reporters/sarifReporter.js';

export interface ConflictsCommandOptions {
  profile?: string;
  json?: boolean;
  sarif?: boolean;
  format?: 'text' | 'json' | 'sarif';
  strict?: boolean;
  cwd?: string;
}

export async function conflictsCommand(
  options: ConflictsCommandOptions
): Promise<ConflictReport> {
  const rootDir = options.cwd || process.cwd();
  const profileId = (options.profile as InstructionProfileId | 'all') || 'all';

  const engine = new InstructionEngine({ rootDir });
  const conflictEngine = new ConflictEngine(engine);

  const report = conflictEngine.runConflicts({
    profile: profileId,
    strict: options.strict,
  });

  const isSarif = options.sarif || options.format === 'sarif';
  const isJson = options.json || options.format === 'json';

  if (isSarif) {
    const sarifLog = generateSarifReport(report.diagnostics);
    console.log(formatSarifReport(sarifLog));
  } else if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextConflictReport(report);
  }

  if (options.strict && report.summary.errors > 0) {
    process.exitCode = 1;
  }

  return report;
}

function printTextConflictReport(report: ConflictReport): void {
  console.log(chalk.bold.cyan('\nAgentRuleMap Conflicts'));
  console.log(chalk.gray(`Repository: ${report.repositoryRoot}`));
  console.log(chalk.gray(`Profile:    ${report.profile}\n`));

  if (report.diagnostics.length === 0) {
    console.log(
      chalk.green('✔ No structural conflicts or stale references detected.')
    );
  } else {
    console.log(chalk.bold(`Findings (${report.diagnostics.length}):\n`));

    for (const d of report.diagnostics) {
      printDiagnostic(d);
    }
  }

  console.log('');
  const errText = report.summary.errors > 0
    ? chalk.red(`${report.summary.errors} error${report.summary.errors > 1 ? 's' : ''}`)
    : chalk.gray('0 errors');
  const warnText = report.summary.warnings > 0
    ? chalk.yellow(`${report.summary.warnings} warning${report.summary.warnings > 1 ? 's' : ''}`)
    : chalk.gray('0 warnings');
  const infoText = report.summary.info > 0
    ? chalk.blue(`${report.summary.info} info`)
    : chalk.gray('0 info');

  console.log(
    chalk.bold(
      `Summary: ${errText}, ${warnText}, ${infoText} (${report.summary.total} total)`
    )
  );

  console.log(chalk.gray(`\nNotice: ${report.deterministicModeNotice}\n`));
}

function printDiagnostic(d: Diagnostic): void {
  const badge =
    d.severity === 'error'
      ? chalk.bgRed.white(' ERROR ')
      : d.severity === 'warning'
      ? chalk.bgYellow.black(' WARN ')
      : chalk.bgBlue.white(' INFO ');

  const idTag = chalk.bold(d.id);
  const location = d.sourcePath
    ? chalk.cyan(d.sourcePath + (d.line ? `:${d.line}${d.column ? `:${d.column}` : ''}` : ''))
    : '';

  console.log(`${badge} ${idTag} ${location}`);
  console.log(`  ${d.message}`);

  if (d.remediation) {
    console.log(`  ${chalk.dim('Remediation:')} ${chalk.green(d.remediation)}`);
  }
  console.log('');
}
