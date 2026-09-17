import chalk from 'chalk';
import type { AnalysisResult } from '../types/index.js';

function formatLabel(label: AnalysisResult['readinessLabel']): string {
  switch (label) {
    case 'EXCELLENT':
      return chalk.green.bold(label);
    case 'GOOD':
      return chalk.cyan.bold(label);
    case 'NEEDS IMPROVEMENT':
      return chalk.yellow.bold(label);
    case 'NOT READY':
      return chalk.red.bold(label);
    default:
      return label;
  }
}

function formatTypes(types: string[]): string {
  return types
    .map((t) => {
      switch (t) {
        case 'typescript':
          return 'TypeScript';
        case 'nodejs':
          return 'Node.js';
        case 'javascript':
          return 'JavaScript';
        case 'react':
          return 'React';
        case 'nextjs':
          return 'Next.js';
        case 'vite':
          return 'Vite';
        case 'python':
          return 'Python';
        default:
          return t;
      }
    })
    .join(' / ');
}

export function formatTerminalReport(result: AnalysisResult, verbose = false): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold('AgentRuleMap'));
  lines.push(`Repository: ${chalk.white.bold(result.repository.name)}`);
  lines.push(`Detected: ${formatTypes(result.repository.detectedTypes)}`);
  lines.push('');

  // Category scores with clean column alignment
  const categories = Object.values(result.categories);
  const maxLabelLength = Math.max(...categories.map((c) => c.label.length));

  for (const cat of categories) {
    const paddedLabel = cat.label.padEnd(maxLabelLength + 2);
    const scoreStr = `${cat.score}/${cat.maxScore}`.padStart(5);
    lines.push(`${paddedLabel} ${chalk.bold(scoreStr)}`);
  }

  // Total Score
  lines.push(chalk.bold(`Score: ${result.score}/100`));
  lines.push('');

  // Check results summary
  // Positive checks (passes)
  const passes = result.checks.filter((c) => c.status === 'pass');
  for (const check of passes) {
    lines.push(chalk.green(`✓ ${check.message}`));
    if (verbose && check.details && check.details.length > 0) {
      for (const d of check.details) {
        lines.push(chalk.dim(`    ${d}`));
      }
    }
  }

  // Warnings
  const warnings = result.warnings;
  for (const warn of warnings) {
    lines.push(chalk.yellow(`⚠ ${warn}`));
  }

  // Errors / Fails
  const fails = result.checks.filter((c) => c.status === 'fail');
  for (const fail of fails) {
    lines.push(chalk.red(`✖ ${fail.message}`));
  }

  lines.push('');
  lines.push(`Agent readiness: ${formatLabel(result.readinessLabel)}`);
  lines.push('');

  return lines.join('\n');
}
