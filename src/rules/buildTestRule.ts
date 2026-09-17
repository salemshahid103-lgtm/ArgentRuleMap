import type { RepoContext, RuleCheck } from '../types/index.js';

export function runBuildTestRule(context: RepoContext): {
  score: number;
  maxScore: number;
  checks: RuleCheck[];
} {
  const maxScore = 25;
  let score = 0;
  const checks: RuleCheck[] = [];

  const scripts = context.packageJson?.scripts || {};
  const isPython = context.detectedTypes.includes('python');
  const isTs = context.detectedTypes.includes('typescript');

  // 1. Test script (6 pts)
  const hasTestScript = Boolean(scripts.test || scripts['test:unit'] || scripts['test:run']);
  const hasPyTest = isPython && (context.structure.rootFiles.includes('pytest.ini') || context.structure.rootFiles.includes('pyproject.toml'));

  if (hasTestScript || hasPyTest) {
    score += 6;
    checks.push({
      id: 'build-test-test-command',
      category: 'build_test',
      name: 'Test Script Verification',
      description: 'Verifies whether automated test command is configured',
      status: 'pass',
      message: 'Test command verified in repository configuration',
      details: hasTestScript ? [`npm test / ${scripts.test}`] : ['Python test runner configured'],
      pointsAwarded: 6,
      pointsPossible: 6,
    });
  } else {
    checks.push({
      id: 'build-test-test-command',
      category: 'build_test',
      name: 'Test Script Verification',
      description: 'Verifies whether automated test command is configured',
      status: 'fail',
      message: 'No test script configured in package.json (e.g. "scripts": { "test": "..." })',
      pointsAwarded: 0,
      pointsPossible: 6,
    });
  }

  // 2. Build script (6 pts)
  const hasBuildScript = Boolean(scripts.build || scripts['build:cli']);
  const needsBuild = context.detectedTypes.some((t) => ['typescript', 'react', 'nextjs', 'vite'].includes(t));

  if (hasBuildScript) {
    score += 6;
    checks.push({
      id: 'build-test-build-command',
      category: 'build_test',
      name: 'Build Command Verification',
      description: 'Verifies whether project build command is configured',
      status: 'pass',
      message: 'Build command verified',
      details: [`npm run build: ${scripts.build || scripts['build:cli']}`],
      pointsAwarded: 6,
      pointsPossible: 6,
    });
  } else if (!needsBuild) {
    score += 6;
    checks.push({
      id: 'build-test-build-command',
      category: 'build_test',
      name: 'Build Command Verification',
      description: 'Verifies whether project build command is configured',
      status: 'info',
      message: 'Build script not strictly required for this project type',
      pointsAwarded: 6,
      pointsPossible: 6,
    });
  } else {
    checks.push({
      id: 'build-test-build-command',
      category: 'build_test',
      name: 'Build Command Verification',
      description: 'Verifies whether project build command is configured',
      status: 'fail',
      message: 'Missing build script in package.json ("build")',
      pointsAwarded: 0,
      pointsPossible: 6,
    });
  }

  // 3. Lint script (5 pts)
  const hasLintScript = Boolean(scripts.lint || scripts['lint:check']);
  if (hasLintScript) {
    score += 5;
    checks.push({
      id: 'build-test-lint-command',
      category: 'build_test',
      name: 'Lint Script Verification',
      description: 'Verifies whether lint/static analysis command is configured',
      status: 'pass',
      message: 'Lint command verified',
      details: [`npm run lint: ${scripts.lint}`],
      pointsAwarded: 5,
      pointsPossible: 5,
    });
  } else {
    checks.push({
      id: 'build-test-lint-command',
      category: 'build_test',
      name: 'Lint Script Verification',
      description: 'Verifies whether lint/static analysis command is configured',
      status: 'warn',
      message: 'No lint command found in package.json ("lint")',
      pointsAwarded: 0,
      pointsPossible: 5,
    });
  }

  // 4. TypeScript configuration (4 pts)
  if (!isTs) {
    score += 4;
    checks.push({
      id: 'build-test-tsconfig',
      category: 'build_test',
      name: 'TypeScript Configuration',
      description: 'Checks tsconfig.json validity when TypeScript is used',
      status: 'info',
      message: 'Project does not appear to use TypeScript; check skipped',
      pointsAwarded: 4,
      pointsPossible: 4,
    });
  } else if (context.hasTsConfig) {
    score += 4;
    checks.push({
      id: 'build-test-tsconfig',
      category: 'build_test',
      name: 'TypeScript Configuration',
      description: 'Checks tsconfig.json validity when TypeScript is used',
      status: 'pass',
      message: 'TypeScript configuration (tsconfig.json) detected',
      pointsAwarded: 4,
      pointsPossible: 4,
    });
  } else {
    checks.push({
      id: 'build-test-tsconfig',
      category: 'build_test',
      name: 'TypeScript Configuration',
      description: 'Checks tsconfig.json validity when TypeScript is used',
      status: 'fail',
      message: 'TypeScript files detected but tsconfig.json is missing',
      pointsAwarded: 0,
      pointsPossible: 4,
    });
  }

  // 5. Test directories or test files (4 pts)
  const hasTestDir = Boolean(
    context.structure.importantDirs.tests ||
    context.structure.importantDirs.test ||
    context.structure.importantDirs.__tests__
  );
  const hasTestFiles = context.structure.rootFiles.some((f) => f.includes('.test.') || f.includes('.spec.'));

  if (hasTestDir || hasTestFiles) {
    score += 4;
    checks.push({
      id: 'build-test-directory',
      category: 'build_test',
      name: 'Test Directory Structure',
      description: 'Checks whether dedicated test directories or files exist',
      status: 'pass',
      message: 'Test directory or test suite files found',
      details: [
        context.structure.importantDirs.tests ||
        context.structure.importantDirs.test ||
        'root test files',
      ],
      pointsAwarded: 4,
      pointsPossible: 4,
    });
  } else {
    checks.push({
      id: 'build-test-directory',
      category: 'build_test',
      name: 'Test Directory Structure',
      description: 'Checks whether dedicated test directories or files exist',
      status: 'warn',
      message: 'No test directory (tests/, test/, __tests__/) found',
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
