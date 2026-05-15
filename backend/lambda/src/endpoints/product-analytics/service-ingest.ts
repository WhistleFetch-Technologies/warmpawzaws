import { getClient } from '../../database/rds-connection';
import type { IngestBody } from './schemas';
import { assertPropertiesSize } from './schemas';
import { upsertProductErrorCasesForInsertedEvents } from './error-case-ingest';

function toJsonb(o: Record<string, unknown> | undefined): string {
  return JSON.stringify(o ?? {});
}

function parseOptionalClientTs(s: string | null | undefined): Date | null {
  if (s == null || s === '') return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

/** Admin / screens tab: error rows used to omit screen_name; backfill from properties when missing. */
function screenNameForIngest(
  eventType: string,
  screenName: string | null | undefined,
  properties: Record<string, unknown> | undefined
): string | null {
  const direct = screenName != null && String(screenName).trim() !== '' ? String(screenName).trim() : '';
  if (direct) {
    return direct.slice(0, 512);
  }
  if (eventType !== 'error') {
    return null;
  }
  const p = properties ?? {};
  const rk = p.route_key;
  if (typeof rk === 'string' && rk.trim()) {
    return rk.trim().slice(0, 512);
  }
  const ss = p.shell_screen;
  if (typeof ss === 'string' && ss.trim()) {
    return ss.trim().slice(0, 512);
  }
  return null;
}

/**
 * Single transaction: upsert session + bulk insert events (one round-trip for INSERT VALUES).
 */
export async function ingestProductAnalyticsBatch(body: IngestBody): Promise<{ sessionId: string; inserted: number }> {
  const device = toJsonb(body.session_patch?.device as Record<string, unknown> | undefined);
  const context = toJsonb(body.session_patch?.context as Record<string, unknown> | undefined);
  assertPropertiesSize('session_patch.device', body.session_patch?.device as Record<string, unknown> | undefined);
  assertPropertiesSize('session_patch.context', body.session_patch?.context as Record<string, unknown> | undefined);

  const batchActorType = body.actor_type ?? null;
  const batchActorId = body.actor_id ?? null;

  for (const ev of body.events) {
    assertPropertiesSize(`event.${ev.event_name}`, ev.properties as Record<string, unknown> | undefined);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sess = await client.query<{ id: string }>(
      `INSERT INTO analytics_sessions (session_key, actor_type, actor_id, app, device, context, started_at, last_seen_at)
       VALUES ($1::text, $2::analytics_actor_type_enum, $3::uuid, $4::analytics_app_enum, $5::jsonb, $6::jsonb, now(), now())
       ON CONFLICT (session_key) DO UPDATE SET
         last_seen_at = now(),
         actor_id = COALESCE(EXCLUDED.actor_id, analytics_sessions.actor_id),
         actor_type = COALESCE(EXCLUDED.actor_type, analytics_sessions.actor_type),
         device = CASE WHEN EXCLUDED.device <> '{}'::jsonb THEN EXCLUDED.device ELSE analytics_sessions.device END,
         context = CASE WHEN EXCLUDED.context <> '{}'::jsonb THEN EXCLUDED.context ELSE analytics_sessions.context END
       RETURNING id`,
      [
        body.session_key,
        batchActorType,
        batchActorId,
        body.app,
        device,
        context,
      ]
    );

    const sessionId = sess.rows[0]?.id;
    if (!sessionId) {
      throw new Error('Failed to resolve session id');
    }

    const events = body.events;
    const cols =
      '(session_id, actor_type, actor_id, app, event_type, event_name, screen_name, duration_ms, api_name, error_code, environment, version, client_ts, properties)';
    const placeholders: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const ev of events) {
      const actorType = ev.actor_type ?? batchActorType;
      const actorId = ev.actor_id ?? batchActorId;
      placeholders.push(
        `($${p++}::uuid, $${p++}::analytics_actor_type_enum, $${p++}::uuid, $${p++}::analytics_app_enum, $${p++}::analytics_event_type_enum, $${p++}::text, $${p++}::text, $${p++}::int, $${p++}::text, $${p++}::text, $${p++}::analytics_environment_enum, $${p++}::smallint, $${p++}::timestamptz, $${p++}::jsonb)`
      );
      params.push(
        sessionId,
        actorType,
        actorId,
        body.app,
        ev.event_type,
        ev.event_name,
        screenNameForIngest(ev.event_type, ev.screen_name, ev.properties as Record<string, unknown> | undefined),
        ev.duration_ms ?? null,
        ev.api_name ?? null,
        ev.error_code ?? null,
        body.environment,
        ev.version ?? 1,
        parseOptionalClientTs(ev.client_ts ?? undefined),
        JSON.stringify(ev.properties ?? {})
      );
    }

    const sql = `INSERT INTO analytics_events ${cols} VALUES ${placeholders.join(', ')} RETURNING id`;
    const insertRes = await client.query<{ id: string }>(sql, params);

    const errorRows = insertRes.rows
      .map((row, i) => ({ id: row.id, ev: events[i] }))
      .filter((x) => x.ev.event_type === 'error')
      .map((x) => ({
        id: x.id,
        app: body.app,
        event_name: x.ev.event_name,
        error_code: x.ev.error_code ?? null,
        properties: (x.ev.properties ?? {}) as Record<string, unknown>,
      }));
    if (errorRows.length > 0) {
      await upsertProductErrorCasesForInsertedEvents(client, errorRows);
    }

    await client.query('COMMIT');
    return { sessionId, inserted: events.length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
