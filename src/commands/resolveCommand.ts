import chalk from 'chalk';
import path from 'node:path';
import { InstructionEngine } from '../core/instructionEngine.js';
import type { InstructionProfileId } from '../types/engine.js';
import { generateSarifReport, formatSarifReport } from '../reporters/sarifReporter.js';

export interface ResolveCommandOptions {
  profile?: string;
  json?: boolean;
  sarif?: boolean;
  format?: 'text' | 'json' | 'sarif';
  cwd?: string;
}

export interface DiscoverCommandOptions {
  profile?: string;
  json?: boolean;
  sarif?: boolean;
  format?: 'text' | 'json' | 'sarif';
  cwd?: string;
}

export function runResolveCommand(
  targetPath: string,
  options: ResolveCommandOptions = {}
): { exitCode: number } {
  const rootDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const engine = new InstructionEngine({ rootDir });

  const rawProfile = (options.profile || 'codex').toLowerCase();
  const profileId: InstructionProfileId =
    rawProfile === 'copilot' ||
    rawProfile === 'gemini' ||
    rawProfile === 'generic'
      ? rawProfile
      : 'codex';

  const resolution = engine.resolve(targetPath, profileId);

  if (options.json) {
    console.log(JSON.stringify(resolution, null, 2));
    const hasError = resolution.diagnostics.some((d) => d.severity === 'error');
    return { exitCode: hasError ? 1 : 0 };
  }

  console.log(chalk.bold.cyan('\nAgentRuleMap Instruction Scope Resolution'));
  console.log(chalk.gray(`Repository: ${rootDir}`));
  console.log(chalk.gray(`Profile:    ${profileId} (${engine.registry.get(profileId).name})`));
  console.log(chalk.gray(`Target:     ${targetPath} -> [${resolution.targetPath.normalized || '(invalid)'}]\n`));

  if (resolution.diagnostics.length > 0) {
    console.log(chalk.bold.yellow('Diagnostics:'));
    for (const diag of resolution.diagnostics) {
      const icon =
        diag.severity === 'error'
          ? chalk.red('✖ [ERROR]')
          : diag.severity === 'warning'
          ? chalk.yellow('⚠ [WARN]')
          : chalk.blue('ℹ [INFO]');
      console.log(`  ${icon} ${diag.id}: ${diag.message}`);
    }
    console.log();
  }

  if (resolution.matchedSources.length === 0) {
    console.log(chalk.yellow('No instruction sources match this target path.'));
  } else {
    console.log(chalk.bold.green(`Matched Instruction Stack (${resolution.matchedSources.length} layer(s)):`));
    console.log(chalk.gray('  (Ordered deterministically: least specific -> most specific)\n'));

    resolution.stack.layers.forEach((layer, idx) => {
      const isOverride = layer.specificity.isOverride ? chalk.magenta(' [OVERRIDE]') : '';
      console.log(
        `  ${chalk.cyan(`Layer ${idx + 1}`)}: ${chalk.bold(layer.source.filePath)}${isOverride}`
      );
      console.log(
        `    ${chalk.gray('• Specificity score:')} ${layer.specificity.score} (depth: ${layer.specificity.depth})`
      );
      console.log(`    ${chalk.gray('• Scope root:')}        ${layer.source.scopeRoot || '/'}`);
      console.log(`    ${chalk.gray('• Reason:')}            ${layer.matchedReason}`);
      console.log();
    });
  }

  if (resolution.rejectedSources.length > 0) {
    console.log(chalk.bold.gray(`Non-applicable / Rejected Candidates (${resolution.rejectedSources.length}):`));
    for (const rejected of resolution.rejectedSources) {
      console.log(chalk.gray(`  - ${rejected.source.filePath}: ${rejected.reason}`));
    }
    console.log();
  }

  const hasError = resolution.diagnostics.some((d) => d.severity === 'error');
  return { exitCode: hasError ? 1 : 0 };
}

export function runDiscoverCommand(
  options: DiscoverCommandOptions = {}
): { exitCode: number } {
  const rootDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const engine = new InstructionEngine({ rootDir });

  const rawProfile = (options.profile || 'generic').toLowerCase();
  const profileId: InstructionProfileId =
    rawProfile === 'codex' ||
    rawProfile === 'copilot' ||
    rawProfile === 'gemini'
      ? rawProfile
      : 'generic';

  const sources = engine.discover(profileId);

  const isSarif = options.sarif || options.format === 'sarif';
  if (isSarif) {
    const allDiagnostics = sources.flatMap((s) => s.diagnostics);
    const sarifLog = generateSarifReport(allDiagnostics);
    console.log(formatSarifReport(sarifLog));
    const hasError = allDiagnostics.some((d) => d.severity === 'error');
    return { exitCode: hasError ? 1 : 0 };
  }

  if (options.json) {
    console.log(JSON.stringify(sources, null, 2));
    return { exitCode: 0 };
  }

  console.log(chalk.bold.cyan('\nAgentRuleMap Instruction Discovery'));
  console.log(chalk.gray(`Repository: ${rootDir}`));
  console.log(chalk.gray(`Profile:    ${profileId}\n`));

  if (sources.length === 0) {
    console.log(chalk.yellow('No instruction files found for this profile.'));
    return { exitCode: 0 };
  }

  console.log(chalk.bold.green(`Found ${sources.length} instruction source(s):\n`));
  for (const s of sources) {
    console.log(`  • ${chalk.bold(s.filePath)} [${s.sourceType}] (scope: "${s.scopeRoot || '/'}")`);
    if (s.diagnostics.length > 0) {
      for (const d of s.diagnostics) {
        console.log(`      ${chalk.yellow(`⚠ ${d.id}: ${d.message}`)}`);
      }
    }
  }
  console.log();

  return { exitCode: 0 };
}
