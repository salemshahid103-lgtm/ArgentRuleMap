import path from 'node:path';
import { analyzeRepository } from '../core/engine.js';
import { formatJsonReport } from '../reporters/jsonReporter.js';
import { formatTerminalReport } from '../reporters/terminalReporter.js';
import type { CheckCommandOptions } from '../types/index.js';

export function runCheckCommand(options: CheckCommandOptions = {}): { exitCode: number; output: string } {
  const targetDir = path.resolve(options.cwd || process.cwd());
  const result = analyzeRepository(targetDir);

  if (options.json) {
    const jsonOutput = formatJsonReport(result, true);
    console.log(jsonOutput);
    return {
      exitCode: result.readinessLabel === 'NOT READY' ? 1 : 0,
      output: jsonOutput,
    };
  }

  const terminalOutput = formatTerminalReport(result, options.verbose ?? false);
  console.log(terminalOutput);

  return {
    exitCode: result.readinessLabel === 'NOT READY' ? 1 : 0,
    output: terminalOutput,
  };
}
