/**
 * Round-robin support ticket auto-assignment (specialty pools + capacity limits).
 */

import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../database/rds-connection';
import {
  recordSupportTicketActivity,
  SUPPORT_TICKET_EVENT_TYPES,
} from './support-ticket-activity';
import { deriveRoutingPoolKey, type RoutingPoolKey } from './support-ticket-routing-pool';

export type { RoutingPoolKey };

export type SupportRoutingSettings = {
  autoAssignEnabled: boolean;
  assignAfterAiAck: boolean;
  sweeperBatchSize: number;
  fallbackToGeneralSpecialty: boolean;
};

export type AssignTicketResult = {
  assigned: boolean;
  reason?: 'disabled' | 'already_assigned' | 'not_assignable' | 'no_eligible_agent' | 'ticket_not_found';
  assigneeId?: string;
  assigneeName?: string;
  poolKey?: RoutingPoolKey;
  workloadAfter?: number;
};

const DEFAULT_ROUTING_SETTINGS: SupportRoutingSettings = {
  autoAssignEnabled: true,
  assignAfterAiAck: true,
  sweeperBatchSize: 25,
  fallbackToGeneralSpecialty: true,
};

const ASSIGNABLE_STATUSES = new Set([
  'open',
  'ai_acknowledged',
  'awaiting_assignment',
]);

let routingSettingsTableExists: boolean | null = null;
let lastAssignedColumnExists: boolean | null = null;

async function ensureRoutingSettingsTable(): Promise<boolean> {
  if (routingSettingsTableExists !== null) return routingSettingsTableExists;
  try {
    const r = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'support_routing_settings'
       ) AS exists`
    );
    routingSettingsTableExists = r.rows?.[0]?.exists === true;
  } catch {
    routingSettingsTableExists = false;
  }
  return routingSettingsTableExists;
}

async function ensureLastAssignedColumn(): Promise<boolean> {
  if (lastAssignedColumnExists !== null) return lastAssignedColumnExists;
  try {
    const r = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'support_agents'
           AND column_name = 'last_assigned_at'
       ) AS exists`
    );
    lastAssignedColumnExists = r.rows?.[0]?.exists === true;
  } catch {
    lastAssignedColumnExists = false;
  }
  return lastAssignedColumnExists;
}

export async function getSupportRoutingSettings(): Promise<SupportRoutingSettings & {
  lastSweeperRunAt?: string | null;
  lastSweeperAssignedCount?: number;
}> {
  const hasTable = await ensureRoutingSettingsTable();
  if (!hasTable) {
    return { ...DEFAULT_ROUTING_SETTINGS, lastSweeperRunAt: null, lastSweeperAssignedCount: 0 };
  }

  try {
    const r = await query(
      `SELECT auto_assign_enabled, assign_after_ai_ack, sweeper_batch_size,
              fallback_to_general_specialty, last_sweeper_run_at, last_sweeper_assigned_count
       FROM support_routing_settings
       WHERE id = 'default'
       LIMIT 1`
    );
    const row = r.rows?.[0];
    if (!row) {
      return { ...DEFAULT_ROUTING_SETTINGS, lastSweeperRunAt: null, lastSweeperAssignedCount: 0 };
    }
    return {
      autoAssignEnabled: row.auto_assign_enabled !== false,
      assignAfterAiAck: row.assign_after_ai_ack !== false,
      sweeperBatchSize: Number(row.sweeper_batch_size) || 25,
      fallbackToGeneralSpecialty: row.fallback_to_general_specialty !== false,
      lastSweeperRunAt: row.last_sweeper_run_at ? String(row.last_sweeper_run_at) : null,
      lastSweeperAssignedCount: Number(row.last_sweeper_assigned_count) || 0,
    };
  } catch (err) {
    console.warn('[support-auto-assign] failed to load routing settings:', err);
    return { ...DEFAULT_ROUTING_SETTINGS, lastSweeperRunAt: null, lastSweeperAssignedCount: 0 };
  }
}

export async function updateSupportRoutingSettings(
  patch: Partial<SupportRoutingSettings>
): Promise<SupportRoutingSettings & { lastSweeperRunAt?: string | null; lastSweeperAssignedCount?: number }> {
  const hasTable = await ensureRoutingSettingsTable();
  if (!hasTable) {
    throw new Error('support_routing_settings table is not available (run migration 1035)');
  }

  const current = await getSupportRoutingSettings();
  const next: SupportRoutingSettings = {
    autoAssignEnabled: patch.autoAssignEnabled ?? current.autoAssignEnabled,
    assignAfterAiAck: patch.assignAfterAiAck ?? current.assignAfterAiAck,
    sweeperBatchSize: patch.sweeperBatchSize ?? current.sweeperBatchSize,
    fallbackToGeneralSpecialty:
      patch.fallbackToGeneralSpecialty ?? current.fallbackToGeneralSpecialty,
  };

  await query(
    `INSERT INTO support_routing_settings (
       id, auto_assign_enabled, assign_after_ai_ack, sweeper_batch_size,
       fallback_to_general_specialty, updated_at
     ) VALUES ('default', $1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       auto_assign_enabled = EXCLUDED.auto_assign_enabled,
       assign_after_ai_ack = EXCLUDED.assign_after_ai_ack,
       sweeper_batch_size = EXCLUDED.sweeper_batch_size,
       fallback_to_general_specialty = EXCLUDED.fallback_to_general_specialty,
       updated_at = NOW()`,
    [
      next.autoAssignEnabled,
      next.assignAfterAiAck,
      Math.min(100, Math.max(1, next.sweeperBatchSize)),
      next.fallbackToGeneralSpecialty,
    ]
  );

  return getSupportRoutingSettings();
}

export { deriveRoutingPoolKey } from './support-ticket-routing-pool';

type AssignTicketOptions = {
  force?: boolean;
  skipSettingsCheck?: boolean;
  settings?: SupportRoutingSettings;
  hasLastAssigned?: boolean;
};

type EligibleAgentRow = {
  support_agent_id: string;
  assignee_id: string;
  name: string;
  workload: number;
  max_concurrent_tickets: number;
};

async function pickEligibleAgent(
  client: PoolClient,
  poolKey: RoutingPoolKey,
  fallbackToGeneral: boolean,
  hasLastAssigned: boolean
): Promise<EligibleAgentRow | null> {
  const orderClause = hasLastAssigned
    ? 'sa.last_assigned_at ASC NULLS FIRST, assignee_id ASC'
    : 'workload ASC, assignee_id ASC';

  const tryPool = async (specialty: string): Promise<EligibleAgentRow | null> => {
    const r = await client.query(
      `SELECT
         sa.id AS support_agent_id,
         COALESCE(sa.user_id, sa.staff_id) AS assignee_id,
         COALESCE(a.name, s.name, 'Agent') AS name,
         COALESCE(sa.max_concurrent_tickets, 10) AS max_concurrent_tickets,
         COALESCE(wc.workload, 0)::int AS workload
       FROM support_agents sa
       LEFT JOIN admins a ON sa.user_id = a.id OR (sa.user_id IS NULL AND sa.staff_id = a.id)
       LEFT JOIN staff s ON sa.staff_id = s.id AND sa.user_id IS NULL
       LEFT JOIN (
         SELECT assigned_to, COUNT(*)::int AS workload
         FROM support_tickets
         WHERE assigned_to IS NOT NULL
           AND status NOT IN ('closed', 'resolved', 'cancelled')
         GROUP BY assigned_to
       ) wc ON wc.assigned_to = COALESCE(sa.user_id, sa.staff_id)
       WHERE sa.is_active = true
         AND COALESCE(sa.user_id, sa.staff_id) IS NOT NULL
         AND (sa.availability_status IS NULL
              OR sa.availability_status IN ('available', 'online'))
         AND sa.specialties @> ARRAY[$1]::text[]
       ORDER BY ${orderClause}`,
      [specialty]
    );

    for (const row of r.rows || []) {
      const workload = Number(row.workload) || 0;
      const max = Number(row.max_concurrent_tickets) || 10;
      if (workload < max) {
        return row as EligibleAgentRow;
      }
    }
    return null;
  };

  let agent = await tryPool(poolKey);
  if (!agent && fallbackToGeneral && poolKey !== 'general') {
    agent = await tryPool('general');
  }
  return agent;
}

async function assignTicketInTransaction(
  ticketId: string,
  options?: AssignTicketOptions
): Promise<AssignTicketResult> {
  const settings = options?.settings ?? (await getSupportRoutingSettings());
  if (!options?.skipSettingsCheck && !settings.autoAssignEnabled && !options?.force) {
    return { assigned: false, reason: 'disabled' };
  }

  const hasLastAssigned =
    options?.hasLastAssigned ?? (await ensureLastAssignedColumn());

  const result = await withTransaction(async (client) => {
    const ticketRes = await client.query(
      `SELECT id, status, assigned_to, booking_id, category, metadata
       FROM support_tickets
       WHERE id = $1
       FOR UPDATE`,
      [ticketId]
    );

    const ticket = ticketRes.rows?.[0];
    if (!ticket) {
      return { assigned: false, reason: 'ticket_not_found' as const };
    }

    if (ticket.assigned_to) {
      return { assigned: false, reason: 'already_assigned' as const };
    }

    const status = String(ticket.status || '').toLowerCase();
    if (!ASSIGNABLE_STATUSES.has(status)) {
      return { assigned: false, reason: 'not_assignable' as const };
    }

    const poolKey = deriveRoutingPoolKey(ticket);
    const agent = await pickEligibleAgent(
      client,
      poolKey,
      settings.fallbackToGeneralSpecialty,
      hasLastAssigned
    );

    if (!agent) {
      return { assigned: false, reason: 'no_eligible_agent' as const, poolKey };
    }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE support_tickets
       SET assigned_to = $1,
           assigned_at = $2,
           status = 'assigned',
           last_updated_at = $2
       WHERE id = $3`,
      [agent.assignee_id, now, ticketId]
    );

    if (hasLastAssigned) {
      await client.query(
        `UPDATE support_agents SET last_assigned_at = $1, updated_at = $1 WHERE id = $2`,
        [now, agent.support_agent_id]
      );
    }

    const workloadAfter = (Number(agent.workload) || 0) + 1;
    const assigneeName = String(agent.name || 'Agent');

    return {
      assigned: true,
      assigneeId: String(agent.assignee_id),
      assigneeName,
      poolKey,
      workloadAfter,
    };
  });

  if (result.assigned) {
    console.log(
      JSON.stringify({
        metric: 'support.auto_assign.success',
        ticketId,
        poolKey: result.poolKey,
        assigneeId: result.assigneeId,
        workloadAfter: result.workloadAfter,
      })
    );
    void recordSupportTicketActivity({
      ticketId,
      eventType: SUPPORT_TICKET_EVENT_TYPES.ASSIGNED,
      eventActorType: 'system',
      eventTitle: `Assigned to ${result.assigneeName}`,
      eventMetadata: {
        autoRouted: true,
        poolKey: result.poolKey,
        assigneeId: result.assigneeId,
        assigneeName: result.assigneeName,
        workloadAfter: result.workloadAfter,
      },
    });
  } else if (result.reason === 'no_eligible_agent') {
    void recordSupportTicketActivity({
      ticketId,
      eventType: 'auto_assign_skipped',
      eventActorType: 'system',
      eventTitle: 'Auto-assign skipped — no eligible agent',
      eventMetadata: { reason: 'no_eligible_agent', poolKey: result.poolKey, autoRouted: true },
    });
  }

  return result;
}

/**
 * Attempt round-robin assignment for a single ticket (idempotent).
 */
export async function assignSupportTicket(
  ticketId: string,
  options?: { force?: boolean }
): Promise<AssignTicketResult> {
  const started = Date.now();
  try {
    const result = await assignTicketInTransaction(ticketId, options);
    if (!result.assigned && result.reason && result.reason !== 'already_assigned') {
      console.log(
        JSON.stringify({
          metric: 'support.auto_assign.skipped',
          ticketId,
          reason: result.reason,
          poolKey: result.poolKey,
          latencyMs: Date.now() - started,
        })
      );
    } else if (result.assigned) {
      console.log(
        JSON.stringify({
          metric: 'support.auto_assign.latency_ms',
          ticketId,
          latencyMs: Date.now() - started,
        })
      );
    }
    return result;
  } catch (err) {
    console.error('[support-auto-assign] assignSupportTicket failed:', ticketId, err);
    throw err;
  }
}

/** API Gateway integration timeout is ~29s — stay under that for HTTP-triggered batches. */
export const SUPPORT_AUTO_ASSIGN_HTTP_TIME_BUDGET_MS = 22_000;

/**
 * Batch assign unassigned tickets (sweeper / manual route-all).
 */
export async function assignSupportTicketBatch(options?: {
  limit?: number;
  force?: boolean;
  updateSweeperStats?: boolean;
  /** Stop early to avoid API Gateway 503 (default for HTTP callers). Pass 0 to disable. */
  timeBudgetMs?: number;
}): Promise<{
  routed: number;
  skipped: number;
  results: AssignTicketResult[];
  timedOut?: boolean;
  processed?: number;
}> {
  const started = Date.now();
  const timeBudgetMs =
    options?.timeBudgetMs === 0 ? null : (options?.timeBudgetMs ?? SUPPORT_AUTO_ASSIGN_HTTP_TIME_BUDGET_MS);

  const settings = await getSupportRoutingSettings();
  const hasLastAssigned = await ensureLastAssignedColumn();
  const limit = Math.min(
    100,
    Math.max(1, options?.limit ?? settings.sweeperBatchSize)
  );

  if (!settings.autoAssignEnabled && !options?.force) {
    return { routed: 0, skipped: 0, results: [] };
  }

  const unassigned = await query(
    `SELECT id FROM support_tickets
     WHERE status IN ('open', 'ai_acknowledged', 'awaiting_assignment')
       AND assigned_to IS NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  const results: AssignTicketResult[] = [];
  let routed = 0;
  let skipped = 0;
  let timedOut = false;

  for (const row of unassigned.rows || []) {
    if (timeBudgetMs != null && Date.now() - started >= timeBudgetMs) {
      timedOut = true;
      break;
    }

    const ticketId = String(row.id);
    const result = await assignTicketInTransaction(ticketId, {
      force: options?.force,
      skipSettingsCheck: options?.force,
      settings,
      hasLastAssigned,
    });
    results.push(result);
    if (result.assigned) routed++;
    else skipped++;
  }

  if (options?.updateSweeperStats && (await ensureRoutingSettingsTable())) {
    try {
      await query(
        `UPDATE support_routing_settings
         SET last_sweeper_run_at = NOW(),
             last_sweeper_assigned_count = $1,
             updated_at = NOW()
         WHERE id = 'default'`,
        [routed]
      );
    } catch (err) {
      console.warn('[support-auto-assign] failed to update sweeper stats:', err);
    }
  }

  return {
    routed,
    skipped,
    results,
    timedOut: timedOut || undefined,
    processed: results.length,
  };
}

/**
 * Fire-and-forget after AI ack — does not block the ack path.
 */
export function scheduleSupportTicketAutoAssign(ticketId: string): void {
  if (!ticketId) return;
  void (async () => {
    const settings = await getSupportRoutingSettings();
    if (!settings.autoAssignEnabled || !settings.assignAfterAiAck) return;
    await assignSupportTicket(ticketId);
  })().catch((err) => {
    console.error('[support-auto-assign] background assign failed:', ticketId, err);
  });
}
