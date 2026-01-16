'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminVendorManagement } from './admin/AdminVendorManagement';
import { UnifiedAdminSidebar } from './admin/layout/UnifiedAdminSidebar';

// ============================================================================
// TYPES
// ============================================================================

interface VendorStats {
  activeVendors: { count: number; percentage: number };
  pendingApplications: { count: number; todayCount: number };
  deactivatedVendors: { count: number };
  rejectedVendors: { count: number };
  total: number;
}

interface Vendor {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  role_id: string;
  tier: string;
  created_at: string;
  rating: number;
}

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  capabilities: string[];
  service_styles: string[];
  is_active: boolean;
}

interface Tier {
  id: string;
  name: string;
  commission_rate: number;
  min_bookings: number;
  benefits: string[];
  is_active: boolean;
}

interface TaxRule {
  id: string;
  name: string;
  rate: number;
  category: string;
  is_active: boolean;
}

interface Promotion {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount: number;
  valid_from: string;
  valid_until: string;
  usage_limit: number;
  used_count: number;
  is_active: boolean;
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  position: 'home_top' | 'home_middle' | 'category' | 'checkout';
  is_active: boolean;
  start_date: string;
  end_date: string;
}

interface PlatformSettings {
  razorpay_enabled: boolean;
  wallet_enabled: boolean;
  gps_tracking_enabled: boolean;
  video_call_enabled: boolean;
  sms_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  default_commission_rate: number;
  settlement_frequency_days: number;
  min_booking_amount: number;
  cancellation_window_hours: number;
  refund_policy: string;
}

// ============================================================================
// CAPABILITY LIST
// ============================================================================

const ALL_CAPABILITIES = [
  // Core
  { id: 'dashboard', name: 'Dashboard', category: 'Core' },
  { id: 'bookings', name: 'Bookings', category: 'Core' },
  { id: 'services', name: 'Services', category: 'Core' },
  { id: 'staff', name: 'Staff Management', category: 'Core' },
  { id: 'schedule', name: 'Schedule', category: 'Core' },
  { id: 'profile', name: 'Profile', category: 'Core' },
  
  // Finance
  { id: 'earnings', name: 'Earnings', category: 'Finance' },
  { id: 'settlements', name: 'Settlements', category: 'Finance' },
  { id: 'bank_account', name: 'Bank Account', category: 'Finance' },
  { id: 'pricing', name: 'Pricing', category: 'Finance' },
  
  // Communication
  { id: 'chat', name: 'Chat', category: 'Communication' },
  { id: 'notifications', name: 'Notifications', category: 'Communication' },
  { id: 'video_call', name: 'Video Calls', category: 'Communication' },
  
  // Service Styles
  { id: 'centre_booking', name: 'Centre Booking', category: 'Service Styles' },
  { id: 'home_services', name: 'Home Services', category: 'Service Styles' },
  { id: 'tele_consultation', name: 'Tele Consultation', category: 'Service Styles' },
  
  // Medical
  { id: 'prescriptions', name: 'Prescriptions', category: 'Medical' },
  { id: 'medical_records', name: 'Medical Records', category: 'Medical' },
  { id: 'vaccination', name: 'Vaccination', category: 'Medical' },
  { id: 'diagnostics', name: 'Diagnostics', category: 'Medical' },
  
  // Specialized - Pharmacy
  { id: 'pharmacy', name: 'Pharmacy', category: 'Specialized' },
  { id: 'inventory', name: 'Inventory', category: 'Specialized' },
  
  // Specialized - Emergency
  { id: 'ambulance', name: 'Ambulance', category: 'Specialized' },
  { id: 'vehicles', name: 'Vehicles', category: 'Specialized' },
  
  // Specialized - Cafe
  { id: 'cafe_tables', name: 'Cafe Tables', category: 'Specialized' },
  { id: 'menu', name: 'Menu', category: 'Specialized' },
  { id: 'reservations', name: 'Reservations', category: 'Specialized' },
  
  // Specialized - Resort/Boarding
  { id: 'rooms', name: 'Rooms', category: 'Specialized' },
  { id: 'boarding', name: 'Boarding', category: 'Specialized' },
  { id: 'checkin_checkout', name: 'Check-in/Out', category: 'Specialized' },
  
  // Specialized - Insurance
  { id: 'insurance_plans', name: 'Insurance Plans', category: 'Specialized' },
  { id: 'policies', name: 'Policies', category: 'Specialized' },
  { id: 'claims', name: 'Claims', category: 'Specialized' },
  
  // Specialized - Adoption
  { id: 'adoption', name: 'Adoption', category: 'Specialized' },
  { id: 'pet_profiles', name: 'Pet Profiles', category: 'Specialized' },
  { id: 'lineage', name: 'Lineage', category: 'Specialized' },
  
  // Specialized - Training
  { id: 'training_programs', name: 'Training Programs', category: 'Specialized' },
  { id: 'progress_tracking', name: 'Progress Tracking', category: 'Specialized' },
  { id: 'packages', name: 'Packages', category: 'Specialized' },
  
  // Specialized - Nutrition
  { id: 'meal_plans', name: 'Meal Plans', category: 'Specialized' },
  { id: 'food_delivery', name: 'Food Delivery', category: 'Specialized' },
  { id: 'subscriptions', name: 'Subscriptions', category: 'Specialized' },
  
  // Specialized - Walker
  { id: 'walking', name: 'Walking Sessions', category: 'Specialized' },
  { id: 'route_tracking', name: 'Route Tracking', category: 'Specialized' },
  
  // Specialized - Holidays
  { id: 'holiday_packages', name: 'Holiday Packages', category: 'Specialized' },
  { id: 'tour_schedule', name: 'Tour Schedule', category: 'Specialized' },
  
  // Operations
  { id: 'reviews', name: 'Reviews', category: 'Operations' },
  { id: 'analytics', name: 'Analytics', category: 'Operations' },
  { id: 'reports', name: 'Reports', category: 'Operations' },
  { id: 'gps_tracking', name: 'GPS Tracking', category: 'Operations' },
  { id: 'service_radius', name: 'Service Radius', category: 'Operations' },
  
  // E-commerce
  { id: 'products', name: 'Products', category: 'E-commerce' },
  { id: 'orders', name: 'Orders', category: 'E-commerce' },
  { id: 'seller_hub', name: 'Seller Hub', category: 'E-commerce' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AdminApp() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [pendingVendors, setPendingVendors] = useState<Vendor[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'roles' && roles.length === 0) loadRoles();
    if (activeTab === 'tiers' && tiers.length === 0) loadTiers();
    if (activeTab === 'taxes' && taxRules.length === 0) loadTaxRules();
    if (activeTab === 'promotions' && promotions.length === 0) loadPromotions();
    if (activeTab === 'banners' && banners.length === 0) loadBanners();
    if (activeTab === 'settings' && !settings) loadSettings();
    if (activeTab === 'vendors' && allVendors.length === 0) loadAllVendors();
  }, [activeTab]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if API base URL is configured
      const apiBaseUrl = (window as any).__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl || 
                         process.env.NEXT_PUBLIC_API_BASE_URL;
      
      if (!apiBaseUrl) {
        setError('API_BASE_URL is not configured. Please check runtime-config.js or NEXT_PUBLIC_API_BASE_URL environment variable.');
        setLoading(false);
        return;
      }

      const [statsResponse, vendorsResponse] = await Promise.all([
        apiClient.get<any>('/admin/vendors/stats').catch(err => {
          console.error('Stats API error:', err);
          return { error: err.message };
        }),
        apiClient.get<any>('/admin/vendors?status=pending').catch(err => {
          console.error('Vendors API error:', err);
          return { error: err.message };
        }),
      ]);

      if (statsResponse && !statsResponse.error) {
        if (statsResponse.success || statsResponse.activeVendors || statsResponse.stats) {
          setStats(statsResponse.stats || statsResponse);
        }
      }

      if (vendorsResponse && !vendorsResponse.error) {
        if (vendorsResponse.success || vendorsResponse.vendors) {
          setPendingVendors(vendorsResponse.vendors || []);
        }
      }

      // Show error if both failed
      if (statsResponse?.error && vendorsResponse?.error) {
        setError(`Failed to load data: ${statsResponse.error}. Please ensure the API is running and accessible.`);
      }
    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      const errorMsg = err.message || 'Failed to load dashboard';
      if (errorMsg.includes('API_BASE_URL')) {
        setError('API configuration error: Please ensure runtime-config.js is loaded or NEXT_PUBLIC_API_BASE_URL is set.');
      } else {
        setError(`Failed to load dashboard: ${errorMsg}. Please check your API connection.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      // Try /admin/roles first (preferred), fallback to /config/roles
      let response: any;
      try {
        response = await apiClient.get<any>('/admin/roles');
        if (response.success && response.roles) {
          setRoles(response.roles || []);
          return;
        }
      } catch (err) {
        console.warn('Failed to load from /admin/roles, trying /config/roles:', err);
      }
      
      // Fallback to /config/roles
      response = await apiClient.get<any>('/config/roles');
      setRoles(response.roles || []);
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const loadTiers = async () => {
    try {
      const response = await apiClient.get<any>('/admin/tiers');
      setTiers(response.tiers || []);
    } catch (err) {
      console.error('Error loading tiers:', err);
    }
  };

  const loadTaxRules = async () => {
    try {
      const response = await apiClient.get<any>('/admin/tax-rules');
      setTaxRules(response.rules || []);
    } catch (err) {
      console.error('Error loading tax rules:', err);
    }
  };

  const loadPromotions = async () => {
    try {
      const response = await apiClient.get<any>('/admin/promotions');
      setPromotions(response.promotions || []);
    } catch (err) {
      console.error('Error loading promotions:', err);
    }
  };

  const loadBanners = async () => {
    try {
      const response = await apiClient.get<any>('/admin/banners');
      setBanners(response.banners || []);
    } catch (err) {
      console.error('Error loading banners:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await apiClient.get<any>('/admin/settings');
      setSettings(response.settings || response);
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const loadAllVendors = async () => {
    try {
      const response = await apiClient.get<any>('/admin/vendors');
      setAllVendors(response.vendors || []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleApproveVendor = async (vendorId: string) => {
    try {
      await apiClient.post(`/admin/vendors/${vendorId}/approve`, {});
      setSuccessMessage('Vendor approved successfully');
      loadDashboard();
      
      // Trigger propagation to vendor dashboard
      await apiClient.post('/admin/governance/propagate', {
        type: 'vendor_status_change',
        vendor_id: vendorId,
        new_status: 'approved',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to approve vendor');
    }
  };

  const handleRejectVendor = async (vendorId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/reject`, { reason });
      setSuccessMessage('Vendor rejected');
      loadDashboard();
    } catch (err: any) {
      setError(err.message || 'Failed to reject vendor');
    }
  };

  const handleRequestClarification = async (vendorId: string) => {
    const comment = prompt('Enter clarification request:');
    if (!comment) return;

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/request-clarification`, { comment });
      setSuccessMessage('Clarification requested');
      loadDashboard();
    } catch (err: any) {
      setError(err.message || 'Failed to request clarification');
    }
  };

  const handleSaveRole = async (role: Partial<Role>) => {
    try {
      if (editingRole?.id) {
        await apiClient.put(`/admin/roles/${editingRole.id}`, role);
        setSuccessMessage('Role updated successfully');
      } else {
        await apiClient.post('/admin/roles', role);
        setSuccessMessage('Role created successfully');
      }
      
      // Propagate to all vendors with this role
      await apiClient.post('/admin/governance/propagate', {
        type: 'role_capabilities_change',
        role_id: editingRole?.id || role.id,
      });
      
      loadRoles();
      setShowRoleModal(false);
      setEditingRole(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save role');
    }
  };

  const handleSaveTier = async (tier: Partial<Tier>) => {
    try {
      if (editingTier?.id) {
        await apiClient.put(`/admin/tiers/${editingTier.id}`, tier);
        setSuccessMessage('Tier updated successfully');
      } else {
        await apiClient.post('/admin/tiers', tier);
        setSuccessMessage('Tier created successfully');
      }
      
      // Propagate to all vendors
      await apiClient.post('/admin/governance/propagate', {
        type: 'tier_change',
        tier_id: editingTier?.id || tier.id,
      });
      
      loadTiers();
      setShowTierModal(false);
      setEditingTier(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save tier');
    }
  };

  const handleSaveSettings = async (newSettings: Partial<PlatformSettings>) => {
    try {
      await apiClient.put('/admin/settings', newSettings);
      setSuccessMessage('Settings saved successfully');
      
      // Propagate settings change
      await apiClient.post('/admin/governance/propagate', {
        type: 'platform_settings_change',
      });
      
      loadSettings();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'vendors', icon: '🏪', label: 'Vendors' },
    { id: 'roles', icon: '👤', label: 'Roles & Capabilities' },
    { id: 'tiers', icon: '🏆', label: 'Tier System' },
    { id: 'taxes', icon: '📋', label: 'Tax Rules' },
    { id: 'promotions', icon: '🎁', label: 'Promotions' },
    { id: 'banners', icon: '🖼️', label: 'Banners' },
    { id: 'catalog', icon: '📚', label: 'Service Catalog' },
    { id: 'reports', icon: '📈', label: 'Reports' },
    { id: 'integrations', icon: '🔗', label: 'Integrations' },
    { id: 'settings', icon: '⚙️', label: 'Platform Settings' },
  ];

  // Map activeTab to UnifiedAdminSidebar view IDs
  const getActiveView = () => {
    if (activeTab === 'vendors') return 'vendor-admin';
    if (activeTab === 'dashboard') return 'dashboard';
    return activeTab;
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && activeTab === 'dashboard') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Unified Sidebar */}
      <UnifiedAdminSidebar 
        activeView={getActiveView()} 
        onNavigate={(view) => {
          // IMPORTANT: Navigate to dedicated pages instead of changing tabs
          // Only handle dashboard and vendors (which have content in AdminApp)
          // All other views should navigate to dedicated pages
          if (view === 'dashboard') {
            setActiveTab('dashboard');
          } else if (view === 'vendor-admin' || view === 'vendors') {
            setActiveTab('vendors');
          } else {
            // Navigate to dedicated page for all other views
            const route = view === 'dashboard' ? '/' : `/${view}`;
            window.location.href = route;
          }
        }} 
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-gray-500">Manage your platform</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboard}
              className="px-4 py-0 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              🔄 Refresh
            </button>
            <button className="px-4 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
              + Add New
            </button>
          </div>
        </header>

        {/* Top Bar */}
        <div className="bg-white border-b px-0 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[#FF8C42] text-xl font-bold">
                {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
              </h1>
              <p className="text-xs text-gray-500">Manage your platform</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadDashboard}
                className="px-4 py-0 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-0">
          {/* Messages */}
          {error && (
            <div className="mb-0 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium mb-0">⚠️ Error Loading Data</p>
                <p className="text-sm">{error}</p>
                <p className="text-xs mt-0 text-red-600">
                  Tip: Check that runtime-config.js is loaded and API_BASE_URL is configured correctly.
                </p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
            </div>
          )}
          
          {successMessage && (
            <div className="mb-0 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}

          {/* Vendors Tab - Use AdminVendorManagement */}
          {activeTab === 'vendors' && (
            <AdminVendorManagement onNavigate={(view) => {
              if (view === 'vendor-admin') setActiveTab('vendors');
              else setActiveTab(view);
            }} />
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading dashboard...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-700">{error}</p>
                <button
                  onClick={loadDashboard}
                  className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                  Retry
                </button>
              </div>
            ) : stats ? (
            <>
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <StatCard icon="✅" value={stats.activeVendors.count} label="Active Vendors" sublabel={`${stats.activeVendors.percentage}% of total`} color="green" />
              <StatCard icon="⏳" value={stats.pendingApplications.count} label="Pending Applications" sublabel={`${stats.pendingApplications.todayCount} today`} color="yellow" />
              <StatCard icon="🚫" value={stats.deactivatedVendors.count} label="Deactivated" color="gray" />
              <StatCard icon="❌" value={stats.rejectedVendors.count} label="Rejected" color="red" />
            </div>

            {/* Pending Approvals */}
            <section className="bg-white rounded-2xl shadow-sm">
              <div className="p-0 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Pending Approvals</h3>
              </div>
              {pendingVendors.length === 0 ? (
                <div className="p-02 text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-gray-500">No pending applications</p>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingVendors.map((vendor) => (
                    <div key={vendor.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-xl">
                            🏪
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{vendor.business_name || vendor.owner_name}</h4>
                            <p className="text-sm text-gray-500">{vendor.phone} • {vendor.city}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleRequestClarification(vendor.id)}
                            className="px-0 py-0.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 transition"
                          >
                            Request Info
                          </button>
                          <button
                            onClick={() => handleRejectVendor(vendor.id)}
                            className="px-0 py-0.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveVendor(vendor.id)}
                            className="px-0 py-0.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <div className="text-5xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Dashboard</h3>
                <p className="text-gray-500 mb-4">No data available. Click Refresh to load dashboard data.</p>
                <button
                  onClick={loadDashboard}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                >
                  🔄 Refresh Dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-gray-500">{roles.length} roles configured</p>
              <button
                onClick={() => { setEditingRole(null); setShowRoleModal(true); }}
                className="px-4 py-0 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                + Add Role
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((role) => (
                <div key={role.id} className="bg-white rounded-2xl shadow-sm p-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{role.icon || '👤'}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{role.display_name}</h4>
                        <p className="text-sm text-gray-500">{role.name}</p>
                      </div>
                    </div>
                    <span className={`px-0 py-0 rounded-full text-xs ${role.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {role.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{role.description}</p>
                  
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-0">Service Styles</p>
                    <div className="flex flex-wrap gap-3">
                      {role.service_styles?.map((style) => (
                        <span key={style} className="px-0 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {style}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 mb-0">Capabilities ({role.capabilities?.length || 0})</p>
                    <div className="flex flex-wrap gap-3 max-h-20 overflow-y-auto">
                      {role.capabilities?.slice(0, 10).map((cap) => (
                        <span key={cap} className="px-0 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {cap}
                        </span>
                      ))}
                      {(role.capabilities?.length || 0) > 10 && (
                        <span className="px-0 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          +{(role.capabilities?.length || 0) - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => { setEditingRole(role); setShowRoleModal(true); }}
                    className="w-full py-0 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
                  >
                    Edit Role
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tiers Tab */}
        {activeTab === 'tiers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-gray-500">{tiers.length} tiers configured</p>
              <button
                onClick={() => { setEditingTier(null); setShowTierModal(true); }}
                className="px-4 py-0 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                + Add Tier
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {tiers.map((tier) => (
                <div key={tier.id} className="bg-white rounded-2xl shadow-sm p-0">
                  <div className="text-center mb-4">
                    <span className="text-4xl">🏆</span>
                    <h4 className="text-xl font-bold text-gray-900 mt-0">{tier.name}</h4>
                    <p className="text-3xl font-bold text-orange-500 mt-0">{tier.commission_rate}%</p>
                    <p className="text-sm text-gray-500">Commission Rate</p>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Min Bookings:</span> {tier.min_bookings}
                    </p>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-0">Benefits:</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {tier.benefits?.map((benefit, idx) => (
                          <li key={idx} className="flex items-center gap-3">
                            <span className="text-green-500">✓</span> {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => { setEditingTier(tier); setShowTierModal(true); }}
                    className="w-full py-0 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
                  >
                    Edit Tier
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vendors Tab - Already handled above with AdminVendorManagement */}

        {/* Promotions Tab */}
        {activeTab === 'promotions' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-gray-500">{promotions.length} promotions</p>
              <button className="px-4 py-0 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition">
                + Create Promotion
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                    <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                    <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {promotions.map((promo) => (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-0 py-4 font-mono text-sm font-medium">{promo.code}</td>
                      <td className="px-0 py-4 text-sm">
                        {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `₹${promo.discount_value}`}
                        {promo.max_discount && <span className="text-gray-400 text-xs ml-2">(max ₹{promo.max_discount})</span>}
                      </td>
                      <td className="px-0 py-4 text-sm text-gray-600">{promo.valid_until}</td>
                      <td className="px-0 py-4 text-sm">{promo.used_count}/{promo.usage_limit || '∞'}</td>
                      <td className="px-0 py-4">
                        <span className={`px-0 py-0 rounded-full text-xs ${promo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-0 py-4">
                        <button className="text-orange-500 hover:text-orange-600 text-sm font-medium">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && settings && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Payment Settings */}
              <div className="bg-white rounded-2xl shadow-sm p-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">💳 Payment Settings</h3>
                <div className="space-y-4">
                  <ToggleSetting 
                    label="Razorpay Enabled" 
                    value={settings.razorpay_enabled} 
                    onChange={(v) => handleSaveSettings({ razorpay_enabled: v })} 
                  />
                  <ToggleSetting 
                    label="Wallet Enabled" 
                    value={settings.wallet_enabled} 
                    onChange={(v) => handleSaveSettings({ wallet_enabled: v })} 
                  />
                  <NumberSetting 
                    label="Default Commission Rate (%)" 
                    value={settings.default_commission_rate} 
                    onChange={(v) => handleSaveSettings({ default_commission_rate: v })} 
                  />
                  <NumberSetting 
                    label="Settlement Frequency (days)" 
                    value={settings.settlement_frequency_days} 
                    onChange={(v) => handleSaveSettings({ settlement_frequency_days: v })} 
                  />
                  <NumberSetting 
                    label="Min Booking Amount (₹)" 
                    value={settings.min_booking_amount} 
                    onChange={(v) => handleSaveSettings({ min_booking_amount: v })} 
                  />
                </div>
              </div>

              {/* Feature Settings */}
              <div className="bg-white rounded-2xl shadow-sm p-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">⚡ Features</h3>
                <div className="space-y-4">
                  <ToggleSetting 
                    label="GPS Tracking" 
                    value={settings.gps_tracking_enabled} 
                    onChange={(v) => handleSaveSettings({ gps_tracking_enabled: v })} 
                  />
                  <ToggleSetting 
                    label="Video Calling" 
                    value={settings.video_call_enabled} 
                    onChange={(v) => handleSaveSettings({ video_call_enabled: v })} 
                  />
                  <ToggleSetting 
                    label="SMS Notifications" 
                    value={settings.sms_notifications_enabled} 
                    onChange={(v) => handleSaveSettings({ sms_notifications_enabled: v })} 
                  />
                  <ToggleSetting 
                    label="Email Notifications" 
                    value={settings.email_notifications_enabled} 
                    onChange={(v) => handleSaveSettings({ email_notifications_enabled: v })} 
                  />
                </div>
              </div>

              {/* Policy Settings */}
              <div className="bg-white rounded-2xl shadow-sm p-0 md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📜 Policies</h3>
                <div className="space-y-4">
                  <NumberSetting 
                    label="Cancellation Window (hours)" 
                    value={settings.cancellation_window_hours} 
                    onChange={(v) => handleSaveSettings({ cancellation_window_hours: v })} 
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Refund Policy</label>
                    <textarea
                      value={settings.refund_policy}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleSaveSettings({ refund_policy: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-0 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTE: All these tabs now have dedicated pages - navigation handled by AdminLayout/UnifiedAdminSidebar */}
        {/* Removed placeholder redirects - they were causing issues when CloudFront served index.html */}

        {/* Other tabs placeholder */}
        {activeTab === 'taxes' && (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🚧</div>
            <h3 className="text-xl font-semibold text-gray-900">Coming Soon</h3>
            <p className="text-gray-500 mt-0">Tax management is under development</p>
          </div>
        )}
        </div>
      </main>

      {/* Role Edit Modal */}
      {showRoleModal && (
        <RoleEditModal
          role={editingRole}
          capabilities={ALL_CAPABILITIES}
          onSave={handleSaveRole}
          onClose={() => { setShowRoleModal(false); setEditingRole(null); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatCard({ icon, value, label, sublabel, color }: { icon: string; value: number; label: string; sublabel?: string; color: string }) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    gray: 'bg-gray-50 text-gray-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className={`${colorClasses[color]} rounded-2xl p-1`}>
      <div className="text-3xl mb-0">{icon}</div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-0">{label}</p>
      {sublabel && <p className="text-xs opacity-70 mt-0">{sublabel}</p>}
    </div>
  );
}

function ToggleSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition ${value ? 'bg-green-500' : 'bg-gray-300'}`}
      >
        <div className={`w-5 h-5 rounded-full bg-white shadow transition ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
        className="w-24 px-1 py-0 border border-gray-200 rounded-lg text-right focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
      />
    </div>
  );
}

function RoleEditModal({ 
  role, 
  capabilities, 
  onSave, 
  onClose 
}: { 
  role: Role | null; 
  capabilities: typeof ALL_CAPABILITIES;
  onSave: (role: Partial<Role>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: role?.name || '',
    display_name: role?.display_name || '',
    description: role?.description || '',
    icon: role?.icon || '👤',
    service_styles: role?.service_styles || [],
    capabilities: role?.capabilities || [],
    is_active: role?.is_active ?? true,
  });

  const groupedCapabilities = capabilities.reduce((acc, cap) => {
    if (!acc[cap.category]) acc[cap.category] = [];
    acc[cap.category].push(cap);
    return acc;
  }, {} as Record<string, typeof capabilities>);

  const toggleCapability = (capId: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...prev.capabilities, capId],
    }));
  };

  const toggleServiceStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      service_styles: prev.service_styles.includes(style)
        ? prev.service_styles.filter(s => s !== style)
        : [...prev.service_styles, style],
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-1 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">
              {role ? 'Edit Role' : 'Create Role'}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
        </div>
        
        <div className="p-1 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Name (ID)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-0 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                placeholder="e.g., veterinarian"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Display Name</label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                className="w-full px-4 py-0 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                placeholder="e.g., Veterinarian"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              className="w-full px-4 py-0 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
            />
          </div>

          {/* Service Styles */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Service Styles</label>
            <div className="flex flex-wrap gap-3">
              {['centre', 'home', 'tele', 'ecommerce'].map((style) => (
                <button
                  key={style}
                  onClick={() => toggleServiceStyle(style)}
                  className={`px-4 py-0 rounded-lg transition ${
                    formData.service_styles.includes(style)
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Capabilities ({formData.capabilities.length} selected)
            </label>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {Object.entries(groupedCapabilities).map(([category, caps]) => (
                <div key={category}>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-0">{category}</p>
                  <div className="flex flex-wrap gap-3">
                    {caps.map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => toggleCapability(cap.id)}
                        className={`px-1 py-0 rounded-lg text-sm transition ${
                          formData.capabilities.includes(cap.id)
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {cap.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="p-1 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-1 py-0 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-1 py-0 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
          >
            Save Role
          </button>
        </div>
      </div>
    </div>
  );
}
