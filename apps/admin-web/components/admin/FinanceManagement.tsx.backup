'use client';

import React, { useState } from 'react';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { PaymentsTab } from './finance/PaymentsTab';
import { SettlementsTab } from './finance/SettlementsTab';
import { TransactionsTab } from './finance/TransactionsTab';

interface FinanceManagementProps {
  onBack?: () => void;
}

export function FinanceManagement({ onBack }: FinanceManagementProps) {
  const [activeTab, setActiveTab] = useState<'payments' | 'settlements' | 'transactions'>('payments');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-3 text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Finance</h1>
              <p className="text-sm text-gray-500">Financial management</p>
            </div>
          </div>
        </div>
        <div className="flex border-t border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'payments' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settlements' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Settlements
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'transactions' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Transactions
          </button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'settlements' && <SettlementsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
      </div>
    </div>
  );
}

