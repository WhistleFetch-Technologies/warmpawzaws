'use client';

import {
  Users,
  ShoppingCart,
  Globe,
  Megaphone,
  Headphones,
  BookOpen,
  Calendar,
  FileText,
  Package,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
  LogOut,
  Briefcase,
  Gift,
  Menu,
  X
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { getPermissionForSection } from '@/lib/admin-permissions';

const logoImage = '/logo.png';

interface UnifiedAdminSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function UnifiedAdminSidebar({ activeView, onNavigate }: UnifiedAdminSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { loaded, hasPermission } = useAdminAuth();

  useEffect(() => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) setOpen(true);
  }, []);
  
  const handleSignOut = async () => {
    apiClient.clearAuth();
    window.location.href = '/';
  };

  const navigationItems = [
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
      onClick: () => {
        window.location.href = '/vendors';
      }
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

  const visibleNavItems = useMemo(() => {
    if (!loaded) return navigationItems;
    return navigationItems.filter((item) => {
      const perm = getPermissionForSection(item.id);
      if (!perm) return true;
      return hasPermission(perm);
    });
  }, [loaded, hasPermission]);

  const canSeeReports = !loaded || hasPermission('admin:reports:view');
  const canSeePlatformSettings = !loaded || hasPermission('admin:platform_settings:view');

  // Sidebar width
  const sidebarWidth = 256; // 64 * 4 (w-64)
  
  return (
    <>
      {/* Open button (shows when sidebar is closed) - fixed positioning */}
      {!open && (
        <button
          className="fixed cursor-pointer top-4 left-4 z-40 bg-white border border-gray-200 rounded-full p-2 shadow-md hover:shadow-lg transition-all hover:bg-gray-50"
          onClick={() => setOpen(true)}
          aria-label="Open sidebar"
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}

      {/* Blur overlay (shows when sidebar is open) - z-40 to be above content */}
      {open && (
        <div
          className="fixed inset-0 z-40 transition-all duration-300 cursor-pointer backdrop-blur-sm bg-black/20"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar overlay"
        />
      )}

      {/* Sidebar - z-50 to be above overlay */}
      <aside
        className={`w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-50 h-screen transition-transform duration-300 ease-in-out shadow-xl ${open ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"}`}
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
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id || 
                               (item.id === 'vendors' && (activeView === 'vendor-admin' || activeView === 'vendor-management' || pathname === '/vendors')) ||
                               (item.id === 'regions' && activeView === 'region-manager') ||
                               (item.id === 'catalog' && activeView === 'catalog-and-services');
                
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

        {/* Bottom Items - Reports & Platform Settings (with active state) */}
        <div className="border-t border-gray-200 p-3 space-y-1">
          {canSeeReports && (
            <button
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-colors ${
                activeView === 'reports'
                  ? 'text-[#FF8C42] bg-orange-50 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              onClick={() => {
                onNavigate('reports');
                setOpen(false);
              }}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span>Reports</span>
            </button>
          )}
          {canSeePlatformSettings && (
            <button
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-colors ${
                activeView === 'platform-settings'
                  ? 'text-[#FF8C42] bg-orange-50 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
              onClick={() => {
                onNavigate('platform-settings');
                setOpen(false);
              }}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Platform Settings</span>
            </button>
          )}
          <button
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

