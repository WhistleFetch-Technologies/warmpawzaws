import { query } from '../../../../../database/rds-connection';
import { WAPPT_COMMERCE_MODE } from '../../../shared/wappt-policy.constants';

export async function dbListWapptPolicyTiers(filters?: {
  policyScope?: 'platform' | 'category';
  serviceCategory?: string | null;
}) {
  const clauses = [`commerce_mode = $1`, `is_active = true`];
  const params: unknown[] = [WAPPT_COMMERCE_MODE];
  if (filters?.policyScope) {
    params.push(filters.policyScope);
    clauses.push(`policy_scope = $${params.length}`);
  }
  if (filters?.serviceCategory) {
    params.push(filters.serviceCategory);
    clauses.push(`LOWER(TRIM(service_category)) = LOWER(TRIM($${params.length}))`);
  }
  const res = await query(
    `SELECT * FROM vendor_refund_tiers
     WHERE ${clauses.join(' AND ')}
     ORDER BY tier_level ASC, cancelled_by ASC, hours_before_service DESC`,
    params,
  );
  return res.rows ?? [];
}

export async function dbReplaceWapptPolicyTiers(
  policyScope: 'platform' | 'category',
  tiers: Record<string, unknown>[],
  serviceCategory?: string | null,
) {
  if (policyScope === 'category' && !serviceCategory) {
    throw new Error('serviceCategory required for category scope');
  }
  await query('BEGIN');
  try {
    if (policyScope === 'platform') {
      await query(
        `DELETE FROM vendor_refund_tiers
         WHERE commerce_mode = $1 AND policy_scope = 'platform'`,
        [WAPPT_COMMERCE_MODE],
      );
    } else {
      await query(
        `DELETE FROM vendor_refund_tiers
         WHERE commerce_mode = $1 AND policy_scope = 'category'
           AND LOWER(TRIM(service_category)) = LOWER(TRIM($2))`,
        [WAPPT_COMMERCE_MODE, serviceCategory],
      );
    }
    const inserted: Record<string, unknown>[] = [];
    for (const row of tiers) {
      const cols = Object.keys(row);
      const vals = Object.values(row);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const res = await query(
        `INSERT INTO vendor_refund_tiers (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
        vals,
      );
      if (res.rows?.[0]) inserted.push(res.rows[0]);
    }
    await query('COMMIT');
    return inserted;
  } catch (e) {
    await query('ROLLBACK');
    throw e;
  }
}

export async function dbDeleteWapptPolicyTier(tierId: string) {
  const res = await query(
    `DELETE FROM vendor_refund_tiers
     WHERE id = $1::uuid AND commerce_mode = $2
     RETURNING id`,
    [tierId, WAPPT_COMMERCE_MODE],
  );
  return res.rows?.[0] ?? null;
}

export async function dbInsertEntityAuditLog(entry: {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO entity_audit_log (entity_type, entity_id, action, actor_id, metadata, created_at)
     VALUES ($1, $2, $3, $4::uuid, $5::jsonb, NOW())`,
    [
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.actorId ?? null,
      JSON.stringify(entry.metadata ?? {}),
    ],
  ).catch(() => undefined);
}
