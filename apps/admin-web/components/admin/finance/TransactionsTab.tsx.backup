'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Receipt, Loader2 } from 'lucide-react';

interface Transaction {
  id: string;
  type: 'debit' | 'credit';
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/finance/transactions');
      if (response.success && response.transactions) {
        setTransactions(response.transactions);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <div key={transaction.id} className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-gray-400" />
                <span className={`font-semibold ${
                  transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'credit' ? '+' : '-'}{transaction.currency} {transaction.amount.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600">{transaction.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

