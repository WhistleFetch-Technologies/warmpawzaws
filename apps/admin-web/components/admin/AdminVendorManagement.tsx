'use client';

import { useState, useEffect } from 'react';
import { 
  Search, Bell, MessageSquare, User, Plus, RefreshCw, TrendingUp, 
  AlertTriangle, Shield, BarChart3, Calendar, IndianRupee, FileText, 
  Send, Download, Check, X, Eye, Phone, Grid3x3, Package, Megaphone, 
  HeadphonesIcon, ClipboardList, Newspaper, PawPrint, Wallet, Users, Settings, MessageCircle, CheckCircle, Globe, ShoppingCart, UserX
} from 'lucide-react';
import { Button, Card, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { DeactivationRequestsTab } from './DeactivationRequestsTab';
import { ReverificationTab } from './ReverificationTab';
import { ComplianceIssuesTab } from './ComplianceIssuesTab';
import { EnhancedPendingApplicationsTab } from './EnhancedPendingApplicationsTab';
import { ActiveVendorsTab } from './ActiveVendorsTab';
import { AddVendorModal } from './AddVendorModal';
import { QualityAlertsPanel } from './QualityAlertsPanel';
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';
import { VendorInsightsDashboard } from './VendorInsightsDashboard';
import { VendorActivityTracker } from './VendorActivityTracker';
import { VendorFraudDetection } from './VendorFraudDetection';

interface VendorStats {
  activeVendors: { count: number; percentage: number };
  pendingApplications: { count: number; todayCount: number };
  complianceIssues: { count: number; highPriority: number };
  supportTickets: { total: number; open: number };
  distribution: { active: number; deactivated: number; pending: number };
}

interface AdminVendorManagementProps {
  onNavigate?: (view: string) => void;
}

export function AdminVendorManagement({ onNavigate }: AdminVendorManagementProps = {}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'deactivation' | 'reverification' | 'compliance' | 'active-vendors' | 'insights'>('overview');
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddVendor, setShowAddVendor] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const statsData = await apiClient.get<any>('/admin/vendors/stats');
      // The API response shape varies across handlers; be defensive:
      const rawStats = statsData.stats ?? statsData.data ?? statsData;
      
      // Ensure all required fields exist with defaults
      setStats({
        activeVendors: rawStats.activeVendors || { count: 0, percentage: 0 },
        pendingApplications: rawStats.pendingApplications || { count: 0, todayCount: 0 },
        complianceIssues: rawStats.complianceIssues || { count: 0, highPriority: 0 },
        supportTickets: rawStats.supportTickets || { total: 0, open: 0 },
        distribution: rawStats.distribution || { active: 0, deactivated: 0, pending: 0 },
      });
    } catch (error) {
      console.error('Error loading data:', error);
      // Set default stats on error to prevent crash
      setStats({
        activeVendors: { count: 0, percentage: 0 },
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
        activeView="vendor-admin" 
        onNavigate={(view) => {
          if (onNavigate) onNavigate(view);
        }} 
      />

      <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 to-white">
        {/* Enhanced Top Bar */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 flex-1">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-[#FF8C42] to-[#FF7A2E] bg-clip-text text-transparent">
                    Vendor Administration
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">Complete vendor lifecycle management & insights</p>
                </div>

                <div className="flex-1 max-w-lg relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search vendors, applications, or activities..."
                    className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const data = await apiClient.get<any>('/admin/vendors?limit=5000');
                      const list = data.vendors ?? data.data ?? Array.isArray(data) ? data : [];
                      const csv = ['Business Name,Owner,Email,Status,Role'].concat(
                        list.map((v: any) => [v.business_name ?? v.businessName ?? '', v.owner_name ?? v.ownerName ?? '', v.email ?? '', v.status ?? '', v.role ?? v.role_id ?? ''].join(','))
                      ).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `vendors-export-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#FF8C42] to-[#FF7A2E] hover:from-[#FF7A2E] hover:to-[#FF6B1A] text-white shadow-md hover:shadow-lg transition-all"
                  onClick={() => setShowAddVendor(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vendor
                </Button>
                <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors relative">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <button className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors">
                  <MessageSquare className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        {stats && (
          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
              <Card className="p-5 border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-green-400 to-green-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +12%
                  </span>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Active Vendors</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.activeVendors?.count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.activeVendors?.percentage ?? 0}% of total</p>
                </div>
              </Card>

              <Card className="p-5 border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-md hover:shadow-lg transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                    <ClipboardList className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full">
                    +{stats.pendingApplications?.todayCount ?? 0} today
                  </span>
                </div>
                <div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Pending Applications</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.pendingApplications?.count ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
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
                  <p className="text-gray-600 text-sm font-medium mb-1">Compliance Issues</p>
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
                  <p className="text-gray-600 text-sm font-medium mb-1">Support Tickets</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.supportTickets?.total ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.supportTickets?.open ?? 0} open tickets</p>
                </div>
              </Card>
            </div>

            {/* Quality Alerts Panel - Enhanced */}
            <div className="mb-6">
              <QualityAlertsPanel 
                onViewVendor={(vendorId) => {
                  setActiveTab('active-vendors');
                }}
                maxAlerts={5}
              />
            </div>
          </div>
        )}

        {/* ✅ FIX: Enhanced Tabs with thicker border for better visual hierarchy */}
        <div className="px-6 mb-6">
          <div className="flex gap-0 border-b border-gray-200 overflow-x-auto -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Overview
              </div>
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'applications'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Applications
              </div>
            </button>
            <button
              onClick={() => setActiveTab('active-vendors')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'active-vendors'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Active Vendors
              </div>
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'insights'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Insights
              </div>
            </button>
            <button
              onClick={() => setActiveTab('deactivation')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'deactivation'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <UserX className="w-4 h-4" />
                Deactivation
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reverification')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'reverification'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Reverification
              </div>
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`px-5 py-3 text-sm font-medium border-b-[3px] transition-all whitespace-nowrap ${
                activeTab === 'compliance'
                  ? 'border-[#FF8C42] text-[#FF8C42] bg-orange-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Compliance
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Fraud Detection & Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <VendorFraudDetection />
                <VendorActivityTracker />
              </div>
            </div>
          )}
          {activeTab === 'applications' && (
            <EnhancedPendingApplicationsTab />
          )}
          {activeTab === 'active-vendors' && (
            <ActiveVendorsTab />
          )}
          {activeTab === 'insights' && (
            <VendorInsightsDashboard />
          )}
          {activeTab === 'deactivation' && (
            <DeactivationRequestsTab />
          )}
          {activeTab === 'reverification' && (
            <ReverificationTab />
          )}
          {activeTab === 'compliance' && (
            <ComplianceIssuesTab />
          )}
        </div>
      </div>

      {/* Add Vendor Modal */}
      {showAddVendor && (
        <AddVendorModal
          isOpen={showAddVendor}
          onClose={() => setShowAddVendor(false)}
          onSuccess={() => {
            loadData();
            setShowAddVendor(false);
          }}
        />
      )}
    </div>
  );
}

