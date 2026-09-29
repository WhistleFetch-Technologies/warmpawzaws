import {
  DEFAULT_CREDITED_BODY,
  DEFAULT_CREDITED_BODY_NO_EXPIRY,
  DEFAULT_CREDITED_TITLE,
  renderCustomerCopy,
  type PromoCustomerCopy,
} from '../customer-copy';

/** Not "promotion…" — users who mute promotional pushes still get wallet credit alerts. */
export const WALLET_CASHBACK_CREDITED_TYPE = 'wallet_cashback_credited';
export const WALLET_DEEP_LINK = '/wallet';

function formatInr(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function formatCashbackExpiryDate(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function buildCashbackCreditedMessage(opts: {
  amount: number;
  expiresAt?: string | null;
  expiryDays?: number | null;
  copy?: PromoCustomerCopy | null;
}): { title: string; message: string } {
  const expiryDate = formatCashbackExpiryDate(opts.expiresAt);
  const vars = {
    amount: formatInr(opts.amount),
    expiryDate,
    expiryDays: opts.expiryDays ?? null,
  };
  const titleTpl = opts.copy?.creditedTitle || DEFAULT_CREDITED_TITLE;
  const bodyTpl =
    opts.copy?.creditedBody ||
    (expiryDate ? DEFAULT_CREDITED_BODY : DEFAULT_CREDITED_BODY_NO_EXPIRY);
  return {
    title: renderCustomerCopy(titleTpl, vars),
    message: renderCustomerCopy(bodyTpl, vars),
  };
}

/**
 * In-app + push alert after cashback lands in the wallet. Call only when the wallet
 * credit actually happened (credited === true) so verify / webhook / reconcile retries
 * never double-notify. Best-effort: never throws into the payment path.
 */
export async function notifyPromoCashbackCredited(opts: {
  userId: string;
  amount: number;
  walletTransactionId: string | null;
  promotionId: string;
  transactionId: string;
  expiresAt?: string | null;
  expiryDays?: number | null;
  copy?: PromoCustomerCopy | null;
}): Promise<void> {
  if (!opts.userId || !(opts.amount > 0)) return;
  try {
    const { dispatchNotification } = await import('../../../utils/notification-dispatch');
    const { title, message } = buildCashbackCreditedMessage(opts);
    const dedupeKey = opts.walletTransactionId
      ? `promo-cashback-${opts.walletTransactionId}`
      : `promo-cashback-${opts.promotionId}-${opts.transactionId}`;
    await dispatchNotification({
      recipientId: opts.userId,
      recipientType: 'customer',
      notificationType: WALLET_CASHBACK_CREDITED_TYPE,
      title,
      message,
      channels: { inApp: true, push: true },
      priority: 'high',
      deepLinkOverride: WALLET_DEEP_LINK,
      data: {
        amount: Math.round(opts.amount * 100) / 100,
        expiresAt: opts.expiresAt ?? null,
        expiryDays: opts.expiryDays ?? null,
        promotionId: opts.promotionId,
        transactionId: opts.transactionId,
        walletTransactionId: opts.walletTransactionId,
        deep_link: WALLET_DEEP_LINK,
        dedupeKey,
      },
    });
  } catch (err) {
    console.warn(
      '[promo-engine] cashback credited notification failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
