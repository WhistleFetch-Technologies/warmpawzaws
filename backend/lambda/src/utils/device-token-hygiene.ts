/**
 * Cap active device_tokens per user/platform to reduce reinstall bloat.
 * Does not alter FCM send path — only deactivates stale rows after register.
 */

import { query } from '../database/rds-connection';

const DEFAULT_MAX_IOS_ANDROID = 3;
const DEFAULT_MAX_WEB = 5;

function maxActiveForPlatform(platform: string): number {
  const envKey =
    platform === 'web'
      ? 'DEVICE_TOKEN_MAX_ACTIVE_WEB'
      : 'DEVICE_TOKEN_MAX_ACTIVE_PER_PLATFORM';
  const fallback = platform === 'web' ? DEFAULT_MAX_WEB : DEFAULT_MAX_IOS_ANDROID;
  const parsed = Number(process.env[envKey] ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/** Deactivate oldest active tokens beyond cap for (user, platform). Current row is newest after upsert. */
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
