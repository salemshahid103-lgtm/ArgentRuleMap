import type { ChangedAnalysisReport } from '../changed/types.js';
import type { InstructionProfileId } from '../types/engine.js';

export const PR_COMMENT_MARKER = '<!-- agentrulemap-pr-comment -->';

/**
 * Escapes characters that could be interpreted as Markdown formatting or HTML tags.
 */
export function sanitizeMarkdown(input: string): string {
  if (!input) return '';
  return input
    .replace(/[&<>"']/g, (match) => {
      switch (match) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return match;
      }
    })
    .replace(/[*_~|]/g, (match) => `\\${match}`);
}

/**
 * Escapes text that will be rendered inside an inline code span (`...`).
 */
export function sanitizeCodeSpan(input: string): string {
  if (!input) return '';
  return input.replace(/`/g, "'");
}

/**
 * Formats a clean, compact, readable GitHub Step Summary markdown.
 */
export function formatStepSummaryMarkdown(
  report: ChangedAnalysisReport,
  baseRef: string,
  isComment = false
): string {
  const lines: string[] = [];

  if (isComment) {
    lines.push(PR_COMMENT_MARKER);
  }

  const errCount = report.diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = report.diagnostics.filter((d) => d.severity === 'warning').length;

  const headerStatus =
    errCount > 0
      ? '🔴 **AgentRuleMap: Issues Detected**'
      : warnCount > 0
      ? '🟡 **AgentRuleMap: Warnings Detected**'
      : '🟢 **AgentRuleMap: All Rules Verified**';

  lines.push(`## ${headerStatus}`);
  lines.push('');

  // 1. Overview stats table
  lines.push('| Metric | Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| **Changed Files** | \`${report.summary.totalChanged}\` |`);

  // Instruction files changed
  const changedInstructions = report.changedInstructionFiles;
  lines.push(
    `| **Instruction Files Modified** | \`${changedInstructions.length}\` |`
  );

  // Profiles evaluated
  const evaluatedProfiles = Object.keys(report.scopeSummary) as InstructionProfileId[];
  const profileLabels = evaluatedProfiles
    .map((p) => {
      switch (p) {
        case 'codex':
          return 'Codex';
        case 'copilot':
          return 'GitHub Copilot';
        case 'gemini':
          return 'Gemini';
        case 'generic':
        default:
          return 'Generic';
      }
    })
    .join(', ');
  lines.push(`| **Profiles Detected** | ${profileLabels} |`);

  // Findings
  const findingsSummary =
    errCount === 0 && warnCount === 0
      ? '0 errors, 0 warnings'
      : `${errCount} error${errCount === 1 ? '' : 's'}, ${warnCount} warning${warnCount === 1 ? '' : 's'}`;
  lines.push(`| **Findings** | ${findingsSummary} |`);
  lines.push('');

  // 2. Modified instruction files section
  if (changedInstructions.length > 0) {
    lines.push('### 📝 Changed Instruction Files');
    lines.push('');
    for (const cif of changedInstructions) {
      const sanitizedPath = sanitizeCodeSpan(cif.path);
      const affectedCount = cif.affectedChangedFiles.length;
      lines.push(
        `- \`${sanitizedPath}\` (${cif.status}) — applies to **${affectedCount}** changed file(s)`
      );
    }
    lines.push('');
  }

  // 3. Instruction sources involved
  const activeSourcesSet = new Set<string>();
  for (const f of report.files) {
    for (const p of Object.values(f.profiles)) {
      for (const s of p.matchedSources) {
        activeSourcesSet.add(s);
      }
    }
  }

  if (activeSourcesSet.size > 0) {
    lines.push('### 🎯 Instruction Sources Governing Changed Files');
    lines.push('');
    for (const source of Array.from(activeSourcesSet).sort()) {
      lines.push(`- \`${sanitizeCodeSpan(source)}\``);
    }
    lines.push('');
  }

  // 4. Diagnostics list (if any)
  if (report.diagnostics.length > 0) {
    lines.push('### ⚠️ Diagnostics');
    lines.push('');
    for (const diag of report.diagnostics) {
      const badge = diag.severity === 'error' ? '❌ **Error**' : '⚠️ **Warning**';
      const loc = diag.sourcePath
        ? `(\`${sanitizeCodeSpan(diag.sourcePath)}${diag.line ? `:${diag.line}` : ''}\`)`
        : '';
      lines.push(
        `- ${badge} **[${sanitizeCodeSpan(diag.id)}]** ${loc}: ${sanitizeMarkdown(diag.message)}`
      );
      if (diag.remediation) {
        lines.push(`  > _Remediation:_ ${sanitizeMarkdown(diag.remediation)}`);
      }
    }
    lines.push('');
  }

  // 5. Reproduction command
  lines.push('### 💻 Reproduce Locally');
  lines.push('');
  lines.push('```bash');
  lines.push(`agentrulemap changed --base ${baseRef}`);
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
