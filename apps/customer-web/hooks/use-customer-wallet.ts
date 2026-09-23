'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  buildCustomerWalletPath,
  type WalletRedeemContext,
} from '@/lib/wallet-redeem-query';

export type CustomerWalletInfo = {
  balance: number;
  spendableBalance?: number;
  lockedPromoCashback?: number;
  currency: string;
  loyaltyPoints?: number;
  rewardsBalance?: number;
};

function asRedeemContext(
  serviceCategoryOrCtx?: string | null | WalletRedeemContext
): WalletRedeemContext {
  if (serviceCategoryOrCtx && typeof serviceCategoryOrCtx === 'object') {
    return serviceCategoryOrCtx;
  }
  return { serviceCategory: serviceCategoryOrCtx || null };
}

/**
 * Loads Warmpawz wallet for a customer phone (same source as UniversalPaymentPage).
 * Pass channel + vendorId so V/C/F cashback follows admin redeem rules.
 */
export function useCustomerWallet(
  customerPhone: string | undefined,
  serviceCategoryOrCtx?: string | null | WalletRedeemContext
) {
  const [wallet, setWallet] = useState<CustomerWalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctx = asRedeemContext(serviceCategoryOrCtx);

  const refresh = useCallback(async () => {
    const phone = String(customerPhone || '').trim();
    if (!phone) {
      setWallet(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const walletRes = await apiClient.get<any>(buildCustomerWalletPath(phone, ctx));
      if (walletRes.wallet) {
        setWallet({
          balance: Number(walletRes.wallet.balance ?? 0),
          spendableBalance: Number(
            walletRes.wallet.spendableBalance ?? walletRes.wallet.balance ?? 0,
          ),
          lockedPromoCashback: Number(walletRes.wallet.lockedPromoCashback ?? 0),
          currency: String(walletRes.wallet.currency || 'INR'),
          loyaltyPoints: walletRes.wallet.loyaltyPoints,
          rewardsBalance: walletRes.wallet.rewardsBalance,
        });
      } else {
        setWallet(null);
      }
    } catch {
      setWallet(null);
      setError('wallet_unavailable');
    } finally {
      setLoading(false);
    }
  }, [
    customerPhone,
    ctx.serviceCategory,
    ctx.channel,
    ctx.vendorId,
    ctx.categoryId,
    ctx.ecommerceCategoryId,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { wallet, loading, error, refresh };
}
