'use client';

import { useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3, Settings,
  Tag, Image as ImageIcon, FileText, IndianRupee, Bell, Menu, X,
  Store, LogOut, User, HelpCircle, Boxes, TrendingUp
} from 'lucide-react';
import { SellerDashboard } from './SellerDashboard';
import { ProductCatalogManagement } from './ProductCatalogManagement';
import { InventoryManagement } from './InventoryManagement';
import { SellerOrderManagement } from './SellerOrderManagement';
import { GSTInvoicing } from './GSTInvoicing';
import { CommissionCalculator } from './CommissionCalculator';
import { PromotionsManagement } from './PromotionsManagement';
import { BannerManagement } from './BannerManagement';
import { SellerAnalytics } from './SellerAnalytics';
import { SellerSettings } from './SellerSettings';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface SellerHubProps {
  vendorData: any;
  onLogout: () => void;
  onBack?: () => void;
}

type TabType = 
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

export function SellerHub({ vendorData, onLogout, onBack }: SellerHubProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState(0);

  const sellerId = vendorData?.id || vendorData?.vendorId;
  const sellerName = vendorData?.full_name || vendorData?.fullName || vendorData?.business_name || vendorData?.businessName || 'Seller';

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & stats' },
    { id: 'products', label: 'Products', icon: Package, description: 'Manage catalog' },
    { id: 'inventory', label: 'Inventory', icon: Boxes, description: 'Stock management' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, description: 'Order processing' },
    { id: 'invoices', label: 'GST Invoices', icon: FileText, description: 'Tax invoices' },
    { id: 'commission', label: 'Commission', icon: IndianRupee, description: 'Earnings & fees' },
    { id: 'promotions', label: 'Promotions', icon: Tag, description: 'Offers & discounts' },
    { id: 'banners', label: 'Banners', icon: ImageIcon, description: 'Marketing assets' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, description: 'Performance data' },
    { id: 'settings', label: 'Settings', icon: Settings, description: 'Account settings' }
  ];

  const activeNav = navigationItems.find((n) => n.id === activeTab);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-orange-50/30">
      {/* Sidebar */}
      <aside className={`${
        sidebarOpen ? 'w-72' : 'w-20'
      } bg-white/80 backdrop-blur-xl border-r border-orange-100/50 transition-all duration-300 flex flex-col shadow-lg`}>
        {/* Logo */}
        <div className="h-20 border-b border-orange-100/50 flex items-center justify-between px-4">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="font-bold text-xl bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Seller Hub</span>
                  <p className="text-xs text-slate-500">Manage your store</p>
                </div>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-orange-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-orange-50 rounded-xl mx-auto transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25'
                    : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                {sidebarOpen && (
                  <div className="text-left">
                    <span className="font-medium block">{item.label}</span>
                    {!isActive && <span className="text-xs text-slate-400">{item.description}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-orange-100/50 p-4">
          {sidebarOpen ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{sellerName}</p>
                  <p className="text-xs text-orange-600 font-medium">Seller Account</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors border border-slate-200"
                  >
                    <X className="w-4 h-4" />
                    <span className="text-sm font-medium">Back</span>
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-200 ${onBack ? '' : 'col-span-2'}`}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="w-full p-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 mx-auto" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <VendorHeader
          title={activeNav?.label ?? 'Seller Hub'}
          subtitle={activeNav?.description}
          showBack={Boolean(onBack)}
          onBack={onBack}
          actions={[
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
            </button>,
          ]}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <SellerDashboard sellerId={sellerId} sellerName={sellerName} />
          )}
          {activeTab === 'products' && (
            <ProductCatalogManagement sellerId={sellerId} />
          )}
          {activeTab === 'inventory' && (
            <InventoryManagement sellerId={sellerId} />
          )}
          {activeTab === 'orders' && (
            <SellerOrderManagement sellerId={sellerId} />
          )}
          {activeTab === 'invoices' && (
            <GSTInvoicing sellerId={sellerId} sellerData={vendorData} />
          )}
          {activeTab === 'commission' && (
            <CommissionCalculator sellerId={sellerId} />
          )}
          {activeTab === 'promotions' && (
            <PromotionsManagement sellerId={sellerId} />
          )}
          {activeTab === 'banners' && (
            <BannerManagement sellerId={sellerId} />
          )}
          {activeTab === 'analytics' && (
            <SellerAnalytics sellerId={sellerId} />
          )}
          {activeTab === 'settings' && (
            <SellerSettings sellerId={sellerId} sellerData={vendorData} />
          )}
        </main>
      </div>
    </div>
  );
}
