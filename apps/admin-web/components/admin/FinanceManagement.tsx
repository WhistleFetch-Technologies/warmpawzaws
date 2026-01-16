'use client';

import React, { useState } from 'react';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { PaymentsTab } from './finance/PaymentsTab';
import { SettlementsTab } from './finance/SettlementsTab';
import { TransactionsTab } from './finance/TransactionsTab';
import { TaxManagement } from './finance/TaxManagement';
import { LogisticsManagement } from './finance/LogisticsManagement';
import { PaymentGatewayManagement } from './finance/PaymentGatewayManagement';

interface FinanceManagementProps {
  onBack?: () => void;
}

export function FinanceManagement({ onBack }: FinanceManagementProps) {
  const [activeTab, setActiveTab] = useState<'payments' | 'settlements' | 'transactions' | 'tax' | 'logistics' | 'payment-gateways'>('payments');

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          {onBack && (
            <button onClick={onBack} className="mb-0 text-gray-600 hover:text-gray-900 flex items-center gap-3">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <div className="p-0 bg-orange-100 rounded-lg">
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
            className={`flex-shrink-0 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'payments' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Payments
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`flex-shrink-0 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settlements' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Settlements
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-shrink-0 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'transactions' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('tax')}
            className={`flex-shrink-0 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tax' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Tax Management
          </button>
          <button
            onClick={() => setActiveTab('logistics')}
            className={`flex-shrink-0 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logistics' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Logistics
          </button>
          <button
            onClick={() => setActiveTab('payment-gateways')}
            className={`flex-shrink-0 px-4 py-0 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'payment-gateways' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Payment Gateways
          </button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'payments' && <PaymentsTab />}
        {activeTab === 'settlements' && <SettlementsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {activeTab === 'tax' && <TaxManagement />}
        {activeTab === 'logistics' && <LogisticsManagement />}
        {activeTab === 'payment-gateways' && <PaymentGatewayManagement />}
      </div>
    </div>
  );
}

