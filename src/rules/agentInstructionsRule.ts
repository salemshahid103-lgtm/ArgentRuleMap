import type { RepoContext, RuleCheck } from '../types/index.js';
import { parseInstructionFile } from '../scanners/instructionParser.js';

export function runAgentInstructionsRule(context: RepoContext): {
  score: number;
  maxScore: number;
  checks: RuleCheck[];
} {
  const maxScore = 30;
  let score = 0;
  const checks: RuleCheck[] = [];

  const files = context.instructionFiles;
  const hasAgentsMd = files.some((f) => f.relativePath === 'AGENTS.md' || f.relativePath.endsWith('AGENTS.md'));
  const hasAnyAgentFile = files.length > 0;

  // 1. Existence check (Max 10 pts)
  if (hasAgentsMd) {
    score += 10;
    checks.push({
      id: 'agent-instructions-file-exists',
      category: 'agent_instructions',
      name: 'Agent Instruction File Found',
      description: 'Checks whether standard agent instruction files exist',
      status: 'pass',
      message: 'AGENTS.md found in repository',
      details: files.map((f) => f.relativePath),
      pointsAwarded: 10,
      pointsPossible: 10,
    });
  } else if (hasAnyAgentFile) {
    score += 8;
    checks.push({
      id: 'agent-instructions-file-exists',
      category: 'agent_instructions',
      name: 'Agent Instruction File Found',
      description: 'Checks whether standard agent instruction files exist',
      status: 'warn',
      message: `Found alternative instruction file(s) (${files.map((f) => f.relativePath).join(', ')}), but standard AGENTS.md is recommended`,
      details: files.map((f) => f.relativePath),
      pointsAwarded: 8,
      pointsPossible: 10,
    });
  } else {
    checks.push({
      id: 'agent-instructions-file-exists',
      category: 'agent_instructions',
      name: 'Agent Instruction File Missing',
      description: 'Checks whether standard agent instruction files exist',
      status: 'fail',
      message: 'No agent instruction files found (e.g. AGENTS.md, CLAUDE.md, GEMINI.md)',
      pointsAwarded: 0,
      pointsPossible: 10,
    });
  }

  // 2. Analyze combined contents across all instruction files (Max 20 pts)
  const combinedContent = files.map((f) => f.content).join('\n\n');
  const parsed = parseInstructionFile(combinedContent, 'combined-instructions');

  const sectionCriteria = [
    { key: 'projectOverview', label: 'Project overview', pts: 3 },
    { key: 'installation', label: 'Installation instructions', pts: 3 },
    { key: 'build', label: 'Build instructions', pts: 3 },
    { key: 'test', label: 'Test instructions', pts: 3 },
    { key: 'conventions', label: 'Coding conventions', pts: 3 },
    { key: 'paths', label: 'Important repository paths', pts: 2 },
    { key: 'safety', label: 'Safety constraints', pts: 2 },
    { key: 'environment', label: 'Environment information', pts: 1 },
  ] as const;

  const missingSections: string[] = [];
  const presentSections: string[] = [];
  let sectionScore = 0;

  for (const { key, label, pts } of sectionCriteria) {
    if (parsed.sections[key]) {
      sectionScore += pts;
      presentSections.push(label);
    } else {
      missingSections.push(label);
    }
  }

  score += sectionScore;

  if (hasAnyAgentFile) {
    if (missingSections.length === 0) {
      checks.push({
        id: 'agent-instructions-sections',
        category: 'agent_instructions',
        name: 'Comprehensive Instruction Sections',
        description: 'Verifies required instruction sections (overview, setup, build, test, conventions, paths, safety, env)',
        status: 'pass',
        message: 'All recommended instruction sections are present',
        details: presentSections,
        pointsAwarded: 20,
        pointsPossible: 20,
      });
    } else {
      checks.push({
        id: 'agent-instructions-sections',
        category: 'agent_instructions',
        name: 'Instruction Sections Completeness',
        description: 'Verifies required instruction sections (overview, setup, build, test, conventions, paths, safety, env)',
        status: missingSections.length <= 2 ? 'warn' : 'fail',
        message: `Missing instruction guidance: ${missingSections.join(', ')}`,
        details: [`Present: ${presentSections.join(', ') || 'None'}`, `Missing: ${missingSections.join(', ')}`],
        pointsAwarded: sectionScore,
        pointsPossible: 20,
      });
    }
  } else {
    checks.push({
      id: 'agent-instructions-sections',
      category: 'agent_instructions',
      name: 'Instruction Sections Missing',
      description: 'Verifies required instruction sections',
      status: 'fail',
      message: 'Cannot evaluate sections because no instruction files exist',
      pointsAwarded: 0,
      pointsPossible: 20,
    });
  }

  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks,
  };
}
