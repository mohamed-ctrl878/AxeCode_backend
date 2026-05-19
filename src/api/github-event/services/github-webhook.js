'use strict';

const crypto = require('crypto');

/**
 * GitHub Webhook Service
 * 
 * Handles webhook ingestion with HMAC-SHA256 signature verification.
 * Follows the same verification pattern used in payment.js for Paymob webhooks.
 */
module.exports = {
  /**
   * Verify the X-Hub-Signature-256 header against the project's webhook secret.
   * 
   * @param {string} payload - Raw request body string
   * @param {string} signature - Value of X-Hub-Signature-256 header
   * @param {string} secret - Project's github_webhook_secret
   * @returns {boolean}
   */
  verifySignature(payload, signature, secret) {
    if (!signature || !secret) return false;

    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      );
    } catch {
      return false;
    }
  },

  /**
   * Extract a compact summary from the full webhook payload.
   * Avoids storing massive payloads in DB.
   * 
   * @param {string} eventType
   * @param {Object} payload
   * @returns {Object} compact summary
   */
  extractSummary(eventType, payload) {
    const base = {
      sender: payload.sender?.login || 'unknown',
      repo: payload.repository?.full_name || 'unknown',
    };

    switch (eventType) {
      case 'push':
        return {
          ...base,
          ref: payload.ref,
          commits: (payload.commits || []).map(c => ({
            id: c.id?.substring(0, 8),
            message: c.message?.substring(0, 200),
            author: c.author?.username || c.author?.name,
          })),
          compare_url: payload.compare,
        };

      case 'pull_request':
        return {
          ...base,
          action: payload.action,
          pr_number: payload.pull_request?.number,
          pr_title: payload.pull_request?.title?.substring(0, 200),
          pr_state: payload.pull_request?.state,
          pr_merged: payload.pull_request?.merged || false,
          head_branch: payload.pull_request?.head?.ref,
          base_branch: payload.pull_request?.base?.ref,
        };

      case 'pull_request_review':
        return {
          ...base,
          action: payload.action,
          pr_number: payload.pull_request?.number,
          review_state: payload.review?.state,
          reviewer: payload.review?.user?.login,
        };

      case 'check_suite':
      case 'check_run':
        return {
          ...base,
          action: payload.action,
          status: (payload.check_suite || payload.check_run)?.status,
          conclusion: (payload.check_suite || payload.check_run)?.conclusion,
          head_branch: (payload.check_suite || payload.check_run)?.head_branch,
        };

      case 'workflow_run':
        return {
          ...base,
          action: payload.action,
          workflow_name: payload.workflow_run?.name,
          status: payload.workflow_run?.status,
          conclusion: payload.workflow_run?.conclusion,
          head_branch: payload.workflow_run?.head_branch,
        };

      default:
        return { ...base, action: payload.action };
    }
  },

  /**
   * Process a GitHub event — resolve commits to tasks, update CI status, etc.
   * This is the background worker logic called after event ingestion.
   * 
   * @param {Object} event - The stored github_event record
   */
  async processEvent(event) {
    const summary = event.payload_summary || {};
    const result = { actions: [] };

    try {
      switch (event.event_type) {
        case 'push':
          // Resolve commits to tasks via branch pattern or commit message
          await this._resolveCommitsToTasks(event, summary, result);
          break;

        case 'pull_request':
          // Link PR to task via branch name matching
          await this._linkPRToTask(event, summary, result);
          break;

        case 'check_suite':
        case 'check_run':
        case 'workflow_run':
          // Update CI status on linked tasks
          await this._updateCIStatus(event, summary, result);
          break;

        case 'pull_request_review':
          // Optionally transition task on approved review
          if (summary.review_state === 'approved') {
            await this._handleReviewApproval(event, summary, result);
          }
          break;
      }
    } catch (err) {
      result.error = err.message;
      strapi.log.error(`[GitHubWorker] Event ${event.documentId} processing failed:`, err.message);
    }

    // Mark as processed
    await strapi.documents('api::github-event.github-event').update({
      documentId: event.documentId,
      data: { processed: true, processed_result: result },
    });

    return result;
  },

  /**
   * 4-priority chain for resolving commits to tasks:
   * 1. Commit message contains task ID (e.g. "fix: resolve TASK-abc123")
   * 2. Branch name matches task.branch_pattern
   * 3. Branch name contains task documentId
   * 4. No match — log only
   */
  async _resolveCommitsToTasks(event, summary, result) {
    const commits = summary.commits || [];

    for (const commit of commits) {
      const message = commit.message || '';
      
      // Priority 1: Explicit task reference in commit message (TASK-<documentId>)
      const taskRef = message.match(/TASK-([a-z0-9]+)/i);
      if (taskRef) {
        const task = await strapi.documents('api::task.task').findOne({
          documentId: taskRef[1],
        });
        if (task && task.status === 'todo') {
          await strapi.documents('api::task.task').update({
            documentId: task.documentId,
            data: { status: 'in_progress' },
          });
          result.actions.push({ type: 'task_transition', taskId: task.documentId, from: 'todo', to: 'in_progress' });
        }
        continue;
      }

      // Priority 2 & 3: Branch-based matching
      const branch = (summary.ref || '').replace('refs/heads/', '');
      if (branch) {
        const tasks = await strapi.documents('api::task.task').findMany({
          filters: { project: { documentId: event.project?.documentId } },
        });

        for (const task of tasks) {
          // Priority 2: branch_pattern match
          if (task.branch_pattern && branch.includes(task.branch_pattern)) {
            if (task.status === 'todo') {
              await strapi.documents('api::task.task').update({
                documentId: task.documentId,
                data: { status: 'in_progress' },
              });
              result.actions.push({ type: 'task_transition', taskId: task.documentId, from: 'todo', to: 'in_progress' });
            }
            break;
          }

          // Priority 3: branch contains documentId
          if (branch.includes(task.documentId)) {
            if (task.status === 'todo') {
              await strapi.documents('api::task.task').update({
                documentId: task.documentId,
                data: { status: 'in_progress' },
              });
              result.actions.push({ type: 'task_transition', taskId: task.documentId, from: 'todo', to: 'in_progress' });
            }
            break;
          }
        }
      }
    }
  },

  /**
   * Link PR to task and optionally transition to in_review.
   */
  async _linkPRToTask(event, summary, result) {
    const headBranch = summary.head_branch || '';
    if (!headBranch) return;

    const tasks = await strapi.documents('api::task.task').findMany({
      filters: { project: { documentId: event.project?.documentId } },
    });

    for (const task of tasks) {
      const matches = (task.branch_pattern && headBranch.includes(task.branch_pattern))
        || headBranch.includes(task.documentId);

      if (matches) {
        const updates = { github_pr_id: summary.pr_number?.toString() };

        // If PR opened/ready_for_review → transition to in_review
        if (['opened', 'ready_for_review'].includes(summary.action) && task.status === 'in_progress') {
          updates.status = 'in_review';
          result.actions.push({ type: 'task_transition', taskId: task.documentId, from: 'in_progress', to: 'in_review' });
        }

        // If PR merged → transition to done
        if (summary.pr_merged && ['in_progress', 'in_review'].includes(task.status)) {
          updates.status = 'done';
          result.actions.push({ type: 'task_transition', taskId: task.documentId, from: task.status, to: 'done' });
        }

        await strapi.documents('api::task.task').update({
          documentId: task.documentId,
          data: updates,
        });
        break;
      }
    }
  },

  /**
   * Update CI status on tasks linked to the checked branch.
   */
  async _updateCIStatus(event, summary, result) {
    const conclusion = summary.conclusion;
    const headBranch = summary.head_branch || '';
    if (!conclusion || !headBranch) return;

    const ciMap = {
      success: 'success',
      failure: 'failure',
      cancelled: 'cancelled',
      neutral: 'success',
      timed_out: 'failure',
    };

    const tasks = await strapi.documents('api::task.task').findMany({
      filters: { project: { documentId: event.project?.documentId } },
    });

    for (const task of tasks) {
      const matches = (task.branch_pattern && headBranch.includes(task.branch_pattern))
        || headBranch.includes(task.documentId);

      if (matches) {
        await strapi.documents('api::task.task').update({
          documentId: task.documentId,
          data: { ci_status: ciMap[conclusion] || 'pending' },
        });
        result.actions.push({ type: 'ci_update', taskId: task.documentId, ci_status: ciMap[conclusion] });
        break;
      }
    }
  },

  /**
   * Handle PR review approval — optionally auto-transition.
   */
  async _handleReviewApproval(event, summary, result) {
    // Find task linked to this PR
    const tasks = await strapi.documents('api::task.task').findMany({
      filters: {
        project: { documentId: event.project?.documentId },
        github_pr_id: summary.pr_number?.toString(),
      },
    });

    for (const task of tasks) {
      if (task.status === 'in_review') {
        result.actions.push({ type: 'review_approved', taskId: task.documentId, reviewer: summary.reviewer });
      }
    }
  },
};
