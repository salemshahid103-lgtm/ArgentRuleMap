import type {
  Diagnostic,
  DiagnosticDefinition,
  DiagnosticSeverity,
} from './types.js';

export const DIAGNOSTIC_REGISTRY: Record<string, DiagnosticDefinition> = {
  ARM001_INVALID_FRONTMATTER: {
    id: 'ARM001_INVALID_FRONTMATTER',
    title: 'Invalid YAML Frontmatter',
    defaultSeverity: 'warning',
    description: 'YAML frontmatter in an instruction file is malformed, unclosed, or cannot be parsed.',
    trigger: 'An instruction markdown file contains unclosed "---" or invalid YAML syntax.',
    example: '---\napplyTo: [invalid: yaml\n---',
    remediation: 'Ensure YAML frontmatter is a valid YAML key-value mapping enclosed between "---" markers.',
    causesStrictModeFailure: false,
  },
  ARM002_INVALID_GLOB: {
    id: 'ARM002_INVALID_GLOB',
    title: 'Invalid Glob Pattern',
    defaultSeverity: 'error',
    description: 'A glob pattern specified in an instruction file is invalid or malformed.',
    trigger: 'An applyTo or path pattern contains unclosed brackets or syntax that picomatch cannot parse.',
    example: 'applyTo: "src/[a-"',
    remediation: 'Check glob pattern syntax and close all brackets, braces, and wildcards properly.',
    causesStrictModeFailure: true,
  },
  ARM003_EMPTY_SCOPE: {
    id: 'ARM003_EMPTY_SCOPE',
    title: 'Empty Instruction Scope',
    defaultSeverity: 'warning',
    description: 'An instruction file declares an empty or whitespace-only scope or applyTo field.',
    trigger: 'applyTo is specified as an empty string, empty array, or whitespace.',
    example: 'applyTo: ""',
    remediation: 'Provide a valid glob pattern or remove the empty applyTo field.',
    causesStrictModeFailure: false,
  },
  ARM004_DUPLICATE_SCOPE: {
    id: 'ARM004_DUPLICATE_SCOPE',
    title: 'Duplicate Scope Definition',
    defaultSeverity: 'warning',
    description: 'Multiple path-specific instruction files declare identical or equivalent scopes.',
    trigger: 'Two or more instruction files define the exact same applyTo glob patterns within the same profile.',
    example: 'Two files both specifying applyTo: "src/api/**/*.ts"',
    remediation: 'Consolidate the rules into one file or differentiate their scopes.',
    causesStrictModeFailure: false,
  },
  ARM005_DUPLICATE_CONTENT: {
    id: 'ARM005_DUPLICATE_CONTENT',
    title: 'Identical Instruction Content',
    defaultSeverity: 'info',
    description: 'Multiple instruction files contain identical effective content.',
    trigger: 'Two or more instruction files have identical normalized content (ignoring line endings and trailing whitespace).',
    example: 'AGENTS.md and packages/api/AGENTS.md have identical instructions.',
    remediation: 'Consider keeping instructions in the root or refactoring common rules.',
    causesStrictModeFailure: false,
  },
  ARM006_STALE_PATH_REFERENCE: {
    id: 'ARM006_STALE_PATH_REFERENCE',
    title: 'Stale Path Reference',
    defaultSeverity: 'warning',
    description: 'An instruction file references a repository-relative path that does not exist.',
    trigger: 'A file or directory path in Markdown inline code or relative link cannot be found in the repository.',
    example: 'Read `src/legacy-api/README.md` before editing.',
    remediation: 'Update or remove reference to the nonexistent file or directory.',
    causesStrictModeFailure: false,
  },
  ARM007_MISSING_PACKAGE_SCRIPT: {
    id: 'ARM007_MISSING_PACKAGE_SCRIPT',
    title: 'Missing Package Script',
    defaultSeverity: 'warning',
    description: 'An instruction file directs the agent to run an npm/pnpm/yarn/bun script that is not in package.json.',
    trigger: 'Instruction contains `npm run lint` or `npm test`, but the scripts field in package.json lacks it.',
    example: 'Run `npm run lint` when package.json has no "lint" script.',
    remediation: 'Add the missing script to package.json "scripts" or correct the command in the instruction file.',
    causesStrictModeFailure: false,
  },
  ARM008_SCOPE_MATCHES_NO_FILES: {
    id: 'ARM008_SCOPE_MATCHES_NO_FILES',
    title: 'Scope Matches No Repository Files',
    defaultSeverity: 'warning',
    description: 'A path-specific instruction scope matches zero files in the repository.',
    trigger: 'An applyTo glob pattern evaluates to zero files in the current repository.',
    example: 'applyTo: "src/legacy/**/*.ts" when src/legacy/ does not exist.',
    remediation: 'Verify the glob pattern matches existing files or remove the unused instruction file.',
    causesStrictModeFailure: false,
  },
  ARM009_PATH_OUTSIDE_REPOSITORY: {
    id: 'ARM009_PATH_OUTSIDE_REPOSITORY',
    title: 'Path Traverses Outside Repository',
    defaultSeverity: 'error',
    description: 'A target path or referenced path escapes the repository boundary.',
    trigger: 'A path uses ".." to escape the repository root.',
    example: 'resolve ../../secret.txt',
    remediation: 'Restrict paths to within the repository root.',
    causesStrictModeFailure: true,
  },
  ARM010_SYMLINK_ESCAPE: {
    id: 'ARM010_SYMLINK_ESCAPE',
    title: 'Symlink Escapes Repository',
    defaultSeverity: 'error',
    description: 'A symbolic link points to a target outside the repository root.',
    trigger: 'A symlinked instruction file points to /etc/passwd or a parent directory.',
    example: 'ln -s /etc/passwd instructions.md',
    remediation: 'Remove or repoint the symbolic link to an internal repository target.',
    causesStrictModeFailure: true,
  },
  ARM011_OVERLAPPING_SCOPE: {
    id: 'ARM011_OVERLAPPING_SCOPE',
    title: 'Overlapping Instruction Scopes',
    defaultSeverity: 'info',
    description: 'Multiple path-specific instruction rules overlap for one or more files.',
    trigger: 'Patterns like "src/**/*.ts" and "src/api/**/*.ts" both match common repository files.',
    example: 'Both applyTo rules match "src/api/users.ts".',
    remediation: 'Ensure instruction precedence is intentional or make scopes mutually exclusive.',
    causesStrictModeFailure: false,
  },
  ARM012_SHADOWED_SOURCE: {
    id: 'ARM012_SHADOWED_SOURCE',
    title: 'Shadowed Instruction Source',
    defaultSeverity: 'info',
    description: 'An instruction source is shadowed by a higher-precedence rule.',
    trigger: 'An override instruction file shadows a baseline instruction file in the same scope.',
    example: 'AGENTS.override.md taking precedence over AGENTS.md in the root directory.',
    remediation: 'Review precedence ordering if the shadowed file was expected to be active.',
    causesStrictModeFailure: false,
  },
  ARM013_UNREADABLE_SOURCE: {
    id: 'ARM013_UNREADABLE_SOURCE',
    title: 'Unreadable Instruction Source',
    defaultSeverity: 'error',
    description: 'An instruction file cannot be read due to file system or permission error.',
    trigger: 'fs.readFileSync fails with EACCES or ENOENT.',
    example: 'An instruction file with restricted file permissions.',
    remediation: 'Check file permissions and ensure file exists and is accessible.',
    causesStrictModeFailure: true,
  },
  ARM014_CYCLIC_SYMLINK: {
    id: 'ARM014_CYCLIC_SYMLINK',
    title: 'Cyclic Symlink Detected',
    defaultSeverity: 'error',
    description: 'A circular symbolic link loop was detected.',
    trigger: 'Symlink resolves in a loop back to an already-visited path.',
    example: 'symlink A -> symlink B -> symlink A.',
    remediation: 'Break the symlink loop.',
    causesStrictModeFailure: true,
  },
  ARM020_OVERSIZED_INSTRUCTION_FILE: {
    id: 'ARM020_OVERSIZED_INSTRUCTION_FILE',
    title: 'Oversized Instruction File',
    defaultSeverity: 'warning',
    description: 'An instruction file exceeds the maximum allowed file size and was skipped to prevent excessive memory consumption.',
    trigger: 'An instruction file exceeds the size limit (1 MB / 1,048,576 bytes).',
    example: 'A large generated markdown file exceeding 1MB.',
    remediation: 'Reduce file size or split repository instructions into smaller scoped files.',
    causesStrictModeFailure: false,
  },
};

/**
 * Creates a strongly typed Diagnostic object with defaults from the registry.
 */
export function createDiagnostic(
  id: string,
  overrides: Partial<Diagnostic> & { message?: string }
): Diagnostic {
  const def = DIAGNOSTIC_REGISTRY[id];
  const severity: DiagnosticSeverity =
    overrides.severity || def?.defaultSeverity || 'warning';

  return {
    id,
    severity,
    title: overrides.title || def?.title || id,
    message: overrides.message || def?.description || '',
    sourcePath: overrides.sourcePath,
    targetPath: overrides.targetPath,
    line: overrides.line,
    column: overrides.column,
    details: overrides.details,
    remediation: overrides.remediation || def?.remediation,
    profile: overrides.profile,
  };
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * Deterministically sorts diagnostics by:
 * 1. Severity (error, warning, info)
 * 2. Diagnostic ID
 * 3. Source path
 * 4. Target path
 * 5. Message
 */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    // 1. Severity rank
    const sevA = SEVERITY_ORDER[a.severity] ?? 99;
    const sevB = SEVERITY_ORDER[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;

    // 2. Diagnostic ID
    const idCmp = a.id.localeCompare(b.id);
    if (idCmp !== 0) return idCmp;

    // 3. Source path
    const srcA = a.sourcePath || '';
    const srcB = b.sourcePath || '';
    const srcCmp = srcA.localeCompare(srcB);
    if (srcCmp !== 0) return srcCmp;

    // 4. Target path
    const tgtA = a.targetPath || '';
    const tgtB = b.targetPath || '';
    const tgtCmp = tgtA.localeCompare(tgtB);
    if (tgtCmp !== 0) return tgtCmp;

    // 5. Line number if available
    const lineA = a.line ?? 0;
    const lineB = b.line ?? 0;
    if (lineA !== lineB) return lineA - lineB;

    // 6. Message
    return a.message.localeCompare(b.message);
  });
}

/**
 * Generates the Markdown documentation for all registered diagnostics.
 */
export function generateDiagnosticsMarkdown(): string {
  const rows = Object.values(DIAGNOSTIC_REGISTRY);

  let md = `# AgentRuleMap Diagnostic Registry\n\n`;
  md += `This document provides the reference list of deterministic diagnostics emitted by AgentRuleMap.\n\n`;
  md += `## Overview\n\n`;
  md += `| ID | Title | Default Severity | Causes Strict Failure |\n`;
  md += `|---|---|---|---|\n`;

  for (const row of rows) {
    const strictLabel = row.causesStrictModeFailure ? 'Yes (`exit 1`)' : 'No';
    md += `| \`${row.id}\` | ${row.title} | \`${row.defaultSeverity}\` | ${strictLabel} |\n`;
  }

  md += `\n---\n\n`;
  md += `## Detailed Diagnostics Reference\n\n`;

  for (const row of rows) {
    md += `### \`${row.id}\`: ${row.title}\n\n`;
    md += `- **Severity**: \`${row.defaultSeverity}\`\n`;
    md += `- **Causes Strict-Mode Failure**: ${row.causesStrictModeFailure ? 'Yes (exit 1)' : 'No'}\n`;
    md += `- **Description**: ${row.description}\n`;
    md += `- **Trigger**: ${row.trigger}\n`;
    if (row.example) {
      md += `- **Example**:\n\`\`\`text\n${row.example}\n\`\`\`\n`;
    }
    md += `- **Remediation**: ${row.remediation}\n\n`;
  }

  return md;
}
