'use client';

import React, { useState } from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';
import { OverviewTab } from './analytics/OverviewTab';
import { VendorAnalyticsTab } from './analytics/VendorAnalyticsTab';
import { CustomerAnalyticsTab } from './analytics/CustomerAnalyticsTab';

interface AnalyticsDashboardProps {
  onBack?: () => void;
}

export function AnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'customers'>('overview');

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
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
              <p className="text-sm text-gray-500">Platform insights</p>
            </div>
          </div>
        </div>
        <div className="flex border-t border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'vendors' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Vendors
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'customers' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'
            }`}
          >
            Customers
          </button>
        </div>
      </div>
      <div className="p-4">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'vendors' && <VendorAnalyticsTab />}
        {activeTab === 'customers' && <CustomerAnalyticsTab />}
      </div>
    </div>
  );
}

