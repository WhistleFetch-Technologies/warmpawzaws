/**
 * Global per-customer benefit cap: loads the admin setting, counts the customer's benefit
 * payments in the current window, and returns a notice once they are at the cap.
 * Fails open — a settings/count error never blocks a checkout.
 */
import {
  DEFAULT_BENEFIT_CAP,
  normalizeBenefitCapConfig,
  validateBenefitCapInput,
  type BenefitCapConfig,
} from '../benefit-cap/config';
import { buildBenefitCapNotice, type BenefitCapNotice } from '../benefit-cap/gate';
import { benefitCapResumeAt, benefitCapWindowStart } from '../benefit-cap/window';
import {
  dbGetBenefitCapSettings,
  dbListBenefitPaymentsSince,
  dbSaveBenefitCapSettings,
} from '../repos/benefit-cap.repo';
import { dbInsertAudit } from '../repos/promo-engine.repo';

const CONFIG_CACHE_MS = 30_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cached: { at: number; cfg: BenefitCapConfig } | null = null;

export function clearBenefitCapConfigCache(): void {
  cached = null;
}

export async function loadBenefitCapConfig(force = false): Promise<BenefitCapConfig> {
  if (!force && cached && Date.now() - cached.at < CONFIG_CACHE_MS) return cached.cfg;
  let cfg: BenefitCapConfig;
  try {
    const row = await dbGetBenefitCapSettings();
    cfg = normalizeBenefitCapConfig(row?.benefit_cap);
  } catch (err) {
    // Table not migrated yet → cap off.
    console.warn('[benefit-cap] settings unavailable:', err instanceof Error ? err.message : err);
    cfg = { ...DEFAULT_BENEFIT_CAP, enabled: false };
  }
  cached = { at: Date.now(), cfg };
  return cfg;
}

export async function resolveBenefitCapNotice(opts: {
  userId: string | null | undefined;
  channel?: string | null;
  /** Commit-time check: ignore the payment being committed. */
  excludeTransactionId?: string | null;
  now?: Date;
}): Promise<BenefitCapNotice | null> {
  const userId = String(opts.userId || '').trim();
  if (!UUID_RE.test(userId)) return null;
  try {
    const cfg = await loadBenefitCapConfig();
    if (!cfg.enabled) return null;
    const now = opts.now ?? new Date();
    const rows = await dbListBenefitPaymentsSince({
      userId,
      since: benefitCapWindowStart(now, cfg),
      excludeTransactionId: opts.excludeTransactionId,
    });
    if (rows.length < cfg.max_benefit_payments) return null;
    return buildBenefitCapNotice({
      cfg,
      used: rows.length,
      resumeAt: benefitCapResumeAt(now, cfg, rows.map((r) => r.at)),
      channel: opts.channel,
    });
  } catch (err) {
    console.warn('[benefit-cap] check skipped:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getBenefitCapSettings(): Promise<{
  benefitCap: BenefitCapConfig;
  updatedBy: string | null;
  updatedAt: string | null;
}> {
  const row = await dbGetBenefitCapSettings();
  return {
    benefitCap: normalizeBenefitCapConfig(row?.benefit_cap),
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function saveBenefitCapSettings(
  input: unknown,
  updatedBy: string | null,
): Promise<{ ok: true; benefitCap: BenefitCapConfig } | { ok: false; errors: string[] }> {
  const errors = validateBenefitCapInput(input);
  if (errors.length) return { ok: false, errors };
  const before = await dbGetBenefitCapSettings().catch(() => null);
  const next = normalizeBenefitCapConfig({ ...(input as Record<string, unknown>) });
  await dbSaveBenefitCapSettings(next, updatedBy);
  clearBenefitCapConfigCache();
  try {
    await dbInsertAudit({
      event_type: 'BENEFIT_CAP_SETTINGS_UPDATED',
      payload: {
        updated_by: updatedBy,
        before: before ? normalizeBenefitCapConfig(before.benefit_cap) : null,
        after: next,
      },
    });
  } catch {
    // audit is best-effort
  }
  return { ok: true, benefitCap: next };
}

/** Notice only when the cap also blocks wallet spend (block = cashback | both). */
export async function resolveWalletBenefitCap(opts: {
  userId: string | null | undefined;
  channel?: string | null;
}): Promise<BenefitCapNotice | null> {
  const notice = await resolveBenefitCapNotice(opts);
  return notice?.blocked.wallet ? notice : null;
}
