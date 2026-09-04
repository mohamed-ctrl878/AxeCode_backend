'use strict';

const crypto = require('crypto');

/**
 * GitHub Webhook Service
 *
 * Handles webhook ingestion with HMAC-SHA256 signature verification.
 * Resolves GitHub usernames to project members for identity tracking.
 *
 * Branch Convention (auto-detected, highest priority first):
 *   1. Commit message contains  TASK-{documentId}
 *   2. Branch name starts with  task/{documentId}
 *   3. Branch name contains     {branch_pattern} stored on the task
 *   4. Branch name contains     {documentId} anywhere
 */
module.exports = {

  // ─────────────────────────────────────────────
  // PUBLIC: Signature verification
  // ─────────────────────────────────────────────
  verifySignature(payload, signature, secret) {
    if (!signature || !secret) return false;
    const expected = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  },

  // ─────────────────────────────────────────────
  // PUBLIC: Extract a compact summary from payload
  // ─────────────────────────────────────────────
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
            id: c.id,
            short_sha: c.id?.substring(0, 8),
            message: c.message?.substring(0, 200),
            author_github: c.author?.username || c.author?.name,
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
          pr_url: payload.pull_request?.html_url,
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
          head_sha: (payload.check_suite || payload.check_run)?.head_sha,
        };

      case 'workflow_run':
        return {
          ...base,
          action: payload.action,
          workflow_name: payload.workflow_run?.name,
          status: payload.workflow_run?.status,
          conclusion: payload.workflow_run?.conclusion,
          head_branch: payload.workflow_run?.head_branch,
          head_sha: payload.workflow_run?.head_sha,
        };

      default:
        return { ...base, action: payload.action };
    }
  },

  // ─────────────────────────────────────────────
  // PUBLIC: Main event processor (background worker)
  // ─────────────────────────────────────────────
  async processEvent(event) {
    const summary = event.payload_summary || {};
    const result = { actions: [] };

    try {
      switch (event.event_type) {
        case 'push':
          await this._resolveCommitsToTasks(event, summary, result);
          break;

        case 'pull_request':
          await this._linkPRToTask(event, summary, result);
          break;

        case 'check_suite':
        case 'check_run':
        case 'workflow_run':
          await this._updateCIStatus(event, summary, result);
          break;

        case 'pull_request_review':
          await this._handleReviewEvent(event, summary, result);
          break;
      }
    } catch (err) {
      result.error = err.message;
      strapi.log.error(`[GitHubWorker] Event ${event.documentId} failed:`, err.message);
    }

    // Mark as processed
    await strapi.documents('api::github-event.github-event').update({
      documentId: event.documentId,
      data: { processed: true, processed_result: result },
    });

    return result;
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Resolve GitHub login → project member
  // ─────────────────────────────────────────────
  async _resolveGithubUserToMember(projectDocumentId, githubLogin) {
    if (!githubLogin || !projectDocumentId) return null;

    const members = await strapi.documents('api::project-member.project-member').findMany({
      filters: {
        project: { documentId: projectDocumentId },
        github_username: { $eqi: githubLogin }, // case-insensitive
        is_active: true,
      },
      populate: ['users_permissions_user'],
    });

    return members[0] || null;
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Find tasks for a project
  // ─────────────────────────────────────────────
  async _getProjectTasks(projectDocumentId) {
    return strapi.documents('api::task.task').findMany({
      filters: { project: { documentId: projectDocumentId } },
      populate: ['assignee', 'assignee.users_permissions_user'],
    });
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Match a branch to a task using 4-priority chain
  //   1. Branch starts with task/{documentId}
  //   2. Branch contains {branch_pattern} stored on task
  //   3. Branch contains {documentId} anywhere
  // ─────────────────────────────────────────────
  _matchBranchToTask(branch, tasks) {
    if (!branch) return null;

    // Priority 1: exact prefix task/{documentId}
    for (const task of tasks) {
      if (branch === `task/${task.documentId}` || branch.startsWith(`task/${task.documentId}-`)) {
        return task;
      }
    }

    // Priority 2: custom branch_pattern stored on task
    for (const task of tasks) {
      if (task.branch_pattern && branch.includes(task.branch_pattern)) {
        return task;
      }
    }

    // Priority 3: documentId appears anywhere in the branch
    for (const task of tasks) {
      if (branch.includes(task.documentId)) {
        return task;
      }
    }

    return null;
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Extract task documentId from commit message
  //   Patterns: TASK-{id} | closes #{id} | fixes TASK-{id}
  // ─────────────────────────────────────────────
  _extractTaskIdFromMessage(message) {
    const match = message.match(/TASK-([a-z0-9]+)/i) || message.match(/task\/([a-z0-9]+)/i);
    return match ? match[1] : null;
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Send notification to task assignee
  // ─────────────────────────────────────────────
  async _notifyAssignee(task, interactionType, extra = {}) {
    try {
      const assigneeUserId = task.assignee?.users_permissions_user?.documentId;
      if (!assigneeUserId) return;

      const emitter = strapi.service('api::notification.notification-emitter');
      if (emitter && emitter.emit) {
        await emitter.emit({
          interactionType,
          contentType: 'task',
          docId: task.documentId,
          actorDocumentId: assigneeUserId,
          extra: { taskTitle: task.title, ...extra },
        });
      }
    } catch (err) {
      strapi.log.warn(`[GitHubWorker] Notification failed for task ${task.documentId}:`, err.message);
    }
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Handle push events
  // ─────────────────────────────────────────────
  async _resolveCommitsToTasks(event, summary, result) {
    const commits = summary.commits || [];
    const branch = (summary.ref || '').replace('refs/heads/', '');
    const projectDocId = event.project?.documentId;
    const tasks = await this._getProjectTasks(projectDocId);

    for (const commit of commits) {
      const message = commit.message || '';
      let matchedTask = null;

      // Priority 1: commit message contains TASK-{documentId}
      const taskId = this._extractTaskIdFromMessage(message);
      if (taskId) {
        matchedTask = tasks.find(t => t.documentId === taskId) || null;
      }

      // Priority 2-4: branch name matching
      if (!matchedTask) {
        matchedTask = this._matchBranchToTask(branch, tasks);
      }

      if (!matchedTask) continue;

      const updates = { last_commit_sha: commit.id || commit.short_sha };

      // Transition: todo → in_progress on first commit
      if (matchedTask.status === 'todo') {
        updates.status = 'in_progress';
        result.actions.push({
          type: 'task_transition',
          taskId: matchedTask.documentId,
          from: 'todo',
          to: 'in_progress',
          trigger: 'push',
          branch,
          commit: commit.short_sha,
        });

        await this._notifyAssignee(matchedTask, 'task_started', {
          branch,
          commit: commit.short_sha,
          committer: summary.sender,
        });
      } else {
        // Just update the commit SHA
        result.actions.push({
          type: 'commit_update',
          taskId: matchedTask.documentId,
          commit: commit.short_sha,
          branch,
        });
      }

      await strapi.documents('api::task.task').update({
        documentId: matchedTask.documentId,
        data: updates,
      });

      // Resolve committer identity
      const member = await this._resolveGithubUserToMember(projectDocId, commit.author_github || summary.sender);
      if (member) {
        result.actions.push({
          type: 'committer_resolved',
          taskId: matchedTask.documentId,
          githubLogin: commit.author_github || summary.sender,
          memberDocId: member.documentId,
        });
      }
    }
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Handle pull_request events
  // ─────────────────────────────────────────────
  async _linkPRToTask(event, summary, result) {
    const headBranch = summary.head_branch || '';
    const projectDocId = event.project?.documentId;
    if (!headBranch) return;

    const tasks = await this._getProjectTasks(projectDocId);
    const matchedTask = this._matchBranchToTask(headBranch, tasks);
    if (!matchedTask) return;

    const updates = {
      github_pr_id: summary.pr_number?.toString(),
      pr_title: summary.pr_title || null,
      pr_url: summary.pr_url || null,
    };

    // opened / ready_for_review → in_review
    if (['opened', 'ready_for_review'].includes(summary.action) && matchedTask.status === 'in_progress') {
      updates.status = 'in_review';
      result.actions.push({
        type: 'task_transition',
        taskId: matchedTask.documentId,
        from: 'in_progress',
        to: 'in_review',
        trigger: `pr_${summary.action}`,
        pr: summary.pr_number,
      });

      await this._notifyAssignee(matchedTask, 'pr_opened', {
        pr_number: summary.pr_number,
        pr_title: summary.pr_title,
        pr_url: summary.pr_url,
      });
    }

    // merged → done
    if (summary.pr_merged && ['in_progress', 'in_review'].includes(matchedTask.status)) {
      updates.status = 'done';
      result.actions.push({
        type: 'task_transition',
        taskId: matchedTask.documentId,
        from: matchedTask.status,
        to: 'done',
        trigger: 'pr_merged',
        pr: summary.pr_number,
      });

      await this._notifyAssignee(matchedTask, 'pr_merged', {
        pr_number: summary.pr_number,
        pr_title: summary.pr_title,
        pr_url: summary.pr_url,
      });
    }

    // closed (not merged) → back to in_progress
    if (summary.action === 'closed' && !summary.pr_merged && matchedTask.status === 'in_review') {
      updates.status = 'in_progress';
      result.actions.push({
        type: 'task_transition',
        taskId: matchedTask.documentId,
        from: 'in_review',
        to: 'in_progress',
        trigger: 'pr_closed_without_merge',
        pr: summary.pr_number,
      });
    }

    await strapi.documents('api::task.task').update({
      documentId: matchedTask.documentId,
      data: updates,
    });
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Handle check_run / check_suite / workflow_run CI events
  // ─────────────────────────────────────────────
  async _updateCIStatus(event, summary, result) {
    const conclusion = summary.conclusion;
    const headBranch = summary.head_branch || '';
    const projectDocId = event.project?.documentId;
    if (!conclusion || !headBranch) return;

    const ciMap = {
      success: 'success',
      neutral: 'success',
      failure: 'failure',
      timed_out: 'failure',
      cancelled: 'cancelled',
    };

    const ciStatus = ciMap[conclusion] || 'pending';

    const tasks = await this._getProjectTasks(projectDocId);
    const matchedTask = this._matchBranchToTask(headBranch, tasks);
    if (!matchedTask) return;

    const updates = { ci_status: ciStatus };

    // Update last_commit_sha from CI event if available
    if (summary.head_sha) {
      updates.last_commit_sha = summary.head_sha.substring(0, 8);
    }

    await strapi.documents('api::task.task').update({
      documentId: matchedTask.documentId,
      data: updates,
    });

    result.actions.push({
      type: 'ci_update',
      taskId: matchedTask.documentId,
      ci_status: ciStatus,
      branch: headBranch,
    });

    // Notify on CI failure
    if (ciStatus === 'failure') {
      await this._notifyAssignee(matchedTask, 'ci_failed', {
        branch: headBranch,
        workflow: summary.workflow_name,
      });
    }

    // Notify on CI success (only when task is in_review)
    if (ciStatus === 'success' && matchedTask.status === 'in_review') {
      await this._notifyAssignee(matchedTask, 'ci_passed', {
        branch: headBranch,
      });
    }
  },

  // ─────────────────────────────────────────────
  // PRIVATE: Handle pull_request_review events
  // ─────────────────────────────────────────────
  async _handleReviewEvent(event, summary, result) {
    const projectDocId = event.project?.documentId;
    const prNumber = summary.pr_number?.toString();
    if (!prNumber) return;

    const tasks = await strapi.documents('api::task.task').findMany({
      filters: {
        project: { documentId: projectDocId },
        github_pr_id: prNumber,
      },
      populate: ['assignee', 'assignee.users_permissions_user'],
    });

    for (const task of tasks) {
      // Approved → just record (merge event will do the transition)
      if (summary.review_state === 'approved') {
        result.actions.push({
          type: 'review_approved',
          taskId: task.documentId,
          reviewer: summary.reviewer,
        });

        await this._notifyAssignee(task, 'review_approved', {
          reviewer: summary.reviewer,
          pr_number: prNumber,
        });
      }

      // Changes requested → blocked
      if (summary.review_state === 'changes_requested' && task.status === 'in_review') {
        await strapi.documents('api::task.task').update({
          documentId: task.documentId,
          data: { status: 'blocked' },
        });

        result.actions.push({
          type: 'task_transition',
          taskId: task.documentId,
          from: 'in_review',
          to: 'blocked',
          trigger: 'changes_requested',
          reviewer: summary.reviewer,
        });

        await this._notifyAssignee(task, 'changes_requested', {
          reviewer: summary.reviewer,
          pr_number: prNumber,
        });
      }
    }
  },
};
