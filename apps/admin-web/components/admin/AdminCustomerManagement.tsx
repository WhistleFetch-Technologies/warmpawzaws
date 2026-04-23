'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Bell,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  UserX,
  Users,
  HeadphonesIcon,
  ClipboardList,
} from 'lucide-react';
import { Button, Card } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';
import { CustomerQualityAlertsPanel } from './CustomerQualityAlertsPanel';
import { CustomerFraudDetection } from './CustomerFraudDetection';
import { CustomerActivityTracker } from './CustomerActivityTracker';
import { CustomerInsightsDashboard } from './CustomerInsightsDashboard';
import { ActiveCustomersTab } from './ActiveCustomersTab';
import { DeactivatedCustomersTab } from './DeactivatedCustomersTab';
import { CustomerDeactivationRequestsTab } from './CustomerDeactivationRequestsTab';
import { CustomerComplianceIssuesTab } from './CustomerComplianceIssuesTab';

interface CustomerStats {
  activeCustomers: { count: number; percentage: number };
  pendingApplications: { count: number; todayCount: number };
  complianceIssues: { count: number; highPriority: number };
  supportTickets: { total: number; open: number };
  distribution: { active: number; deactivated: number; pending: number };
}

interface AdminCustomerManagementProps {
  onNavigate?: (view: string) => void;
}

export function AdminCustomerManagement({ onNavigate }: AdminCustomerManagementProps = {}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'active-customers' | 'deactivated-customers' | 'insights' | 'deactivation' | 'compliance'
  >('overview');
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const statsData = await apiClient.get<any>('/admin/customers/stats');
      const rawStats = statsData.stats ?? statsData.data ?? statsData;

      setStats({
        activeCustomers: rawStats.activeCustomers || { count: 0, percentage: 0 },
        pendingApplications: rawStats.pendingApplications || { count: 0, todayCount: 0 },
        complianceIssues: rawStats.complianceIssues || { count: 0, highPriority: 0 },
        supportTickets: rawStats.supportTickets || { total: 0, open: 0 },
        distribution: rawStats.distribution || { active: 0, deactivated: 0, pending: 0 },
      });
    } catch (error) {
      console.error('Error loading customer admin data:', error);
      setStats({
        activeCustomers: { count: 0, percentage: 0 },
        pendingApplications: { count: 0, todayCount: 0 },
        complianceIssues: { count: 0, highPriority: 0 },
        supportTickets: { total: 0, open: 0 },
        distribution: { active: 0, deactivated: 0, pending: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <UnifiedAdminSidebar
        activeView="customer-admin"
        onNavigate={(view) => {
          if (onNavigate) onNavigate(view);
        }}
      />

      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 flex-1">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-[#FF8C42] to-[#FF7A2E] bg-clip-text text-transparent">
                    Customer Administration
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">Customer lifecycle, risk signals, and compliance</p>
                </div>

                <div className="flex-1 max-w-lg relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Use search on Active / Deactivated tabs…"
                    className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent transition-all bg-gray-50"
                    disabled
                    aria-disabled="true"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={loadData} className="border-gray-300 hover:bg-gray-50">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <button
                  type="button"
                  onClick={() => router.push('/notifications')}
                  className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors relative"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/notifications')}
                  className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
                  title="Messages"
                >
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {stats && (
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <Card className="p-5 border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-green-400 to-green-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  {typeof stats.activeCustomers?.percentage === 'number' && stats.activeCustomers.percentage > 0 ? (
                    <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
                      {stats.activeCustomers.percentage}% active
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Active customers</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.activeCustomers?.count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.distribution?.deactivated ?? 0} deactivated</p>
                </div>
              </Card>

              <Card className="p-5 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full">
                    +{stats.pendingApplications?.todayCount ?? 0} new today
                  </span>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Pending deactivation queue</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingApplications?.count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
                </div>
              </Card>

              <Card className="p-5 border-2 border-red-200 bg-gradient-to-br from-red-50 to-white shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-red-400 to-red-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-6 h-6 text-white" />
                  </div>
                  {stats.complianceIssues?.highPriority ? (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full animate-pulse">
                      {stats.complianceIssues.highPriority} urgent
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Compliance issues</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.complianceIssues?.count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.complianceIssues?.highPriority ?? 0} high priority</p>
                </div>
              </Card>

              <Card className="p-5 border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <HeadphonesIcon className="w-6 h-6 text-white" />
                  </div>
                  {stats.supportTickets?.open ? (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
                      {stats.supportTickets.open} open
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Support tickets</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.supportTickets?.total ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.supportTickets?.open ?? 0} open</p>
                </div>
              </Card>
            </div>

            <div className="mb-6">
              <CustomerQualityAlertsPanel
                onViewCustomer={() => setActiveTab('active-customers')}
                maxAlerts={5}
              />
            </div>
          </div>
        )}

        <div className="px-6 mb-6">
          <div className="flex gap-0 border-b border-gray-200 overflow-x-auto -mb-px">
            {[
              { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
              { id: 'active-customers' as const, label: 'Active customers', icon: Users },
              { id: 'deactivated-customers' as const, label: 'Deactivated', icon: UserX },
              { id: 'insights' as const, label: 'Insights', icon: TrendingUp },
              { id: 'deactivation' as const, label: 'Deactivation', icon: UserX },
              { id: 'compliance' as const, label: 'Compliance', icon: AlertTriangle },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                  activeTab === id
                    ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CustomerFraudDetection />
                <CustomerActivityTracker />
              </div>
            </div>
          )}
          {activeTab === 'active-customers' && <ActiveCustomersTab />}
          {activeTab === 'deactivated-customers' && <DeactivatedCustomersTab />}
          {activeTab === 'insights' && <CustomerInsightsDashboard />}
          {activeTab === 'deactivation' && <CustomerDeactivationRequestsTab />}
          {activeTab === 'compliance' && <CustomerComplianceIssuesTab />}
        </div>
      </div>
    </div>
  );
}
