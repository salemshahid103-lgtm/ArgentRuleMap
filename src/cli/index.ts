import { Command } from 'commander';
import { getVersion } from '../version.js';
import { runCheckCommand } from '../commands/checkCommand.js';
import { runInitCommand } from '../commands/initCommand.js';
import { runFixCommand } from '../commands/fixCommand.js';
import { runResolveCommand, runDiscoverCommand } from '../commands/resolveCommand.js';
import { conflictsCommand } from '../commands/conflictsCommand.js';
import { coverageCommand } from '../commands/coverageCommand.js';
import { changedCommand } from '../commands/changedCommand.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('agentrulemap')
    .description('Deterministic AI coding-agent instruction discovery, scope resolution, conflicts & coverage engine')
    .version(getVersion());

  program
    .command('check')
    .description('Analyze the repository and verify agent readiness')
    .option('-j, --json', 'Output results as structured JSON')
    .option('-v, --verbose', 'Show detailed check explanations')
    .option('-C, --cwd <path>', 'Target directory to analyze (default: current directory)')
    .action((opts) => {
      const { exitCode } = runCheckCommand({
        json: Boolean(opts.json),
        verbose: Boolean(opts.verbose),
        cwd: opts.cwd,
      });
      process.exitCode = exitCode;
    });

  program
    .command('init')
    .description('Generate an AGENTS.md template tailored to the actual repository')
    .option('-f, --force', 'Overwrite existing AGENTS.md if present')
    .option('-C, --cwd <path>', 'Target directory (default: current directory)')
    .action((opts) => {
      const result = runInitCommand({
        force: Boolean(opts.force),
        cwd: opts.cwd,
      });
      process.exitCode = result.success ? 0 : 1;
    });

  program
    .command('fix')
    .description('Perform safe deterministic fixes (add missing sections, update gitignore, etc.)')
    .option('-d, --dry-run', 'Show proposed changes without writing to disk')
    .option('-C, --cwd <path>', 'Target directory (default: current directory)')
    .action((opts) => {
      runFixCommand({
        dryRun: Boolean(opts.dryRun),
        cwd: opts.cwd,
      });
      process.exitCode = 0;
    });

  program
    .command('resolve <targetPath>')
    .description('Resolve which AI instruction files apply to a specific target file path')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic (default: codex)', 'codex')
    .option('-j, --json', 'Output resolution as structured JSON')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action((targetPath, opts) => {
      const { exitCode } = runResolveCommand(targetPath, {
        profile: opts.profile,
        json: Boolean(opts.json),
        cwd: opts.cwd,
      });
      process.exitCode = exitCode;
    });

  // trace & explain aliases for resolve
  program
    .command('trace <targetPath>')
    .description('Trace which instruction sources match a target path with precedence ordering')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic (default: codex)', 'codex')
    .option('-j, --json', 'Output trace as structured JSON')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action((targetPath, opts) => {
      const { exitCode } = runResolveCommand(targetPath, {
        profile: opts.profile,
        json: Boolean(opts.json),
        cwd: opts.cwd,
      });
      process.exitCode = exitCode;
    });

  program
    .command('explain <targetPath>')
    .description('Explain why specific instruction sources apply or do not apply to a target path')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic (default: codex)', 'codex')
    .option('-j, --json', 'Output explanation as structured JSON')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action((targetPath, opts) => {
      const { exitCode } = runResolveCommand(targetPath, {
        profile: opts.profile,
        json: Boolean(opts.json),
        cwd: opts.cwd,
      });
      process.exitCode = exitCode;
    });

  program
    .command('discover')
    .description('Discover all AI agent instruction files in the repository for a profile')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic (default: generic)', 'generic')
    .option('-j, --json', 'Output discovered sources as structured JSON')
    .option('--sarif', 'Output discovered sources and diagnostics as SARIF 2.1.0')
    .option('--format <format>', 'Output format: text, json, sarif (default: text)', 'text')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action((opts) => {
      const { exitCode } = runDiscoverCommand({
        profile: opts.profile,
        json: Boolean(opts.json),
        sarif: Boolean(opts.sarif),
        format: opts.format,
        cwd: opts.cwd,
      });
      process.exitCode = exitCode;
    });

  // scan alias for discover
  program
    .command('scan')
    .description('Scan repository to discover instruction sources')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic (default: generic)', 'generic')
    .option('-j, --json', 'Output scan as structured JSON')
    .option('--sarif', 'Output scan and diagnostics as SARIF 2.1.0')
    .option('--format <format>', 'Output format: text, json, sarif (default: text)', 'text')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action((opts) => {
      const { exitCode } = runDiscoverCommand({
        profile: opts.profile,
        json: Boolean(opts.json),
        sarif: Boolean(opts.sarif),
        format: opts.format,
        cwd: opts.cwd,
      });
      process.exitCode = exitCode;
    });

  program
    .command('conflicts')
    .description('Find objectively detectable structural conflicts, stale references, and invalid scopes')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic, all (default: all)', 'all')
    .option('-j, --json', 'Output report as deterministic structured JSON')
    .option('--sarif', 'Output report as SARIF 2.1.0')
    .option('--format <format>', 'Output format: text, json, sarif (default: text)', 'text')
    .option('-s, --strict', 'Exit with code 1 if any error-level diagnostic is detected')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action(async (opts) => {
      await conflictsCommand({
        profile: opts.profile,
        json: Boolean(opts.json),
        sarif: Boolean(opts.sarif),
        format: opts.format,
        strict: Boolean(opts.strict),
        cwd: opts.cwd,
      });
    });

  program
    .command('coverage')
    .description('Describe where instruction coverage exists across repository boundaries')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic, all (default: all)', 'all')
    .option('-j, --json', 'Output coverage report as structured JSON')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action(async (opts) => {
      await coverageCommand({
        profile: opts.profile,
        json: Boolean(opts.json),
        cwd: opts.cwd,
      });
    });

  program
    .command('changed')
    .description('Analyze which AI coding-agent instructions apply to files changed in branch, commit, staged, or PR')
    .option('-b, --base <ref>', 'Git base revision to compare working tree against (e.g. main, origin/main, HEAD~1)')
    .option('--staged', 'Analyze staged changes (HEAD ↔ index)')
    .option('--unstaged', 'Analyze unstaged changes (index ↔ working tree)')
    .option('--compare-instructions', 'Compare instruction mappings between base revision and working tree')
    .option('-p, --profile <profile>', 'Agent profile: codex, copilot, gemini, generic, all (default: all)', 'all')
    .option('-j, --json', 'Output report as deterministic structured JSON')
    .option('--sarif', 'Output report as SARIF 2.1.0')
    .option('--format <format>', 'Output format: text, json, sarif (default: text)', 'text')
    .option('-s, --strict', 'Exit with code 1 if any error-level diagnostic is detected')
    .option('-C, --cwd <path>', 'Repository root directory (default: current directory)')
    .action(async (opts) => {
      await changedCommand({
        base: opts.base,
        staged: Boolean(opts.staged),
        unstaged: Boolean(opts.unstaged),
        compareInstructions: Boolean(opts.compareInstructions),
        profile: opts.profile,
        json: Boolean(opts.json),
        sarif: Boolean(opts.sarif),
        format: opts.format,
        strict: Boolean(opts.strict),
        cwd: opts.cwd,
      });
    });

  return program;
}

export function run(): void {
  const program = createCli();
  program.parse(process.argv);
}

run();

