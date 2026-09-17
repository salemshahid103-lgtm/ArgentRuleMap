export interface ParsedInstructionSection {
  name: string;
  found: boolean;
  matchedHeading?: string;
}

export interface ExtractedCommand {
  raw: string;
  commandName: string; // e.g., 'npm' or 'pnpm' or 'pytest'
  scriptName?: string; // e.g., 'build', 'test', 'lint'
  sourceFile: string;
}

export interface ExtractedPath {
  raw: string;
  normalized: string;
  sourceFile: string;
  lineNumber?: number;
}

export interface InstructionAnalysis {
  sourceFile: string;
  sections: {
    projectOverview: boolean;
    installation: boolean;
    build: boolean;
    test: boolean;
    conventions: boolean;
    paths: boolean;
    safety: boolean;
    environment: boolean;
  };
  commands: ExtractedCommand[];
  referencedPaths: ExtractedPath[];
}

const SECTION_PATTERNS = {
  projectOverview: /(?:project\s+overview|about\s+the\s+project|introduction|architecture\s+overview|overview|what\s+is)/i,
  installation: /(?:installation|getting\s+started|setup|dependencies|prerequisites|install)/i,
  build: /(?:build(?:\s+instructions|\s+commands|\s+step)?|compil(?:e|ation)|bundl(?:e|ing))/i,
  test: /(?:test(?:ing|\s+instructions|\s+commands|\s+suite)?|vitest|jest|pytest)/i,
  conventions: /(?:coding\s+(?:standards|conventions|guidelines|style)|code\s+style|rules|conventions)/i,
  paths: /(?:repository\s+(?:structure|layout|map|paths)|important\s+(?:files|paths|directories)|directory\s+structure)/i,
  safety: /(?:safety|security|constraints|guardrails|forbidden|do\s+not|rules\s+and\s+boundaries)/i,
  environment: /(?:environment\s+(?:variables|setup|info|configuration)|\.env|configuration)/i,
};

export function parseInstructionFile(content: string, sourceFile: string): InstructionAnalysis {
  const sections = {
    projectOverview: false,
    installation: false,
    build: false,
    test: false,
    conventions: false,
    paths: false,
    safety: false,
    environment: false,
  };

  // 1. Check sections
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(content)) {
      sections[key as keyof typeof sections] = true;
    }
  }

  // 2. Extract commands
  const commands: ExtractedCommand[] = [];
  const lines = content.split('\n');

  // Match: npm test, npm run build, npm run lint, pnpm test, yarn test, etc.
  const npmRegex = /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([a-zA-Z0-9_:-]+)/g;
  const BUILTIN_PKG_COMMANDS = new Set([
    'install',
    'i',
    'ci',
    'add',
    'update',
    'upgrade',
    'remove',
    'uninstall',
    'audit',
    'init',
    'publish',
    'pack',
    'login',
    'logout',
    'whoami',
    'version',
    'config',
    'exec',
    'dlx',
  ]);

  lines.forEach((line) => {
    let match: RegExpExecArray | null;
    npmRegex.lastIndex = 0;
    while ((match = npmRegex.exec(line)) !== null) {
      const full = match[0];
      const script = match[1];
      // Skip flags like --verbose or builtin package manager commands like 'install'
      if (script.startsWith('-') || BUILTIN_PKG_COMMANDS.has(script.toLowerCase())) continue;

      commands.push({
        raw: full,
        commandName: full.split(' ')[0],
        scriptName: script,
        sourceFile,
      });
    }
  });

  // 3. Extract paths
  const referencedPaths: ExtractedPath[] = [];
  // Regex looking for typical file/dir paths:
  // e.g. `src/api`, `src/components`, `app/routes.ts`, `./server.ts`, `docs/setup.md`
  const pathRegex = /(?:`|'|")([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+|\.\/[a-zA-Z0-9_.-]+)(?:`|'|")/g;

  lines.forEach((line, index) => {
    // Skip external URLs or markdown links
    if (line.includes('http://') || line.includes('https://')) {
      return;
    }

    let pMatch: RegExpExecArray | null;
    pathRegex.lastIndex = 0;
    while ((pMatch = pathRegex.exec(line)) !== null) {
      const rawPath = pMatch[1];
      // Filter out package names, urls, or MIME types
      if (
        rawPath.startsWith('@') ||
        rawPath.includes('github.com') ||
        rawPath.endsWith('.com') ||
        rawPath.endsWith('.org') ||
        rawPath === 'node_modules' ||
        rawPath === '.git'
      ) {
        continue;
      }

      const normalized = rawPath.replace(/^\.\//, '');
      referencedPaths.push({
        raw: rawPath,
        normalized,
        sourceFile,
        lineNumber: index + 1,
      });
    }
  });

  return {
    sourceFile,
    sections,
    commands,
    referencedPaths,
  };
}
