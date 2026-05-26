'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type CustomerWalletInfo = {
  balance: number;
  currency: string;
  loyaltyPoints?: number;
  rewardsBalance?: number;
};

/**
 * Loads Warmpawz wallet for a customer phone (same source as UniversalPaymentPage).
 */
export function useCustomerWallet(customerPhone: string | undefined) {
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
      const walletRes = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(phone)}`);
      if (walletRes.wallet) {
        setWallet({
          balance: Number(walletRes.wallet.balance ?? 0),
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
  }, [customerPhone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { wallet, loading, error, refresh };
}
