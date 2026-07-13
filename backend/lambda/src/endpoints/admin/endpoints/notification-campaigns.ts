/**
 * Notification Campaign Engine — domain API (not page-driven).
 * Routes: /admin/notifications/*
 */

import { Hono } from 'hono';
import { insert, query, update } from '../../../database/rds-connection';
import {
  estimateCampaignAudience,
  buildAudienceFiltersPayload,
  serializeAudienceFilters,
  type AudienceFilters,
} from '../../../utils/notification-campaign-audience';
import { executeCampaignDelivery } from '../../../utils/notification-campaign-processor';
import { loadCampaignTargeting } from '../../../utils/notification-campaign-targeting';
import { processDueScheduledCampaigns } from '../../../utils/scheduled-notification-drain';
import {
  campaignPipelineDisabledResult,
  cronPipelineSkippedPayload,
  isNotificationCronEnabled,
  isNotificationPipelineEnabled,
} from '../../../utils/notification-pipeline-kill-switch';

function getAdminId(c: { req: { header: (name: string) => string | undefined } }): string | null {
  return c.req.header('x-admin-id') || c.req.header('x-user-id') || null;
}

async function recordCampaignEvent(
  campaignId: string,
  eventType: string,
  performedBy: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await insert('notification_campaign_events', {
    campaign_id: campaignId,
    event_type: eventType,
    performed_by: performedBy,
    metadata,
  }).catch((err) => console.warn('[campaign-event]', err));
}

async function buildCampaignAudienceFilters(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return serializeAudienceFilters(buildAudienceFiltersPayload(body));
}

async function campaignAudiencePayload(
  campaign: Record<string, unknown>,
  targeting: Awaited<ReturnType<typeof loadCampaignTargeting>>
): Promise<AudienceFilters> {
  const audience = buildAudienceFiltersPayload({
    audience_filters: campaign.audience_filters,
    ...(campaign.audience_filters as Record<string, unknown> || {}),
  });
  return {
    targeting_type: String(campaign.targeting_type || 'BROADCAST'),
    target_app: (campaign.target_app as 'CUSTOMER' | 'VENDOR') || 'CUSTOMER',
    region_ids: targeting.region_ids,
    city_names: targeting.city_names,
    user_ids: targeting.user_ids,
    segment_ids: targeting.segment_ids,
    ...audience,
  };
}

async function replaceCampaignTargeting(
  campaignId: string,
  body: Record<string, unknown>
): Promise<void> {
  await query('DELETE FROM notification_campaign_regions WHERE campaign_id = $1', [campaignId]);
  await query('DELETE FROM notification_campaign_cities WHERE campaign_id = $1', [campaignId]);
  await query('DELETE FROM notification_campaign_users WHERE campaign_id = $1', [campaignId]);
  await query('DELETE FROM notification_segment_targets WHERE campaign_id = $1', [campaignId]);

  for (const regionId of (body.region_ids as string[]) || []) {
    await insert('notification_campaign_regions', { campaign_id: campaignId, region_id: regionId });
  }
  for (const cityName of (body.city_names as string[]) || []) {
    const trimmed = String(cityName).trim();
    if (!trimmed) continue;
    await insert('notification_campaign_cities', { campaign_id: campaignId, city_name: trimmed });
  }
  for (const userId of (body.user_ids as string[]) || []) {
    await insert('notification_campaign_users', { campaign_id: campaignId, user_id: userId });
  }
  for (const segmentId of (body.segment_ids as string[]) || []) {
    await insert('notification_segment_targets', { campaign_id: campaignId, segment_id: segmentId });
  }
}

export function registerNotificationCampaignEndpoints(app: Hono) {
  // ── Settings ──────────────────────────────────────────────────────────────
  app.get('/admin/notifications/settings', async (c) => {
    try {
      const result = await query(
        `SELECT app_type::text AS app_type, push_enabled, updated_at
         FROM notification_channel_settings ORDER BY app_type`
      );
      const rows = result.rows || [];
      const customer = rows.find((r: { app_type: string }) => r.app_type === 'CUSTOMER');
      const vendor = rows.find((r: { app_type: string }) => r.app_type === 'VENDOR');
      return c.json({
        success: true,
        settings: {
          customerPushEnabled: customer?.push_enabled ?? true,
          vendorPushEnabled: vendor?.push_enabled ?? true,
        },
      });
    } catch {
      return c.json({
        success: true,
        settings: { customerPushEnabled: true, vendorPushEnabled: true },
      });
    }
  });

  app.put('/admin/notifications/settings', async (c) => {
    try {
      const body = await c.req.json();
      const adminId = getAdminId(c);
      if (body.customerPushEnabled != null) {
        await query(
          `UPDATE notification_channel_settings
           SET push_enabled = $1, updated_by = $2::uuid, updated_at = NOW()
           WHERE app_type = 'CUSTOMER'`,
          [!!body.customerPushEnabled, adminId]
        );
      }
      if (body.vendorPushEnabled != null) {
        await query(
          `UPDATE notification_channel_settings
           SET push_enabled = $1, updated_by = $2::uuid, updated_at = NOW()
           WHERE app_type = 'VENDOR'`,
          [!!body.vendorPushEnabled, adminId]
        );
      }
      return c.json({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to update settings';
      return c.json({ error: msg }, 500);
    }
  });

  // ── Audience estimate ─────────────────────────────────────────────────────
  app.post('/admin/notifications/estimate-audience', async (c) => {
    try {
      const body = await c.req.json();
      const estimate = await estimateCampaignAudience(body as AudienceFilters);
      return c.json({ success: true, ...estimate });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Estimate failed';
      return c.json({ error: msg }, 500);
    }
  });

  // ── Templates ─────────────────────────────────────────────────────────────
  app.get('/admin/notifications/templates', async (c) => {
    try {
      const result = await query(
        `SELECT id, name, target_app::text AS target_app, channel::text AS channel,
                title_template, message_template, cta_template, deep_link_template,
                is_active, created_at, updated_at
         FROM notification_campaign_templates
         WHERE is_active = true
         ORDER BY name ASC`
      );
      return c.json({ success: true, templates: result.rows || [] });
    } catch {
      return c.json({ success: true, templates: [] });
    }
  });

  app.post('/admin/notifications/templates', async (c) => {
    try {
      const body = await c.req.json();
      const row = await insert('notification_campaign_templates', {
        name: body.name,
        target_app: body.target_app || 'CUSTOMER',
        channel: body.channel || 'PUSH',
        title_template: body.title_template,
        message_template: body.message_template,
        cta_template: body.cta_template || null,
        deep_link_template: body.deep_link_template || null,
        is_active: body.is_active !== false,
      });
      return c.json({ success: true, template: row[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Create template failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.put('/admin/notifications/templates/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();
      const updated = await update('notification_campaign_templates', { id }, {
        ...body,
        updated_at: new Date().toISOString(),
      });
      return c.json({ success: true, template: updated[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Update template failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.delete('/admin/notifications/templates/:id', async (c) => {
    try {
      const { id } = c.req.param();
      await update('notification_campaign_templates', { id }, { is_active: false, updated_at: new Date().toISOString() });
      return c.json({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Delete template failed';
      return c.json({ error: msg }, 500);
    }
  });

  // ── Segments ──────────────────────────────────────────────────────────────
  app.get('/admin/notifications/segments', async (c) => {
    try {
      const result = await query(
        `SELECT id, name, description, target_app::text AS target_app, is_active, created_at
         FROM notification_segments WHERE is_active = true ORDER BY name`
      );
      return c.json({ success: true, segments: result.rows || [] });
    } catch {
      return c.json({ success: true, segments: [] });
    }
  });

  app.post('/admin/notifications/segments', async (c) => {
    try {
      const body = await c.req.json();
      const row = await insert('notification_segments', {
        name: body.name,
        description: body.description || null,
        target_app: body.target_app || 'CUSTOMER',
        is_active: true,
      });
      const segmentId = row[0]?.id;
      for (const rule of body.rules || []) {
        await insert('notification_segment_rules', {
          segment_id: segmentId,
          field_name: rule.field_name,
          operator: rule.operator || '=',
          comparison_value: String(rule.comparison_value),
        });
      }
      return c.json({ success: true, segment: row[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Create segment failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.post('/admin/notifications/segments/:id/preview', async (c) => {
    try {
      const { id } = c.req.param();
      const segment = await query('SELECT * FROM notification_segments WHERE id = $1', [id]);
      if (!segment.rows?.length) return c.json({ error: 'Segment not found' }, 404);
      const estimate = await estimateCampaignAudience({
        targeting_type: 'SEGMENTS',
        target_app: segment.rows[0].target_app,
        segment_ids: [id],
      });
      return c.json({ success: true, ...estimate });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Preview failed';
      return c.json({ error: msg }, 500);
    }
  });

  // ── Campaigns CRUD ────────────────────────────────────────────────────────
  app.get('/admin/notifications/campaigns', async (c) => {
    try {
      const status = c.req.query('status');
      const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
      const params: unknown[] = [];
      let where = '';
      if (status) {
        params.push(status);
        where = `WHERE status = $1::notification_campaign_status`;
      }
      params.push(limit);
      const result = await query(
        `SELECT id, name, title, message, channel::text AS channel, target_app::text AS target_app,
                status::text AS status, targeting_type::text AS targeting_type,
                estimated_recipients, sent_recipients, scheduled_at_utc, sent_at,
                created_by, created_at, updated_at
         FROM notification_campaigns ${where}
         ORDER BY created_at DESC LIMIT $${params.length}`,
        params
      );
      return c.json({ success: true, campaigns: result.rows || [] });
    } catch {
      return c.json({ success: true, campaigns: [] });
    }
  });

  app.get('/admin/notifications/campaigns/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const result = await query('SELECT * FROM notification_campaigns WHERE id = $1', [id]);
      if (!result.rows?.length) return c.json({ error: 'Campaign not found' }, 404);
      const targeting = await loadCampaignTargeting(id);
      return c.json({ success: true, campaign: { ...result.rows[0], ...targeting } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Fetch failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.post('/admin/notifications/campaigns', async (c) => {
    try {
      const body = await c.req.json();
      const adminId = getAdminId(c);
      if (body.scheduled_at_utc) {
        return c.json(
          {
            error: 'Scheduled campaigns are disabled. Create as DRAFT and use Send.',
            code: 'CAMPAIGN_SCHEDULE_DISABLED',
          },
          400
        );
      }
      const row = await insert('notification_campaigns', {
        name: body.name,
        title: body.title,
        message: body.message,
        channel: body.channel || 'PUSH',
        target_app: body.target_app || 'CUSTOMER',
        status: body.status === 'SCHEDULED' ? 'DRAFT' : body.status || 'DRAFT',
        image_url: body.image_url || null,
        cta_text: body.cta_text || null,
        deep_link: body.deep_link || null,
        targeting_type: body.targeting_type || 'BROADCAST',
        audience_filters: await buildCampaignAudienceFilters(body),
        timezone: body.timezone || null,
        scheduled_at_utc: null,
        created_by: adminId,
      });
      const campaignId = row[0]?.id;
      if (campaignId) {
        await replaceCampaignTargeting(campaignId, body);
        await recordCampaignEvent(campaignId, 'CREATED', adminId);
      }
      return c.json({ success: true, campaign: row[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Create campaign failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.put('/admin/notifications/campaigns/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();
      const adminId = getAdminId(c);
      if (body.scheduled_at_utc || body.status === 'SCHEDULED') {
        return c.json(
          {
            error: 'Scheduled campaigns are disabled. Use Send for immediate delivery.',
            code: 'CAMPAIGN_SCHEDULE_DISABLED',
          },
          400
        );
      }
      const updated = await update('notification_campaigns', { id }, {
        name: body.name,
        title: body.title,
        message: body.message,
        channel: body.channel,
        target_app: body.target_app,
        image_url: body.image_url,
        cta_text: body.cta_text,
        deep_link: body.deep_link,
        targeting_type: body.targeting_type,
        audience_filters: await buildCampaignAudienceFilters(body),
        timezone: body.timezone,
        updated_at: new Date().toISOString(),
      });
      await replaceCampaignTargeting(id, body);
      await recordCampaignEvent(id, 'UPDATED', adminId);
      return c.json({ success: true, campaign: updated[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Update failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.post('/admin/notifications/campaigns/:id/duplicate', async (c) => {
    try {
      const { id } = c.req.param();
      const adminId = getAdminId(c);
      const src = await query('SELECT * FROM notification_campaigns WHERE id = $1', [id]);
      if (!src.rows?.length) return c.json({ error: 'Campaign not found' }, 404);
      const s = src.rows[0];
      const row = await insert('notification_campaigns', {
        name: `${s.name} (copy)`,
        title: s.title,
        message: s.message,
        channel: s.channel,
        target_app: s.target_app,
        status: 'DRAFT',
        image_url: s.image_url,
        cta_text: s.cta_text,
        deep_link: s.deep_link,
        targeting_type: s.targeting_type,
        audience_filters: s.audience_filters || {},
        timezone: s.timezone,
        created_by: adminId,
      });
      const newId = row[0]?.id;
      if (newId) {
        const targeting = await loadCampaignTargeting(id);
        await replaceCampaignTargeting(newId, targeting);
        await recordCampaignEvent(newId, 'CREATED', adminId, { duplicated_from: id });
      }
      return c.json({ success: true, campaign: row[0] });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Duplicate failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.post('/admin/notifications/campaigns/:id/validate', async (c) => {
    try {
      const { id } = c.req.param();
      const adminId = getAdminId(c);
      const result = await query('SELECT * FROM notification_campaigns WHERE id = $1', [id]);
      if (!result.rows?.length) return c.json({ error: 'Campaign not found' }, 404);
      const campaign = result.rows[0];
      const errors: string[] = [];
      if (!campaign.title || campaign.title.length > 60) errors.push('Title required (max 60 chars)');
      if (!campaign.message || campaign.message.length > 180) errors.push('Message required (max 180 chars)');
      if (campaign.cta_text && campaign.cta_text.length > 20) errors.push('CTA max 20 chars');

      const targeting = await loadCampaignTargeting(id);
      const estimate = await estimateCampaignAudience(
        await campaignAudiencePayload(campaign, targeting)
      );

      const settings = await query(
        `SELECT push_enabled FROM notification_channel_settings WHERE app_type = $1`,
        [campaign.target_app]
      );
      const pushEnabled = settings.rows?.[0]?.push_enabled !== false;
      const warnings = [...estimate.warnings];
      if (!pushEnabled && campaign.channel === 'PUSH') {
        warnings.push(`${campaign.target_app} push notifications are currently disabled.`);
      }

      await recordCampaignEvent(id, 'VALIDATED', adminId, { errors, warnings });

      return c.json({
        success: errors.length === 0,
        valid: errors.length === 0,
        errors,
        warnings,
        estimatedRecipients: estimate.estimatedRecipients,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Validation failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.post('/admin/notifications/campaigns/:id/schedule', async (c) => {
    return c.json(
      {
        success: false,
        error: 'Scheduled campaigns are disabled. Use POST /admin/notifications/campaigns/:id/send.',
        code: 'CAMPAIGN_SCHEDULE_DISABLED',
      },
      410
    );
  });

  app.post('/admin/notifications/campaigns/:id/send', async (c) => {
    if (!isNotificationPipelineEnabled()) {
      return c.json({ success: false, ...campaignPipelineDisabledResult() }, 503);
    }
    try {
      const { id } = c.req.param();
      const adminId = getAdminId(c);
      const result = await query('SELECT * FROM notification_campaigns WHERE id = $1', [id]);
      if (!result.rows?.length) return c.json({ error: 'Campaign not found' }, 404);
      const campaign = result.rows[0];
      if (['SENT', 'CANCELLED'].includes(campaign.status)) {
        return c.json({ error: `Campaign already ${campaign.status}` }, 400);
      }

      const targeting = await loadCampaignTargeting(id);
      const estimate = await estimateCampaignAudience(
        await campaignAudiencePayload(campaign, targeting)
      );

      if (estimate.estimatedRecipients === 0) {
        return c.json({ error: 'No recipients match selected filters', warnings: estimate.warnings }, 400);
      }

      const delivery = await executeCampaignDelivery(campaign, targeting, adminId);

      if (delivery.status === 'FAILED' && delivery.sentRecipients === 0) {
        return c.json({
          error: 'Campaign delivery failed',
          warnings: estimate.warnings,
          ...delivery,
        }, 500);
      }

      return c.json({
        success: true,
        status: delivery.status,
        estimatedRecipients: delivery.estimatedRecipients,
        sentRecipients: delivery.sentRecipients,
        failedRecipients: delivery.failedRecipients,
        pushSuccessCount: delivery.pushSuccessCount,
        pushFailureCount: delivery.pushFailureCount,
        warnings: estimate.warnings,
        errors: delivery.errors,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Send failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.post('/admin/notifications/campaigns/:id/cancel', async (c) => {
    try {
      const { id } = c.req.param();
      const adminId = getAdminId(c);
      await update('notification_campaigns', { id }, {
        status: 'CANCELLED',
        updated_at: new Date().toISOString(),
      });
      await recordCampaignEvent(id, 'CANCELLED', adminId);
      return c.json({ success: true });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Cancel failed';
      return c.json({ error: msg }, 500);
    }
  });

  app.get('/admin/notifications/campaigns/:id/deliveries', async (c) => {
    try {
      const { id } = c.req.param();
      const status = c.req.query('status');
      const cursor = c.req.query('cursor');
      const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
      const params: unknown[] = [id];
      const conditions = ['campaign_id = $1'];
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}::notification_campaign_delivery_status`);
      }
      if (cursor) {
        params.push(cursor);
        conditions.push(`id > $${params.length}::uuid`);
      }
      params.push(limit);
      const result = await query(
        `SELECT id, recipient_id, recipient_type, status::text AS status,
                failure_reason, created_at, processed_at
         FROM notification_campaign_deliveries
         WHERE ${conditions.join(' AND ')}
         ORDER BY id ASC
         LIMIT $${params.length}`,
        params
      );
      const rows = result.rows || [];
      const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
      return c.json({ success: true, deliveries: rows, nextCursor });
    } catch {
      return c.json({ success: true, deliveries: [], nextCursor: null });
    }
  });

  app.get('/admin/notifications/campaigns/:id/analytics', async (c) => {
    try {
      const { id } = c.req.param();
      const result = await query(
        `SELECT status::text AS status, COUNT(*)::int AS count
         FROM notification_campaign_deliveries WHERE campaign_id = $1 GROUP BY status`,
        [id]
      );
      return c.json({
        success: true,
        analytics: { phase: 2, deliveryCounts: result.rows || [] },
      });
    } catch {
      return c.json({ success: true, analytics: { phase: 2, deliveryCounts: [] } });
    }
  });

  /**
   * POST /admin/notifications/campaigns/process-scheduled
   * EventBridge cron: fire campaigns with status SCHEDULED and scheduled_at_utc <= now.
   */
  app.post('/admin/notifications/campaigns/process-scheduled', async (c) => {
    if (!isNotificationCronEnabled()) {
      return c.json(cronPipelineSkippedPayload());
    }
    try {
      const result = await processDueScheduledCampaigns();
      console.log(
        JSON.stringify({ metric: 'notification_campaign_cron', ...result })
      );
      return c.json({ success: true, ...result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Campaign cron failed';
      return c.json({ success: false, error: msg }, 500);
    }
  });
}
