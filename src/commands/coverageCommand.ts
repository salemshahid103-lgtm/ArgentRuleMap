import chalk from 'chalk';
import { InstructionEngine } from '../core/instructionEngine.js';
import {
  CoverageEngine,
  formatCoverageText,
  type FullCoverageReport,
} from '../coverage/coverageEngine.js';
import type { InstructionProfileId } from '../types/engine.js';

export interface CoverageCommandOptions {
  profile?: string;
  json?: boolean;
  cwd?: string;
}

export async function coverageCommand(
  options: CoverageCommandOptions
): Promise<FullCoverageReport> {
  const rootDir = options.cwd || process.cwd();
  const rawProfile = options.profile as InstructionProfileId | 'all' | undefined;

  const engine = new InstructionEngine({ rootDir });
  const coverageEngine = new CoverageEngine(engine);

  const report = coverageEngine.generateCoverage(rawProfile);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextCoverageReport(report);
  }

  return report;
}

function printTextCoverageReport(report: FullCoverageReport): void {
  const profileKeys = Object.keys(report.profiles) as InstructionProfileId[];

  for (let i = 0; i < profileKeys.length; i++) {
    const pid = profileKeys[i];
    const profReport = report.profiles[pid];
    console.log(formatCoverageText(profReport));
    if (i < profileKeys.length - 1) {
      console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
    }
  }
}
