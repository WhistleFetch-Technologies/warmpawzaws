/**
 * Logistics Management Component
 * 
 * Main component for logistics management in Finance & Logistics tab
 * Follows existing design philosophy and UI migration patterns
 */

'use client';

import { useState } from 'react';
import { LogisticsPartnersManager } from './LogisticsPartnersManager';
import { LogisticsRulesManager } from './LogisticsRulesManager';
import { CustomerDeliveryFeePolicyManager } from './CustomerDeliveryFeePolicyManager';

type TabType = 'partners' | 'rules' | 'customerFees';

export function LogisticsManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('partners');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Logistics Management</h2>
        <p className="text-gray-600">
          Configure logistics partners and delivery rules for order fulfillment
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('partners')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'partners'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Logistics Partners
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rules'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Delivery Rules
            </button>
            <button
              onClick={() => setActiveTab('customerFees')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'customerFees'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Customer delivery fees
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'partners' && <LogisticsPartnersManager />}
          {activeTab === 'rules' && <LogisticsRulesManager />}
          {activeTab === 'customerFees' && <CustomerDeliveryFeePolicyManager />}
        </div>
      </div>
    </div>
  );
}

