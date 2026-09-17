import fs from 'node:fs';
import path from 'node:path';
import type { AgentInstructionFile, RepoContext, RepoPackageJson, RepoStructure } from '../types/index.js';
import { fileExists, readFileSafe, readJsonSafe, scanDirectoryStructure } from '../utils/fsUtils.js';
import { detectRepoTypes } from './repoTypeScanner.js';

interface InstructionFileCandidate {
  relPath: string;
  agentType: AgentInstructionFile['agentType'];
}

const INSTRUCTION_CANDIDATES: InstructionFileCandidate[] = [
  { relPath: 'AGENTS.md', agentType: 'agents' },
  { relPath: '.agent/AGENTS.md', agentType: 'agents' },
  { relPath: '.github/AGENTS.md', agentType: 'agents' },
  { relPath: 'CLAUDE.md', agentType: 'claude' },
  { relPath: '.claude/CLAUDE.md', agentType: 'claude' },
  { relPath: 'GEMINI.md', agentType: 'gemini' },
  { relPath: '.github/copilot-instructions.md', agentType: 'copilot' },
  { relPath: '.cursorrules', agentType: 'cursor' },
  { relPath: '.cursor/rules', agentType: 'cursor' },
];

export function scanRepository(targetDir: string): RepoContext {
  const rootDir = path.resolve(targetDir);
  const repoName = path.basename(rootDir) || 'unnamed-repo';

  // Structure scan
  const { directories, rootFiles, totalFilesScanned } = scanDirectoryStructure(rootDir, 3);

  // Map important directories
  const importantDirs: RepoStructure['importantDirs'] = {};
  const standardDirs = ['src', 'app', 'pages', 'components', 'tests', 'test', '__tests__', 'docs', 'scripts', 'bin'];

  for (const dir of standardDirs) {
    const found = directories.find((d) => d === dir || d.endsWith(`/${dir}`));
    if (found) {
      importantDirs[dir] = found;
    }
  }

  const structure: RepoStructure = {
    directories,
    importantDirs,
    rootFiles,
    totalFilesScanned,
  };

  // package.json
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = readJsonSafe<RepoPackageJson>(packageJsonPath) ?? undefined;

  // tsconfig
  const hasTsConfig = fileExists(path.join(rootDir, 'tsconfig.json'));

  // gitignore
  const gitignorePath = path.join(rootDir, '.gitignore');
  const hasGitignore = fileExists(gitignorePath);
  const gitignoreContent = readFileSafe(gitignorePath) ?? undefined;

  // env files
  const envFileCandidates = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];
  const envFiles = envFileCandidates.filter((f) => fileExists(path.join(rootDir, f)));
  const hasEnvFile = envFiles.length > 0;
  const hasEnvExample = fileExists(path.join(rootDir, '.env.example'));

  // Instruction files
  const instructionFiles: AgentInstructionFile[] = [];

  for (const candidate of INSTRUCTION_CANDIDATES) {
    const fullPath = path.join(rootDir, candidate.relPath);
    if (fileExists(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          const content = readFileSafe(fullPath) || '';
          instructionFiles.push({
            relativePath: candidate.relPath,
            absolutePath: fullPath,
            agentType: candidate.agentType,
            content,
            exists: true,
            sizeBytes: stats.size,
          });
        } else if (stats.isDirectory() && candidate.relPath === '.cursor/rules') {
          // Cursor rules can be directory of .mdc or .md files
          const ruleFiles = fs.readdirSync(fullPath);
          for (const rf of ruleFiles) {
            const rfPath = path.join(fullPath, rf);
            const rRel = path.join(candidate.relPath, rf);
            const rContent = readFileSafe(rfPath) || '';
            instructionFiles.push({
              relativePath: rRel,
              absolutePath: rfPath,
              agentType: 'cursor',
              content: rContent,
              exists: true,
              sizeBytes: Buffer.byteLength(rContent),
            });
          }
        }
      } catch {
        // Ignore unreadable
      }
    }
  }

  // Readme
  let readmeFile: { path: string; content: string } | undefined;
  const readmePath = path.join(rootDir, 'README.md');
  if (fileExists(readmePath)) {
    readmeFile = {
      path: 'README.md',
      content: readFileSafe(readmePath) || '',
    };
  }

  // Detect repo types
  const detectedTypes = detectRepoTypes(rootDir, rootFiles, packageJson);

  return {
    rootDir,
    name: packageJson?.name || repoName,
    detectedTypes,
    packageJson,
    hasTsConfig,
    hasGitignore,
    gitignoreContent,
    hasEnvFile,
    hasEnvExample,
    envFiles,
    structure,
    instructionFiles,
    readmeFile,
  };
}
