import { useState, useEffect } from 'react';
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminAuth } from './admin/AdminAuth';
import { AdminVendorManagement } from './admin/AdminVendorManagement';
import { CatalogServicesManagement } from './admin/CatalogServicesManagement';
import { ECommerceManagement } from './admin/ecommerce/ECommerceManagement';
import { SupportCRM } from './admin/SupportCRM';
import { RegionManager } from './admin/RegionManager';
import { PlatformSettings } from './admin/PlatformSettings';
import { FinanceManagement } from './admin/finance/FinanceManagement';
import { PetInformationDashboard } from './admin/pets/PetInformationDashboard';
import { RBACDashboard } from './admin/rbac/RBACDashboard';
import { ReportsDashboard } from './admin/reports/ReportsDashboard';
import { AdminAnalyticsDashboard } from './admin/analytics/AdminAnalyticsDashboard';
import { AdminOperationsDashboard } from './admin/operations/AdminOperationsDashboard';
import { EnterpriseRevenue } from './admin/EnterpriseRevenue';
import { DatabaseSeeding } from './admin/DatabaseSeeding';
import { supabase } from '../utils/supabase/client';

export function AdminApp() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<string>('vendor-management');

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleNavigation = (viewId: string) => {
    // Map navigation IDs to actual view names
    const viewMap: { [key: string]: string } = {
      'dashboard': 'dashboard',
      'vendor-admin': 'vendor-management',
      'ecommerce': 'ecommerce',
      'catalog': 'catalog',
      'seed-panel': 'seed-panel',
      'database-seeding': 'database-seeding',
      'vendor-migration': 'vendor-migration',
      'vendor-diagnostic': 'vendor-diagnostic',
      'region-init': 'region-init',
      'region-manager': 'region-manager',
      'platform-settings': 'platform-settings',
      'marketing': 'marketing',
      'support': 'support',
      'events': 'events',
      'content': 'content',
      'finance': 'finance',
      'pet-info': 'pet-info',
      'roles': 'roles',
      'reports': 'reports',
      'analytics': 'analytics',
      'operations': 'operations'
    };
    
    const mappedView = viewMap[viewId];
    if (mappedView) {
      setCurrentView(mappedView);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AdminAuth onAuthSuccess={setSession} />;
  }

  // Show vendor management by default for this demo
  if (currentView === 'vendor-management') {
    return <AdminVendorManagement onNavigate={handleNavigation} />;
  }

  // EXISTING ROUTES
  if (currentView === 'catalog') {
    return <CatalogServicesManagement onNavigate={handleNavigation} />;
  }


  if (currentView === 'ecommerce') {
    return <ECommerceManagement onBack={() => setCurrentView('vendor-management')} />;
  }

  if (currentView === 'region-manager') {
    return <RegionManager onBack={() => setCurrentView('vendor-management')} />;
  }

  if (currentView === 'platform-settings') {
    return <PlatformSettings onBack={() => setCurrentView('vendor-management')} />;
  }

  if (currentView === 'marketing') {
    return <AdminDashboard session={session} onNavigate={handleNavigation} initialView="marketing" />;
  }

  if (currentView === 'enterprise') {
    return <EnterpriseRevenue onBack={() => setCurrentView('vendor-management')} />;
  }

  if (currentView === 'database-seeding') {
    return <DatabaseSeeding onBack={() => setCurrentView('vendor-management')} />;
  }
  
  if (currentView === 'support') {
    return <SupportCRM onNavigate={handleNavigation} />;
  }

  if (currentView === 'finance') {
    return <FinanceManagement onBack={() => setCurrentView('vendor-management')} onNavigate={handleNavigation} />;
  }

  // ✅ NEW: Enterprise Admin Capabilities
  if (currentView === 'pet-info') {
    return <PetInformationDashboard onBack={() => setCurrentView('vendor-management')} />;
  }

  if (currentView === 'roles') {
    return <RBACDashboard onBack={() => setCurrentView('vendor-management')} />;
  }

  // Reports merged into Analytics & Insights
  if (currentView === 'reports' || currentView === 'analytics') {
    return <AdminAnalyticsDashboard onBack={() => setCurrentView('vendor-management')} />;
  }

  if (['events', 'content'].includes(currentView)) {
    return <AdminDashboard session={session} onNavigate={handleNavigation} initialView={currentView} />;
  }

  if (currentView === 'operations') {
    return <AdminOperationsDashboard onBack={() => setCurrentView('vendor-management')} />;
  }

  return <AdminDashboard session={session} onNavigate={handleNavigation} />;
}