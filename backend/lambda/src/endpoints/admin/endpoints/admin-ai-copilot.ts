/**
 * Admin AI copilot — reactive chat + allowlisted tools + RAG snippets + audit.
 *
 * Phase 3: expand tools with explicit permission maps; add CloudWatch counters;
 * optional PII regex strip on tool JSON before the main Bedrock turn.
 */
import { Hono } from 'hono';
import { createHash, randomUUID } from 'crypto';
import { invokeBedrock, BEDROCK_GUARDRAIL_BLOCKED } from '../../../utils/bedrock-client';
import { withRetry } from '../../../utils/error-recovery';
import { parseChatBedrockCompletion } from '../../../utils/ai/ai-chatbot-response-parse';
import { query, insert } from '../../../database/rds-connection';
import { hasAdminPermission } from '../../../utils/admin-rbac-permissions';
import { resolveAdminPermissionsFromRequest } from '../admin-resolve-permissions-from-request';
import { logErrorSafe } from '../../../utils/redact-for-log';
import {
  ADMIN_COPILOT_TOOL_PASS1_SYSTEM,
  MAX_ADMIN_COPILOT_PLANNER_ROUNDS,
  adminCopilotMayTriggerDataAgent,
  filterAdminCopilotToolRequestsByPermissions,
  formatAdminCopilotToolResultsForPrompt,
  parseAdminCopilotToolRequestsFromCompletion,
} from '../../../utils/ai/admin-ai-copilot-tools-core';
import { executeAdminCopilotToolRequests } from '../../../utils/ai/admin-ai-copilot-tools';
import { buildAdminCopilotRagContext } from '../../../utils/ai/admin-copilot-rag';

async function isAdminAiCopilotKillSwitchOff(): Promise<boolean> {
  if (String(process.env.ADMIN_AI_COPILOT_ENABLED || '').toLowerCase() === 'false') {
    return false;
  }
  try {
    const r = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:ai_copilot' LIMIT 1`
    );
    const raw = r.rows?.[0]?.setting_value as unknown;
    if (raw == null) return true;
    const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (j && typeof j === 'object' && (j as { enabled?: boolean }).enabled === false) {
      return false;
    }
  } catch {
    /* default on */
  }
  return true;
}

async function appendAdminAiAudit(row: {
  adminPrincipalId: string;
  route: string;
  toolNames: string[];
  requestId: string;
  latencyMs: number;
  outcome: string;
  promptHash: string;
  messageLen: number;
}): Promise<void> {
  try {
    await insert('admin_ai_audit', {
      id: randomUUID(),
      admin_principal_id: row.adminPrincipalId,
      route: row.route,
      tool_names: row.toolNames.length ? JSON.stringify(row.toolNames) : null,
      request_id: row.requestId,
      created_at: new Date().toISOString(),
      latency_ms: row.latencyMs,
      outcome: row.outcome,
      prompt_hash: row.promptHash,
      message_len: row.messageLen,
    });
  } catch (e) {
    logErrorSafe('admin-ai-copilot-audit', e);
  }
}

async function fetchAdminCopilotToolAppendixForPrompt(
  userMessage: string,
  permissions: string[]
): Promise<{ appendix: string; toolNames: string[] }> {
  if (!adminCopilotMayTriggerDataAgent(userMessage)) {
    return { appendix: '', toolNames: [] };
  }

  const usedTools: string[] = [];
  let accumulated: Record<string, unknown> = {};

  for (let round = 0; round < MAX_ADMIN_COPILOT_PLANNER_ROUNDS; round++) {
    const plannerUserMessage =
      round === 0
        ? userMessage
        : `${userMessage}\n\nACCUMULATED_TOOL_RESULTS_JSON:\n${JSON.stringify(accumulated)}`;

    let passRaw = '';
    try {
      passRaw = await withRetry(
        () =>
          invokeBedrock(plannerUserMessage, ADMIN_COPILOT_TOOL_PASS1_SYSTEM, {
            maxTokens: 320,
            temperature: 0,
            topP: 0.9,
          }),
        {
          maxAttempts: 2,
          initialDelayMs: 400,
          retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
        }
      );
    } catch {
      break;
    }

    const parsed = parseAdminCopilotToolRequestsFromCompletion(passRaw);
    const allowed = filterAdminCopilotToolRequestsByPermissions(parsed, permissions);
    if (allowed.length === 0) break;

    for (const t of allowed) {
      if (!usedTools.includes(t.name)) usedTools.push(t.name);
    }

    const batch = await executeAdminCopilotToolRequests(allowed);
    accumulated = { ...accumulated, ...batch };
  }

  const appendix = formatAdminCopilotToolResultsForPrompt(accumulated);
  return { appendix, toolNames: usedTools };
}

export function registerAdminAiCopilotEndpoints(app: Hono) {
  app.get('/admin/ai-copilot/health', async (c) => {
    const enabled = await isAdminAiCopilotKillSwitchOff().catch(() => true);
    return c.json({ ok: true, copilotEnabled: enabled });
  });

  app.post('/admin/ai-copilot/chat', async (c) => {
    const started = Date.now();
    const requestId = randomUUID();
    const principal = String((c as { get: (key: string) => unknown }).get('userId') || 'unknown');
    const authHeader = c.req.header('authorization') || c.req.header('Authorization') || undefined;

    const failAudit = async (outcome: string, messageLen = 0, promptHash = '') => {
      await appendAdminAiAudit({
        adminPrincipalId: principal,
        route: 'POST /admin/ai-copilot/chat',
        toolNames: [],
        requestId,
        latencyMs: Date.now() - started,
        outcome,
        promptHash,
        messageLen,
      });
    };

    try {
      const enabled = await isAdminAiCopilotKillSwitchOff();
      if (!enabled) {
        await failAudit('disabled', 0, '');
        return c.json(
          { success: false, error: 'Admin AI copilot is disabled', code: 'COPILOT_DISABLED' },
          503
        );
      }

      const body = await c.req.json().catch(() => ({}));
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      const pathname = typeof body.pathname === 'string' ? body.pathname.trim() : '';
      const conversationId =
        typeof body.conversationId === 'string' ? body.conversationId.trim() : `admin_conv_${Date.now()}`;

      if (!message) {
        await failAudit('validation_error', 0, '');
        return c.json({ error: 'message is required' }, 400);
      }

      const promptHash = createHash('sha256').update(message).digest('hex').slice(0, 32);

      const permissions = await resolveAdminPermissionsFromRequest(principal, authHeader);
      if (!hasAdminPermission(permissions, 'admin.ai_copilot')) {
        await failAudit('forbidden', message.length, promptHash);
        return c.json({ success: false, error: 'admin.ai_copilot permission required', code: 'FORBIDDEN' }, 403);
      }

      const { appendix, toolNames } = await fetchAdminCopilotToolAppendixForPrompt(message, permissions);
      const ragBlock = buildAdminCopilotRagContext(pathname || undefined, message);

      const systemPrompt = `You are the **Warmpawz admin portal** copilot. The signed-in admin is authenticated; you help with navigation, processes, and read-only data shown in TOOL_RESULTS_JSON or excerpts.

RULES:
- Never print AWS access keys, secrets, connection strings, or full raw platform JSON with credentials.
- Prefer facts from TOOL_RESULTS_JSON when present. INTERNAL_HELP_EXCERPTS are secondary.
- You may suggest where in the admin UI to go (paths like /vendors). You cannot perform writes.
- Output JSON when possible with keys: response, intent, confidence, suggestedActions, requiresAgent. Use intent one of: general, support, knowledge, admin_vendors, admin_platform_settings, admin_roles, admin_governance.

Current page path (if provided): ${pathname || '(unknown)'}

${ragBlock}

${appendix ? `${appendix}\n` : ''}`;

      let responseText = '';
      let intent = 'general';
      let confidence = 0.75;
      let suggestedActions: string[] = [];
      let requiresAgent = false;
      let usedBedrock = false;
      let guardrailBlocked = false;

      try {
        const completion = await withRetry(
          () =>
            invokeBedrock(message, systemPrompt, {
              maxTokens: 1024,
              temperature: 0.35,
              topP: 0.9,
            }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );
        usedBedrock = true;
        const parsed = parseChatBedrockCompletion(completion);
        responseText = parsed.responseText || completion.slice(0, 12000);
        intent = parsed.intent;
        confidence = parsed.confidence;
        suggestedActions = parsed.suggestedActions;
        requiresAgent = parsed.requiresAgent;
      } catch (err: unknown) {
        if ((err as Error)?.message === BEDROCK_GUARDRAIL_BLOCKED) {
          guardrailBlocked = true;
          usedBedrock = true;
          responseText =
            'That request could not be completed due to safety filters. Try rephrasing, or use the relevant admin screen directly.';
        } else {
          logErrorSafe('admin-ai-copilot-bedrock', err);
          responseText = 'The assistant is temporarily unavailable. Please try again later.';
        }
      }

      if (guardrailBlocked) {
        await appendAdminAiAudit({
          adminPrincipalId: principal,
          route: 'POST /admin/ai-copilot/chat',
          toolNames: toolNames,
          requestId,
          latencyMs: Date.now() - started,
          outcome: 'guardrail',
          promptHash,
          messageLen: message.length,
        });
      } else {
        await appendAdminAiAudit({
          adminPrincipalId: principal,
          route: 'POST /admin/ai-copilot/chat',
          toolNames: toolNames,
          requestId,
          latencyMs: Date.now() - started,
          outcome: usedBedrock ? 'ok' : 'degraded',
          promptHash,
          messageLen: message.length,
        });
      }

      return c.json({
        success: true,
        conversationId,
        response: responseText,
        intent,
        confidence,
        suggestedActions,
        requiresAgent,
        usedBedrock,
        requestId,
      });
    } catch (error: unknown) {
      logErrorSafe('admin-ai-copilot-chat', error);
      await failAudit('error', 0, '');
      return c.json({ success: false, error: 'Failed to process chat' }, 500);
    }
  });
}
