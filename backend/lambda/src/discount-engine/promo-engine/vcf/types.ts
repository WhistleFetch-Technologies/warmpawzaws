/**
 * V / C / F contract. Visit source, publish, and redeem are independent.
 * Ecommerce orders are recorded as visits but only count for promotions that list
 * `ecommerce` as a specific visit-source channel.
 */

export type Letter = 'V' | 'C' | 'F';
export type CountChannel = 'tele' | 'appointment' | 'paybill' | 'ecommerce';
export type SpendChannel = CountChannel;
export type PaymentChannel = SpendChannel;

/** Every channel a visit cell holds. */
export const COUNT_CHANNELS: CountChannel[] = ['tele', 'appointment', 'paybill', 'ecommerce'];

/** "General" visit source counts service visits only; ecommerce is opt-in. */
export const GENERAL_COUNT_CHANNELS: CountChannel[] = ['tele', 'appointment', 'paybill'];

export type VisitLoop =
  | { kind: 'visit_number'; n: number }
  | { kind: 'every_nth'; n: number }
  | { kind: 'from_onward'; n: number }
  | { kind: 'between'; n: number; m: number }
  | { kind: 'every' };

export type RankingOverride =
  | 'least_platform_loss'
  | 'max_customer_discount'
  | 'max_customer_cashback'
  | 'max_customer_total_value';

/** Pooled: visits across every listed vendor/category add up as one group. */
export type VisitCountMode = 'pooled';

/**
 * V/C scope. `vendorIds` / `categoryIds` hold the full list; the singular id is always the
 * first list entry so older readers keep working.
 */
export interface VcfScope {
  letter: Letter;
  vendorId?: string;
  vendorIds?: string[];
  categoryId?: string;
  categoryIds?: string[];
}

export interface PromoVcfConfig {
  visitSource: VcfScope & {
    width: 'general' | 'specific';
    channels?: CountChannel[];
    countMode?: VisitCountMode;
  };
  visitLoop: VisitLoop;
  benefitMode: 'discount' | 'cashback' | 'both';
  maxDiscount?: number;
  /** `channels` empty/absent = every payment channel. */
  publish: VcfScope & { channels?: SpendChannel[] };
  redeem?: {
    letter: Letter;
    vendorId?: string;
    /** Multi-vendor redeem when letter = V (wallet spend). */
    vendorIds?: string[];
    categoryId?: string;
    /** Multi-category redeem when letter = C (wallet spend). */
    categoryIds?: string[];
    ecommerceCategoryId?: string;
    channels: SpendChannel[];
  };
  expiryDays?: number;
  rankingOverride?: RankingOverride;
}

export interface ChannelCell {
  count: number;
  lastAt: string | null;
}

export interface VisitProfile {
  platform: Record<CountChannel, ChannelCell>;
  categories: Record<string, Record<CountChannel, ChannelCell>>;
  vendors: Record<
    string,
    { categoryId: string; roleId: string } & Record<CountChannel, ChannelCell>
  >;
}

export interface PaymentContext {
  channel: PaymentChannel | null;
  vendorId: string | null;
  roleId: string | null;
  /** service_categories.id — never a client slug */
  categoryId: string | null;
}

export type FallbackReason =
  | 'LOST_TO_MORE_SPECIFIC'
  | 'LOST_TO_PRIORITY'
  | 'VISIT_FAIL'
  | 'LIMIT_FAIL';

export interface RankedPromo {
  promotionId: string;
  publishLetter: Letter;
  /** Number of vendors/categories in publish; smaller wins within the same letter. */
  publishScopeSize?: number;
  priority: number;
  updatedAt: string;
  discount: number;
  cashback: number;
  rankingOverride?: RankingOverride | null;
}

export function emptyChannelCells(): Record<CountChannel, ChannelCell> {
  return {
    tele: { count: 0, lastAt: null },
    appointment: { count: 0, lastAt: null },
    paybill: { count: 0, lastAt: null },
    ecommerce: { count: 0, lastAt: null },
  };
}

export function emptyVisitProfile(): VisitProfile {
  return { platform: emptyChannelCells(), categories: {}, vendors: {} };
}
