'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::github-event.github-event', ({ strapi }) => ({
  /**
   * POST /github/webhook — Receive GitHub webhook events.
   * 
   * This endpoint is called by GitHub. It:
   * 1. Identifies the project by github_repo_id from the payload
   * 2. Verifies X-Hub-Signature-256 against the project's webhook secret
   * 3. Stores the event (idempotent via delivery_id)
   * 4. Processes it in the background (fire-and-forget)
   */
  async ingest(ctx) {
    const eventType = ctx.request.headers['x-github-event'];
    const deliveryId = ctx.request.headers['x-github-delivery'];
    const signature = ctx.request.headers['x-hub-signature-256'];

    if (!eventType || !deliveryId) {
      return ctx.badRequest('Missing required GitHub webhook headers');
    }

    // Get raw body for signature verification
    const rawBody = typeof ctx.request.body === 'string'
      ? ctx.request.body
      : JSON.stringify(ctx.request.body);

    const payload = typeof ctx.request.body === 'string'
      ? JSON.parse(ctx.request.body)
      : ctx.request.body;

    // Identify project by repository ID
    const repoId = payload.repository?.id;
    if (!repoId) {
      return ctx.badRequest('Missing repository.id in payload');
    }

    const project = await strapi.db.query('api::project.project').findOne({
      where: { github_repo_id: repoId.toString() },
    });

    if (!project) {
      // Not a tracked project — acknowledge but don't store
      return { data: { status: 'ignored', reason: 'untracked_repository' } };
    }

    // Verify signature
    const webhookService = strapi.service('api::github-event.github-webhook');
    if (project.github_webhook_secret) {
      const isValid = webhookService.verifySignature(rawBody, signature, project.github_webhook_secret);
      if (!isValid) {
        strapi.log.warn(`[GitHub] Invalid signature for project ${project.documentId}, delivery ${deliveryId}`);
        return ctx.unauthorized('Invalid webhook signature');
      }
    }

    // Idempotent check — skip if already received
    const existing = await strapi.db.query('api::github-event.github-event').findOne({
      where: { delivery_id: deliveryId },
    });

    if (existing) {
      return { data: { status: 'duplicate', delivery_id: deliveryId } };
    }

    // Extract summary and store
    const summary = webhookService.extractSummary(eventType, payload);

    const event = await strapi.db.query('api::github-event.github-event').create({
      data: {
        project: project.id,
        event_type: eventType,
        action: payload.action || null,
        sender_github_username: payload.sender?.login || 'unknown',
        delivery_id: deliveryId,
        payload_summary: summary,
        processed: false,
      },
    });

    // Process in background (fire-and-forget)
    setImmediate(async () => {
      try {
        // Re-fetch with documentId for the worker
        const fullEvent = await strapi.db.query('api::github-event.github-event').findOne({
          where: { id: event.id },
          populate: { project: true },
        });
        if (fullEvent) {
          await webhookService.processEvent(fullEvent);
        }
      } catch (err) {
        strapi.log.error(`[GitHub] Background processing failed for delivery ${deliveryId}:`, err.message);
      }
    });

    return { data: { status: 'accepted', delivery_id: deliveryId, event_type: eventType } };
  },

  /**
   * GET /projects/:id/github-events — List GitHub events for a project.
   */
  async findByProject(ctx) {
    const { id: projectId } = ctx.params;
    const { event_type, limit: rawLimit } = ctx.query;
    const limit = parseInt(rawLimit, 10) || 20;

    const filters = { project: { documentId: projectId } };
    if (event_type) filters.event_type = event_type;

    const events = await strapi.documents('api::github-event.github-event').findMany({
      filters,
      sort: [{ createdAt: 'desc' }],
      limit,
    });

    return { data: events };
  },
}));
