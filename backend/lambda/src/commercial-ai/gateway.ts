/**
 * Commercial AI Gateway — read-only orchestration beside commercial engines.
 * Does not modify promotions, policy, campaigns, settlement, or resolver logic.
 */
import { createHash, randomUUID } from 'crypto';
import { invokeBedrock, BEDROCK_GUARDRAIL_BLOCKED } from '../utils/bedrock-client';
import { withRetry } from '../utils/error-recovery';
import { parseChatBedrockCompletion } from '../utils/ai/ai-chatbot-response-parse';
import { query } from '../database/rds-connection';
import { routeCommercialIntent } from './intent-router';
import { resolveCommercialContext, formatContextForPrompt } from './context';
import { buildCommercialRagContext } from './rag';
import { knowledgeGraphSummary } from './knowledge-graph';
import { COMMERCIAL_REFUSAL_MESSAGE } from './scope';
import { suggestedQuestionsForModule } from './suggested-questions';
import {
  COMMERCIAL_COPILOT_TOOL_PASS1_SYSTEM,
  MAX_COMMERCIAL_PLANNER_ROUNDS,
  commercialCopilotMayTriggerInvestigation,
  filterCommercialCopilotToolRequestsByPermissions,
  formatCommercialCopilotToolResultsForPrompt,
  parseCommercialCopilotToolRequestsFromCompletion,
} from './tools-core';
import {
  executeCommercialCopilotToolRequests,
  enrichToolRequestsFromContext,
} from './tools';
import {
  resolveResponseSource,
  sourceBadgeLabel,
  validateCommercialResponse,
} from './response-validate';
import type {
  CommercialAiChatRequest,
  CommercialAiChatResponse,
  CommercialAiContextPacket,
} from './types';

export async function isCommercialAiCopilotEnabled(): Promise<boolean> {
  if (String(process.env.COMMERCIAL_AI_COPILOT_ENABLED || '').toLowerCase() === 'false') {
    return false;
  }
  try {
    const r = await query(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'admin:settings:commercial_ai_copilot' LIMIT 1`
    );
    const raw = r.rows?.[0]?.setting_value as unknown;
    if (raw == null) return true;
    const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (j && typeof j === 'object' && (j as { enabled?: boolean }).enabled === false) {
      return false;
    }
  } catch {
    /* default on when env allows */
  }
  return true;
}

function buildExplainSystemPrompt(ctx: CommercialAiContextPacket, rag: string): string {
  return `You are the **Warmpawz Commercial Copilot** (admin, read-only).

SCOPE: Promotions, coupons, policy center, campaigns, funding, settlement, commission, analytics, finance, notifications, discount resolver, SERVICE and ECOMMERCE domains only.

RULES:
- Explain using COMMERCIAL_GLOSSARY and doc excerpts. Do not invent metrics.
- You cannot create, publish, pause, delete, or modify any commercial record.
- Never expose secrets, customer PII, or draft policy internals.
- If unsure, say so briefly.

COMMERCIAL_CONTEXT:
${formatContextForPrompt(ctx)}

KNOWLEDGE_GRAPH:
${knowledgeGraphSummary(ctx.module)}

${rag}

End responses with a brief note that this answer is based on **Documentation**.`;
}

function buildInvestigateSystemPrompt(
  ctx: CommercialAiContextPacket,
  rag: string,
  toolAppendix: string
): string {
  return `You are the **Warmpawz Commercial Copilot** (admin, read-only investigation).

Use TOOL_RESULTS_JSON as authoritative live runtime facts. Do not invent numbers or statuses.
If TOOL_RESULTS_JSON is empty, say: "Investigation requires additional runtime information."

COMMERCIAL_CONTEXT:
${formatContextForPrompt(ctx)}

${rag}

${toolAppendix || ''}

End responses with a brief note that this answer uses **Live Data** when tools ran, otherwise state data was unavailable.`;
}

async function fetchInvestigationTools(
  message: string,
  ctx: CommercialAiContextPacket,
  permissions: string[]
): Promise<{ appendix: string; toolNames: string[] }> {
  if (!commercialCopilotMayTriggerInvestigation(message) && !ctx.entity?.id) {
    return { appendix: '', toolNames: [] };
  }

  const usedTools: string[] = [];
  let accumulated: Record<string, unknown> = {};

  for (let round = 0; round < MAX_COMMERCIAL_PLANNER_ROUNDS; round++) {
    const plannerMessage = `${message}\n\nCOMMERCIAL_CONTEXT:\n${formatContextForPrompt(ctx)}\n\nACCUMULATED_TOOL_RESULTS_JSON:\n${JSON.stringify(accumulated)}`;

    let passRaw = '';
    try {
      passRaw = await withRetry(
        () =>
          invokeBedrock(plannerMessage, COMMERCIAL_COPILOT_TOOL_PASS1_SYSTEM, {
            maxTokens: 400,
            temperature: 0,
            topP: 0.9,
          }),
        { maxAttempts: 2, initialDelayMs: 400, retryableErrors: ['Bedrock invocation failed'] }
      );
    } catch {
      break;
    }

    let parsed = parseCommercialCopilotToolRequestsFromCompletion(passRaw);
    parsed = enrichToolRequestsFromContext(parsed, ctx.entity);
    const allowed = filterCommercialCopilotToolRequestsByPermissions(parsed, permissions);
    if (!allowed.length) break;

    for (const t of allowed) {
      if (!usedTools.includes(t.name)) usedTools.push(t.name);
    }
    accumulated = { ...accumulated, ...(await executeCommercialCopilotToolRequests(allowed)) };
  }

  if (!Object.keys(accumulated).length && ctx.entity?.id) {
    const fallback = enrichToolRequestsFromContext([], ctx.entity);
    const allowed = filterCommercialCopilotToolRequestsByPermissions(fallback, permissions);
    for (const t of allowed) {
      if (!usedTools.includes(t.name)) usedTools.push(t.name);
    }
    accumulated = await executeCommercialCopilotToolRequests(allowed);
  }

  return {
    appendix: formatCommercialCopilotToolResultsForPrompt(accumulated),
    toolNames: usedTools,
  };
}

export async function runCommercialAiChat(input: {
  message: string;
  conversationId?: string;
  context?: Partial<CommercialAiContextPacket>;
  permissions: string[];
}): Promise<Omit<CommercialAiChatResponse, 'requestId'> & { promptHash: string; auditOutcome: string }> {
  const message = input.message.trim();
  const ctx = resolveCommercialContext(input.context?.route || '/', input.context);
  const conversationId = input.conversationId || `commercial_conv_${Date.now()}`;
  const promptHash = createHash('sha256').update(message).digest('hex').slice(0, 32);
  const intent = routeCommercialIntent(message, ctx);

  const suggestions = suggestedQuestionsForModule(ctx.module, ctx.entity?.name);

  if (intent === 'refuse') {
    return {
      success: true,
      conversationId,
      response: COMMERCIAL_REFUSAL_MESSAGE,
      intent: 'refuse',
      source: 'documentation',
      suggestedQuestions: suggestions,
      toolNames: [],
      usedBedrock: false,
      promptHash,
      auditOutcome: 'refused',
    };
  }

  const rag = buildCommercialRagContext(message, ctx);
  let toolNames: string[] = [];
  let toolAppendix = '';

  if (intent === 'investigate') {
    const inv = await fetchInvestigationTools(message, ctx, input.permissions);
    toolAppendix = inv.appendix;
    toolNames = inv.toolNames;
  }

  const systemPrompt =
    intent === 'investigate'
      ? buildInvestigateSystemPrompt(ctx, rag, toolAppendix)
      : buildExplainSystemPrompt(ctx, rag);

  let responseText = '';
  let usedBedrock = false;

  try {
    const completion = await withRetry(
      () =>
        invokeBedrock(message, systemPrompt, {
          maxTokens: 1024,
          temperature: intent === 'explain' ? 0.25 : 0.2,
          topP: 0.9,
        }),
      {
        maxAttempts: 3,
        initialDelayMs: 800,
        retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
      }
    );
    usedBedrock = true;
    const parsed = parseChatBedrockCompletion(completion);
    responseText = parsed.responseText || completion.slice(0, 12000);
  } catch (err: unknown) {
    if ((err as Error)?.message === BEDROCK_GUARDRAIL_BLOCKED) {
      return {
        success: true,
        conversationId,
        response:
          'That request could not be completed due to safety filters. Try rephrasing with a commercial topic.',
        intent,
        source: 'documentation',
        suggestedQuestions: suggestions,
        toolNames,
        usedBedrock: true,
        promptHash,
        auditOutcome: 'guardrail',
      };
    }
    responseText = 'The Commercial Copilot is temporarily unavailable. Please try again later.';
  }

  const hasToolResults = Boolean(toolAppendix);
  const validated = validateCommercialResponse(responseText, {
    hasToolResults,
    intent,
  });
  const source = resolveResponseSource(intent, hasToolResults, Boolean(rag));
  const badge = sourceBadgeLabel(source);
  if (!validated.text.includes(badge)) {
    validated.text += `\n\n— _Source: ${badge}_`;
  }

  return {
    success: true,
    conversationId,
    response: validated.text,
    intent,
    source,
    suggestedQuestions: suggestions,
    toolNames,
    usedBedrock,
    promptHash,
    auditOutcome: intent,
  };
}

export { sourceBadgeLabel };
