import {
  COUNT_CHANNELS,
  type CountChannel,
  type Letter,
  type PromoVcfConfig,
  type RankingOverride,
  type SpendChannel,
  type VisitLoop,
} from './types';

const LETTERS: Letter[] = ['V', 'C', 'F'];
const SPEND: SpendChannel[] = ['tele', 'appointment', 'paybill', 'ecommerce'];
const OVERRIDES: RankingOverride[] = [
  'least_platform_loss',
  'max_customer_discount',
  'max_customer_cashback',
  'max_customer_total_value',
];

function asLetter(raw: unknown): Letter | null {
  const v = String(raw || '').toUpperCase();
  return LETTERS.includes(v as Letter) ? (v as Letter) : null;
}

function asLoop(raw: unknown): VisitLoop | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = String(row.kind || '');
  const n = Math.max(1, Math.floor(Number(row.n) || 1));
  const m = Math.max(n, Math.floor(Number(row.m) || n));
  if (kind === 'every') return { kind: 'every' };
  if (kind === 'visit_number') return { kind: 'visit_number', n };
  if (kind === 'every_nth') return { kind: 'every_nth', n };
  if (kind === 'from_onward') return { kind: 'from_onward', n };
  if (kind === 'between') return { kind: 'between', n, m };
  return null;
}

function scope(raw: unknown, requireId: boolean): PromoVcfConfig['publish'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const letter = asLetter(row.letter);
  if (!letter) return null;
  const vendorId = row.vendorId ? String(row.vendorId) : undefined;
  const categoryId = row.categoryId ? String(row.categoryId) : undefined;
  if (letter === 'V' && requireId && !vendorId) return null;
  if (letter === 'C' && requireId && !categoryId) return null;
  return { letter, vendorId, categoryId };
}

/**
 * Read V/C/F contract from promotion metadata.vcf.
 * Missing or invalid → null (legacy row, keep today’s conditions).
 */
export function parseVcfConfig(metadata: Record<string, unknown> | undefined | null): PromoVcfConfig | null {
  const raw = metadata?.vcf ?? metadata;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const visitSourceRaw = row.visitSource;
  if (!visitSourceRaw || typeof visitSourceRaw !== 'object') return null;
  const vs = visitSourceRaw as Record<string, unknown>;
  const letter = asLetter(vs.letter);
  if (!letter) return null;
  const width = String(vs.width || 'general') === 'specific' ? 'specific' : 'general';
  const channels = Array.isArray(vs.channels)
    ? vs.channels
        .map((c) => String(c))
        .filter((c): c is CountChannel => COUNT_CHANNELS.includes(c as CountChannel))
    : undefined;
  const visitLoop = asLoop(row.visitLoop) || { kind: 'every' };
  const publish = scope(row.publish, true);
  if (!publish) return null;

  const modeRaw = String(row.benefitMode || '').toLowerCase();
  const benefitMode: PromoVcfConfig['benefitMode'] =
    modeRaw === 'cashback' ? 'cashback' : modeRaw === 'both' ? 'both' : 'discount';

  let redeem: PromoVcfConfig['redeem'] | undefined;
  if (row.redeem && typeof row.redeem === 'object') {
    const r = row.redeem as Record<string, unknown>;
    const redeemLetter = asLetter(r.letter);
    const redeemChannels = Array.isArray(r.channels)
      ? r.channels.map((c) => String(c)).filter((c): c is SpendChannel => SPEND.includes(c as SpendChannel))
      : [];
    if (redeemLetter && redeemChannels.length) {
      redeem = {
        letter: redeemLetter,
        vendorId: r.vendorId ? String(r.vendorId) : undefined,
        categoryId: r.categoryId ? String(r.categoryId) : undefined,
        ecommerceCategoryId: r.ecommerceCategoryId ? String(r.ecommerceCategoryId) : undefined,
        channels: redeemChannels,
      };
    }
  }

  const ranking = String(row.rankingOverride || '') as RankingOverride;
  return {
    visitSource: {
      letter,
      vendorId: vs.vendorId ? String(vs.vendorId) : undefined,
      categoryId: vs.categoryId ? String(vs.categoryId) : undefined,
      width,
      channels: width === 'specific' ? channels : undefined,
    },
    visitLoop,
    benefitMode,
    maxDiscount: row.maxDiscount != null ? Number(row.maxDiscount) : undefined,
    publish,
    redeem,
    expiryDays: row.expiryDays != null ? Number(row.expiryDays) : undefined,
    rankingOverride: OVERRIDES.includes(ranking) ? ranking : undefined,
  };
}

export function matchesPublish(
  publish: PromoVcfConfig['publish'],
  ctx: { vendorId?: string | null; categoryId?: string | null }
): boolean {
  if (publish.letter === 'F') return true;
  if (publish.letter === 'V') {
    return Boolean(publish.vendorId && ctx.vendorId && publish.vendorId === String(ctx.vendorId));
  }
  return Boolean(publish.categoryId && ctx.categoryId && publish.categoryId === String(ctx.categoryId));
}
