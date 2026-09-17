import fs from 'node:fs';
import {
  isShallowRepository,
  verifyGitRef,
  resolveDefaultBase,
} from '../git/safeGit.js';
import type { ActionEnvironment } from './types.js';

export interface BaseDetectionResult {
  base?: string;
  error?: string;
}

/**
 * Extracts the base branch reference from GitHub event payload JSON if available.
 */
export function getBaseRefFromEvent(eventPath?: string): string | undefined {
  if (!eventPath || !fs.existsSync(eventPath)) return undefined;
  try {
    const content = fs.readFileSync(eventPath, 'utf8');
    const payload = JSON.parse(content);
    return (
      payload?.pull_request?.base?.ref ||
      payload?.base_ref ||
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * Automatically detects the appropriate comparison base reference in GitHub Actions.
 * Handles PR events, GITHUB_BASE_REF, shallow clone detection, and fallback resolution.
 */
export async function detectActionBase(
  env: ActionEnvironment,
  cwd: string
): Promise<BaseDetectionResult> {
  // 1. Check for shallow repository clone
  const isShallow = await isShallowRepository(cwd);
  if (isShallow) {
    return {
      error:
        'The repository was checked out with fetch-depth: 1 (shallow clone). ' +
        'AgentRuleMap requires commit history to determine changed files and base revisions accurately. ' +
        'Please set `fetch-depth: 0` on `actions/checkout` in your GitHub Actions workflow:\n\n' +
        '    - uses: actions/checkout@v4\n' +
        '      with:\n' +
        '        fetch-depth: 0',
    };
  }

  // 2. User explicitly provided base via inputs
  if (env.inputs?.base && env.inputs.base.trim()) {
    const userBase = env.inputs.base.trim();
    const verified = await verifyGitRef(userBase, cwd);
    if (verified.exists) {
      return { base: userBase };
    }
    // Check if origin/<userBase> exists
    const originUserBase = `origin/${userBase}`;
    const verifiedOrigin = await verifyGitRef(originUserBase, cwd);
    if (verifiedOrigin.exists) {
      return { base: originUserBase };
    }
    return {
      error: `Specified base reference "${userBase}" could not be resolved in the repository.`,
    };
  }

  // 3. GitHub PR Context: GITHUB_BASE_REF or pull_request event payload
  const prBaseRef =
    (env.baseRef && env.baseRef.trim()) || getBaseRefFromEvent(env.eventPath);

  if (prBaseRef) {
    const candidates = [
      `origin/${prBaseRef}`,
      prBaseRef,
      `refs/remotes/origin/${prBaseRef}`,
    ];

    for (const candidate of candidates) {
      const verified = await verifyGitRef(candidate, cwd);
      if (verified.exists) {
        return { base: candidate };
      }
    }

    return {
      error:
        `Pull request base branch "${prBaseRef}" (or "origin/${prBaseRef}") was not found in git history. ` +
        `Ensure \`fetch-depth: 0\` is configured on \`actions/checkout\`.`,
    };
  }

  // 4. Non-PR context (push event, workflow_dispatch, or manual local execution)
  try {
    const defaultBase = await resolveDefaultBase(cwd);
    return { base: defaultBase };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      error:
        `Could not automatically resolve a comparison base: ${msg}. ` +
        `Please specify the \`base\` input in your action configuration.`,
    };
  }
}
