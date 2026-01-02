import React, { useState, useEffect } from 'react';
import { RoleManagement } from './RoleManagement';
import { EnhancedOnboardingFormBuilder } from './EnhancedOnboardingFormBuilder';
import { ServiceCatalogTab } from './catalog/ServiceCatalogTab';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { adminCatalogApi } from '../../utils/api/client';
import { Button } from '../ui/button';
import { WARM_ORANGE, LOGO_CIRCULAR_ORANGE } from '../../assets/design-tokens';
import { 
  Grid3x3, 
  Package, 
  Megaphone, 
  HeadphonesIcon, 
  ClipboardList, 
  Calendar, 
  Newspaper, 
  DollarSign, 
  Wallet, 
  Settings, 
  BarChart3, 
  TrendingUp,
  Package2,
  AlertCircle,
  ShoppingCart,
  Search,
  Bell,
  MessageSquare,
  User,
  Eye,
  AlertTriangle,
  Download,
  Plus
} from 'lucide-react';
const logoImage = LOGO_CIRCULAR_ORANGE;
import { UnifiedAdminSidebar } from './layout/UnifiedAdminSidebar';

// Import other tab components (they may not exist yet - we'll create placeholder)
import { CategoriesTab } from './catalog/CategoriesTab';
import { ProductServicesTab } from './catalog/ProductServicesTab';
import { PricingInventoryTab } from './catalog/PricingInventoryTab';
import { BulkOperationsTab } from './catalog/BulkOperationsTab';
import { CreateCategoryModal } from './catalog/CreateCategoryModal';
import { CreateProductModal } from './catalog/CreateProductModal';
import { ExportCategoriesModal } from './catalog/ExportCategoriesModal';

interface CatalogStats {
  mainCategories: { count: number; change: number };
  activeProducts: { count: number; change: number };
  pendingReviews: { count: number; change: number };
  lowStockAlerts: { count: number; change: number };
}

interface CatalogServicesManagementProps {
  onNavigate?: (view: string) => void;
}

export function CatalogServicesManagement({ onNavigate }: CatalogServicesManagementProps = {}) {
  const [activeTab, setActiveTab] = useState<'categories' | 'products' | 'pricing' | 'bulk' | 'roles' | 'onboarding' | 'servicecatalog'>('categories');
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadStats();
    loadCategories();
  }, [refreshTrigger]);

  const loadCategories = async () => {
    try {
      // ✅ FIX: Use adminCatalogApi instead of direct fetch
      const data = await adminCatalogApi.getCategories();
      const categoryNames = data.categories?.map((cat: any) => cat.name) || [];
      setCategories(categoryNames);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: Use adminCatalogApi instead of direct fetch
      const data = await adminCatalogApi.getStats();
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading catalog stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Unified Sidebar */}
      <UnifiedAdminSidebar 
        activeView="catalog" 
        onNavigate={(view) => onNavigate?.(view)} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl text-gray-900">Catalog & Services</h1>
                <select className="text-sm border border-gray-200 rounded-lg px-3 py-1 bg-white">
                  <option>/Catalog Management</option>
                  <option>/Low Stock Alerts</option>
                </select>
              </div>
              <p className="text-sm text-gray-500">Effortlessly manage categories, products, services, pricing and inventory across the platform.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search"
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-64"
                />
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg relative">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-gray-600" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg">
                <User className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Grid3x3 className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-50"
              title="Main Categories"
              value={stats?.mainCategories?.count?.toString() || '10'}
              change={`+${stats?.mainCategories?.change || 2} this month`}
              changePositive={true}
            />
            <StatCard
              icon={<Package className="w-5 h-5 text-green-600" />}
              iconBg="bg-green-50"
              title="Active Products"
              value={stats?.activeProducts?.count?.toString() || '32'}
              change={`+${stats?.activeProducts?.change || 3} this week`}
              changePositive={true}
            />
            <StatCard
              icon={<Eye className="w-5 h-5 text-orange-600" />}
              iconBg="bg-orange-50"
              title="Pending Reviews"
              value={stats?.pendingReviews?.count?.toString() || '10'}
              change={`-${stats?.pendingReviews?.change || 4} this month`}
              changePositive={false}
            />
            <StatCard
              icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
              iconBg="bg-red-50"
              title="Low Stock Alerts"
              value={stats?.lowStockAlerts?.count?.toString() || '23'}
              change={`+${stats?.lowStockAlerts?.change || 8} this week`}
              changePositive={false}
            />
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-3 flex items-center justify-between">
              <div className="flex gap-6">
                <TabButton 
                  label="Categories" 
                  active={activeTab === 'categories'}
                  onClick={() => setActiveTab('categories')}
                />
                <TabButton 
                  label="Product & Services" 
                  active={activeTab === 'products'}
                  onClick={() => setActiveTab('products')}
                />
                <TabButton 
                  label="Pricing & Inventory" 
                  active={activeTab === 'pricing'}
                  onClick={() => setActiveTab('pricing')}
                />
                <TabButton 
                  label="Bulk Operations" 
                  active={activeTab === 'bulk'}
                  onClick={() => setActiveTab('bulk')}
                />
                <TabButton 
                  label="Roles" 
                  active={activeTab === 'roles'}
                  onClick={() => setActiveTab('roles')}
                />
                <TabButton 
                  label="Onboarding" 
                  active={activeTab === 'onboarding'}
                  onClick={() => setActiveTab('onboarding')}
                />
                <TabButton 
                  label="Service Catalog" 
                  active={activeTab === 'servicecatalog'}
                  onClick={() => setActiveTab('servicecatalog')}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={() => setShowExport(true)}>
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button 
                  className="gap-2"
                  style={{ backgroundColor: WARM_ORANGE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FF7A2E';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = WARM_ORANGE;
                  }}
                  onClick={() => setShowCreateCategory(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </Button>
                <Button 
                  className="gap-2"
                  style={{ backgroundColor: WARM_ORANGE }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#FF7A2E';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = WARM_ORANGE;
                  }}
                  onClick={() => setShowCreateProduct(true)}
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'categories' && <CategoriesTab onRefresh={() => setRefreshTrigger(refreshTrigger + 1)} />}
              {activeTab === 'products' && <ProductServicesTab />}
              {activeTab === 'pricing' && <PricingInventoryTab />}
              {activeTab === 'bulk' && <BulkOperationsTab />}
              {activeTab === 'roles' && <RoleManagement />}
              {activeTab === 'onboarding' && <EnhancedOnboardingFormBuilder />}
              {activeTab === 'servicecatalog' && <ServiceCatalogTab />}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-[#FF8C42] hover:bg-[#FF7A2E] rounded-full flex items-center justify-center shadow-lg">
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Modals */}
      <CreateCategoryModal
        isOpen={showCreateCategory}
        onClose={() => setShowCreateCategory(false)}
        onSuccess={() => {
          console.log('Category created - triggering refresh');
          setShowCreateCategory(false);
          setRefreshTrigger(prev => prev + 1);
          loadStats();
        }}
      />

      <CreateProductModal
        isOpen={showCreateProduct}
        onClose={() => setShowCreateProduct(false)}
        onSuccess={() => {
          console.log('Product created - triggering refresh');
          setShowCreateProduct(false);
          setRefreshTrigger(prev => prev + 1);
          loadStats();
        }}
        categories={categories}
      />

      <ExportCategoriesModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
      />
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-[#FF8C42] text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="text-left">{label}</span>
    </button>
  );
}

function StatCard({ icon, iconBg, title, value, change, changePositive }: any) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-sm text-gray-600">{title}</span>
      </div>
      <div className="text-3xl mb-1">{value}</div>
      <div className={`text-xs ${changePositive ? 'text-green-600' : 'text-red-600'}`}>
        {change}
      </div>
    </div>
  );
}

function TabButton({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${
        active
          ? 'border-[#FF8C42] text-[#FF8C42]'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
}