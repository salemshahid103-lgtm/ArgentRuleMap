import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { generateAgentsTemplate } from '../generators/agentDocGenerator.js';
import { scanRepository } from '../scanners/fileScanner.js';
import type { InitCommandOptions } from '../types/index.js';
import { fileExists } from '../utils/fsUtils.js';

export function runInitCommand(options: InitCommandOptions = {}): {
  success: boolean;
  message: string;
  targetPath: string;
} {
  const targetDir = path.resolve(options.cwd || process.cwd());
  const agentsPath = path.join(targetDir, 'AGENTS.md');

  if (fileExists(agentsPath) && !options.force) {
    const message = `AGENTS.md already exists at ${agentsPath}. Use ${chalk.cyan('--force')} to overwrite.`;
    console.warn(chalk.yellow(`⚠ ${message}`));
    return {
      success: false,
      message,
      targetPath: agentsPath,
    };
  }

  const context = scanRepository(targetDir);
  const content = generateAgentsTemplate(context);

  try {
    fs.writeFileSync(agentsPath, content, 'utf-8');
    const message = `Generated AGENTS.md successfully at ${path.relative(process.cwd(), agentsPath) || 'AGENTS.md'}`;
    console.log(chalk.green(`✓ ${message}`));
    return {
      success: true,
      message,
      targetPath: agentsPath,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const message = `Failed to write AGENTS.md: ${errMsg}`;
    console.error(chalk.red(`✖ ${message}`));
    return {
      success: false,
      message,
      targetPath: agentsPath,
    };
  }
}
