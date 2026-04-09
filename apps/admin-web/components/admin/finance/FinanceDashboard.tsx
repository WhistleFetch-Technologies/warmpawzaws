'use client';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger, Card } from '@warmpawz/ui';
import { 
  IndianRupee, 
  CreditCard, 
  Receipt, 
  Calendar, 
  Settings,
  TrendingUp,
  Wallet,
  FileText,
  RefreshCw
} from 'lucide-react';

// Import all finance components
import { AdminPaymentSettings } from './paymentGateway/AdminPaymentSettings';
import { RefundPoliciesSection } from './refundPolicies/RefundPoliciesSection';
import { CancellationPolicyManagement } from './cancellationPolicy/CancellationPolicyManagement';
import { GSTConfigurationManagement } from './gstConfig/GSTConfigurationManagement';
import { SettlementScheduleSettings } from './scheduleSettings/SettlementScheduleSettings';
import { DynamicSettlementRulesManager } from './settlementRules/DynamicSettlementRulesManager';
import { SettlementDashboard } from './settlements/SettlementDashboard';
import { PayoutManagement } from './payoutManagement/PayoutManagement';
import { TierManagement } from './tierManagement/TierManagement';
import { TransactionsTab } from './TransactionsTab';
import { PaymentsTab } from './PaymentsTab';
import { SettlementsTab } from './SettlementsTab';

/**
 * Unified Finance Dashboard
 * Consolidates all finance-related functionality into a single dashboard with tabs
 * 
 * This replaces the need for multiple separate finance components and provides:
 * - Centralized finance management
 * - Consistent UI/UX
 * - Complete CRUD operations
 * - Better organization
 */
export function FinanceDashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Finance & Payments</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage payments, settlements, taxes, refunds, and financial configurations
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Overview</span>
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Transactions</span>
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Payments</span>
                </TabsTrigger>
                <TabsTrigger value="settlements" className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">Settlements</span>
                </TabsTrigger>
                <TabsTrigger value="payouts" className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4" />
                  <span className="hidden sm:inline">Payouts</span>
                </TabsTrigger>
                <TabsTrigger value="taxes" className="flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  <span className="hidden sm:inline">Taxes</span>
                </TabsTrigger>
                <TabsTrigger value="refunds" className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Refunds</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-blue-500 text-white p-3 rounded-lg">
                        <IndianRupee className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">₹0</h3>
                    <p className="text-sm text-gray-500">Total Revenue</p>
                  </Card>
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-green-500 text-white p-3 rounded-lg">
                        <Wallet className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">₹0</h3>
                    <p className="text-sm text-gray-500">Pending Settlements</p>
                  </Card>
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-orange-500 text-white p-3 rounded-lg">
                        <Receipt className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">0</h3>
                    <p className="text-sm text-gray-500">Pending Refunds</p>
                  </Card>
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-purple-500 text-white p-3 rounded-lg">
                        <CreditCard className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">0</h3>
                    <p className="text-sm text-gray-500">Active Gateways</p>
                  </Card>
                </div>
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                      onClick={() => setActiveTab('settlements')}
                      className="p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-left"
                    >
                      <Wallet className="w-5 h-5 mb-2 text-orange-500" />
                      <p className="font-medium">Process Settlements</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('refunds')}
                      className="p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-left"
                    >
                      <RefreshCw className="w-5 h-5 mb-2 text-orange-500" />
                      <p className="font-medium">Manage Refunds</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('taxes')}
                      className="p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-left"
                    >
                      <Receipt className="w-5 h-5 mb-2 text-orange-500" />
                      <p className="font-medium">Configure Taxes</p>
                    </button>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="p-4 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-left"
                    >
                      <Settings className="w-5 h-5 mb-2 text-orange-500" />
                      <p className="font-medium">Payment Settings</p>
                    </button>
                  </div>
                </Card>
              </TabsContent>

              {/* Transactions Tab */}
              <TabsContent value="transactions">
                <TransactionsTab />
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments">
                <PaymentsTab />
              </TabsContent>

              {/* Settlements Tab */}
              <TabsContent value="settlements">
                <SettlementDashboard />
              </TabsContent>

              {/* Payouts Tab */}
              <TabsContent value="payouts">
                <PayoutManagement />
              </TabsContent>

              {/* Taxes Tab */}
              <TabsContent value="taxes" className="space-y-6">
                <GSTConfigurationManagement />
              </TabsContent>

              {/* Refunds Tab */}
              <TabsContent value="refunds" className="space-y-6">
                <RefundPoliciesSection />
                <CancellationPolicyManagement />
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <AdminPaymentSettings />
                <SettlementScheduleSettings />
                <DynamicSettlementRulesManager />
                <TierManagement />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
