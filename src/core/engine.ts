import type {
  AnalysisResult,
  CategoryName,
  ReadinessLabel,
  RepoContext,
  RuleCheck,
} from '../types/index.js';
import { scanRepository } from '../scanners/fileScanner.js';
import { runAgentInstructionsRule } from '../rules/agentInstructionsRule.js';
import { runBuildTestRule } from '../rules/buildTestRule.js';
import { runRepoStructureRule } from '../rules/repoStructureRule.js';
import { runInstructionAccuracyRule } from '../rules/instructionAccuracyRule.js';
import { runSecurityRule } from '../rules/securityRule.js';

export function calculateReadinessLabel(score: number): ReadinessLabel {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 50) return 'NEEDS IMPROVEMENT';
  return 'NOT READY';
}

export function analyzeRepository(targetDir: string = process.cwd()): AnalysisResult {
  const context: RepoContext = scanRepository(targetDir);

  const agentRule = runAgentInstructionsRule(context);
  const buildTestRule = runBuildTestRule(context);
  const repoStructureRule = runRepoStructureRule(context);
  const accuracyRule = runInstructionAccuracyRule(context);
  const securityRule = runSecurityRule(context);

  const totalScore = Math.min(
    100,
    Math.max(
      0,
      agentRule.score +
        buildTestRule.score +
        repoStructureRule.score +
        accuracyRule.score +
        securityRule.score
    )
  );

  const readinessLabel = calculateReadinessLabel(totalScore);

  const categories: Record<CategoryName, { label: string; score: number; maxScore: number }> = {
    agent_instructions: {
      label: 'Agent Instructions',
      score: agentRule.score,
      maxScore: agentRule.maxScore,
    },
    build_test: {
      label: 'Build & Test Readiness',
      score: buildTestRule.score,
      maxScore: buildTestRule.maxScore,
    },
    repo_structure: {
      label: 'Repository Structure',
      score: repoStructureRule.score,
      maxScore: repoStructureRule.maxScore,
    },
    instruction_accuracy: {
      label: 'Instruction Accuracy',
      score: accuracyRule.score,
      maxScore: accuracyRule.maxScore,
    },
    security: {
      label: 'Security',
      score: securityRule.score,
      maxScore: securityRule.maxScore,
    },
  };

  const allChecks: RuleCheck[] = [
    ...agentRule.checks,
    ...buildTestRule.checks,
    ...repoStructureRule.checks,
    ...accuracyRule.checks,
    ...securityRule.checks,
  ];

  const warnings: string[] = [
    ...accuracyRule.warnings,
    ...securityRule.warnings,
  ];

  // Add any warnings from checks that failed or warned
  for (const check of allChecks) {
    if (check.status === 'warn' && !warnings.includes(check.message)) {
      warnings.push(check.message);
    }
  }

  const errors: string[] = allChecks
    .filter((c) => c.status === 'fail')
    .map((c) => c.message);

  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    repository: {
      name: context.name,
      path: context.rootDir,
      detectedTypes: context.detectedTypes,
      instructionFiles: context.instructionFiles.map((f) => f.relativePath),
      structure: {
        importantDirs: Object.fromEntries(
          Object.entries(context.structure.importantDirs).filter(([_, v]) => Boolean(v)) as [string, string][]
        ),
        totalFiles: context.structure.totalFilesScanned,
      },
    },
    score: totalScore,
    readinessLabel,
    categories,
    checks: allChecks,
    warnings,
    errors,
  };
}
