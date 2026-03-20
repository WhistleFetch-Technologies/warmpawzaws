'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

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

  const normalizeWalletResponse = (response: any): WalletData | null => {
    if (!response) return null;
    const data = response.data || response.wallet || response;
    if (!data) return null;

    return {
      balance: Number(data.balance ?? data.currentBalance ?? data.walletBalance ?? 0),
      pending_credits: Number(data.pending_credits ?? data.pendingCredits ?? 0),
      total_earned: Number(data.total_earned ?? data.totalEarned ?? 0),
      total_spent: Number(data.total_spent ?? data.totalSpent ?? 0),
    };
  };

  const normalizeTransactionsResponse = (response: any): Transaction[] => {
    if (!response) return [];
    const data = response.data || response;
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

      // Then get wallet using customer ID
      const response = await apiClient.get<any>(`/wallet/${id}`);
      const normalized = normalizeWalletResponse(response);
      if (normalized) {
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

    if (!customerId) {
      alert('Customer not found. Please refresh the page.');
      return;
    }

    setProcessingTopUp(true);
    try {
      // Create Razorpay order
      const orderResponse = await apiClient.post<any>('/razorpay/create-order', {
        bookingId: null, // Wallet top-up doesn't need booking
        amount: amount,
        currency: 'INR',
        customerId: customerId,
      });

      if (!orderResponse.orderId) {
        throw new Error('Failed to create payment order');
      }

      // Initialize Razorpay checkout
      const options = {
        key: orderResponse.keyId,
        amount: orderResponse.amount * 100, // Convert to paise
        currency: orderResponse.currency,
        name: 'Warmpawz',
        description: `Wallet Top-up of ₹${amount}`,
        order_id: orderResponse.orderId,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await apiClient.post<any>('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyResponse.success) {
              // Credit wallet
              await apiClient.post<any>(`/wallet/${customerId}/credit`, {
                amount: amount,
                referenceType: 'topup',
                referenceId: response.razorpay_payment_id,
                description: `Wallet top-up via Razorpay`,
              });

              // Reload wallet data
              await loadWalletData();
              await loadTransactions();
              
              setShowTopUpModal(false);
              setTopUpAmount('');
              alert('Wallet topped up successfully!');
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (error: any) {
            console.error('Error processing top-up:', error);
            alert('Failed to process top-up. Please contact support.');
          } finally {
            setProcessingTopUp(false);
          }
        },
        prefill: {
          contact: customerPhone,
        },
        theme: {
          color: '#F97316', // Orange primary color
        },
        modal: {
          ondismiss: () => {
            setProcessingTopUp(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Error initiating top-up:', error);
      alert('Failed to initiate top-up. Please try again.');
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

  return (
    <div>
      {/* Balance Card */}
      <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="text-gray-600 text-sm mb-2">Available Balance</p>
            <p className="text-4xl font-bold text-gray-900">₹{wallet?.balance?.toLocaleString() || '0'}</p>
            
            {wallet?.pending_credits && wallet.pending_credits > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-orange-600">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                ₹{wallet.pending_credits.toLocaleString()} pending
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-xs text-gray-600">Total Earned</p>
                <p className="text-lg font-semibold text-gray-900">₹{wallet?.total_earned?.toLocaleString() || '0'}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-xs text-gray-600">Total Spent</p>
                <p className="text-lg font-semibold text-gray-900">₹{wallet?.total_spent?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </div>
        </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 overflow-x-auto">
          <button
            onClick={() => setShowTopUpModal(true)}
            className="flex flex-col items-center p-0 hover:bg-orange-50 rounded-xl min-w-[80px] border-2 border-orange-500 bg-orange-50"
          >
            <span className="text-2xl">💳</span>
            <span className="text-xs text-gray-600 mt-0 font-semibold">Add Money</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('rewards-loyalty') : (window.location.href = '/rewards')}
            className="flex flex-col items-center p-0 hover:bg-gray-50 rounded-xl min-w-[80px]"
          >
            <span className="text-2xl">⭐</span>
            <span className="text-xs text-gray-600 mt-0">Rewards & points</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate ? onNavigate('referral-system') : (window.location.href = '/referrals')}
            className="flex flex-col items-center p-0 hover:bg-gray-50 rounded-xl min-w-[80px]"
          >
            <span className="text-2xl">👥</span>
            <span className="text-xs text-gray-600 mt-0">Refer & Earn</span>
          </button>
          <a href="/offers" className="flex flex-col items-center p-0 hover:bg-gray-50 rounded-xl min-w-[80px]">
            <span className="text-2xl">🎁</span>
            <span className="text-xs text-gray-600 mt-0">Offers</span>
          </a>
          <a href="/help" className="flex flex-col items-center p-0 hover:bg-gray-50 rounded-xl min-w-[80px]">
            <span className="text-2xl">❓</span>
            <span className="text-xs text-gray-600 mt-0">Help</span>
          </a>
        </div>
      </div>

      {/* Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          <select
            value={filter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
            className="text-sm border rounded-lg px-0 py-0"
          >
            <option value="all">All</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-02">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-02 bg-white rounded-2xl">
            <span className="text-6xl">💳</span>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No transactions yet</h3>
            <p className="text-gray-500 mt-0">Your wallet transactions will appear here</p>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-0 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Add Money to Wallet</h3>
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Amount (Minimum ₹100)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                value={topUpAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {[100, 500, 1000, 2000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTopUpAmount(amount.toString())}
                  className={`px-4 py-0 rounded-lg border ${
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
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount('');
                }}
                className="flex-1 px-4 py-1 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processingTopUp}
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={processingTopUp || !topUpAmount || parseFloat(topUpAmount) < 100}
                className="flex-1 px-4 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
