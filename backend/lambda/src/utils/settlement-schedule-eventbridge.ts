/**
 * Daily settlement cron: map admin wall-clock (scheduleTime + IANA timezone) → EventBridge UTC cron().
 * Uses a fixed calendar date with no DST for Asia/Kolkata; UTC is exact.
 */
import { EventBridgeClient, PutRuleCommand } from '@aws-sdk/client-eventbridge';

const REF_DATE = '2024-01-15';

const TZ_OFFSET_SUFFIX: Record<string, string> = {
  UTC: 'Z',
  'Asia/Kolkata': '+05:30',
};

export function scheduleTimeAndZoneToUtcCron(scheduleTime: string, timezone: string): string {
  const raw = (scheduleTime || '09:00').trim();
  const parts = raw.split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] || '9', 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(parts[1] || '0', 10) || 0));
  const suffix = TZ_OFFSET_SUFFIX[timezone] ?? 'Z';
  const d = new Date(`${REF_DATE}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${suffix}`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid schedule time or timezone: ${scheduleTime} ${timezone}`);
  }
  return `cron(${d.getUTCMinutes()} ${d.getUTCHours()} * * ? *)`;
}

export type PutSettlementCronResult =
  | { synced: true; scheduleExpression: string }
  | { synced: false; skipped: true; reason: string }
  | { synced: false; skipped: false; scheduleExpression: string; error: string };

/**
 * Updates the existing EventBridge rule schedule (default bus). Rule name from env.
 */
export async function putSettlementCalculateDailyCron(scheduleExpression: string): Promise<PutSettlementCronResult> {
  const name = process.env.SETTLEMENT_CALCULATE_CRON_RULE_NAME?.trim();
  if (!name) {
    console.warn('[settlement-cron] SETTLEMENT_CALCULATE_CRON_RULE_NAME unset; skip EventBridge PutRule');
    return { synced: false, skipped: true, reason: 'SETTLEMENT_CALCULATE_CRON_RULE_NAME not configured' };
  }
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
  const client = new EventBridgeClient({ region });
  try {
    await client.send(
      new PutRuleCommand({
        Name: name,
        ScheduleExpression: scheduleExpression,
        State: 'ENABLED',
        Description:
          'POST /settlements/calculate-daily via API destination (schedule managed from Admin → Finance → Schedule Settings)',
      })
    );
    return { synced: true, scheduleExpression };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[settlement-cron] PutRule failed:', msg);
    return { synced: false, skipped: false, scheduleExpression, error: msg };
  }
}
