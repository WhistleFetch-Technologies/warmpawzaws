/**
 * Spendable wallet for a checkout being quoted or created.
 * Same as computeSpendableWalletBalance, plus the global benefit cap: once the customer is
 * capped (block = cashback | both) the wallet cannot be applied to this checkout.
 * Debits of an already-quoted checkout keep using computeSpendableWalletBalance directly, so a
 * captured payment never fails its wallet leg because the cap was reached meanwhile.
 */
import type { BenefitCapNotice } from '../benefit-cap/gate';
import { resolveWalletBenefitCap } from './benefit-cap.service';
import {
  computeSpendableWalletBalance,
  type WalletRedeemPayment,
} from './wallet-redeem-scope.service';

export async function computeCheckoutSpendableWallet(
  customerId: string,
  serviceCategory?: string | null,
  payment?: WalletRedeemPayment,
): Promise<{
  balance: number;
  spendable: number;
  lockedPromoCashback: number;
  benefitCap: BenefitCapNotice | null;
}> {
  // Without a checkout context (plain wallet screen) there is no payment to gate.
  const isCheckout = Boolean(
    payment?.channel ||
      payment?.vendorId ||
      payment?.categoryId ||
      payment?.ecommerceCategoryId ||
      payment?.serviceCategory ||
      serviceCategory,
  );
  const [scoped, benefitCap] = await Promise.all([
    computeSpendableWalletBalance(customerId, serviceCategory, payment),
    isCheckout
      ? resolveWalletBenefitCap({ userId: customerId, channel: payment?.channel ?? null })
      : Promise.resolve(null),
  ]);
  if (!benefitCap) return { ...scoped, benefitCap: null };
  return { ...scoped, spendable: 0, benefitCap };
}
