import type { RepoContext, RuleCheck } from '../types/index.js';
import { detectInsecureInstructions, detectSecretsInContent } from '../security/secretDetector.js';

export function runSecurityRule(context: RepoContext): {
  score: number;
  maxScore: number;
  checks: RuleCheck[];
  warnings: string[];
} {
  const maxScore = 10;
  let score = 10;
  const checks: RuleCheck[] = [];
  const warnings: string[] = [];

  // 1. Check .gitignore coverage for sensitive env files
  const gitignore = context.gitignoreContent || '';
  const ignoresEnv =
    gitignore.includes('.env') ||
    gitignore.includes('.env*') ||
    gitignore.includes('*.env');

  if (!context.hasGitignore) {
    score -= 3;
    const msg = 'Missing .gitignore file in repository; sensitive files may be committed accidentally';
    warnings.push(msg);
    checks.push({
      id: 'security-gitignore',
      category: 'security',
      name: '.gitignore Protection',
      description: 'Checks whether .gitignore exists and protects sensitive environment files',
      status: 'fail',
      message: msg,
      pointsAwarded: 0,
      pointsPossible: 3,
    });
  } else if (!ignoresEnv && context.hasEnvFile) {
    score -= 3;
    const msg = 'Active .env file detected but .gitignore does not ignore .env files';
    warnings.push(msg);
    checks.push({
      id: 'security-gitignore',
      category: 'security',
      name: '.gitignore Protection',
      description: 'Checks whether .gitignore exists and protects sensitive environment files',
      status: 'warn',
      message: msg,
      details: context.envFiles,
      pointsAwarded: 0,
      pointsPossible: 3,
    });
  } else {
    checks.push({
      id: 'security-gitignore',
      category: 'security',
      name: '.gitignore Protection',
      description: 'Checks whether .gitignore exists and protects sensitive environment files',
      status: 'pass',
      message: '.gitignore properly configured to protect environment variables',
      pointsAwarded: 3,
      pointsPossible: 3,
    });
  }

  // 2. Check for obvious hardcoded secrets in instruction files & readme
  const filesToScan: Array<{ name: string; content: string }> = [
    ...context.instructionFiles.map((f) => ({ name: f.relativePath, content: f.content })),
    ...(context.readmeFile ? [{ name: context.readmeFile.path, content: context.readmeFile.content }] : []),
  ];

  const leakedSecrets = filesToScan.flatMap((file) =>
    detectSecretsInContent(file.content, file.name)
  );

  if (leakedSecrets.length > 0) {
    score -= 4;
    const leakedDetails = leakedSecrets.map(
      (s) => `${s.source}: detected ${s.type} (${s.maskedSnippet})`
    );
    for (const d of leakedDetails) {
      warnings.push(`Potential secret leak: ${d}`);
    }

    checks.push({
      id: 'security-secret-leak',
      category: 'security',
      name: 'Secret Leak Detection',
      description: 'Scans files for exposed API keys and sensitive tokens',
      status: 'fail',
      message: `${leakedSecrets.length} potential secret token(s) detected in documentation/instructions`,
      details: leakedDetails,
      pointsAwarded: 0,
      pointsPossible: 4,
    });
  } else {
    checks.push({
      id: 'security-secret-leak',
      category: 'security',
      name: 'Secret Leak Detection',
      description: 'Scans files for exposed API keys and sensitive tokens',
      status: 'pass',
      message: 'No unmasked or hardcoded API keys detected in scanned files',
      pointsAwarded: 4,
      pointsPossible: 4,
    });
  }

  // 3. Detect dangerous instructions in agent instructions
  const dangerousInstructions = context.instructionFiles.flatMap((file) =>
    detectInsecureInstructions(file.content, file.relativePath)
  );

  if (dangerousInstructions.length > 0) {
    score -= 3;
    const dangDetails = dangerousInstructions.map(
      (d) => `${d.source}: ${d.issue} -> "${d.snippet}"`
    );
    for (const d of dangDetails) {
      warnings.push(`Insecure instruction: ${d}`);
    }

    checks.push({
      id: 'security-agent-instructions',
      category: 'security',
      name: 'Agent Safety Constraints',
      description: 'Ensures instructions do not direct AI agents to bypass security checks or expose secrets',
      status: 'fail',
      message: 'Instruction file contains unsafe directives for AI agents',
      details: dangDetails,
      pointsAwarded: 0,
      pointsPossible: 3,
    });
  } else {
    // Check if security instructions are actively provided
    const hasSecurityMention = context.instructionFiles.some((f) =>
      /safety|security|secret|credential|token|\.env/i.test(f.content)
    );

    if (context.instructionFiles.length > 0 && !hasSecurityMention) {
      score -= 1;
      const warnMsg = 'Missing security guidance';
      warnings.push(warnMsg);

      checks.push({
        id: 'security-agent-instructions',
        category: 'security',
        name: 'Agent Safety Constraints',
        description: 'Ensures instructions do not direct AI agents to bypass security checks or expose secrets',
        status: 'warn',
        message: 'No security guidelines or credential boundaries defined for AI agents',
        pointsAwarded: 2,
        pointsPossible: 3,
      });
    } else {
      checks.push({
        id: 'security-agent-instructions',
        category: 'security',
        name: 'Agent Safety Constraints',
        description: 'Ensures instructions do not direct AI agents to bypass security checks or expose secrets',
        status: 'pass',
        message: 'No dangerous directives found in agent instruction files',
        pointsAwarded: 3,
        pointsPossible: 3,
      });
    }
  }

  return {
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    checks,
    warnings,
  };
}
