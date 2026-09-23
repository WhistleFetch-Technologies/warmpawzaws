import { isSpendChannel } from './channel';
import type { RedeemPayment } from './redeem-allows';
import type { SpendChannel } from './types';

export type WalletRedeemPayment = RedeemPayment & {
  serviceCategory?: string | null;
  channel?: SpendChannel | null;
};

export function parseWalletRedeemQuery(q: {
  serviceCategory?: string | null;
  channel?: string | null;
  vendorId?: string | null;
  categoryId?: string | null;
  ecommerceCategoryId?: string | null;
}): WalletRedeemPayment {
  const channelRaw = String(q.channel || '')
    .trim()
    .toLowerCase();
  return {
    serviceCategory: q.serviceCategory ? String(q.serviceCategory) : null,
    channel: isSpendChannel(channelRaw) ? channelRaw : null,
    vendorId: q.vendorId ? String(q.vendorId) : null,
    categoryId: q.categoryId ? String(q.categoryId) : null,
    ecommerceCategoryId: q.ecommerceCategoryId ? String(q.ecommerceCategoryId) : null,
  };
}
