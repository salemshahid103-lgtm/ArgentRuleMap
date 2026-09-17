import type { RepoContext, RuleCheck } from '../types/index.js';

export function runRepoStructureRule(context: RepoContext): {
  score: number;
  maxScore: number;
  checks: RuleCheck[];
} {
  const maxScore = 15;
  let score = 0;
  const checks: RuleCheck[] = [];

  const { importantDirs, directories } = context.structure;
  const hasSourceDir = Boolean(importantDirs.src || importantDirs.app || importantDirs.pages);

  // 1. Source Organization (6 pts)
  if (hasSourceDir) {
    score += 6;
    checks.push({
      id: 'repo-structure-source',
      category: 'repo_structure',
      name: 'Source Directory Organization',
      description: 'Checks for dedicated source folder (src, app, or pages)',
      status: 'pass',
      message: 'Source code folder detected',
      details: [importantDirs.src ? `src/ (${importantDirs.src})` : `app/ (${importantDirs.app})`],
      pointsAwarded: 6,
      pointsPossible: 6,
    });
  } else if (directories.length > 0) {
    score += 3;
    checks.push({
      id: 'repo-structure-source',
      category: 'repo_structure',
      name: 'Source Directory Organization',
      description: 'Checks for dedicated source folder (src, app, or pages)',
      status: 'warn',
      message: 'No distinct src/ or app/ directory; root contains source files',
      pointsAwarded: 3,
      pointsPossible: 6,
    });
  } else {
    checks.push({
      id: 'repo-structure-source',
      category: 'repo_structure',
      name: 'Source Directory Organization',
      description: 'Checks for dedicated source folder (src, app, or pages)',
      status: 'fail',
      message: 'Repository has flat or unorganized root without clear source boundaries',
      pointsAwarded: 0,
      pointsPossible: 6,
    });
  }

  // 2. Functional Modular Directory Separation (5 pts)
  const identifiedList = Object.entries(importantDirs)
    .filter(([_, v]) => Boolean(v))
    .map(([k, v]) => `${k} -> ${v}`);

  if (identifiedList.length >= 2) {
    score += 5;
    checks.push({
      id: 'repo-structure-segmentation',
      category: 'repo_structure',
      name: 'Repository Modular Structure',
      description: 'Identifies standard architectural modules (components, docs, scripts, tests)',
      status: 'pass',
      message: 'Repository structure detected with clear architectural modules',
      details: identifiedList,
      pointsAwarded: 5,
      pointsPossible: 5,
    });
  } else if (identifiedList.length === 1) {
    score += 3;
    checks.push({
      id: 'repo-structure-segmentation',
      category: 'repo_structure',
      name: 'Repository Modular Structure',
      description: 'Identifies standard architectural modules (components, docs, scripts, tests)',
      status: 'info',
      message: 'Basic directory structure found',
      details: identifiedList,
      pointsAwarded: 3,
      pointsPossible: 5,
    });
  } else {
    checks.push({
      id: 'repo-structure-segmentation',
      category: 'repo_structure',
      name: 'Repository Modular Structure',
      description: 'Identifies standard architectural modules (components, docs, scripts, tests)',
      status: 'warn',
      message: 'Few or no modular subdirectories detected',
      pointsAwarded: 0,
      pointsPossible: 5,
    });
  }

  // 3. Documentation Presence (4 pts)
  if (context.readmeFile) {
    score += 4;
    checks.push({
      id: 'repo-structure-documentation',
      category: 'repo_structure',
      name: 'Repository Documentation',
      description: 'Verifies existence of human/agent onboarding documentation (README.md)',
      status: 'pass',
      message: 'README.md found',
      pointsAwarded: 4,
      pointsPossible: 4,
    });
  } else {
    checks.push({
      id: 'repo-structure-documentation',
      category: 'repo_structure',
      name: 'Repository Documentation',
      description: 'Verifies existence of human/agent onboarding documentation (README.md)',
      status: 'fail',
      message: 'Missing README.md in root directory',
      pointsAwarded: 0,
      pointsPossible: 4,
    });
  }

  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks,
  };
}
