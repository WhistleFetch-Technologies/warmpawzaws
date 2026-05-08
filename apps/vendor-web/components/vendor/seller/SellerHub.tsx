'use client';

import type { RefObject } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  Tag,
  Image as ImageIcon,
  FileText,
  IndianRupee,
  Menu,
  X,
  LogOut,
  User,
  Boxes,
} from 'lucide-react';
import { SellerDashboard } from './SellerDashboard';
import { ProductCatalogManagement } from './ProductCatalogManagement';
import { InventoryManagement, type InventoryManagementHandle } from './InventoryManagement';
import { SellerOrderManagement } from './SellerOrderManagement';
import { GSTInvoicing } from './GSTInvoicing';
import { CommissionCalculator } from './CommissionCalculator';
import { PromotionsManagement } from './PromotionsManagement';
import { BannerManagement } from './BannerManagement';
import { SellerAnalytics } from './SellerAnalytics';
import { SellerSettings, type SellerSettingsHandle } from './SellerSettings';

export type SellerHubTab =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'orders'
  | 'invoices'
  | 'commission'
  | 'promotions'
  | 'banners'
  | 'analytics'
  | 'settings';

export const SELLER_HUB_NAVIGATION: {
  id: SellerHubTab;
  label: string;
  icon: typeof LayoutDashboard;
  description: string;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
  { id: 'products', label: 'Products', icon: Package, description: 'Manage catalog' },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    description: 'Stock management — levels and quantities',
  },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, description: 'Order processing' },
  { id: 'invoices', label: 'GST Invoices', icon: FileText, description: 'Tax invoices' },
  { id: 'commission', label: 'Commission', icon: IndianRupee, description: 'Earnings & fees' },
  { id: 'promotions', label: 'Promotions', icon: Tag, description: 'Offers & discounts' },
  { id: 'banners', label: 'Banners', icon: ImageIcon, description: 'Marketing assets' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Performance data' },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Manage your account and store settings',
  },
];

interface SellerHubSidebarProps {
  activeTab: SellerHubTab;
  onTabChange: (tab: SellerHubTab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  vendorData: any;
  onLogout: () => void;
  onBack?: () => void;
}

export function SellerHubSidebar({
  activeTab,
  onTabChange,
  sidebarOpen,
  setSidebarOpen,
  vendorData,
  onLogout,
  onBack,
}: SellerHubSidebarProps) {
  const sellerName =
    vendorData?.full_name ||
    vendorData?.fullName ||
    vendorData?.business_name ||
    vendorData?.businessName ||
    'Seller';

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-72' : 'w-20'
      } flex flex-col border-r border-orange-100/50 bg-white/80 shadow-lg backdrop-blur-xl transition-all duration-300`}
    >
      <div className="flex h-20 items-center justify-between border-b border-orange-100/50 px-4">
        {sidebarOpen ? (
          <>
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full shadow-lg shadow-orange-500/25 ring-2 ring-orange-100">
                <Image
                  src="/warmpawz-logo.svg"
                  alt="Warmpawz"
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div>
                <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-xl font-bold text-transparent">
                  Seller Hub
                </span>
                <p className="text-xs text-slate-500">Manage your store</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-xl p-2 transition-colors hover:bg-orange-50"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="mx-auto rounded-xl p-2 transition-colors hover:bg-orange-50"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
        {SELLER_HUB_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                  : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              {sidebarOpen && (
                <div className="text-left">
                  <span className="block font-medium">{item.label}</span>
                  {!isActive && <span className="text-xs text-slate-400">{item.description}</span>}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-orange-100/50 p-4">
        {sidebarOpen ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 p-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-md">
                <User className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-800">{sellerName}</p>
                <p className="text-xs font-medium text-orange-600">Seller Account</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  <span className="text-sm font-medium">Back</span>
                </button>
              )}
              <button
                type="button"
                onClick={onLogout}
                className={`flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-red-600 transition-colors hover:bg-red-50 ${onBack ? '' : 'col-span-2'}`}
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-xl p-3 text-red-600 transition-colors hover:bg-red-50"
            title="Logout"
          >
            <LogOut className="mx-auto h-5 w-5" />
          </button>
        )}
      </div>
    </aside>
  );
}

interface SellerHubMainPanelsProps {
  activeTab: SellerHubTab;
  vendorData: any;
  settingsRef?: RefObject<SellerSettingsHandle | null>;
  inventoryRef?: RefObject<InventoryManagementHandle | null>;
}

export function SellerHubMainPanels({
  activeTab,
  vendorData,
  settingsRef,
  inventoryRef,
}: SellerHubMainPanelsProps) {
  const sellerId = vendorData?.id || vendorData?.vendorId;
  const sellerName =
    vendorData?.full_name ||
    vendorData?.fullName ||
    vendorData?.business_name ||
    vendorData?.businessName ||
    'Seller';

  return (
    <>
      {activeTab === 'dashboard' && <SellerDashboard sellerId={sellerId} sellerName={sellerName} />}
      {activeTab === 'products' && <ProductCatalogManagement sellerId={sellerId} />}
      {activeTab === 'inventory' && (
        <InventoryManagement ref={inventoryRef} sellerId={sellerId} />
      )}
      {activeTab === 'orders' && <SellerOrderManagement sellerId={sellerId} />}
      {activeTab === 'invoices' && <GSTInvoicing sellerId={sellerId} sellerData={vendorData} />}
      {activeTab === 'commission' && <CommissionCalculator sellerId={sellerId} />}
      {activeTab === 'promotions' && <PromotionsManagement sellerId={sellerId} />}
      {activeTab === 'banners' && <BannerManagement sellerId={sellerId} />}
      {activeTab === 'analytics' && <SellerAnalytics sellerId={sellerId} />}
      {activeTab === 'settings' && (
        <SellerSettings ref={settingsRef} sellerId={sellerId} sellerData={vendorData} />
      )}
    </>
  );
}
