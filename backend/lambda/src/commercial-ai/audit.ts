import { randomUUID } from 'crypto';
import { insert } from '../database/rds-connection';
import { logErrorSafe } from '../utils/redact-for-log';
import type { CommercialAiIntent, CommercialAiSource } from './types';

export async function appendCommercialAiAudit(row: {
  adminPrincipalId: string;
  route: string;
  surface?: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  toolNames: string[];
  requestId: string;
  latencyMs: number;
  outcome: 'explain' | 'investigate' | 'refused' | 'error' | 'guardrail' | 'disabled';
  intent: CommercialAiIntent;
  source: CommercialAiSource;
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
      outcome: `${row.outcome}:${row.intent}:${row.source}`,
      prompt_hash: row.promptHash,
      message_len: row.messageLen,
    });
  } catch (e) {
    logErrorSafe('commercial-ai-audit', e);
  }
}
