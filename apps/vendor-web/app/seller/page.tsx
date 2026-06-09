'use client';

import { useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  SellerHubSidebar,
  SellerHubMainPanels,
  SELLER_HUB_NAVIGATION,
  type SellerHubTab,
} from '@/components/vendor/seller/SellerHub';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SellerSettingsHandle } from '@/components/vendor/seller/SellerSettings';
import type { InventoryManagementHandle } from '@/components/vendor/seller/InventoryManagement';
import { VendorNotificationModal } from '@/components/vendor/modals/VendorNotificationModal';
import { VendorSupportDashboard } from '@/components/vendor/VendorSupportDashboard';
import { vendorNotificationUnreadCount } from '@/components/vendor/dashboard/helpers';
import { apiClient } from '@/lib/api-client';
import { isSellerStrict } from '@/components/vendor/landingPage/constants/helpers';
import { Bell, HelpCircle, RefreshCcw } from 'lucide-react';

const NOTIFICATION_POLL_MS = 60_000;

export default function SellerPage() {
  const router = useRouter();
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SellerHubTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsRef = useRef<SellerSettingsHandle | null>(null);
  const inventoryRef = useRef<InventoryManagementHandle | null>(null);

  const vendorId = vendorData?.id || vendorData?.vendorId || '';

  const refreshNotificationUnreadCount = useCallback(async () => {
    if (!vendorId) {
      setNotificationUnreadCount(0);
      return;
    }
    try {
      const res = await apiClient
        .get(`/vendor/notifications/${vendorId}?limit=10`)
        .catch(() => ({ success: false }));
      setNotificationUnreadCount(vendorNotificationUnreadCount(res));
    } catch {
      setNotificationUnreadCount(0);
    }
  }, [vendorId]);

  useEffect(() => {
    loadVendorData();
  }, []);

  useEffect(() => {
    if (loading || !vendorData) return;
    if (!isSellerStrict(vendorData)) {
      router.replace('/dashboard');
    }
  }, [loading, vendorData, router]);

  useEffect(() => {
    if (!vendorId) {
      setNotificationUnreadCount(0);
      return;
    }
    void refreshNotificationUnreadCount();
    const intervalId = window.setInterval(() => void refreshNotificationUnreadCount(), NOTIFICATION_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [vendorId, refreshNotificationUnreadCount]);

  const loadVendorData = async () => {
    try {
      const persistVendorId = (v: Record<string, unknown> | null | undefined) => {
        const id = v && (v.id ?? v.vendorId);
        if (id != null && String(id).trim() !== '') {
          localStorage.setItem('vendorId', String(id).trim());
        }
      };

      // Get vendor data from localStorage (set during login)
      const stored = localStorage.getItem('vendorData');
      if (stored) {
        const parsed = JSON.parse(stored);
        setVendorData(parsed);
        persistVendorId(parsed);
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
          persistVendorId(data.vendor);
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
          className="h-9 shrink-0 bg-orange-500 text-sm text-white hover:bg-orange-600 disabled:opacity-60"
          disabled={settingsSaving}
          onClick={() => void settingsRef.current?.save()}
        >
          {settingsSaving ? 'Saving...' : 'Save'}
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
        title="Notifications"
        disabled={!vendorId}
        onClick={() => vendorId && setNotificationModalOpen(true)}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {notificationUnreadCount > 0 && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>,
      <button
        key="help"
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-gray-100"
        aria-label="Help and support"
        title="Help and support"
        disabled={!vendorId}
        onClick={() => vendorId && setHelpOpen(true)}
      >
        <HelpCircle className="h-5 w-5 text-slate-600" />
      </button>
    );
    return actions;
  }, [activeTab, notificationUnreadCount, vendorId, settingsSaving]);

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
              onTabChange={setActiveTab}
              vendorData={vendorData}
              settingsRef={settingsRef}
              inventoryRef={inventoryRef}
              onSettingsSavingChange={setSettingsSaving}
            />
          </div>
        </main>
      </div>

      {vendorId ? (
        <>
          <VendorNotificationModal
            vendorId={vendorId}
            open={notificationModalOpen}
            onClose={() => setNotificationModalOpen(false)}
            onNotificationsRead={() => void refreshNotificationUnreadCount()}
          />
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogContent className="flex max-h-[min(90dvh,calc(100dvh-2rem))] w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
              <DialogHeader className="shrink-0 border-b border-gray-100 px-6 py-4 text-left">
                <DialogTitle>Help & support</DialogTitle>
                <DialogDescription>
                  View support tickets or create a new request for the Warmpawz team.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2 sm:px-6">
                <VendorSupportDashboard vendorId={vendorId} />
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
