import path from 'node:path';
import type { RepoContext, RuleCheck } from '../types/index.js';
import { parseInstructionFile } from '../scanners/instructionParser.js';
import { fileExists } from '../utils/fsUtils.js';

export function runInstructionAccuracyRule(context: RepoContext): {
  score: number;
  maxScore: number;
  checks: RuleCheck[];
  warnings: string[];
} {
  const maxScore = 20;
  let score = 0;
  const checks: RuleCheck[] = [];
  const warnings: string[] = [];

  const instructionFiles = context.instructionFiles;
  if (instructionFiles.length === 0) {
    checks.push({
      id: 'instruction-accuracy-commands',
      category: 'instruction_accuracy',
      name: 'Command Verification',
      description: 'Verifies whether scripts mentioned in instructions exist in package.json',
      status: 'fail',
      message: 'No instruction files available to verify commands against',
      pointsAwarded: 0,
      pointsPossible: 10,
    });

    checks.push({
      id: 'instruction-accuracy-paths',
      category: 'instruction_accuracy',
      name: 'Path Verification',
      description: 'Verifies whether paths referenced in instructions actually exist in the repository',
      status: 'fail',
      message: 'No instruction files available to verify referenced paths against',
      pointsAwarded: 0,
      pointsPossible: 10,
    });

    return { score: 0, maxScore, checks, warnings };
  }

  // Parse all instruction files
  const analyses = instructionFiles.map((file) =>
    parseInstructionFile(file.content, file.relativePath)
  );

  // 1. Command Verification (10 pts)
  const allCommands = analyses.flatMap((a) => a.commands);
  const pkgScripts = context.packageJson?.scripts || {};

  const invalidCommands: string[] = [];
  const verifiedCommands: string[] = [];

  for (const cmd of allCommands) {
    if (cmd.scriptName) {
      // Direct npm command check (e.g. test, start, build, lint)
      const scriptExists = Object.prototype.hasOwnProperty.call(pkgScripts, cmd.scriptName);
      if (scriptExists) {
        if (!verifiedCommands.includes(cmd.scriptName)) {
          verifiedCommands.push(cmd.scriptName);
        }
      } else {
        // Special case: 'npm test' or 'npm start' can be default npm behaviors, but in modern repos they should be declared
        const item = `${cmd.sourceFile} mentions "${cmd.raw}" but script "${cmd.scriptName}" is missing from package.json`;
        if (!invalidCommands.includes(item)) {
          invalidCommands.push(item);
        }
      }
    }
  }

  if (invalidCommands.length > 0) {
    const penalty = Math.min(10, invalidCommands.length * 3);
    const cmdScore = Math.max(0, 10 - penalty);
    score += cmdScore;

    for (const inv of invalidCommands) {
      warnings.push(inv);
    }

    checks.push({
      id: 'instruction-accuracy-commands',
      category: 'instruction_accuracy',
      name: 'Command Verification',
      description: 'Verifies whether scripts mentioned in instructions exist in package.json',
      status: 'warn',
      message: `Instruction commands do not match package.json (${invalidCommands.length} mismatch${invalidCommands.length > 1 ? 'es' : ''})`,
      details: invalidCommands,
      pointsAwarded: cmdScore,
      pointsPossible: 10,
    });
  } else if (verifiedCommands.length > 0) {
    score += 10;
    checks.push({
      id: 'instruction-accuracy-commands',
      category: 'instruction_accuracy',
      name: 'Command Verification',
      description: 'Verifies whether scripts mentioned in instructions exist in package.json',
      status: 'pass',
      message: `Verified instruction commands (${verifiedCommands.join(', ')}) in package.json scripts`,
      details: verifiedCommands.map((c) => `✓ Script "${c}" exists in package.json`),
      pointsAwarded: 10,
      pointsPossible: 10,
    });
  } else {
    // Instructions exist but don't explicitly cite npm run commands
    score += 8;
    checks.push({
      id: 'instruction-accuracy-commands',
      category: 'instruction_accuracy',
      name: 'Command Verification',
      description: 'Verifies whether scripts mentioned in instructions exist in package.json',
      status: 'info',
      message: 'No explicit package.json scripts were cited in agent instructions',
      pointsAwarded: 8,
      pointsPossible: 10,
    });
  }

  // 2. Path Verification (10 pts)
  const allPaths = analyses.flatMap((a) => a.referencedPaths);
  const brokenPaths: Array<{ source: string; raw: string }> = [];
  const validPaths: string[] = [];

  for (const p of allPaths) {
    const fullPath = path.resolve(context.rootDir, p.normalized);
    // Path could refer to a directory or a file
    const exists = fileExists(fullPath);
    if (exists) {
      if (!validPaths.includes(p.normalized)) {
        validPaths.push(p.normalized);
      }
    } else {
      brokenPaths.push({ source: p.sourceFile, raw: p.raw });
      const warnMsg = `${p.sourceFile} references ${p.raw} but that path does not exist`;
      if (!warnings.includes(warnMsg)) {
        warnings.push(warnMsg);
      }
    }
  }

  if (brokenPaths.length > 0) {
    const penalty = Math.min(10, brokenPaths.length * 3);
    const pathScore = Math.max(0, 10 - penalty);
    score += pathScore;

    checks.push({
      id: 'instruction-accuracy-paths',
      category: 'instruction_accuracy',
      name: 'Path Verification',
      description: 'Verifies whether paths referenced in instructions actually exist in the repository',
      status: 'warn',
      message: `${brokenPaths.length} referenced path${brokenPaths.length > 1 ? 's' : ''} do not exist in the repository`,
      details: brokenPaths.map((bp) => `${bp.source} references ${bp.raw} (not found)`),
      pointsAwarded: pathScore,
      pointsPossible: 10,
    });
  } else if (validPaths.length > 0) {
    score += 10;
    checks.push({
      id: 'instruction-accuracy-paths',
      category: 'instruction_accuracy',
      name: 'Path Verification',
      description: 'Verifies whether paths referenced in instructions actually exist in the repository',
      status: 'pass',
      message: 'All paths referenced in instructions were verified to exist',
      details: validPaths.map((vp) => `✓ ${vp} verified`),
      pointsAwarded: 10,
      pointsPossible: 10,
    });
  } else {
    // Instructions exist but did not cite specific filesystem paths
    score += 8;
    checks.push({
      id: 'instruction-accuracy-paths',
      category: 'instruction_accuracy',
      name: 'Path Verification',
      description: 'Verifies whether paths referenced in instructions actually exist in the repository',
      status: 'info',
      message: 'No explicit relative paths detected in agent instructions to verify',
      pointsAwarded: 8,
      pointsPossible: 10,
    });
  }

  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks,
    warnings,
  };
}
