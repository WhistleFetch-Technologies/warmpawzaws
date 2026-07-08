/**
 * Commercial AI Copilot HTTP endpoints — Admin only (Phase A1).
 */
import type { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { hasAdminPermission } from '../../../utils/admin-rbac-permissions';
import { resolveAdminPermissionsFromRequest } from '../admin-resolve-permissions-from-request';
import { logErrorSafe } from '../../../utils/redact-for-log';
import { isCommercialAiCopilotEnabled, runCommercialAiChat } from '../../../commercial-ai/gateway';
import { appendCommercialAiAudit } from '../../../commercial-ai/audit';
import { COMMERCIAL_GLOSSARY } from '../../../commercial-ai/glossary';
import { suggestedQuestionsForModule } from '../../../commercial-ai/suggested-questions';
import type { CommercialAiContextPacket, CommercialAiModule } from '../../../commercial-ai/types';

export function registerCommercialAiCopilotEndpoints(app: Hono): void {
  app.get('/admin/commercial-ai-copilot/health', async (c) => {
    const enabled = await isCommercialAiCopilotEnabled().catch(() => false);
    return c.json({
      ok: true,
      commercialCopilotEnabled: enabled,
      vendorAiEnabled: false,
      sellerAiEnabled: false,
    });
  });

  app.get('/admin/commercial-ai-copilot/glossary', (c) => {
    const module = c.req.query('module');
    if (module) {
      const entries = COMMERCIAL_GLOSSARY.filter((e) => e.modules.includes(module));
      return c.json({ success: true, entries });
    }
    return c.json({ success: true, entries: COMMERCIAL_GLOSSARY });
  });

  app.get('/admin/commercial-ai-copilot/suggestions', (c) => {
    const module = (c.req.query('module') || 'other') as CommercialAiModule;
    const entityName = c.req.query('entityName') || undefined;
    return c.json({
      success: true,
      suggestions: suggestedQuestionsForModule(module, entityName),
    });
  });

  app.post('/admin/commercial-ai-copilot/chat', async (c) => {
    const started = Date.now();
    const requestId = randomUUID();
    const principal = String((c as { get: (key: string) => unknown }).get('userId') || 'unknown');
    const authHeader = c.req.header('authorization') || c.req.header('Authorization') || undefined;

    try {
      const enabled = await isCommercialAiCopilotEnabled();
      if (!enabled) {
        await appendCommercialAiAudit({
          adminPrincipalId: principal,
          route: 'POST /admin/commercial-ai-copilot/chat',
          toolNames: [],
          requestId,
          latencyMs: Date.now() - started,
          outcome: 'disabled',
          intent: 'refuse',
          source: 'documentation',
          promptHash: '',
          messageLen: 0,
        });
        return c.json(
          {
            success: false,
            error: 'Commercial AI Copilot is disabled',
            code: 'COMMERCIAL_COPILOT_DISABLED',
          },
          503
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) return c.json({ error: 'message is required' }, 400);

      const permissions = await resolveAdminPermissionsFromRequest(principal, authHeader);
      if (!hasAdminPermission(permissions, 'admin.ai_copilot')) {
        return c.json(
          { success: false, error: 'admin.ai_copilot permission required', code: 'FORBIDDEN' },
          403
        );
      }

      const context = (body.context ?? {}) as Partial<CommercialAiContextPacket>;
      if (typeof body.pathname === 'string' && !context.route) {
        context.route = body.pathname;
      }

      const result = await runCommercialAiChat({
        message,
        conversationId: body.conversationId,
        context,
        permissions,
      });

      await appendCommercialAiAudit({
        adminPrincipalId: principal,
        route: 'POST /admin/commercial-ai-copilot/chat',
        surface: context.surface,
        module: context.module,
        entityType: context.entity?.type,
        entityId: context.entity?.id,
        toolNames: result.toolNames,
        requestId,
        latencyMs: Date.now() - started,
        outcome: result.auditOutcome as 'explain' | 'investigate' | 'refused' | 'guardrail',
        intent: result.intent,
        source: result.source,
        promptHash: result.promptHash,
        messageLen: message.length,
      });

      return c.json({
        success: result.success,
        conversationId: result.conversationId,
        response: result.response,
        intent: result.intent,
        source: result.source,
        suggestedQuestions: result.suggestedQuestions,
        toolNames: result.toolNames,
        usedBedrock: result.usedBedrock,
        requestId,
      });
    } catch (error: unknown) {
      logErrorSafe('commercial-ai-copilot-chat', error);
      await appendCommercialAiAudit({
        adminPrincipalId: principal,
        route: 'POST /admin/commercial-ai-copilot/chat',
        toolNames: [],
        requestId,
        latencyMs: Date.now() - started,
        outcome: 'error',
        intent: 'refuse',
        source: 'documentation',
        promptHash: '',
        messageLen: 0,
      });
      return c.json({ success: false, error: 'Failed to process commercial chat' }, 500);
    }
  });
}
