import path from 'node:path';
import chalk from 'chalk';
import { fileURLToPath } from 'node:url';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { ConflictEngine } from '../src/diagnostics/conflictEngine.js';
import { CoverageEngine, formatCoverageText } from '../src/coverage/coverageEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'examples');

console.log(chalk.bold.cyan('\n======================================================'));
console.log(chalk.bold.cyan('           AgentRuleMap Deterministic Demo            '));
console.log(chalk.bold.cyan('======================================================\n'));

// 1. Scan / Discovery Demo on examples/monorepo
console.log(chalk.bold.yellow('▶ STEP 1: Scan (Discovery) on "examples/monorepo"'));
console.log(chalk.gray('Discovering instruction sources across monorepo boundaries...\n'));

const monorepoPath = path.join(examplesDir, 'monorepo');
const monorepoEngine = new InstructionEngine({ rootDir: monorepoPath });
const monorepoSources = monorepoEngine.discover('codex');

console.log(chalk.bold(`Discovered ${monorepoSources.length} instruction source(s):`));
for (const src of monorepoSources) {
  console.log(`  • ${chalk.green(src.filePath)} [profile: ${src.profile}, type: ${src.sourceType}, scopeRoot: "${src.scopeRoot}"]`);
}
console.log('');

// 2. Explain / Resolve Demo on examples/nested-agents
console.log(chalk.bold.yellow('▶ STEP 2: Explain / Resolve on "examples/nested-agents" (Target: src/api/users.ts)'));
console.log(chalk.gray('Evaluating specificity hierarchy for target path in nested directory tree...\n'));

const nestedPath = path.join(examplesDir, 'nested-agents');
const nestedEngine = new InstructionEngine({ rootDir: nestedPath });
const resolution = nestedEngine.resolve('src/api/users.ts', 'codex');

console.log(`Target: ${chalk.bold('src/api/users.ts')}`);
console.log(`Active Stack (${resolution.stack.layers.length} layers in precedence order):`);
for (const layer of resolution.stack.layers) {
  console.log(`  Layer ${layer.layerIndex}: ${chalk.cyan(layer.source.filePath)} (specificity: ${layer.specificity.score})`);
  console.log(`    ↳ Reason: ${layer.matchedReason}`);
}
console.log('');

// 3. Coverage Demo on examples/copilot-scopes
console.log(chalk.bold.yellow('▶ STEP 3: Coverage on "examples/copilot-scopes"'));
console.log(chalk.gray('Analyzing instruction file coverage across repository paths...\n'));

const copilotPath = path.join(examplesDir, 'copilot-scopes');
const copilotEngine = new InstructionEngine({ rootDir: copilotPath });
const coverageEngine = new CoverageEngine(copilotEngine);
const coverageReport = coverageEngine.generateCoverage('copilot');

if (coverageReport.profiles.copilot) {
  console.log(formatCoverageText(coverageReport.profiles.copilot));
}
console.log('');

// 4. Conflicts Demo on examples/broken-repo
console.log(chalk.bold.yellow('▶ STEP 4: Conflict & Diagnostic Audit on "examples/broken-repo"'));
console.log(chalk.gray('Detecting objective structural conflicts, invalid globs, and stale references...\n'));

const brokenPath = path.join(examplesDir, 'broken-repo');
const brokenEngine = new InstructionEngine({ rootDir: brokenPath });
const conflictEngine = new ConflictEngine(brokenEngine);
const conflictReport = conflictEngine.runConflicts({ profile: 'all' });

console.log(chalk.bold(`Findings detected: ${conflictReport.summary.total} (Errors: ${conflictReport.summary.errors}, Warnings: ${conflictReport.summary.warnings})`));
for (const diag of conflictReport.diagnostics) {
  const icon = diag.severity === 'error' ? chalk.red('✖ [ERROR]') : chalk.yellow('⚠ [WARN]');
  console.log(`  ${icon} ${chalk.bold(diag.id)}: ${diag.title}`);
  console.log(`     Message:     ${diag.message}`);
  if (diag.sourcePath) {
    console.log(`     Source:      ${diag.sourcePath}`);
  }
  if (diag.remediation) {
    console.log(`     Remediation: ${chalk.cyan(diag.remediation)}`);
  }
}

console.log(chalk.bold.green('\n✔ Demo completed successfully in deterministic offline mode.\n'));
