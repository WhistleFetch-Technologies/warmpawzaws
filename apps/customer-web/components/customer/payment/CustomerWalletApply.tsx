'use client';

import { Wallet, CheckCircle2 } from 'lucide-react';
import type { CustomerWalletInfo } from '@/hooks/use-customer-wallet';

type CustomerWalletApplyProps = {
  wallet: CustomerWalletInfo | null;
  useWallet: boolean;
  onToggleUseWallet: () => void;
  walletAmountApplied: number;
  /** When false, wallet row is still shown if balance > 0 but user cannot toggle (optional). */
  enabled?: boolean;
};

/**
 * Toggle + copy for applying Warmpawz wallet balance (extracted from UniversalPaymentPage).
 */
export function CustomerWalletApply({
  wallet,
  useWallet,
  onToggleUseWallet,
  walletAmountApplied,
  enabled = true,
}: CustomerWalletApplyProps) {
  if (!wallet || !(wallet.balance > 0)) return null;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <button
        type="button"
        disabled={!enabled}
        onClick={() => enabled && onToggleUseWallet()}
        className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-left transition-all duration-150 active:scale-[0.98] touch-manipulation ${
          useWallet ? 'border-green-500 bg-green-50' : 'border-gray-200'
        } ${!enabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              useWallet ? 'bg-green-100' : 'bg-orange-100'
            }`}
          >
            <Wallet className={`h-5 w-5 ${useWallet ? 'text-green-600' : 'text-[#FF8C42]'}`} />
          </div>
          <div>
            <p className="font-medium text-gray-900">Warmpawz Wallet</p>
            <p className="text-sm text-gray-500">
              Balance: ₹{wallet.balance.toFixed(2)}
              {wallet.loyaltyPoints != null ? ` • ${wallet.loyaltyPoints} points` : ''}
            </p>
          </div>
        </div>
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
            useWallet ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
          }`}
        >
          {useWallet && <CheckCircle2 className="h-4 w-4" />}
        </div>
      </button>
      {useWallet && walletAmountApplied > 0 && (
        <p className="mt-2 text-sm text-green-700">
          ₹{walletAmountApplied.toFixed(2)} will be deducted from wallet
        </p>
      )}
    </div>
  );
}
