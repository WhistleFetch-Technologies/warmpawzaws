/**
 * Scheduled cleanup for Allyticas product analytics (RDS).
 * Invoke daily via EventBridge schedule (see infrastructure/cdk lambda-stack).
 */
import { Context } from 'aws-lambda';
import { query } from '../database/rds-connection';

export async function handler(_event?: unknown, _context?: Context): Promise<{ statusCode: number; body: string }> {
  const days = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '180', 10);
  if (!Number.isFinite(days) || days < 30) {
    console.warn('[analytics-retention] ANALYTICS_RETENTION_DAYS invalid; defaulting to 180');
  }
  const d = Number.isFinite(days) && days >= 30 ? days : 180;

  let deleted = 0;
  /** Batch deletes to reduce long locks on large tables */
  const BATCH = 5000;
  for (let i = 0; i < 100; i++) {
    const res = await query(
      `DELETE FROM analytics_events ae
       WHERE ae.id IN (
         SELECT id FROM analytics_events
         WHERE occurred_at < (NOW() - ($1::int * INTERVAL '1 day'))
         LIMIT ${BATCH}
       )`,
      [d]
    );
    deleted += res.rowCount ?? 0;
    if ((res.rowCount ?? 0) < BATCH) break;
  }

  const orphan = await query(
    `DELETE FROM analytics_sessions s
     WHERE NOT EXISTS (SELECT 1 FROM analytics_events e WHERE e.session_id = s.id)`
  );

  const body = JSON.stringify({
    success: true,
    deletedEvents: deleted,
    orphanedSessionsRemoved: orphan.rowCount ?? 0,
    retentionDays: d,
  });

  console.log('[analytics-retention]', body);
  return { statusCode: 200, body };
}
