import { useState } from 'react';
import { Grid3x3, Package, Megaphone, HeadphonesIcon, ClipboardList, Calendar, Newspaper, DollarSign, Wallet, CreditCard, Settings as SettingsIcon, LogOut, Clock, RotateCcw } from 'lucide-react';
import logoImage from '../../public/logo.png';
import { RefundPoliciesManagementNew } from './settings/RefundPoliciesManagementNew';
import { PaymentSettingsManagementNew } from './settings/PaymentSettingsManagementNew';
import { ScheduleSettingsManagement } from './settings/ScheduleSettingsManagement';
import { ReturnsManagement } from './ecommerce/ReturnsManagement';
import { Button } from '../ui/button';
import { createClient } from '../../utils/supabase/client';
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';

interface PaymentRefundManagementProps {
  onNavigate?: (view: string) => void;
}

// Reusable NavItem component
function NavItem({ 
  icon, 
  label, 
  active = false, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick && !active}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
        active
          ? 'bg-orange-50 text-[#FF8C42] font-medium'
          : onClick
          ? 'text-gray-700 hover:bg-gray-50'
          : 'text-gray-400 cursor-not-allowed opacity-60'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function PaymentRefundManagement({ onNavigate }: PaymentRefundManagementProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payment' | 'refund' | 'schedule' | 'returns'>('overview');
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // If a management page is active, show it
  if (activeTab === 'payment') {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <UnifiedAdminSidebar 
          activeView="payment-refund" 
          onNavigate={(view) => onNavigate?.(view)} 
        />
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <PaymentSettingsManagementNew onBack={() => setActiveTab('overview')} />
        </div>
      </div>
    );
  }

  if (activeTab === 'refund') {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <UnifiedAdminSidebar 
          activeView="payment-refund" 
          onNavigate={(view) => onNavigate?.(view)} 
        />
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <RefundPoliciesManagementNew onBack={() => setActiveTab('overview')} />
        </div>
      </div>
    );
  }

  if (activeTab === 'schedule') {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <UnifiedAdminSidebar 
          activeView="payment-refund" 
          onNavigate={(view) => onNavigate?.(view)} 
        />
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <ScheduleSettingsManagement onBack={() => setActiveTab('overview')} />
        </div>
      </div>
    );
  }

  if (activeTab === 'returns') {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <UnifiedAdminSidebar 
          activeView="payment-refund" 
          onNavigate={(view) => onNavigate?.(view)} 
        />
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <ReturnsManagement onBack={() => setActiveTab('overview')} />
        </div>
      </div>
    );
  }

  // Overview page
  return (
    <div className="min-h-screen bg-gray-50 flex">
      <UnifiedAdminSidebar 
        activeView="payment-refund" 
        onNavigate={(view) => onNavigate?.(view)} 
      />

      {/* Main Content - Overview */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-[#FF8C42]" />
              <h1 className="text-2xl font-semibold text-gray-900">Payment & Refund Management</h1>
            </div>
            <p className="text-sm text-gray-600">
              Configure platform-wide payment rules and refund policies. Manage reservation types, cancellation tiers, and vendor-specific settings.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Payment Rules</span>
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">3</div>
              <div className="text-xs text-gray-500 mt-1">Active configurations</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Refund Tiers</span>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">2</div>
              <div className="text-xs text-gray-500 mt-1">Cancellation policies</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Vendor Types</span>
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">13</div>
              <div className="text-xs text-gray-500 mt-1">Categories covered</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Services</span>
                <ClipboardList className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-semibold text-gray-900">25+</div>
              <div className="text-xs text-gray-500 mt-1">In catalog</div>
            </div>
          </div>

          {/* Management Cards */}
          <div className="grid grid-cols-2 gap-6">
            {/* Payment Settings Card */}
            <div 
              className="bg-white rounded-lg border-2 border-gray-200 hover:border-[#FF8C42] transition-all hover:shadow-xl cursor-pointer group"
              onClick={() => setActiveTab('payment')}
            >
              <div className="p-8">
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center mb-5 group-hover:bg-[#FF8C42] transition-colors">
                  <CreditCard className="w-7 h-7 text-blue-600 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Payment Settings</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Configure reservation types, advance payment rules, escrow settings, and service-specific charges per service and location.
                </p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Dynamic service selection from catalog</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Location-based rules (At Home/At Center)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Flat, percentage, or full payment options</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Integrated with customer booking flow</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm font-medium text-[#FF8C42]">Manage Payment Rules →</span>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Service-Based</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Refund Policies Card */}
            <div 
              className="bg-white rounded-lg border-2 border-gray-200 hover:border-[#FF8C42] transition-all hover:shadow-xl cursor-pointer group"
              onClick={() => setActiveTab('refund')}
            >
              <div className="p-8">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-5 group-hover:bg-[#FF8C42] transition-colors">
                  <DollarSign className="w-7 h-7 text-green-600 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Refund Policies</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Manage cancellation tiers, refund percentages, vendor-type specific policies, and service location based rules.
                </p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• 11 vendor type categories</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Location-based policies (At Home/At Center)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Time-based refund tiers</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Auto-applied during cancellation</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm font-medium text-[#FF8C42]">Manage Refund Tiers →</span>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Vendor-Based</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule Settings Card */}
            <div 
              className="bg-white rounded-lg border-2 border-gray-200 hover:border-[#FF8C42] transition-all hover:shadow-xl cursor-pointer group"
              onClick={() => setActiveTab('schedule')}
            >
              <div className="p-8">
                <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center mb-5 group-hover:bg-[#FF8C42] transition-colors">
                  <Clock className="w-7 h-7 text-purple-600 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Schedule Settings</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Define availability, booking windows, and service-specific scheduling rules to optimize resource utilization.
                </p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Dynamic service selection from catalog</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Location-based rules (At Home/At Center)</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Customizable booking windows</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Integrated with customer booking flow</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm font-medium text-[#FF8C42]">Manage Schedule Rules →</span>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Service-Based</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Returns Management Card */}
            <div 
              className="bg-white rounded-lg border-2 border-gray-200 hover:border-[#FF8C42] transition-all hover:shadow-xl cursor-pointer group"
              onClick={() => setActiveTab('returns')}
            >
              <div className="p-8">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-5 group-hover:bg-[#FF8C42] transition-colors">
                  <RotateCcw className="w-7 h-7 text-red-600 group-hover:text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Returns Management</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Handle product returns, process refunds, and manage return policies for e-commerce transactions.
                </p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Automated return processing</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Customizable return policies</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Real-time tracking of returns</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">• Integrated with e-commerce platform</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm font-medium text-[#FF8C42]">Manage Returns →</span>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">E-Commerce</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-orange-50 to-white border border-orange-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#FF8C42] flex items-center justify-center flex-shrink-0">
                <SettingsIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-2">Enterprise-Grade Rule Management</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Both payment and refund systems support multi-rule configurations with intelligent vendor type matching. Payment rules target specific services from the catalog, while refund policies apply to entire vendor categories for maximum flexibility.
                </p>
                <div className="grid grid-cols-3 gap-6 text-sm">
                  <div>
                    <div className="font-medium text-gray-900 mb-1">✓ Smart Vendor Matching</div>
                    <div className="text-gray-600">Backend automatically maps services to vendor types</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 mb-1">✓ Location Awareness</div>
                    <div className="text-gray-600">Different rules for At Home vs At Center services</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 mb-1">✓ Real-Time Application</div>
                    <div className="text-gray-600">Rules apply instantly during customer bookings</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}