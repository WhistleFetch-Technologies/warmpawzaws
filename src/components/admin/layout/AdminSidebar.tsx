import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
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
  LogOut
} from 'lucide-react';
import { createClient } from '../../../utils/supabase/client';

interface AdminSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export function AdminSidebar({ activeView, onNavigate }: AdminSidebarProps) {
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const navigationItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: Briefcase, label: 'Enterprise & Revenue', id: 'enterprise' },
    { icon: Users, label: 'Vendor Administration', id: 'vendor-management' },
    { icon: Globe, label: 'Region Manager', id: 'region-manager' },
    { icon: Megaphone, label: 'Marketing & Promotions', id: 'marketing' },
    { icon: Headphones, label: 'Support & CRM', id: 'support' },
    { icon: BookOpen, label: 'Catalog & Services', id: 'catalog' },
    { icon: Database, label: 'Database Seeding', id: 'database-seeding' },
    { icon: Calendar, label: 'Event Management', id: 'events' },
    { icon: FileText, label: 'Content Management', id: 'content' },
    { icon: DollarSign, label: 'Payment & Refund', id: 'payment-refund' },
    { icon: Package, label: 'Pet Info Management', id: 'pet-info' },
    { icon: Wallet, label: 'Finance & Logistics', id: 'finance' },
    { icon: UserCog, label: 'Role & User Management', id: 'roles' },
  ];

  return (
    <div className="w-64 bg-white border-r flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF8C42] rounded-lg flex items-center justify-center">
            <span className="text-lg">🐾</span>
          </div>
          <span className="text-[#FF8C42] font-bold text-lg">warmpawz</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
              activeView === item.id
                ? 'text-[#FF8C42] bg-orange-50 border-r-2 border-[#FF8C42]'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom Items */}
      <div className="border-t p-4 space-y-2">
        <button 
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          onClick={() => onNavigate('reports')}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Reports</span>
        </button>
        <button 
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          onClick={() => onNavigate('platform-settings')}
        >
          <Settings className="w-4 h-4" />
          <span>Platform Settings</span>
        </button>
        <button 
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}