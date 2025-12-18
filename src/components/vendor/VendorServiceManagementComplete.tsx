import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { VendorServiceConfigurationScreen } from './VendorServiceConfigurationScreen';
import { VendorCustomServiceCreation } from './VendorCustomServiceCreation';
import { PackageManagementContainer } from './packages/PackageManagementContainer';
import { VendorServiceCatalogView } from './VendorServiceCatalogView';

interface VendorServiceManagementCompleteProps {
  vendorId: string;
  vendorData: any;
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

  useEffect(() => {
    loadRoleConfiguration();
  }, [vendorId]);

  const loadRoleConfiguration = async () => {
    try {
      setLoadingRoleConfig(true);
      console.log('🔧 [ROLE-CONFIG] Loading allowed service styles for vendor:', vendorId);
      
      // Use the new dedicated endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/allowed-service-styles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [ROLE-CONFIG] API Response:', data);
        
        if (data.success && Array.isArray(data.allowedStyles)) {
          console.log('✅ [ROLE-CONFIG] Setting allowed styles:', data.allowedStyles);
          setAllowedServiceStyles(data.allowedStyles);
          setRoleConfig(data.roleConfig);
        } else {
          console.error('❌ [ROLE-CONFIG] Invalid response format - allowedStyles is not an array:', data);
          setAllowedServiceStyles([]);
        }
      } else {
        const errorData = await response.json();
        console.error('❌ [ROLE-CONFIG] API request failed:', response.status, errorData);
        toast.error(errorData.error || 'Failed to load role configuration');
        setAllowedServiceStyles([]);
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
            <Button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </Button>
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
              { value: 'at_home' as ServiceStyle, label: 'Home Services', icon: '🏠', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
              { value: 'at_center' as ServiceStyle, label: 'Book at Clinic', icon: '🏥', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
              { value: 'tele' as ServiceStyle, label: 'Tele Consultation', icon: '📱', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' }
            ]
              .filter(type => Array.isArray(allowedServiceStyles) && allowedServiceStyles.includes(type.value))
              .map(type => (
                <Button
                  key={type.value}
                  onClick={() => setSelectedServiceStyle(type.value)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${type.color}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{type.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{type.label}</h3>
                      <p className="text-xs text-gray-600 mt-0.5">{getStyleDescription(type.value)}</p>
                    </div>
                    <div className="text-gray-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Button>
              ))}
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

        {/* ✅ NEW: Catalog View Section (Only for at_center or both) */}
        {canCreateCustomServices && (
          <div className="p-4">
            <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-lg">Service Catalog</h3>
                  <p className="text-sm text-white/90 mb-4">
                    Browse and enable services from our catalog
                  </p>
                </div>
                <Plus className="w-6 h-6 flex-shrink-0" />
              </div>
              
              <Button
                onClick={() => setShowCatalogView(true)}
                className="w-full bg-white text-[#FF8C42] hover:bg-gray-100 font-semibold"
              >
                Browse Catalog
              </Button>
              
              <p className="text-xs text-white/80 mt-3 text-center">
                ⭐ Only available for center-based services
              </p>
            </div>
          </div>
        )}

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