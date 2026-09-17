export interface ExtractedCommandReference {
  rawCommand: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  scriptName: string;
  line: number;
  column: number;
}

const BUILTIN_YARN_COMMANDS = new Set([
  'install',
  'add',
  'remove',
  'upgrade',
  'publish',
  'init',
  'create',
  'config',
  'cache',
  'info',
  'pack',
  'help',
  'version',
  'workspace',
  'workspaces',
  'policies',
  'node',
  'set',
  'dlx',
  'explain',
  'why',
  'dedupe',
]);

const BUILTIN_PNPM_COMMANDS = new Set([
  'install',
  'i',
  'add',
  'remove',
  'rm',
  'uninstall',
  'un',
  'update',
  'up',
  'publish',
  'init',
  'create',
  'exec',
  'dlx',
  'outdated',
  'why',
  'prune',
  'pack',
  'root',
  'bin',
  'setup',
  'link',
  'unlink',
  'import',
  'env',
  'server',
  'store',
  'audit',
]);

const BUILTIN_BUN_COMMANDS = new Set([
  'install',
  'i',
  'add',
  'remove',
  'rm',
  'update',
  'upgrade',
  'create',
  'init',
  'build', // Note: bun build is a native bundler, but bun run build is a script!
  'pm',
  'link',
  'unlink',
]);

/**
 * Extracts npm/pnpm/yarn/bun script execution commands from instruction markdown text.
 */
export function extractCommandReferences(
  markdownContent: string
): ExtractedCommandReference[] {
  const results: ExtractedCommandReference[] = [];
  const lines = markdownContent.split(/\r?\n/);

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // We search for matches in the line
    // Regex for package manager commands
    // e.g. (npm|pnpm|yarn|bun) (run|test|start|<script>)
    const pmRegex = /\b(npm|pnpm|yarn|bun)\s+([a-zA-Z0-9_:-]+)(?:\s+([a-zA-Z0-9_:-]+))?/g;
    let match: RegExpExecArray | null;

    while ((match = pmRegex.exec(line)) !== null) {
      const pm = match[1] as 'npm' | 'pnpm' | 'yarn' | 'bun';
      const firstArg = match[2];
      const secondArg = match[3];
      const col = match.index + 1;

      let scriptName = '';
      let rawCommand = '';

      if (firstArg === 'run' || firstArg === 'run-script') {
        if (secondArg) {
          scriptName = secondArg;
          rawCommand = `${pm} ${firstArg} ${secondArg}`;
        }
      } else if (firstArg === 'test' || firstArg === 't' || firstArg === 'tst') {
        scriptName = 'test';
        rawCommand = `${pm} ${firstArg}`;
      } else if (firstArg === 'start') {
        scriptName = 'start';
        rawCommand = `${pm} start`;
      } else if (pm === 'yarn' && !BUILTIN_YARN_COMMANDS.has(firstArg)) {
        // e.g. `yarn lint`, `yarn build`, `yarn typecheck`
        scriptName = firstArg;
        rawCommand = `yarn ${firstArg}`;
      } else if (pm === 'pnpm' && !BUILTIN_PNPM_COMMANDS.has(firstArg)) {
        // e.g. `pnpm lint`, `pnpm build`
        scriptName = firstArg;
        rawCommand = `pnpm ${firstArg}`;
      }

      if (scriptName) {
        results.push({
          rawCommand,
          packageManager: pm,
          scriptName,
          line: lineNumber,
          column: col,
        });
      }
    }
  }

  return results;
}
