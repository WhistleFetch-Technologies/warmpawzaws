'use client';

import { useState, useEffect } from 'react';
import { 
  Search, Bell, MessageSquare, User, Plus, RefreshCw, TrendingUp, 
  AlertTriangle, Shield, BarChart3, Calendar, DollarSign, FileText, 
  Send, Download, Check, X, Eye, Phone, Grid3x3, Package, Megaphone, 
  HeadphonesIcon, ClipboardList, Newspaper, PawPrint, Wallet, Users, Settings, MessageCircle, CheckCircle, Globe, ShoppingCart 
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
  const [activeTab, setActiveTab] = useState<'applications' | 'deactivation' | 'reverification' | 'compliance' | 'active-vendors'>('applications');
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
      setStats(statsData.stats ?? statsData.data ?? statsData);
    } catch (error) {
      console.error('Error loading data:', error);
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

      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b px-0 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div>
                <h1 className="text-[#FF8C42] text-xl font-bold">Vendor Administration</h1>
                <p className="text-xs text-gray-500">Complete vendor lifecycle management</p>
              </div>

              <div className="flex-1 max-w-md relative ml-8">
                <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search vendors..."
                  className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-0">
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-0" />
                Refresh
              </Button>
              <Button size="sm" className="bg-[#FF8C42] hover:bg-[#FF7A2E]" onClick={() => setShowAddVendor(true)}>
                <Plus className="w-4 h-4 mr-0" />
                Add Vendor
              </Button>
              <button className="p-0 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-0 hover:bg-gray-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="px-0 py-4">
            <div className="grid grid-cols-4 gap-4 mb-4">
              <Card className="p-4 border-green-200 bg-green-50/50">
                <div className="flex items-start justify-between mb-0">
                  <div className="p-0 bg-green-100 rounded-lg">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-xs text-green-600 bg-green-100 px-0 py-0 rounded">+12%</span>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-0">Active Vendors</p>
                  <p className="text-2xl font-bold">{stats.activeVendors.count}</p>
                </div>
              </Card>

              <Card className="p-4 border-orange-200 bg-orange-50/50">
                <div className="flex items-start justify-between mb-0">
                  <div className="p-0 bg-orange-100 rounded-lg">
                    <ClipboardList className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="text-xs text-orange-600 bg-orange-100 px-0 py-0 rounded">+{stats.pendingApplications.todayCount} today</span>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-0">Pending Applications</p>
                  <p className="text-2xl font-bold">{stats.pendingApplications.count}</p>
                </div>
              </Card>

              <Card className="p-4 border-red-200 bg-red-50/50">
                <div className="flex items-start justify-between mb-0">
                  <div className="p-0 bg-red-100 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-0">Compliance Issues</p>
                  <p className="text-2xl font-bold">{stats.complianceIssues.count}</p>
                  <p className="text-xs text-gray-500 mt-0">{stats.complianceIssues.highPriority} high priority</p>
                </div>
              </Card>

              <Card className="p-4 border-blue-200 bg-blue-50/50">
                <div className="flex items-start justify-between mb-0">
                  <div className="p-0 bg-blue-100 rounded-lg">
                    <HeadphonesIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-0">Support Tickets</p>
                  <p className="text-2xl font-bold">{stats.supportTickets.total}</p>
                  <p className="text-xs text-gray-500 mt-0">{stats.supportTickets.open} open</p>
                </div>
              </Card>
            </div>

            {/* Quality Alerts Panel - Attention Queue */}
            <div className="mb-4">
              <QualityAlertsPanel 
                onViewVendor={(vendorId) => {
                  setActiveTab('active-vendors');
                  // TODO: Scroll to or highlight vendor in active vendors tab
                }}
                maxAlerts={5}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-0 mb-4">
          <div className="flex gap-0 border-b">
            <button
              onClick={() => setActiveTab('applications')}
              className={`px-4 py-0 text-sm border-b-2 transition-colors ${
                activeTab === 'applications'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Applications
            </button>
            <button
              onClick={() => setActiveTab('active-vendors')}
              className={`px-4 py-0 text-sm border-b-2 transition-colors ${
                activeTab === 'active-vendors'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Active Vendors
            </button>
            <button
              onClick={() => setActiveTab('deactivation')}
              className={`px-4 py-0 text-sm border-b-2 transition-colors ${
                activeTab === 'deactivation'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Deactivation Requests
            </button>
            <button
              onClick={() => setActiveTab('reverification')}
              className={`px-4 py-0 text-sm border-b-2 transition-colors ${
                activeTab === 'reverification'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Reverification
            </button>
            <button
              onClick={() => setActiveTab('compliance')}
              className={`px-4 py-0 text-sm border-b-2 transition-colors ${
                activeTab === 'compliance'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Compliance Issues
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-0 pb-0">
          {activeTab === 'applications' && (
            <EnhancedPendingApplicationsTab />
          )}
          {activeTab === 'active-vendors' && (
            <ActiveVendorsTab />
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

