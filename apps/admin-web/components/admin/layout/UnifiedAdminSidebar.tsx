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
  Image
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const logoImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjRkY4QzQyIi8+CiAgPHBhdGggZD0iTTIwIDEyQzE2LjY4NjMgMTIgMTQgMTQuNjg2MyAxNCAxOEMxNCAxOS41OTEzIDE0LjYzMjEgMjEuMDI2MSAxNS42NTY5IDIyLjA1MTRDMTY4MjE3IDIzLjA3NjcgMTguMTE2NSAyMy43MDg4IDE5LjcwNzcgMjMuNzA4OEMyMS4yOTg5IDIzLjcwODggMjIuNzMzNyAyMy4wNzY3IDIzLjc1ODUgMjIuMDUxNEMyNC43ODMzIDIxLjAyNjEgMjUuNDE1NCAxOS41OTEzIDI1LjQxNTQgMThDMjUuNDE1NCAxNC42ODYzIDIyLjcyOTEgMTIgMTkuNDE1NCAxMkgyMFpNMjAgMTRDMjEuNjU2OSAxNCAyMyAxNS4zNDMxIDIzIDE3QzIzIDE4LjY1NjkgMjEuNjU2OSAyMCAyMCAyMEMxOC4zNDMxIDIwIDE3IDE4LjY1NjkgMTcgMTdDMTcgMTUuMzQzMSAxOC4zNDMxIDE0IDIwIDE0WiIgZmlsbD0id2hpdGUiLz4KICA8cGF0aCBkPSJNMTIgMjRDMTIgMjQuNTUyMyAxMi40NDc3IDI1IDEzIDI1SDI3QzI3LjU1MjMgMjUgMjggMjQuNTUyMyAyOCAyNEMyOCAyMi4zNDMxIDI2LjY1NjkgMjEgMjUgMjFIMTVDMTMuMzQzMSAyMSAxMiAyMi4zNDMxIDEyIDI0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';

interface UnifiedAdminSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function UnifiedAdminSidebar({ activeView, onNavigate }: UnifiedAdminSidebarProps) {
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
      id: 'vendor-admin',
      onClick: () => onNavigate('vendor-admin')
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
      id: 'region-manager',
      onClick: () => onNavigate('region-manager')
    },
    { 
      icon: Megaphone, 
      label: 'Marketing & Promotions', 
      id: 'marketing',
      onClick: () => {
        window.location.href = '/promotions';
      }
    },
    { 
      icon: Image, 
      label: 'Banner Management', 
      id: 'banners',
      onClick: () => {
        window.location.href = '/banners';
      }
    },
    { 
      icon: Gift, 
      label: 'Loyalty & Rewards', 
      id: 'loyalty',
      onClick: () => {
        window.location.href = '/loyalty';
      }
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

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-0">
          <img src={logoImage} alt="WarmPawz" className="w-10 h-10" />
          <div>
            <h2 className="text-primary font-bold">Warmpawz</h2>
            <span className="text-xs text-gray-500">Admin Portal</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-0">
        <div className="px-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-0">
            Main Menu
          </h3>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id || 
                             (item.id === 'vendor-admin' && activeView === 'vendor-management');
              
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full flex items-center gap-0 px-4 py-0.5 text-sm transition-colors rounded-lg ${
                    isActive
                      ? 'text-primary bg-primary/10 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Items */}
      <div className="border-t border-gray-200 p-0 space-y-1">
        <button 
          className="w-full flex items-center gap-0 px-4 py-0.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
          onClick={() => onNavigate('reports')}
        >
          <BarChart3 className="w-4 h-4 flex-shrink-0" />
          <span>Reports</span>
        </button>
        <button 
          className="w-full flex items-center gap-0 px-4 py-0.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
          onClick={() => onNavigate('platform-settings')}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span>Platform Settings</span>
        </button>
        <button 
          className="w-full flex items-center gap-0 px-4 py-0.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

