import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { generateAgentsTemplate } from '../generators/agentDocGenerator.js';
import { scanRepository } from '../scanners/fileScanner.js';
import { parseInstructionFile } from '../scanners/instructionParser.js';
import type { FixAction, FixCommandOptions } from '../types/index.js';
import { fileExists, readFileSafe } from '../utils/fsUtils.js';

export function runFixCommand(options: FixCommandOptions = {}): {
  actionsProposed: number;
  actionsApplied: number;
  actions: Array<{ title: string; file: string; description: string }>;
} {
  const targetDir = path.resolve(options.cwd || process.cwd());
  const dryRun = Boolean(options.dryRun);
  const context = scanRepository(targetDir);

  const actions: FixAction[] = [];

  // 1. Missing AGENTS.md entirely
  const agentsMdPath = path.join(targetDir, 'AGENTS.md');
  if (!fileExists(agentsMdPath)) {
    const template = generateAgentsTemplate(context);
    actions.push({
      id: 'create-agents-md',
      title: 'Create missing AGENTS.md instruction file',
      description: 'Generates structured repository guidance populated from package.json and repository tree',
      file: 'AGENTS.md',
      diffOrPreview: template,
      apply: () => {
        fs.writeFileSync(agentsMdPath, template, 'utf-8');
      },
    });
  } else {
    // 2. Existing AGENTS.md missing key sections
    const existingContent = readFileSafe(agentsMdPath) || '';
    const parsed = parseInstructionFile(existingContent, 'AGENTS.md');
    const sectionsToAppend: string[] = [];

    if (!parsed.sections.safety) {
      sectionsToAppend.push(
        `\n## Safety Rules\n- **Secrets**: Never commit \`.env\`, API keys, or private tokens to version control.\n- **Verification**: Always run tests and verify changes before proposing edits.\n- **Destructive Commands**: Confirm with the user before deleting files or running external shell scripts.\n`
      );
    }

    if (!parsed.sections.build && context.packageJson?.scripts?.build) {
      sectionsToAppend.push(
        `\n## Build Commands\n\`\`\`bash\nnpm run build\n\`\`\`\n`
      );
    }

    if (!parsed.sections.test && context.packageJson?.scripts?.test) {
      sectionsToAppend.push(
        `\n## Test Commands\n\`\`\`bash\nnpm test\n\`\`\`\n`
      );
    }

    if (!parsed.sections.paths && Object.keys(context.structure.importantDirs).length > 0) {
      const dirs = Object.entries(context.structure.importantDirs)
        .filter(([_, rel]) => Boolean(rel))
        .map(([k, rel]) => `- \`${rel}/\`: ${k} directory`)
        .join('\n');
      sectionsToAppend.push(
        `\n## Repository Structure\n${dirs}\n`
      );
    }

    if (sectionsToAppend.length > 0) {
      const appendedText = sectionsToAppend.join('\n');
      actions.push({
        id: 'append-missing-sections',
        title: 'Add missing recommended sections to AGENTS.md',
        description: `Appends missing sections (${sectionsToAppend.length} detected) to AGENTS.md`,
        file: 'AGENTS.md',
        diffOrPreview: appendedText,
        apply: () => {
          fs.appendFileSync(agentsMdPath, `\n${appendedText}`, 'utf-8');
        },
      });
    }
  }

  // 3. Sensitive file protection in .gitignore
  const gitignorePath = path.join(targetDir, '.gitignore');
  const gitignoreContent = readFileSafe(gitignorePath) || '';
  const ignoresEnv = gitignoreContent.includes('.env') || gitignoreContent.includes('.env*');

  if (!fileExists(gitignorePath)) {
    const defaultGitignore = `node_modules/\ndist/\nbuild/\n.env*\n!.env.example\n*.log\n`;
    actions.push({
      id: 'create-gitignore',
      title: 'Create .gitignore protecting sensitive environment files',
      description: 'Adds standard .gitignore covering node_modules, build outputs, and .env files',
      file: '.gitignore',
      diffOrPreview: defaultGitignore,
      apply: () => {
        fs.writeFileSync(gitignorePath, defaultGitignore, 'utf-8');
      },
    });
  } else if (!ignoresEnv && context.hasEnvFile) {
    const addition = `\n# Protect environment files\n.env*\n!.env.example\n`;
    actions.push({
      id: 'update-gitignore-env',
      title: 'Add .env protection to .gitignore',
      description: 'Appends .env* exclusion rule to .gitignore to protect secrets from being committed',
      file: '.gitignore',
      diffOrPreview: addition,
      apply: () => {
        fs.appendFileSync(gitignorePath, addition, 'utf-8');
      },
    });
  }

  // 4. Missing .env.example when .env exists
  const envPath = path.join(targetDir, '.env');
  const envExamplePath = path.join(targetDir, '.env.example');
  if (fileExists(envPath) && !fileExists(envExamplePath)) {
    const rawEnv = readFileSafe(envPath) || '';
    const exampleLines = rawEnv
      .split('\n')
      .map((line) => {
        if (line.trim().startsWith('#') || !line.includes('=')) {
          return line;
        }
        const [key] = line.split('=');
        return `${key.trim()}=your_${key.trim().toLowerCase()}_here`;
      })
      .join('\n');

    actions.push({
      id: 'create-env-example',
      title: 'Create .env.example template',
      description: 'Generates sanitized .env.example with placeholders based on detected .env file',
      file: '.env.example',
      diffOrPreview: exampleLines,
      apply: () => {
        fs.writeFileSync(envExamplePath, exampleLines, 'utf-8');
      },
    });
  }

  // Report actions
  console.log('');
  console.log(chalk.bold('AgentRuleMap Fix Plan'));
  if (dryRun) {
    console.log(chalk.cyan.bold('Mode: DRY-RUN (no files will be modified)'));
  }
  console.log('');

  if (actions.length === 0) {
    console.log(chalk.green('✓ No automatic fixes needed. Repository is clean.'));
    return {
      actionsProposed: 0,
      actionsApplied: 0,
      actions: [],
    };
  }

  let appliedCount = 0;

  for (const act of actions) {
    console.log(chalk.blue.bold(`• [${act.file}] ${act.title}`));
    console.log(chalk.dim(`  ${act.description}`));
    console.log(chalk.dim('  Changes preview:'));
    const previewLines = act.diffOrPreview
      .trim()
      .split('\n')
      .slice(0, 10)
      .map((l) => chalk.dim(`    + ${l}`))
      .join('\n');
    console.log(previewLines);
    if (act.diffOrPreview.trim().split('\n').length > 10) {
      console.log(chalk.dim('    + ... [truncated]'));
    }

    if (!dryRun) {
      try {
        act.apply();
        appliedCount++;
        console.log(chalk.green(`  ✓ Applied fix to ${act.file}`));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`  ✖ Failed to apply fix to ${act.file}: ${msg}`));
      }
    } else {
      console.log(chalk.cyan(`  → [dry-run] Would apply fix to ${act.file}`));
    }
    console.log('');
  }

  if (dryRun) {
    console.log(
      chalk.cyan(`Dry run complete. ${actions.length} potential fix(es) identified. Run without --dry-run to apply.`)
    );
  } else {
    console.log(chalk.green(`Applied ${appliedCount} of ${actions.length} fix(es).`));
  }
  console.log('');

  return {
    actionsProposed: actions.length,
    actionsApplied: appliedCount,
    actions: actions.map((a) => ({ title: a.title, file: a.file, description: a.description })),
  };
}
