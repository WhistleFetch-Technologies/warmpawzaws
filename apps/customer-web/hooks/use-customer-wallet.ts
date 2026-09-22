'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type CustomerWalletInfo = {
  balance: number;
  spendableBalance?: number;
  lockedPromoCashback?: number;
  currency: string;
  loyaltyPoints?: number;
  rewardsBalance?: number;
};

export type CustomerWalletScope = {
  serviceCategory?: string | null;
  channel?: 'tele' | 'appointment' | 'paybill' | 'ecommerce' | null;
  vendorId?: string | null;
  categoryId?: string | null;
};

/**
 * Loads Warmpawz wallet for a customer phone (same source as UniversalPaymentPage).
 * Pass channel (and vendor/category when known) so VCF cashback redeem_scope unlocks correctly.
 */
export function useCustomerWallet(
  customerPhone: string | undefined,
  serviceCategoryOrScope?: string | null | CustomerWalletScope,
) {
  const scope: CustomerWalletScope =
    serviceCategoryOrScope && typeof serviceCategoryOrScope === 'object'
      ? serviceCategoryOrScope
      : { serviceCategory: serviceCategoryOrScope ?? null };

  const [wallet, setWallet] = useState<CustomerWalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const phone = String(customerPhone || '').trim();
    if (!phone) {
      setWallet(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ phone });
      const cat = String(scope.serviceCategory || '').trim();
      if (cat) params.set('serviceCategory', cat);
      if (scope.channel) params.set('channel', scope.channel);
      if (scope.vendorId) params.set('vendorId', String(scope.vendorId));
      if (scope.categoryId) params.set('categoryId', String(scope.categoryId));
      const walletRes = await apiClient.get<any>(`/customer/wallet?${params.toString()}`);
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
    scope.serviceCategory,
    scope.channel,
    scope.vendorId,
    scope.categoryId,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { wallet, loading, error, refresh };
}
