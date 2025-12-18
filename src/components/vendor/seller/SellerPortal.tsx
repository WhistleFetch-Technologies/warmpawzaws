import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3, Settings,
  Tag, Image as ImageIcon, FileText, DollarSign, Bell, Menu, X,
  Store, LogOut, User, HelpCircle
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
import { Button } from '../../ui/button';

interface SellerPortalProps {
  vendorData: any;
  onLogout: () => void;
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

export function SellerPortal({ vendorData, onLogout }: SellerPortalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState(0);

  const sellerId = vendorData.id;
  const sellerName = vendorData.fullName || vendorData.businessName || 'Seller';

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: ShoppingCart },
    { id: 'orders', label: 'Orders', icon: FileText },
    { id: 'invoices', label: 'GST Invoices', icon: FileText },
    { id: 'commission', label: 'Commission', icon: DollarSign },
    { id: 'promotions', label: 'Promotions', icon: Tag },
    { id: 'banners', label: 'Banners', icon: ImageIcon },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${
        sidebarOpen ? 'w-64' : 'w-20'
      } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-[#FF8C42] to-[#FFA562] rounded-lg flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-black">Seller Hub</span>
              </div>
              <Button onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-600" />
              </Button>
            </>
          ) : (
            <Button onClick={() => setSidebarOpen(true)}
              className="p-1 hover:bg-gray-100 rounded mx-auto"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <Button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-[#FF8C42]/10 text-[#FF8C42] border-r-2 border-[#FF8C42]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-gray-200 p-4">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-br from-[#FF8C42] to-[#FFA562] rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-black text-sm truncate">{sellerName}</p>
                  <p className="text-xs text-gray-500">Seller Account</p>
                </div>
              </div>
              <Button onClick={onLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Logout</span>
              </Button>
            </div>
          ) : (
            <Button onClick={onLogout}
              className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 mx-auto" />
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h2 className="text-black capitalize">{activeTab.replace('_', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <Button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </Button>
            <Button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </Button>
          </div>
        </header>

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
