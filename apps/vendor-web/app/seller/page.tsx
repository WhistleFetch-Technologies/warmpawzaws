'use client';

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  SellerHubSidebar,
  SellerHubMainPanels,
  SELLER_HUB_NAVIGATION,
  type SellerHubTab,
} from '@/components/vendor/seller/SellerHub';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Button } from '@/components/ui/button';
import type { SellerSettingsHandle } from '@/components/vendor/seller/SellerSettings';
import type { InventoryManagementHandle } from '@/components/vendor/seller/InventoryManagement';
import { apiClient } from '@/lib/api-client';
import { isSellerStrict } from '@/components/vendor/landingPage/constants/helpers';
import { Bell, HelpCircle, RefreshCcw } from 'lucide-react';

export default function SellerPage() {
  const router = useRouter();
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SellerHubTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications] = useState(0);
  const settingsRef = useRef<SellerSettingsHandle | null>(null);
  const inventoryRef = useRef<InventoryManagementHandle | null>(null);

  useEffect(() => {
    loadVendorData();
  }, []);

  useEffect(() => {
    if (loading || !vendorData) return;
    if (!isSellerStrict(vendorData)) {
      router.replace('/dashboard');
    }
  }, [loading, vendorData, router]);

  const loadVendorData = async () => {
    try {
      // Get vendor data from localStorage (set during login)
      const stored = localStorage.getItem('vendorData');
      if (stored) {
        const parsed = JSON.parse(stored);
        setVendorData(parsed);
        setLoading(false);
        return;
      }

      // Try to get vendor from session
      const phone = localStorage.getItem('vendorPhone');
      if (phone) {
        const data = await apiClient.get<{ vendor?: any }>(`/vendor/by-phone/${phone}`);
        if (data?.vendor) {
          setVendorData(data.vendor);
          localStorage.setItem('vendorData', JSON.stringify(data.vendor));
        }
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorPhone');
    localStorage.removeItem('vendorId');
    router.push('/');
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  const activeNav = SELLER_HUB_NAVIGATION.find((n) => n.id === activeTab);

  const headerActions = useMemo(() => {
    const actions: ReactNode[] = [];
    if (activeTab === 'settings') {
      actions.push(
        <Button
          key="save-settings"
          type="button"
          size="sm"
          className="h-9 shrink-0 bg-orange-500 text-sm text-white hover:bg-orange-600"
          onClick={() => void settingsRef.current?.save()}
        >
          Save
        </Button>
      );
    }
    if (activeTab === 'inventory') {
      actions.push(
        <button
          key="refresh-inventory"
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
          aria-label="Refresh inventory"
          onClick={() => void inventoryRef.current?.refresh()}
        >
          <RefreshCcw className="h-5 w-5 text-slate-600" />
        </button>
      );
    }
    actions.push(
      <button
        key="bell"
        type="button"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {notifications > 0 && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>,
      <button
        key="help"
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
        aria-label="Help"
      >
        <HelpCircle className="h-5 w-5 text-slate-600" />
      </button>
    );
    return actions;
  }, [activeTab, notifications]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Seller Hub...</p>
        </div>
      </div>
    );
  }

  if (vendorData && !isSellerStrict(vendorData)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Opening your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!vendorData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-gray-600 mb-6">Please log in again to access the Seller Hub.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 bg-gradient-to-br from-slate-50 to-orange-50/30">
      <SellerHubSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        vendorData={vendorData}
        onLogout={handleLogout}
        onBack={handleBack}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <VendorHeader
          title={activeNav?.label ?? 'Seller Hub'}
          subtitle={activeNav?.description}
          showBack
          onBack={handleBack}
          actions={headerActions}
        />
        <main className="vendor-app-column mx-auto min-h-0 w-full flex-1 overflow-y-auto">
          <div className="px-4 py-4 sm:px-6 sm:py-6">
            <SellerHubMainPanels
              activeTab={activeTab}
              vendorData={vendorData}
              settingsRef={settingsRef}
              inventoryRef={inventoryRef}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
