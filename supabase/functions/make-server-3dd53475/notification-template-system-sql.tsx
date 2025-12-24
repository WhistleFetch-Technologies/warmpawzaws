/**
 * ============================================================================
 * NOTIFICATION TEMPLATE SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete SMS/Email/WhatsApp template management
 * 
 * Features:
 * - Template CRUD operations
 * - Variable interpolation
 * - Multi-channel support (SMS, Email, WhatsApp, Push)
 * - Event-based triggering
 * - Preview & testing
 * - Analytics tracking
 * - A/B testing support
 * - Localization support
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - Complete KV to SQL Migration
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getNotificationTemplatesRepository } from "../../lib/repositories/notification-templates.ts";

// Template variable interpolation
function interpolateTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(regex, String(value || ''));
  }
  
  return result;
}

// Validate required variables
function validateVariables(
  templateVariables: Array<{ name: string; required: boolean; defaultValue?: any }>,
  providedVariables: Record<string, any>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const templateVar of templateVariables) {
    if (templateVar.required) {
      const value = providedVariables[templateVar.name];
      if (value === undefined || value === null || value === '') {
        if (templateVar.defaultValue === undefined) {
          missing.push(templateVar.name);
        }
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

// Apply default values
function applyDefaults(
  templateVariables: Array<{ name: string; defaultValue?: any }>,
  providedVariables: Record<string, any>
): Record<string, any> {
  const result = { ...providedVariables };
  
  for (const templateVar of templateVariables) {
    if (result[templateVar.name] === undefined && templateVar.defaultValue !== undefined) {
      result[templateVar.name] = templateVar.defaultValue;
    }
  }
  
  return result;
}

export function notificationTemplateSystem(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const repo = getNotificationTemplatesRepository();

  /**
   * POST /notification-templates
   * Create notification template
   */
  app.post(`${BASE_PATH}/notification-templates`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        templateName,
        templateCode,
        channel,
        eventType,
        subject,
        body: templateBody,
        variables = [],
        metadata,
        settings,
        localization,
        createdBy
      } = body;

      if (!templateName || !templateCode || !channel || !eventType || !templateBody || !createdBy) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Check if template code already exists
      const existing = await repo.getTemplateByTemplateCode(templateCode);
      if (existing) {
        return sendError(c, 'Template code already exists', 400);
      }

      const templateId = `TPL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create template
      const template = await repo.createTemplate({
        template_id: templateId,
        template_name: templateName,
        template_code: templateCode,
        channel: channel,
        event_type: eventType,
        subject: subject,
        body: templateBody,
        variables: variables,
        metadata: metadata || {
          category: 'transactional',
          priority: 'medium',
          tags: []
        },
        settings: settings || {
          enabled: true
        },
        localization: localization,
        created_by: createdBy,
        is_active: true
      });

      console.log(`✅ Notification template created: ${templateId}`);

      // Transform to match original interface
      const templateResponse = {
        templateId: template.template_id,
        templateName: template.template_name,
        templateCode: template.template_code,
        channel: template.channel,
        eventType: template.event_type,
        subject: template.subject,
        body: template.body,
        variables: template.variables,
        metadata: template.metadata,
        settings: template.settings,
        localization: template.localization,
        abTest: template.ab_test,
        analytics: template.analytics,
        createdBy: template.created_by,
        updatedBy: template.updated_by,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      };

      return sendSuccess(c, { template: templateResponse }, 'Template created successfully');

    } catch (error) {
      console.error('❌ Error creating template:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /notification-templates
   * List all templates
   */
  app.get(`${BASE_PATH}/notification-templates`, async (c) => {
    try {
      const channel = c.req.query('channel');
      const eventType = c.req.query('eventType');
      const category = c.req.query('category');

      // ✅ SQL: Get templates with filters
      const templates = await repo.getTemplates({
        channel: channel || undefined,
        eventType: eventType || undefined,
        category: category || undefined
      });

      // Transform to match original interface
      const templatesResponse = templates.map((t: any) => ({
        templateId: t.template_id,
        templateName: t.template_name,
        templateCode: t.template_code,
        channel: t.channel,
        eventType: t.event_type,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        metadata: t.metadata,
        settings: t.settings,
        localization: t.localization,
        abTest: t.ab_test,
        analytics: t.analytics,
        createdBy: t.created_by,
        updatedBy: t.updated_by,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      return sendSuccess(c, {
        count: templatesResponse.length,
        templates: templatesResponse
      });

    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /notification-templates/:templateId
   * Get template by ID
   */
  app.get(`${BASE_PATH}/notification-templates/:templateId`, async (c) => {
    try {
      const { templateId } = c.req.param();

      // ✅ SQL: Get template
      const template = await repo.getTemplateByTemplateId(templateId);
      
      if (!template) {
        return sendError(c, 'Template not found', 404);
      }

      // Transform to match original interface
      const templateResponse = {
        templateId: template.template_id,
        templateName: template.template_name,
        templateCode: template.template_code,
        channel: template.channel,
        eventType: template.event_type,
        subject: template.subject,
        body: template.body,
        variables: template.variables,
        metadata: template.metadata,
        settings: template.settings,
        localization: template.localization,
        abTest: template.ab_test,
        analytics: template.analytics,
        createdBy: template.created_by,
        updatedBy: template.updated_by,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      };

      return sendSuccess(c, { template: templateResponse });

    } catch (error) {
      console.error('❌ Error fetching template:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /notification-templates/:templateId
   * Update template
   */
  app.put(`${BASE_PATH}/notification-templates/:templateId`, async (c) => {
    try {
      const { templateId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Get template
      const template = await repo.getTemplateByTemplateId(templateId);
      
      if (!template) {
        return sendError(c, 'Template not found', 404);
      }

      // ✅ SQL: Update template
      const updatedTemplate = await repo.updateTemplate(templateId, {
        template_name: updates.templateName,
        subject: updates.subject,
        body: updates.body,
        variables: updates.variables,
        metadata: updates.metadata,
        settings: updates.settings,
        localization: updates.localization,
        ab_test: updates.abTest,
        updated_by: updates.updatedBy
      });

      console.log(`✅ Template updated: ${templateId}`);

      // Transform to match original interface
      const templateResponse = {
        templateId: updatedTemplate.template_id,
        templateName: updatedTemplate.template_name,
        templateCode: updatedTemplate.template_code,
        channel: updatedTemplate.channel,
        eventType: updatedTemplate.event_type,
        subject: updatedTemplate.subject,
        body: updatedTemplate.body,
        variables: updatedTemplate.variables,
        metadata: updatedTemplate.metadata,
        settings: updatedTemplate.settings,
        localization: updatedTemplate.localization,
        abTest: updatedTemplate.ab_test,
        analytics: updatedTemplate.analytics,
        createdBy: updatedTemplate.created_by,
        updatedBy: updatedTemplate.updated_by,
        isActive: updatedTemplate.is_active,
        createdAt: updatedTemplate.created_at,
        updatedAt: updatedTemplate.updated_at
      };

      return sendSuccess(c, { template: templateResponse }, 'Template updated successfully');

    } catch (error) {
      console.error('❌ Error updating template:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /notification-templates/:templateId/toggle
   * Toggle template active status
   */
  app.post(`${BASE_PATH}/notification-templates/:templateId/toggle`, async (c) => {
    try {
      const { templateId } = c.req.param();

      // ✅ SQL: Get template
      const template = await repo.getTemplateByTemplateId(templateId);
      
      if (!template) {
        return sendError(c, 'Template not found', 404);
      }

      // ✅ SQL: Toggle active status
      const updatedTemplate = await repo.updateTemplate(templateId, {
        is_active: !template.is_active
      });

      console.log(`✅ Template ${templateId} ${updatedTemplate.is_active ? 'activated' : 'deactivated'}`);

      return sendSuccess(c, { 
        templateId,
        isActive: updatedTemplate.is_active
      }, `Template ${updatedTemplate.is_active ? 'activated' : 'deactivated'} successfully`);

    } catch (error) {
      console.error('❌ Error toggling template:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /notification-templates/:templateId/preview
   * Preview template with variables
   */
  app.post(`${BASE_PATH}/notification-templates/:templateId/preview`, async (c) => {
    try {
      const { templateId } = c.req.param();
      const { variables = {}, locale } = await c.req.json();

      // ✅ SQL: Get template
      const template = await repo.getTemplateByTemplateId(templateId);
      
      if (!template) {
        return sendError(c, 'Template not found', 404);
      }

      // Get localized content if available
      let subject = template.subject;
      let body = template.body;

      if (locale && template.localization && template.localization[locale]) {
        subject = template.localization[locale].subject || subject;
        body = template.localization[locale].body;
      }

      // Apply defaults
      const varsWithDefaults = applyDefaults(template.variables, variables);

      // Interpolate
      const renderedSubject = subject ? interpolateTemplate(subject, varsWithDefaults) : undefined;
      const renderedBody = interpolateTemplate(body || '', varsWithDefaults);

      return sendSuccess(c, {
        preview: {
          subject: renderedSubject,
          body: renderedBody
        },
        variables: varsWithDefaults
      });

    } catch (error) {
      console.error('❌ Error previewing template:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /notifications/send
   * Send notification using template
   */
  app.post(`${BASE_PATH}/notifications/send`, async (c) => {
    try {
      const body = await c.req.json();
      const { templateCode, recipient, variables = {}, locale, metadata } = body;

      if (!templateCode || !recipient) {
        return sendError(c, 'Missing templateCode or recipient', 400);
      }

      // ✅ SQL: Get template by code
      const template = await repo.getTemplateByTemplateCode(templateCode);
      
      if (!template || !template.is_active) {
        return sendError(c, 'Template not found or inactive', 404);
      }

      // Validate variables
      const validation = validateVariables(template.variables, variables);
      if (!validation.valid) {
        return sendError(c, `Missing required variables: ${validation.missing.join(', ')}`, 400);
      }

      // Apply defaults
      const varsWithDefaults = applyDefaults(template.variables, variables);

      // Get localized content
      let subject = template.subject;
      let templateBody = template.body;

      if (locale && template.localization && template.localization[locale]) {
        subject = template.localization[locale].subject || subject;
        templateBody = template.localization[locale].body;
      }

      // Interpolate
      const renderedSubject = subject ? interpolateTemplate(subject || '', varsWithDefaults) : undefined;
      const renderedBody = interpolateTemplate(templateBody || '', varsWithDefaults);

      const logId = `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // ✅ SQL: Create log
      const log = await repo.createLog({
        log_id: logId,
        template_id: template.template_id,
        template_code: templateCode,
        channel: template.channel,
        recipient: recipient,
        variables: varsWithDefaults,
        rendered_content: {
          subject: renderedSubject,
          body: renderedBody
        },
        status: 'pending',
        metadata: metadata
      });

      // ✅ SQL: Update template analytics
      const analytics = template.analytics || {};
      analytics.totalSent = (analytics.totalSent || 0) + 1;
      analytics.lastSentAt = new Date().toISOString();

      await repo.updateTemplate(template.template_id, {
        analytics: analytics,
        last_sent_at: new Date().toISOString()
      });

      // In production, integrate with actual SMS/Email providers
      // For now, mark as sent
      const updatedLog = await repo.updateLog(logId, {
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      console.log(`✅ Notification sent: ${logId} via ${template.channel}`);

      return sendSuccess(c, {
        logId,
        status: 'sent',
        channel: template.channel,
        preview: {
          subject: renderedSubject,
          body: renderedBody
        }
      }, 'Notification sent successfully');

    } catch (error) {
      console.error('❌ Error sending notification:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /notifications/logs
   * Get notification logs
   */
  app.get(`${BASE_PATH}/notifications/logs`, async (c) => {
    try {
      const templateId = c.req.query('templateId');
      const channel = c.req.query('channel');
      const status = c.req.query('status');
      const userId = c.req.query('userId');

      // ✅ SQL: Get logs with filters
      const logs = await repo.getLogs({
        templateId: templateId || undefined,
        channel: channel || undefined,
        status: status || undefined,
        userId: userId || undefined,
        limit: 100
      });

      // Transform to match original interface
      const logsResponse = logs.map((l: any) => ({
        logId: l.log_id,
        templateId: l.template_id,
        templateCode: l.template_code,
        channel: l.channel,
        recipient: l.recipient,
        variables: l.variables,
        renderedContent: l.rendered_content,
        status: l.status,
        provider: l.provider,
        providerId: l.provider_id,
        errorMessage: l.error_message,
        metadata: l.metadata,
        sentAt: l.sent_at,
        deliveredAt: l.delivered_at,
        openedAt: l.opened_at,
        clickedAt: l.clicked_at,
        createdAt: l.created_at
      }));

      return sendSuccess(c, {
        count: logsResponse.length,
        logs: logsResponse
      });

    } catch (error) {
      console.error('❌ Error fetching logs:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /notification-templates/analytics/:templateId
   * Get template analytics
   */
  app.get(`${BASE_PATH}/notification-templates/analytics/:templateId`, async (c) => {
    try {
      const { templateId } = c.req.param();

      // ✅ SQL: Get template
      const template = await repo.getTemplateByTemplateId(templateId);
      
      if (!template) {
        return sendError(c, 'Template not found', 404);
      }

      // ✅ SQL: Get logs for template
      const templateLogs = await repo.getLogs({
        templateId: templateId,
        limit: 10000 // Get all logs for analytics
      });

      const analytics = {
        ...template.analytics,
        breakdown: {
          pending: templateLogs.filter((l: any) => l.status === 'pending').length,
          sent: templateLogs.filter((l: any) => l.status === 'sent').length,
          delivered: templateLogs.filter((l: any) => l.status === 'delivered').length,
          failed: templateLogs.filter((l: any) => l.status === 'failed').length,
          opened: templateLogs.filter((l: any) => l.status === 'opened').length,
          clicked: templateLogs.filter((l: any) => l.status === 'clicked').length
        },
        rates: {
          deliveryRate: template.analytics.totalSent > 0 
            ? ((template.analytics.totalDelivered / template.analytics.totalSent) * 100).toFixed(2)
            : 0,
          openRate: template.analytics.totalDelivered > 0
            ? ((template.analytics.totalOpened / template.analytics.totalDelivered) * 100).toFixed(2)
            : 0,
          clickRate: template.analytics.totalOpened > 0
            ? ((template.analytics.totalClicked / template.analytics.totalOpened) * 100).toFixed(2)
            : 0
        }
      };

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Notification Template System Endpoints (SQL) registered');
}

