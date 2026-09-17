import fs from 'node:fs';
import * as github from '@actions/github';
import * as core from '@actions/core';
import { PR_COMMENT_MARKER } from './summaryFormatter.js';
import type { ActionEnvironment } from './types.js';

export interface PrCommentResult {
  success: boolean;
  actionTaken?: 'created' | 'updated' | 'skipped';
  error?: string;
}

/**
 * Opt-in PR commenting.
 * Updates an existing AgentRuleMap comment if found, or creates a new one.
 * Fails gracefully without throwing if permissions (e.g. pull-requests: write) are lacking.
 */
export async function postOrUpdatePrComment(
  markdownBody: string,
  env: ActionEnvironment
): Promise<PrCommentResult> {
  const token = env.token || env.inputs?.githubToken || process.env.GITHUB_TOKEN;
  if (!token) {
    core.notice('AgentRuleMap: PR commenting skipped because no GitHub token was provided.');
    return { success: false, actionTaken: 'skipped', error: 'No token provided' };
  }

  const repository = env.repository || process.env.GITHUB_REPOSITORY;
  if (!repository || !repository.includes('/')) {
    core.notice('AgentRuleMap: PR commenting skipped because GITHUB_REPOSITORY is invalid.');
    return { success: false, actionTaken: 'skipped', error: 'Invalid repository' };
  }

  const [owner, repo] = repository.split('/');

  // Determine PR number from event payload
  let prNumber: number | undefined;
  if (env.eventPath && fs.existsSync(env.eventPath)) {
    try {
      const payload = JSON.parse(fs.readFileSync(env.eventPath, 'utf8'));
      prNumber =
        payload?.pull_request?.number ||
        payload?.issue?.number ||
        payload?.number;
    } catch {
      // ignore parsing errors
    }
  }

  if (!prNumber) {
    core.notice(
      'AgentRuleMap: PR commenting skipped because the current workflow event does not contain a pull_request number.'
    );
    return { success: false, actionTaken: 'skipped', error: 'No PR number found' };
  }

  try {
    const octokit = github.getOctokit(token);

    // List existing comments to check for existing AgentRuleMap comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
      per_page: 100,
    });

    const existingComment = comments.find(
      (c) => c.body && c.body.includes(PR_COMMENT_MARKER)
    );

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: markdownBody,
      });
      return { success: true, actionTaken: 'updated' };
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: markdownBody,
      });
      return { success: true, actionTaken: 'created' };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    core.notice(
      `AgentRuleMap: Unable to post PR comment (${errorMsg}). Verify that the workflow has "pull-requests: write" permission.`
    );
    return { success: false, actionTaken: 'skipped', error: errorMsg };
  }
}
