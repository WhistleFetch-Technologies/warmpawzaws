import {
  COUNT_CHANNELS,
  type CountChannel,
  type Letter,
  type PromoVcfConfig,
  type RankingOverride,
  type SpendChannel,
  type VcfScope,
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

function uniqIds(list: unknown, single: unknown): string[] {
  const raw = [...(Array.isArray(list) ? list : []), single];
  const out: string[] = [];
  for (const item of raw) {
    const id = item == null ? '' : String(item).trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

function scope(raw: unknown, requireId: boolean): VcfScope | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const letter = asLetter(row.letter);
  if (!letter) return null;
  if (letter === 'V') {
    const ids = uniqIds(row.vendorIds, row.vendorId);
    if (requireId && !ids.length) return null;
    return { letter, vendorId: ids[0], vendorIds: ids.length ? ids : undefined };
  }
  if (letter === 'C') {
    const ids = uniqIds(row.categoryIds, row.categoryId);
    if (requireId && !ids.length) return null;
    return { letter, categoryId: ids[0], categoryIds: ids.length ? ids : undefined };
  }
  return { letter };
}

/** Vendor ids for V, category ids for C, empty for F. */
export function scopeIds(s: VcfScope): string[] {
  if (s.letter === 'V') return uniqIds(s.vendorIds, s.vendorId);
  if (s.letter === 'C') return uniqIds(s.categoryIds, s.categoryId);
  return [];
}

/** Same vendor / same category copies publish first, then visit source — only when redeem lists are empty. */
function inheritRedeemIds(
  redeem: NonNullable<PromoVcfConfig['redeem']>,
  publish: VcfScope,
  visitSource: VcfScope
): NonNullable<PromoVcfConfig['redeem']> {
  if (redeem.letter === 'V') {
    const existing = [
      ...(Array.isArray(redeem.vendorIds) ? redeem.vendorIds : []),
      redeem.vendorId,
    ].filter(Boolean) as string[];
    if (existing.length) {
      const uniq = [...new Set(existing.map(String))];
      return { ...redeem, vendorIds: uniq, vendorId: uniq[0], categoryId: undefined, categoryIds: undefined };
    }
    const inherited =
      publish.letter === 'V'
        ? scopeIds(publish)
        : visitSource.letter === 'V'
          ? scopeIds(visitSource)
          : [];
    return {
      ...redeem,
      vendorId: inherited[0],
      vendorIds: inherited.length ? inherited : undefined,
      categoryId: undefined,
      categoryIds: undefined,
    };
  }
  if (redeem.letter === 'C') {
    const existing = [
      ...(Array.isArray(redeem.categoryIds) ? redeem.categoryIds : []),
      redeem.categoryId,
    ].filter(Boolean) as string[];
    if (existing.length) {
      const uniq = [...new Set(existing.map(String))];
      return { ...redeem, categoryIds: uniq, categoryId: uniq[0], vendorId: undefined, vendorIds: undefined };
    }
    const inherited =
      publish.letter === 'C'
        ? scopeIds(publish)
        : visitSource.letter === 'C'
          ? scopeIds(visitSource)
          : [];
    return {
      ...redeem,
      categoryId: inherited[0],
      categoryIds: inherited.length ? inherited : undefined,
      vendorId: undefined,
      vendorIds: undefined,
    };
  }
  return redeem;
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
  const visitScope = scope(vs, false);
  if (!visitScope) return null;
  const width = String(vs.width || 'general') === 'specific' ? 'specific' : 'general';
  const channels = Array.isArray(vs.channels)
    ? vs.channels
        .map((c) => String(c))
        .filter((c): c is CountChannel => COUNT_CHANNELS.includes(c as CountChannel))
    : undefined;
  const visitLoop = asLoop(row.visitLoop) || { kind: 'every' };
  const publishScope = scope(row.publish, true);
  if (!publishScope) return null;
  const publishRaw = row.publish as Record<string, unknown>;
  const publishChannels = Array.isArray(publishRaw.channels)
    ? [
        ...new Set(
          publishRaw.channels
            .map((c) => String(c))
            .filter((c): c is SpendChannel => SPEND.includes(c as SpendChannel))
        ),
      ]
    : [];
  const publish: PromoVcfConfig['publish'] = publishChannels.length
    ? { ...publishScope, channels: publishChannels }
    : publishScope;

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
      const vendorIds = Array.isArray(r.vendorIds)
        ? r.vendorIds.map((x) => String(x)).filter(Boolean)
        : undefined;
      const categoryIds = Array.isArray(r.categoryIds)
        ? r.categoryIds.map((x) => String(x)).filter(Boolean)
        : undefined;
      redeem = inheritRedeemIds(
        {
          letter: redeemLetter,
          vendorId: r.vendorId ? String(r.vendorId) : undefined,
          vendorIds: vendorIds?.length ? [...new Set(vendorIds)] : undefined,
          categoryId: r.categoryId ? String(r.categoryId) : undefined,
          categoryIds: categoryIds?.length ? [...new Set(categoryIds)] : undefined,
          ecommerceCategoryId: r.ecommerceCategoryId ? String(r.ecommerceCategoryId) : undefined,
          channels: redeemChannels,
        },
        publish,
        visitScope
      );
    }
  }

  const ranking = String(row.rankingOverride || '') as RankingOverride;
  return {
    visitSource: {
      ...visitScope,
      width,
      channels: width === 'specific' ? channels : undefined,
      countMode: 'pooled',
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

/**
 * F matches every vendor/category; V/C match when the payment's vendor/category is in the
 * publish list. When `publish.channels` is set, the payment channel must also be listed.
 */
export function matchesPublish(
  publish: PromoVcfConfig['publish'],
  ctx: { vendorId?: string | null; categoryId?: string | null; channel?: SpendChannel | null }
): boolean {
  if (publish.channels?.length) {
    if (!ctx.channel || !publish.channels.includes(ctx.channel)) return false;
  }
  if (publish.letter === 'F') return true;
  const target = publish.letter === 'V' ? ctx.vendorId : ctx.categoryId;
  if (!target) return false;
  return scopeIds(publish).includes(String(target));
}

/** Publish list size for ranking; F has no list and ranks as the widest. */
export function publishScopeSize(publish: VcfScope): number | undefined {
  if (publish.letter === 'F') return undefined;
  return scopeIds(publish).length || undefined;
}
