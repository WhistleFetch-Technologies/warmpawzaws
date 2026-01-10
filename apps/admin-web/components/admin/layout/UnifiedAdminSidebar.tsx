'use client';

import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart,
  Globe, 
  Megaphone, 
  Headphones, 
  BookOpen, 
  Database, 
  Calendar, 
  FileText, 
  DollarSign, 
  Package, 
  Wallet, 
  UserCog, 
  BarChart3, 
  Settings,
  LogOut,
  Briefcase,
  Gift,
  Image,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

const logoImage = '/logo.png';

interface UnifiedAdminSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function UnifiedAdminSidebar({ activeView, onNavigate }: UnifiedAdminSidebarProps) {
  const [open, setOpen] = useState(false);
  
  const handleSignOut = async () => {
    apiClient.clearAuth();
    window.location.href = '/';
  };

  const navigationItems = [
    { 
      icon: LayoutDashboard, 
      label: 'Dashboard', 
      id: 'dashboard',
      onClick: () => onNavigate('dashboard')
    },
    { 
      icon: BarChart3, 
      label: 'Analytics & Insights', 
      id: 'analytics',
      onClick: () => onNavigate('analytics')
    },
    { 
      icon: Briefcase, 
      label: 'Enterprise & Revenue', 
      id: 'enterprise',
      onClick: () => onNavigate('enterprise')
    },
    { 
      icon: Users, 
      label: 'Vendor Administration', 
      id: 'vendors',
      onClick: () => onNavigate('vendors')
    },
    { 
      icon: ShoppingCart, 
      label: 'E-Commerce', 
      id: 'ecommerce',
      onClick: () => onNavigate('ecommerce')
    },
    { 
      icon: Globe, 
      label: 'Region Manager', 
      id: 'regions',
      onClick: () => onNavigate('regions')
    },
    { 
      icon: Megaphone, 
      label: 'Marketing & Promotions', 
      id: 'marketing',
      onClick: () => onNavigate('marketing')
    },
    { 
      icon: Image, 
      label: 'Banner Management', 
      id: 'banners',
      onClick: () => onNavigate('banners')
    },
    { 
      icon: Gift, 
      label: 'Loyalty & Rewards', 
      id: 'loyalty',
      onClick: () => onNavigate('loyalty')
    },
    { 
      icon: Headphones, 
      label: 'Support & CRM', 
      id: 'support',
      onClick: () => onNavigate('support')
    },
    { 
      icon: BookOpen, 
      label: 'Catalog & Services', 
      id: 'catalog',
      onClick: () => onNavigate('catalog')
    },
    { 
      icon: Database, 
      label: 'Database Seeding', 
      id: 'database-seeding',
      onClick: () => onNavigate('database-seeding')
    },
    { 
      icon: Calendar, 
      label: 'Event Management', 
      id: 'events',
      onClick: () => onNavigate('events')
    },
    { 
      icon: FileText, 
      label: 'Content Management', 
      id: 'content',
      onClick: () => onNavigate('content')
    },
    { 
      icon: DollarSign, 
      label: 'Payment & Refund', 
      id: 'payment-refund',
      onClick: () => onNavigate('payment-refund')
    },
    { 
      icon: Package, 
      label: 'Pet Info Management', 
      id: 'pet-info',
      onClick: () => onNavigate('pet-info')
    },
    { 
      icon: Wallet, 
      label: 'Finance & Logistics', 
      id: 'finance',
      onClick: () => onNavigate('finance')
    },
    { 
      icon: UserCog, 
      label: 'Role & User Management', 
      id: 'roles',
      onClick: () => onNavigate('roles')
    },
  ];

  // Sidebar width
  const sidebarWidth = 256; // 64 * 4 (w-64)
  
  return (
    <div className="z-50">
      {/* Open button (shows when sidebar is closed) */}
      {!open && (
        <button
          className="fixed cursor-pointer top-4 left-4 z-40 bg-white border border-gray-200 rounded-full p-2 shadow transition-opacity hover:bg-gray-100"
          onClick={() => setOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Blur overlay (shows when sidebar is open) */}
      {open && (
        <div
          className="fixed inset-0 z-20 transition-all duration-300 cursor-pointer backdrop-blur-sm bg-white/30"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-30 h-screen transition-transform duration-300 ease-in-out ${open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"}`}
        style={{ WebkitOverflowScrolling: "touch", width: sidebarWidth }}
      >
        {/* Close button (always visible when sidebar is open) */}
        {open && (
          <button
            className="absolute cursor-pointer top-4 right-4 z-50 bg-white border border-gray-200 rounded-full p-1 shadow transition-opacity hover:bg-gray-100"
            onClick={() => setOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-gray-700" />
          </button>
        )}
        
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="WarmPawz" className="w-10 h-10" />
            <div>
              <h2 className="text-[#FF8C42] font-bold">Warmpawz</h2>
              <span className="text-xs text-gray-500">Admin Portal</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2">
              Main Menu
            </h3>
            <nav className="space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id || 
                               (item.id === 'vendors' && (activeView === 'vendor-admin' || activeView === 'vendor-management')) ||
                               (item.id === 'regions' && activeView === 'region-manager');
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick();
                      setOpen(false); // Close sidebar after navigation
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-lg ${
                      isActive
                        ? "text-[#FF8C42] bg-orange-50 font-medium"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Items */}
        <div className="border-t border-gray-200 p-3 space-y-1">
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
            onClick={() => {
              onNavigate('reports');
              setOpen(false);
            }}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Reports</span>
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
            onClick={() => {
              onNavigate('platform-settings');
              setOpen(false);
            }}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Platform Settings</span>
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

