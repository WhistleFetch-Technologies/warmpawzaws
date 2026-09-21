/**
 * V / C / F contract. Visit source, publish, and redeem are independent.
 * Ecommerce is a spend channel only — never a visit.
 */

export type Letter = 'V' | 'C' | 'F';
export type CountChannel = 'tele' | 'appointment' | 'paybill';
export type SpendChannel = CountChannel | 'ecommerce';
export type PaymentChannel = SpendChannel;

export const COUNT_CHANNELS: CountChannel[] = ['tele', 'appointment', 'paybill'];

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

export interface PromoVcfConfig {
  visitSource: {
    letter: Letter;
    vendorId?: string;
    categoryId?: string;
    width: 'general' | 'specific';
    channels?: CountChannel[];
  };
  visitLoop: VisitLoop;
  benefitMode: 'discount' | 'cashback' | 'both';
  maxDiscount?: number;
  publish: {
    letter: Letter;
    vendorId?: string;
    categoryId?: string;
  };
  redeem?: {
    letter: Letter;
    vendorId?: string;
    categoryId?: string;
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
  };
}

export function emptyVisitProfile(): VisitProfile {
  return { platform: emptyChannelCells(), categories: {}, vendors: {} };
}
