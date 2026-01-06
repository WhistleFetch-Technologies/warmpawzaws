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
}

export function CustomerWallet({ customerPhone }: CustomerWalletProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadWalletData();
  }, [customerPhone]);

  useEffect(() => {
    loadTransactions();
  }, [customerPhone, filter]);

  const loadWalletData = async () => {
    try {
      // First get customer ID from phone
      const customerResponse = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerResponse.customer?.id;
      
      if (!customerId) {
        console.error('Customer not found');
        return;
      }

      // Then get wallet using customer ID
      const response = await apiClient.get<any>(`/wallet/${customerId}`);
      if (response.success && response.data) {
        setWallet({
          balance: response.data.balance || 0,
          pending_credits: 0,
          total_earned: 0,
          total_spent: 0,
        });
      }
    } catch (err) {
      console.error('Error loading wallet:', err);
      // Fallback: try old endpoint
      try {
        const response = await apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`);
        if (response.wallet) {
          setWallet(response.wallet);
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
      if (response.success && response.data) {
        setTransactions(response.data.transactions || []);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      // Fallback: try old endpoint
      try {
        const params = filter !== 'all' ? `&type=${filter}` : '';
        const response = await apiClient.get<any>(`/customer/wallet/transactions?phone=${encodeURIComponent(customerPhone)}${params}`);
        if (response.transactions) {
          setTransactions(response.transactions);
        }
      } catch (fallbackErr) {
        console.error('Fallback transactions load failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string, refType?: string) => {
    if (type === 'credit') {
      switch (refType) {
        case 'refund': return '💸';
        case 'cashback': return '🎁';
        case 'referral': return '👥';
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <a href="/" className="text-2xl">←</a>
          <h1 className="text-xl font-bold">My Wallet</h1>
        </div>

        {/* Balance Card */}
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6">
            <p className="text-white/80 text-sm">Available Balance</p>
            <p className="text-4xl font-bold mt-1">₹{wallet?.balance?.toLocaleString() || '0'}</p>
            
            {wallet?.pending_credits && wallet.pending_credits > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-white/80">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
                ₹{wallet.pending_credits.toLocaleString()} pending
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-white/70">Total Earned</p>
                <p className="text-lg font-semibold">₹{wallet?.total_earned?.toLocaleString() || '0'}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-white/70">Total Spent</p>
                <p className="text-lg font-semibold">₹{wallet?.total_spent?.toLocaleString() || '0'}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Actions */}
      <div className="max-w-4xl mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 overflow-x-auto">
          <a href="/offers" className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-xl min-w-[80px]">
            <span className="text-2xl">🎁</span>
            <span className="text-xs text-gray-600 mt-1">Offers</span>
          </a>
          <a href="/referral" className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-xl min-w-[80px]">
            <span className="text-2xl">👥</span>
            <span className="text-xs text-gray-600 mt-1">Refer & Earn</span>
          </a>
          <a href="/help" className="flex flex-col items-center p-3 hover:bg-gray-50 rounded-xl min-w-[80px]">
            <span className="text-2xl">❓</span>
            <span className="text-xs text-gray-600 mt-1">Help</span>
          </a>
        </div>
      </div>

      {/* Transactions */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Transaction History</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2"
          >
            <option value="all">All</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl">
            <span className="text-6xl">💳</span>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No transactions yet</h3>
            <p className="text-gray-500 mt-2">Your wallet transactions will appear here</p>
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
      </main>
    </div>
  );
}

