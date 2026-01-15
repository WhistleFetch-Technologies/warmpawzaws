'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { VendorServiceConfigurationScreen } from './VendorServiceConfigurationScreen';
import { VendorCustomServiceCreation } from './VendorCustomServiceCreation';
import { PackageManagementContainer } from './packages/PackageManagementContainer';
import { VendorServiceCatalogView } from './VendorServiceCatalogView';
import { getVendorRoleId, hasVendorRole } from '@/lib/vendor-utils';

interface VendorServiceManagementCompleteProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  fromStaffManagement?: boolean; // ✅ NEW: Track if we came from staff management
}

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

export function VendorServiceManagementComplete({ 
  vendorId, 
  vendorData, 
  onBack,
  fromStaffManagement
}: VendorServiceManagementCompleteProps) {
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<ServiceStyle[]>([]);
  const [loadingRoleConfig, setLoadingRoleConfig] = useState(true);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(null);
  const [roleConfig, setRoleConfig] = useState<any>(null);
  const [showCustomServices, setShowCustomServices] = useState(false); // ✅ NEW
  const [showPackages, setShowPackages] = useState(false); // ✅ NEW: Package Management
  const [showCatalogView, setShowCatalogView] = useState(false); // ✅ NEW: Catalog browsing
  const [serviceCounts, setServiceCounts] = useState<Record<ServiceStyle, number>>({
    at_home: 0,
    at_center: 0,
    tele: 0
  }); // ✅ NEW: Track service counts per style

  useEffect(() => {
    loadRoleConfiguration();
  }, [vendorId]);
  
  // ✅ Refresh counts when returning from sub-views
  useEffect(() => {
    if (!selectedServiceStyle && !showCatalogView && !showCustomServices && !showPackages) {
      loadRoleConfiguration();
    }
  }, [selectedServiceStyle, showCatalogView, showCustomServices, showPackages]);

  // ✅ PHASE 3: Role-based conditional field visibility (using utility functions)
  const vendorRoleId = getVendorRoleId(vendorData);
  const isCafe = hasVendorRole(vendorData, ['pet_cafe', 'cafe']);
  const isResort = hasVendorRole(vendorData, ['pet_resort', 'resort']);
  const isBoarding = hasVendorRole(vendorData, ['pet_boarding', 'boarding']);
  const isRetail = hasVendorRole(vendorData, ['pet_products_store', 'product_seller', 'retail', 'seller', 'ecommerce']);
  const isPharmacy = hasVendorRole(vendorData, ['pet_pharmacy', 'pharmacy']);
  const isHealthcare = hasVendorRole(vendorData, ['veterinarian', 'veterinary_clinic', 'pet_clinic', 'vet']);
  const supportsHomeService = !isCafe && !isResort && !isBoarding && !isRetail && !isPharmacy; // Cafe, Resort, Boarding, Retail, Pharmacy don't do home services

  const loadRoleConfiguration = async () => {
    try {
      setLoadingRoleConfig(true);
      console.log('🔧 [ROLE-CONFIG] Loading allowed service styles for vendor:', vendorId);
      
      // ✅ FIX: Use /vendor/:vendorId/services endpoint (now includes role config and allowedServiceStyles)
      const data = await apiClient.get(`/vendor/${vendorId}/services`) as any;

      if (data && data.success) {
        console.log('✅ [ROLE-CONFIG] API Response:', data);
        
        // ✅ FIX: Extract allowedServiceStyles and role config from services endpoint response
        const allowedStyles = data.allowedServiceStyles || data.allowed_service_styles || ['at_home', 'at_center', 'tele'];
        const roleConfig = data.role?.config || data.roleConfig || {};
        
        // ✅ NEW: Extract service counts per style
        const counts: Record<ServiceStyle, number> = {
          at_home: 0,
          at_center: 0,
          tele: 0
        };
        
        if (data.services) {
          // Services might be grouped by style
          if (data.services.at_home) counts.at_home = data.services.at_home.count || data.services.at_home.services?.length || 0;
          if (data.services.at_center) counts.at_center = data.services.at_center.count || data.services.at_center.services?.length || 0;
          if (data.services.tele) counts.tele = data.services.tele.count || data.services.tele.services?.length || 0;
        }
        
        // Also check allServices for total count verification
        if (data.allServices && Array.isArray(data.allServices)) {
          data.allServices.forEach((svc: any) => {
            const style = svc.serviceStyle || svc.service_style;
            if (style === 'at_home') counts.at_home++;
            else if (style === 'at_center') counts.at_center++;
            else if (style === 'tele') counts.tele++;
          });
          // Only use this if grouped counts were 0
          if (counts.at_home === 0 && counts.at_center === 0 && counts.tele === 0) {
            // Already counted above
          }
        }
        
        console.log('✅ [ROLE-CONFIG] Service counts:', counts);
        setServiceCounts(counts);
        
        if (Array.isArray(allowedStyles)) {
          console.log('✅ [ROLE-CONFIG] Setting allowed styles:', allowedStyles);
          setAllowedServiceStyles(allowedStyles);
          setRoleConfig(roleConfig);
        } else {
          console.error('❌ [ROLE-CONFIG] Invalid response format - allowedServiceStyles is not an array:', data);
          setAllowedServiceStyles(['at_home', 'at_center', 'tele']); // Default fallback
          setRoleConfig({});
        }
      } else {
        console.error('❌ [ROLE-CONFIG] API request failed:', data);
        toast.error(data?.error || 'Failed to load role configuration');
        setAllowedServiceStyles(['at_home', 'at_center', 'tele']); // Default fallback
        setRoleConfig({});
      }
    } catch (error) {
      console.error('❌ [ROLE-CONFIG] Exception during role config load:', error);
      toast.error('Error loading role configuration');
      setAllowedServiceStyles([]);
    } finally {
      setLoadingRoleConfig(false);
    }
  };

  const getStyleIcon = (style: ServiceStyle) => {
    switch (style) {
      case 'at_home': return '🏠';
      case 'at_center': return '🏥';
      case 'tele': return '📱';
    }
  };

  const getStyleName = (style: ServiceStyle) => {
    switch (style) {
      case 'at_home': return 'Home Services';
      case 'at_center': return 'Book at Clinic';
      case 'tele': return 'Tele Consultation';
    }
  };

  const getStyleDescription = (style: ServiceStyle) => {
    switch (style) {
      case 'at_home': return 'Services delivered at customer\'s home';
      case 'at_center': return 'Services at your clinic/center';
      case 'tele': return 'Online consultation services';
    }
  };

  // If a service style is selected, show the configuration screen
  if (selectedServiceStyle) {
    return (
      <VendorServiceConfigurationScreen
        vendorId={vendorId}
        vendorData={vendorData}
        serviceStyle={selectedServiceStyle}
        roleConfig={roleConfig}
        onBack={() => setSelectedServiceStyle(null)}
      />
    );
  }

  // ✅ NEW: If custom services view is active
  if (showCustomServices) {
    return (
      <VendorCustomServiceCreation
        vendorId={vendorId}
        vendorData={vendorData}
        serviceStyle={vendorData?.serviceStyle}
        onClose={() => setShowCustomServices(false)}
        onServiceCreated={() => {
          toast.success('Custom service created!');
        }}
      />
    );
  }

  // ✅ NEW: If package management view is active
  if (showPackages) {
    return (
      <PackageManagementContainer
        vendorId={vendorId}
        onBack={() => setShowPackages(false)}
      />
    );
  }

  // ✅ NEW: If catalog view is active
  if (showCatalogView) {
    return (
      <VendorServiceCatalogView
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => setShowCatalogView(false)}
        mode="multi-select" // ✅ Enable multi-select mode for bulk service addition
        allowedServiceStyles={allowedServiceStyles} // ✅ Pass role-based allowed styles
        onSelectService={(service) => {
          console.log('🎯 [SERVICE-MGMT] Service selected from catalog:', service);
          // Navigate to configuration screen for this service's style
          setSelectedServiceStyle(service.serviceStyle);
          setShowCatalogView(false);
        }}
      />
    );
  }

  if (loadingRoleConfig) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading configuration...</p>
        </div>
      </div>
    );
  }

  // ✅ NEW: Check if vendor can create custom services (only at_center or both)
  const canCreateCustomServices = vendorData?.serviceStyle === 'at_center' || vendorData?.serviceStyle === 'both';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="p-4 bg-white border-b sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">Service Management</h1>
              <p className="text-xs text-gray-500">{vendorData?.businessName || vendorData?.fullName}</p>
            </div>
          </div>
        </div>

        {/* ✅ NEW: Show helpful banner when coming from staff management */}
        {fromStaffManagement && (
          <div className="mx-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-sm">ℹ️</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Enable Services First</h3>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Select a service type below and enable the services you want to offer. After enabling services, click the back button to return to Staff Management and assign them to your team members.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Service Style Selection */}
        <div className="p-4">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900 mb-1">Select Service Type</h2>
            <p className="text-sm text-gray-600">Choose how you want to deliver your services</p>
          </div>

          <div className="space-y-3">
            {[
              { value: 'at_home' as ServiceStyle, label: 'Home Services', icon: '🏠', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100', activeColor: 'border-blue-500' },
              { value: 'at_center' as ServiceStyle, label: 'Book at Clinic', icon: '🏥', color: 'bg-green-50 border-green-200 hover:bg-green-100', activeColor: 'border-green-500' },
              { value: 'tele' as ServiceStyle, label: 'Tele Consultation', icon: '📱', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100', activeColor: 'border-purple-500' }
            ]
              .filter(type => Array.isArray(allowedServiceStyles) && allowedServiceStyles.includes(type.value))
              .map(type => {
                const count = serviceCounts[type.value] || 0;
                const hasServices = count > 0;
                
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedServiceStyle(type.value)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${type.color} ${hasServices ? type.activeColor : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-4xl">{type.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{type.label}</h3>
                          {hasServices && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-500 text-white">
                              {count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {hasServices 
                            ? `${count} service${count > 1 ? 's' : ''} enabled` 
                            : getStyleDescription(type.value)
                          }
                        </p>
                      </div>
                      <div className="text-gray-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>

          {(Array.isArray(allowedServiceStyles) ? allowedServiceStyles : []).length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <X className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">No Service Styles Configured</h3>
              <p className="text-sm text-gray-600">
                No service styles are available for your vendor type. Please contact support.
              </p>
            </div>
          )}
        </div>

        {/* ✅ NEW: Custom Services Section (Only for at_center or both) */}
        {canCreateCustomServices && (
          <div className="p-4">
            <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-lg">Custom Services</h3>
                  <p className="text-sm text-white/90 mb-4">
                    Create your own specialized services tailored to your center's expertise
                  </p>
                </div>
                <Plus className="w-6 h-6 flex-shrink-0" />
              </div>
              
              <Button
                onClick={() => setShowCustomServices(true)}
                className="w-full bg-white text-[#FF8C42] hover:bg-gray-100 font-semibold"
              >
                Manage Custom Services
              </Button>
              
              <p className="text-xs text-white/80 mt-3 text-center">
                ⭐ Only available for center-based services
              </p>
            </div>
          </div>
        )}

        {/* ✅ NEW: Package Management Section (Only for at_center or both) */}
        {canCreateCustomServices && (
          <div className="p-4">
            <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-lg">Package Management</h3>
                  <p className="text-sm text-white/90 mb-4">
                    Create and manage service packages to offer bundled services
                  </p>
                </div>
                <Plus className="w-6 h-6 flex-shrink-0" />
              </div>
              
              <Button
                onClick={() => setShowPackages(true)}
                className="w-full bg-white text-[#FF8C42] hover:bg-gray-100 font-semibold"
              >
                Manage Packages
              </Button>
              
              <p className="text-xs text-white/80 mt-3 text-center">
                ⭐ Only available for center-based services
              </p>
            </div>
          </div>
        )}

        {/* ✅ Service Catalog Section - Available for ALL vendors */}
        <div className="p-4">
          <div className="bg-gradient-to-r from-[#26C6DA] to-[#00ACC1] rounded-2xl p-6 text-white">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="font-semibold mb-2 text-lg">Service Catalog</h3>
                <p className="text-sm text-white/90 mb-4">
                  Browse and enable certified services from the admin catalog
                </p>
              </div>
              <Package className="w-6 h-6 flex-shrink-0" />
            </div>
            
            <Button
              onClick={() => setShowCatalogView(true)}
              className="w-full bg-white text-[#26C6DA] hover:bg-gray-100 font-semibold"
            >
              Browse Service Catalog
            </Button>
            
            <p className="text-xs text-white/80 mt-3 text-center">
              📋 All tele and home services are controlled from here
            </p>
          </div>
        </div>

        {/* Help Section */}
        <div className="p-4 mt-8">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <h3 className="font-semibold text-orange-900 mb-2 text-sm">How it works:</h3>
            <ol className="text-xs text-orange-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">1.</span>
                <span>Select a service type based on your role configuration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">2.</span>
                <span>Enable services you want to offer from the catalog</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">3.</span>
                <span>For "Book at Clinic", customize pricing or add custom services</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold flex-shrink-0">4.</span>
                <span>Publish to make them available to customers</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}