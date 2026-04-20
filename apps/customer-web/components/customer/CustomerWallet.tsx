'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  rememberHelpBackFromCurrentUrl,
  rememberPromotionsBackFromCurrentUrl,
} from '@/lib/go-back-or-replace';
import {
  fetchCustomerUuidByPhone,
  formatWalletTopUpError,
  normalizeRazorpayCreateOrderResponse,
} from '@/lib/wallet-razorpay-helpers';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';

interface WalletData {
  balance: number;
  pending_credits: number;
  total_earned: number;
  total_spent: number;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference_type?: string;
  reference_id?: string;
  status: string;
  created_at: string;
}

interface CustomerWalletProps {
  customerPhone: string;
  /** When provided (e.g. inside app wrapper), use for in-app navigation instead of href */
  onNavigate?: (path: string) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function CustomerWallet({ customerPhone, onNavigate }: CustomerWalletProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [processingTopUp, setProcessingTopUp] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadWalletData();
  }, [customerPhone]);

  useEffect(() => {
    loadTransactions();
  }, [customerPhone, filter]);

  const extractWalletPayload = (response: any): any => {
    if (!response || typeof response !== 'object') return null;
    const top = response;
    const d1 = top.data;
    if (d1 && typeof d1 === 'object') {
      if (d1.balance != null || d1.totalEarned != null || d1.customerId != null) return d1;
      if (d1.data && typeof d1.data === 'object') return d1.data;
      if (d1.wallet && typeof d1.wallet === 'object') return d1.wallet;
    }
    if (top.wallet && typeof top.wallet === 'object') return top.wallet;
    if (top.balance != null || top.totalEarned != null) return top;
    return top;
  };

  const normalizeWalletResponse = (response: any): WalletData | null => {
    if (!response) return null;
    const data = extractWalletPayload(response);
    if (!data) return null;

    let totalEarned = Number(data.total_earned ?? data.totalEarned ?? 0);
    let totalSpent = Number(data.total_spent ?? data.totalSpent ?? 0);
    const recent = data.recentTransactions;
    if (
      totalEarned === 0 &&
      totalSpent === 0 &&
      Array.isArray(recent) &&
      recent.length > 0
    ) {
      for (const t of recent) {
        const typ = String(t.type ?? t.transaction_type ?? t.transactionType ?? '').toLowerCase();
        const amt = Math.abs(Number(t.amount ?? 0));
        if (typ === 'credit' || typ === 'c') totalEarned += amt;
        else if (typ === 'debit' || typ === 'd') totalSpent += amt;
      }
    }

    return {
      balance: Number(data.balance ?? data.currentBalance ?? data.walletBalance ?? 0),
      pending_credits: Number(data.pending_credits ?? data.pendingCredits ?? 0),
      total_earned: totalEarned,
      total_spent: totalSpent,
    };
  };

  const extractTransactionsPayload = (response: any): any => {
    if (!response || typeof response !== 'object') return null;
    const d1 = (response as any).data;
    if (d1 && typeof d1 === 'object' && !Array.isArray(d1)) {
      if (Array.isArray(d1.transactions) || Array.isArray(d1.recentTransactions)) return d1;
      if (d1.data && typeof d1.data === 'object') return d1.data;
    }
    return response;
  };

  /** Align with backend wallet ledger classification (refund = inflow, payment = spend). */
  const ledgerTotalsFromTransactions = (rows: Transaction[]): { earned: number; spent: number } => {
    let earned = 0;
    let spent = 0;
    for (const t of rows) {
      const typ = String(t.type ?? '').toLowerCase().trim();
      const amt = Math.abs(Number(t.amount ?? 0));
      if (!amt) continue;
      if (
        ['credit', 'c', 'refund', 'r', 'topup', 'top_up', 'cashback'].includes(typ) ||
        typ.includes('refund') ||
        typ.includes('credit')
      ) {
        earned += amt;
      } else if (
        ['debit', 'd', 'payout', 'payment', 'purchase', 'withdraw'].includes(typ) ||
        typ.includes('debit') ||
        typ.includes('payout')
      ) {
        spent += amt;
      }
    }
    return { earned, spent };
  };

  const normalizeTransactionsResponse = (response: any): Transaction[] => {
    if (!response) return [];
    const data = extractTransactionsPayload(response) || response;
    const list = data.transactions || data.recentTransactions || [];
    if (!Array.isArray(list)) return [];

    return list.map((txn: any) => ({
      id: txn.id,
      type: txn.type || txn.transaction_type || txn.transactionType || 'debit',
      amount: Number(txn.amount ?? 0),
      description: txn.description || txn.reference_type || txn.referenceType || 'Wallet transaction',
      reference_type: txn.reference_type || txn.referenceType,
      reference_id: txn.reference_id || txn.referenceId,
      status: txn.status || 'completed',
      created_at: txn.created_at || txn.timestamp || txn.createdAt || new Date().toISOString(),
    }));
  };

  const loadWalletData = async () => {
    try {
      // First get customer ID from phone
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const id = customerResponse.customer?.id;
      
      if (!id) {
        console.error('Customer not found');
        return;
      }

      setCustomerId(id);

      const [walletRes, txRes] = await Promise.all([
        apiClient.get<any>(`/wallet/${id}`),
        apiClient.get<any>(`/wallet/${id}/transactions?limit=500&offset=0`).catch(() => null),
      ]);

      const normalized = normalizeWalletResponse(walletRes);
      if (normalized) {
        if (txRes) {
          const txs = normalizeTransactionsResponse(txRes);
          const { earned, spent } = ledgerTotalsFromTransactions(txs);
          normalized.total_earned = Math.max(normalized.total_earned, earned);
          normalized.total_spent = Math.max(normalized.total_spent, spent);
        }
        setWallet(normalized);
      }
    } catch (err) {
      console.error('Error loading wallet:', err);
      // Fallback: try old endpoint
      try {
        const response = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
        const normalized = normalizeWalletResponse(response);
        if (normalized) {
          setWallet(normalized);
        }
      } catch (fallbackErr) {
        console.error('Fallback wallet load failed:', fallbackErr);
      }
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      
      // First get customer ID from phone
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;
      
      if (!customerId) {
        setLoading(false);
        return;
      }

      // Then get transactions using customer ID
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('type', filter);
      }
      params.append('limit', '50');
      params.append('offset', '0');

      const response = await apiClient.get<any>(`/wallet/${customerId}/transactions?${params.toString()}`);
      const normalized = normalizeTransactionsResponse(response);
      const filtered = filter === 'all' ? normalized : normalized.filter((txn) => txn.type === filter);
      setTransactions(filtered);
    } catch (err) {
      console.error('Error loading transactions:', err);
      // Fallback: try old endpoint
      try {
        const params = filter !== 'all' ? `&type=${filter}` : '';
        const response = await apiClient.get<any>(`/customer/wallet/transactions?phone=${encodeURIComponent(customerPhone)}${params}`);
        const normalized = normalizeTransactionsResponse(response);
        const filtered = filter === 'all' ? normalized : normalized.filter((txn) => txn.type === filter);
        setTransactions(filtered);
      } catch (fallbackErr) {
        console.error('Fallback transactions load failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    if (window.Razorpay) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 100) {
      alert('Minimum top-up amount is ₹100');
      return;
    }

    setProcessingTopUp(true);
    try {
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId) {
        resolvedCustomerId = await fetchCustomerUuidByPhone((p) => apiClient.get(p), customerPhone);
        if (resolvedCustomerId) setCustomerId(resolvedCustomerId);
      }
      if (!resolvedCustomerId) {
        alert('Customer not found. Please refresh the page.');
        setProcessingTopUp(false);
        return;
      }

      const orderRaw = await apiClient.post<any>('/razorpay/create-order', {
        type: 'wallet_topup',
        paymentType: 'wallet_topup',
        purpose: 'wallet',
        amount,
        currency: 'INR',
        customerId: resolvedCustomerId,
        customerPhone,
      });

      const order = normalizeRazorpayCreateOrderResponse(orderRaw);
      if (!order) {
        console.error('[wallet top-up] Unexpected create-order response:', orderRaw);
        const er =
          orderRaw && typeof orderRaw === 'object'
            ? (orderRaw as { error?: string; message?: string }).error ||
              (orderRaw as { message?: string }).message
            : undefined;
        throw new Error(typeof er === 'string' && er.trim() ? er : 'Failed to create payment order');
      }

      const payAmountPaise = Math.round(order.amount * 100);

      const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);

      const options = buildSanitizedStandardRazorpayCheckoutOptions({
        key: order.keyId,
        amountPaise: payAmountPaise,
        currency: order.currency,
        name: 'Warmpawz',
        description: `Wallet Top-up of ₹${amount}`,
        order_id: order.orderId,
        customerPhone,
        customerEmail: checkoutEmail,
        includeInstrumentBlocks: true,
        handler: async (response: any) => {
          try {
            const MAX_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                await apiClient.post<any>(
                  '/razorpay/verify-payment',
                  {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                  },
                  undefined,
                  30000
                );
                break;
              } catch (verifyErr: any) {
                console.error(`[VERIFY] Attempt ${attempt}/${MAX_RETRIES} failed:`, verifyErr?.message);
                if (attempt === MAX_RETRIES) throw verifyErr;
                await new Promise((r) => setTimeout(r, attempt * 1000));
              }
            }

            await apiClient.post<any>(`/wallet/${resolvedCustomerId}/credit`, {
              amount: Number(amount),
              referenceType: 'topup',
              referenceId: response.razorpay_payment_id,
              description: `Wallet top-up via Razorpay`,
            });

            await loadWalletData();
            await loadTransactions();

            setShowTopUpModal(false);
            setTopUpAmount('');
            alert('Wallet topped up successfully!');
          } catch (error: any) {
            console.error('Error processing top-up:', error);
            alert(formatWalletTopUpError(error) || 'Failed to process top-up. Please contact support.');
          } finally {
            setProcessingTopUp(false);
          }
        },
        theme: {
          color: '#F97316', // Orange primary color
        },
        modal: {
          ondismiss: () => {
            setProcessingTopUp(false);
          },
        },
      });

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Error initiating top-up:', error);
      alert(formatWalletTopUpError(error));
      setProcessingTopUp(false);
    }
  };

  const getTransactionIcon = (type: string, refType?: string) => {
    if (type === 'credit') {
      switch (refType) {
        case 'refund': return '💸';
        case 'cashback': return '🎁';
        case 'referral': return '👥';
        case 'topup': return '💳';
        default: return '💰';
      }
    } else {
      switch (refType) {
        case 'booking': return '📅';
        case 'order': return '📦';
        default: return '💳';
      }
    }
  };

  const gridTileClass =
    'flex flex-col items-center justify-center gap-1 min-h-[4.25rem] w-full touch-manipulation py-2 px-1 rounded-xl active:scale-[0.98] transition-transform';

  return (
    <div className="pb-2">
      {/* Balance Card */}
      <div className="mb-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-5">
          <p className="text-gray-500 text-xs font-medium tracking-wide uppercase">Available Balance</p>
          <p className="text-[2rem] leading-tight font-extrabold text-gray-900 mt-1 tabular-nums">
            ₹{wallet?.balance?.toLocaleString() ?? '0'}
          </p>

          {(wallet?.pending_credits ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              ₹{wallet.pending_credits.toLocaleString()} pending
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3">
            <div className="bg-[#F3EBE0] rounded-xl p-3.5 flex flex-col justify-center">
              <p className="text-[11px] text-gray-600 font-medium">Total Earned</p>
              <p className="text-base font-bold text-gray-900 tabular-nums mt-0.5">
                ₹{wallet?.total_earned?.toLocaleString() ?? '0'}
              </p>
            </div>
            <div className="bg-[#F3EBE0] rounded-xl p-3.5 flex flex-col justify-center">
              <p className="text-[11px] text-gray-600 font-medium">Total Spent</p>
              <p className="text-base font-bold text-gray-900 tabular-nums mt-0.5">
                ₹{wallet?.total_spent?.toLocaleString() ?? '0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions — 3-column mobile grid (no wide horizontal strip) */}
      <div className="mb-4">
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled
              aria-disabled="true"
              aria-label="Add money (unavailable)"
              className={`${gridTileClass} bg-white border-2 border-stone-200 opacity-60 cursor-not-allowed shadow-sm disabled:pointer-events-none disabled:active:scale-100`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-2xl leading-none grayscale">
                💳
              </span>
              <span className="text-[10px] text-center text-gray-500 font-semibold leading-tight px-0.5">
                Add Money
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate ? onNavigate('rewards-loyalty') : (window.location.href = '/rewards')
              }
              className={`${gridTileClass} bg-stone-50/80 hover:bg-stone-100/90`}
            >
              <span className="text-2xl">⭐</span>
              <span className="text-[10px] text-center text-gray-600 leading-tight px-0.5">Rewards & points</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate ? onNavigate('referral-system') : (window.location.href = '/referrals')
              }
              className={`${gridTileClass} bg-stone-50/80 hover:bg-stone-100/90`}
            >
              <span className="text-2xl">👥</span>
              <span className="text-[10px] text-center text-gray-600 leading-tight px-0.5">Refer & Earn</span>
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('promotions');
                  return;
                }
                if (typeof window !== 'undefined') {
                  rememberPromotionsBackFromCurrentUrl();
                  window.location.href = '/promotions';
                }
              }}
              className={`${gridTileClass} bg-stone-50/80 hover:bg-stone-100/90`}
            >
              <span className="text-2xl">🎁</span>
              <span className="text-[10px] text-center text-gray-600 leading-tight px-0.5">Offers</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate('support_help');
                  return;
                }
                if (typeof window !== 'undefined') {
                  rememberHelpBackFromCurrentUrl();
                  window.location.href = '/help';
                }
              }}
              className={`${gridTileClass} bg-stone-50/80 hover:bg-stone-100/90`}
            >
              <span className="text-2xl">❓</span>
              <span className="text-[10px] text-center text-gray-600 leading-tight px-0.5">Help</span>
            </button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-bold text-gray-900">Transaction History</h2>
          <select
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 min-h-[44px] bg-white text-gray-800 font-medium shrink-0"
            aria-label="Filter transactions"
          >
            <option value="all">All</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-10 px-4 bg-white rounded-2xl border border-stone-200/90 shadow-sm">
            <span className="text-5xl" aria-hidden>
              💳
            </span>
            <h3 className="mt-4 text-base font-bold text-gray-900">No transactions yet</h3>
            <p className="text-gray-500 text-sm mt-1">Your wallet transactions will appear here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y">
              {transactions.map((txn) => (
                <div key={txn.id} className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                    txn.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {getTransactionIcon(txn.type, txn.reference_type)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{txn.description}</p>
                    <p className="text-sm text-gray-500">{new Date(txn.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                    </p>
                    <p className={`text-xs ${
                      txn.status === 'completed' ? 'text-green-600' :
                      txn.status === 'pending' ? 'text-yellow-600' : 'text-gray-500'
                    }`}>
                      {txn.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top-up Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 pr-2">Add Money to Wallet</h3>
              <button
                type="button"
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Minimum ₹100)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={topUpAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-base"
              />
            </div>

            <div className="grid grid-cols-4 gap-2 mb-5">
              {[100, 500, 1000, 2000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setTopUpAmount(amount.toString())}
                  className={`px-2 py-2.5 min-h-[44px] rounded-xl border text-sm font-semibold ${
                    topUpAmount === amount.toString()
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  ₹{amount}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="flex-1 px-4 py-3 min-h-[48px] border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                disabled={processingTopUp}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTopUp}
                disabled={processingTopUp || !topUpAmount || parseFloat(topUpAmount) < 100}
                className="flex-1 px-4 py-3 min-h-[48px] bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {processingTopUp ? 'Processing...' : `Add ₹${topUpAmount || '0'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
