import { useState } from 'react';
import { DollarSign, TrendingUp, Receipt, FileText, Wallet, BarChart3, Layers, Settings } from 'lucide-react';
import { PayoutManagement } from './PayoutManagement';
import { TierManagement } from './TierManagement';
import { SettlementDashboard } from './SettlementDashboard';
import { AdminPaymentSettings } from './AdminPaymentSettings';

interface FinanceManagementProps {
  onBack?: () => void;
}

type TabType = 'dashboard' | 'payouts' | 'settlements' | 'tiers' | 'settings' | 'reports';

export function FinanceManagement({ onBack }: FinanceManagementProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'settlements', label: 'Settlements', icon: Receipt },
    { id: 'payouts', label: 'Payout Management', icon: Wallet },
    { id: 'tiers', label: 'Tiers', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'reports', label: 'Reports', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {onBack && (
                <button
                  onClick={onBack}
                  className="text-gray-600 hover:text-gray-900 mb-2 flex items-center gap-1"
                >
                  ← Back to Admin
                </button>
              )}
              <h1 className="text-black">Finance & Logistics</h1>
              <p className="text-gray-500 text-sm mt-1">Manage payouts, settlements, and financial reporting</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Live
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#FF8C42] text-[#FF8C42]'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Pending Payouts</span>
                  <Wallet className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-2xl font-semibold text-gray-900">₹45,230</div>
                <div className="text-xs text-gray-500 mt-1">23 vendors awaiting settlement</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">This Month</span>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-2xl font-semibold text-gray-900">₹2,34,500</div>
                <div className="text-xs text-gray-500 mt-1">+18% from last month</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Platform Commission</span>
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-semibold text-gray-900">₹35,175</div>
                <div className="text-xs text-gray-500 mt-1">15% average commission</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Completed Payouts</span>
                  <Receipt className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-2xl font-semibold text-gray-900">156</div>
                <div className="text-xs text-gray-500 mt-1">This month</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Finance & Payout Hub</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage vendor settlements, commission calculations, and financial reporting from a single dashboard.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setActiveTab('settlements')} className="bg-[#FF8C42] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#FF7A2E] transition-colors">
                      Go to Settlements
                    </button>
                    <button onClick={() => setActiveTab('tiers')} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                      Manage Tiers
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settlements' && <SettlementDashboard />}
        {activeTab === 'payouts' && <PayoutManagement />}
        {activeTab === 'tiers' && <TierManagement />}
        {activeTab === 'settings' && <AdminPaymentSettings />}

        {activeTab === 'reports' && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Financial Reports</h3>
            <p className="text-gray-600 mb-6">
              Advanced reporting and analytics features are coming soon. You'll be able to generate comprehensive financial reports, analyze revenue trends, and export data for accounting.
            </p>
            <button className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium cursor-not-allowed">
              Coming Soon
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
