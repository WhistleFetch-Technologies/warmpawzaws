/**
 * Device token hygiene for push.
 *
 * Durable model (no cron, no per-campaign write storm):
 * 1. Client: authenticated register-device on login / app open / resume (+ pipeline version bump).
 * 2. Register path: capActiveDeviceTokens keeps newest N per platform; deactivateStale… soft-closes age ghosts.
 * 3. Send / audience path: SELECT-only freshness filter (is_active + updated_at within window).
 * 4. FCM permanent failures still deactivate via firebase-client.
 */

import { query } from '../database/rds-connection';

const DEFAULT_MAX_IOS_ANDROID = 3;
const DEFAULT_MAX_WEB = 5;

/** Tokens not refreshed via register-device within this window are ineligible for send. */
export const FCM_ACTIVE_TOKEN_MAX_AGE_DAYS = 30;

/** Audience EXISTS fragment — keep in sync with FCM_ACTIVE_TOKEN_MAX_AGE_DAYS. */
export const FCM_TOKEN_FRESH_EXISTS_SQL = `dt.is_active = true
      AND dt.fcm_token IS NOT NULL
      AND dt.updated_at >= NOW() - INTERVAL '${FCM_ACTIVE_TOKEN_MAX_AGE_DAYS} days'`;

function maxActiveForPlatform(platform: string): number {
  const envKey =
    platform === 'web'
      ? 'DEVICE_TOKEN_MAX_ACTIVE_WEB'
      : 'DEVICE_TOKEN_MAX_ACTIVE_PER_PLATFORM';
  const fallback = platform === 'web' ? DEFAULT_MAX_WEB : DEFAULT_MAX_IOS_ANDROID;
  const parsed = Number(process.env[envKey] ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Deactivate oldest active tokens beyond cap for (user, platform). Runs on register only. */
export async function capActiveDeviceTokens(params: {
  userId: string;
  userType: string;
  platform: string;
}): Promise<number> {
  const maxActive = maxActiveForPlatform(params.platform);
  if (maxActive <= 0) return 0;

  const result = await query(
    `UPDATE device_tokens
     SET is_active = false, updated_at = NOW()
     WHERE id IN (
       SELECT id FROM device_tokens
       WHERE user_id = $1::uuid
         AND user_type = $2
         AND platform = $3
         AND is_active = true
       ORDER BY updated_at DESC
       OFFSET $4
     )
     RETURNING id`,
    [params.userId, params.userType, params.platform, maxActive]
  );

  const count = result.rowCount ?? 0;
  if (count > 0) {
    console.log(
      JSON.stringify({
        event: 'device_tokens_capped',
        userId: params.userId,
        userType: params.userType,
        platform: params.platform,
        deactivated: count,
        maxActive,
      })
    );
  }
  return count;
}

/**
 * Soft-deactivate age-stale active tokens for one user.
 * Call from register-device (app open), not from campaign send — keeps send path write-free.
 */
export async function deactivateStaleActiveDeviceTokens(
  userId: string,
  userType: string,
  maxAgeDays: number = FCM_ACTIVE_TOKEN_MAX_AGE_DAYS
): Promise<number> {
  const result = await query(
    `UPDATE device_tokens
     SET is_active = false, updated_at = NOW()
     WHERE user_id = $1::uuid
       AND user_type = $2
       AND is_active = true
       AND (updated_at IS NULL OR updated_at < NOW() - ($3::int * INTERVAL '1 day'))`,
    [userId, userType, maxAgeDays]
  );
  const count = result.rowCount ?? 0;
  if (count > 0) {
    console.log(
      JSON.stringify({
        event: 'device_tokens_stale_deactivated',
        userId,
        userType,
        deactivated: count,
        maxAgeDays,
      })
    );
  }
  return count;
}

/**
 * Load distinct send-eligible FCM tokens (SELECT only — no UPDATE on hot path).
 * Uses existing idx_device_tokens_active_user (user_id, user_type) WHERE is_active.
 */
export async function loadFreshActiveFcmTokens(
  userId: string,
  userType: string,
  maxAgeDays: number = FCM_ACTIVE_TOKEN_MAX_AGE_DAYS
): Promise<string[]> {
  const tokensResult = await query(
    `SELECT DISTINCT fcm_token FROM device_tokens
     WHERE user_id = $1::uuid
       AND user_type = $2
       AND is_active = true
       AND fcm_token IS NOT NULL
       AND updated_at >= NOW() - ($3::int * INTERVAL '1 day')`,
    [userId, userType, maxAgeDays]
  );
  return [
    ...new Set(
      (tokensResult.rows || [])
        .map((r: { fcm_token: string }) => r.fcm_token)
        .filter(Boolean)
    ),
  ];
}

/** Cap + age-ghost cleanup after a successful register-device upsert. */
export async function applyRegisterDeviceTokenHygiene(params: {
  userId: string;
  userType: string;
  platform: string;
}): Promise<void> {
  if (params.platform !== 'unknown') {
    await capActiveDeviceTokens(params);
  }
  await deactivateStaleActiveDeviceTokens(params.userId, params.userType);
}
