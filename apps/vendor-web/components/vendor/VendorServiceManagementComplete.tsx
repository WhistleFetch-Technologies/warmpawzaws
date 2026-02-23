'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';
import { VendorServiceConfigurationScreen } from './VendorServiceConfigurationScreen';
import { VendorCustomServiceCreationEnhanced as VendorCustomServiceCreation } from './VendorCustomServiceCreationEnhanced'; // ✅ ENHANCED: Role-based custom services
import { VendorServiceCatalogView } from './VendorServiceCatalogView';
import { getVendorRoleId, hasVendorRole } from '@/lib/vendor-utils';
import { getServiceStyleLabelForRole } from '@/lib/service-style-labels';
import { useVendorCapabilities } from './hooks/useVendorCapabilities';
import CapabilityHelper from '@/lib/capability-helper';

interface VendorServiceManagementCompleteProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

type ServiceStyle = 'at_home' | 'at_center' | 'tele';

export function VendorServiceManagementComplete({ 
  vendorId, 
  vendorData, 
  onBack,
}: VendorServiceManagementCompleteProps) {
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<ServiceStyle[]>([]);
  const [loadingRoleConfig, setLoadingRoleConfig] = useState(true);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(null);
  const [roleConfig, setRoleConfig] = useState<any>(null);
  const [fetchedRoleId, setFetchedRoleId] = useState<string | null>(null); // ✅ NEW: Store roleId from API
  const [fetchedRoleName, setFetchedRoleName] = useState<string | null>(null); // ✅ Role name for role-based labels
  const [showCustomServices, setShowCustomServices] = useState(false); // ✅ NEW
  const [showCatalogView, setShowCatalogView] = useState(false); // ✅ NEW: Catalog browsing
  const [serviceCounts, setServiceCounts] = useState<Record<ServiceStyle, number>>({
    at_home: 0,
    at_center: 0,
    tele: 0
  }); // ✅ NEW: Track service counts per style

  // ✅ NEW: Load vendor capabilities for capability-based checks
  // ✅ CRITICAL FIX: Check both roleId formats (camelCase and snake_case)
  const effectiveRoleId = vendorData?.roleId || vendorData?.role_id || vendorData?.selected_role_id;
  const { capabilities } = useVendorCapabilities(effectiveRoleId);
  
  // ✅ NEW: Check if vendor is solo provider
  const vendorConfiguration = vendorData?.vendorConfiguration || vendorData?.vendor_configuration || roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration || null;
  const isSoloProvider = vendorConfiguration === 'solo' || vendorData?.isSoloProvider || vendorData?.is_solo_provider || false;

  useEffect(() => {
    loadRoleConfiguration();
  }, [vendorId]);
  
  // ✅ Refresh counts when returning from sub-views
  useEffect(() => {
    if (!selectedServiceStyle && !showCatalogView && !showCustomServices) {
      loadRoleConfiguration();
    }
  }, [selectedServiceStyle, showCatalogView, showCustomServices]);

  // ✅ PHASE 3: Role-based conditional field visibility (using utility functions)
  const vendorRoleId = getVendorRoleId(vendorData);
  const isCafe = hasVendorRole(vendorData, ['pet_cafe', 'cafe']);
  const isResort = hasVendorRole(vendorData, ['pet_resort', 'resort']);
  const isBoarding = hasVendorRole(vendorData, ['pet_boarding', 'boarding']);
  const isRetail = hasVendorRole(vendorData, ['pet_products_store', 'product_seller', 'retail', 'seller', 'ecommerce']);
  const isPharmacy = hasVendorRole(vendorData, ['pet_pharmacy', 'pharmacy']);
  const isHealthcare = hasVendorRole(vendorData, ['veterinarian', 'veterinary_clinic', 'pet_clinic', 'vet']);
  const supportsHomeService = !isCafe && !isResort && !isBoarding && !isRetail && !isPharmacy; // Cafe, Resort, Boarding, Retail, Pharmacy don't do home services
  
  // ✅ NEW: Check if trainer/walker/sitter who can create session packages even as solo (NOT groomer/vet)
  const isTrainerWalkerSitter = hasVendorRole(vendorData, ['pet_trainer', 'trainer', 'trainer_solo', 'pet_behaviorist', 'behaviorist_solo', 'behaviorist_center', 'pet_walker', 'walker', 'dog_walker', 'pet_sitter', 'sitter']);
  // Solo groomer and solo vet: custom services YES, custom packages NO
  const isSoloGroomer = isSoloProvider && hasVendorRole(vendorData, ['pet_groomer', 'groomer', 'groomer_solo']);
  const isSoloVet = isSoloProvider && hasVendorRole(vendorData, ['veterinarian', 'vet', 'vet_solo']);
  
  // ✅ Solo trainers/walkers/sitters CAN create session packages; solo groomer/vet cannot
  const canCreatePackages = (!isSoloProvider || (isTrainerWalkerSitter && !isSoloGroomer && !isSoloVet));

  // ✅ FIX: Add ref to prevent multiple simultaneous calls
  const loadingRef = useRef(false);
  const lastCallTimeRef = useRef(0);
  
  const loadRoleConfiguration = async (retryCount = 0) => {
    // ✅ FIX: Prevent multiple simultaneous calls
    if (loadingRef.current) {
      console.log('🔧 [ROLE-CONFIG] Already loading, skipping duplicate call');
      return;
    }
    
    // ✅ FIX: Debounce rapid successive calls (wait at least 500ms between calls)
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    if (timeSinceLastCall < 500 && lastCallTimeRef.current > 0) {
      console.log('🔧 [ROLE-CONFIG] Debouncing rapid call, waiting...');
      return;
    }
    lastCallTimeRef.current = now;
    
    try {
      loadingRef.current = true;
      setLoadingRoleConfig(true);
      console.log('🔧 [ROLE-CONFIG] Loading allowed service styles for vendor:', vendorId);
      
      // ✅ FIX: Use /vendor/:vendorId/services endpoint (now includes role config and allowedServiceStyles)
      const data = await apiClient.get(`/vendor/${vendorId}/services`) as any;

      if (data && data.success) {
        console.log('✅ [ROLE-CONFIG] API Response:', data);
        
        // ✅ FIX: Extract allowedServiceStyles and role config from services endpoint response
        // ⚠️ CRITICAL: Do NOT default to all three styles - only use what backend returns
        // If backend returns empty/null, we'll derive from role name as fallback
        let allowedStyles = data.allowedServiceStyles || data.allowed_service_styles || [];
        
        // ✅ NEW: If no styles from backend, derive from role name as safety fallback
        // Normalize role name: "Training Center" -> "training_center" so lookup works
        if (!Array.isArray(allowedStyles) || allowedStyles.length === 0) {
          const roleNameRaw = (data.role?.name || data.roleName || '').toLowerCase();
          const roleName = roleNameRaw.replace(/\s+/g, '_'); // e.g. "training center" -> "training_center"
          console.log('⚠️ [ROLE-CONFIG] No allowedServiceStyles from backend, deriving from role:', roleName);
          
          // Role-based service style rules (must match backend vendor-services.ts)
          const ROLE_SERVICE_STYLES: Record<string, string[]> = {
            'pet_groomer': ['at_center', 'at_home'],
            'groomer': ['at_center', 'at_home'],
            'groomer_solo': ['at_home'],
            'groomer_center': ['at_center', 'at_home'],
            'pet_walker': ['at_home'],
            'walker': ['at_home'],
            'pet_trainer': ['at_home', 'at_center', 'tele'],
            'trainer': ['at_home', 'at_center', 'tele'],
            'trainer_center': ['at_home', 'at_center', 'tele'], // Training center: center + home + tele
            'training_center': ['at_home', 'at_center', 'tele'],
            'trainer_solo': ['at_home', 'tele'],
            'pet_sitter': ['at_home'],
            'sitter': ['at_home'],
            'pet_taxi': ['at_home'],
            'pet_boarding': ['at_center'],
            'pet_resort': ['at_center'],
            'pet_cafe': ['at_center'],
            'veterinarian': ['at_center', 'tele', 'at_home'],
            'vet': ['at_center', 'tele', 'at_home'],
            'vet_solo': ['at_home', 'tele'],
            'veterinary_clinic': ['at_center', 'tele', 'at_home'],
            'vet_clinic': ['at_center', 'tele', 'at_home'],
            'nutritionist': ['at_center', 'tele', 'at_home'],
            'pet_nutritionist': ['at_center', 'tele', 'at_home'],
            'pet_behaviorist': ['at_home', 'at_center', 'tele'],
            'diagnostics': ['at_home', 'at_center'],
            'diagnostic_center': ['at_home', 'at_center'],
            'diagnostics_center': ['at_home', 'at_center'],
            'pet_pharmacy': ['delivery', 'pickup'],
            'pharmacy': ['delivery', 'pickup'],
            'pet_products_store': ['delivery', 'pickup'],
          };
          
          allowedStyles = ROLE_SERVICE_STYLES[roleName] || ['at_home'];
          // Map 'online' -> 'tele' for UI (backend may return either)
          allowedStyles = allowedStyles.map(s => (s === 'online' ? 'tele' : s)).filter(s => ['at_center', 'at_home', 'tele'].includes(s));
        }
        
        const roleConfig = data.role?.config || data.roleConfig || {};
        const vendorConfiguration = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
        
        // ✅ FIX: Ensure veterinarian roles always have at_home, at_center, and tele options (unless solo provider)
        const roleId = data.role?.id || data.roleId || '';
        const roleName = data.role?.name || data.roleName || '';
        
        // ✅ NEW: Store roleId and roleName in state for passing to catalog view and role-based labels
        if (roleId) setFetchedRoleId(roleId);
        if (roleName) setFetchedRoleName(roleName);
        if ((roleId?.toLowerCase().includes('veterinarian') || roleName?.toLowerCase().includes('veterinarian')) 
            && Array.isArray(allowedStyles)
            && vendorConfiguration !== 'solo') { // ✅ Don't override for solo providers
          // Ensure all three service styles are available for veterinarians (non-solo)
          const requiredStyles = ['at_home', 'at_center', 'tele'];
          allowedStyles = [...new Set([...allowedStyles, ...requiredStyles])];
        }
        
        // ✅ NEW: Extract service counts per style - ONLY COUNT ENABLED SERVICES
        const counts: Record<ServiceStyle, number> = {
          at_home: 0,
          at_center: 0,
          tele: 0
        };
        
        // ✅ FIX: Use servicesByStyle (grouped) for counts; backend returns services = array, servicesByStyle = grouped
        // ✅ CRITICAL FIX: Only count enabled services (isEnabled === true)
        const grouped = data.servicesByStyle || data.services;
        if (grouped && typeof grouped === 'object' && !Array.isArray(grouped)) {
          if (grouped.at_home && Array.isArray(grouped.at_home.services)) {
            // Count only enabled services
            counts.at_home = grouped.at_home.services.filter((svc: any) => 
              svc.isEnabled === true || svc.is_enabled === true
            ).length;
          }
          if (grouped.at_center && Array.isArray(grouped.at_center.services)) {
            // Count only enabled services
            counts.at_center = grouped.at_center.services.filter((svc: any) => 
              svc.isEnabled === true || svc.is_enabled === true
            ).length;
          }
          if (grouped.tele && Array.isArray(grouped.tele.services)) {
            // Count only enabled services
            counts.tele = grouped.tele.services.filter((svc: any) => 
              svc.isEnabled === true || svc.is_enabled === true
            ).length;
          }
        }
        
        // ✅ FIX: Only use allServices as fallback if grouped counts are all 0
        // This prevents double-counting when both sources have data
        // ✅ CRITICAL FIX: Only count enabled services in fallback too
        if ((counts.at_home === 0 && counts.at_center === 0 && counts.tele === 0) && 
            data.allServices && Array.isArray(data.allServices)) {
          // Fallback: count from allServices only if grouped counts are empty, but only enabled services
          data.allServices.forEach((svc: any) => {
            const isEnabled = svc.isEnabled === true || svc.is_enabled === true;
            if (!isEnabled) return; // Skip disabled services
            
            const style = svc.serviceStyle || svc.service_style;
            if (style === 'at_home') counts.at_home++;
            else if (style === 'at_center') counts.at_center++;
            else if (style === 'tele') counts.tele++;
          });
        }
        
        console.log('✅ [ROLE-CONFIG] Service counts:', counts);
        setServiceCounts(counts);
        
        if (Array.isArray(allowedStyles)) {
          // Map 'online' -> 'tele' so UI shows all three options (Center, Home, Tele)
          const normalizedStyles = allowedStyles.map((s: string) => (s === 'online' ? 'tele' : s)).filter((s: string) => ['at_center', 'at_home', 'tele'].includes(s));
          if (normalizedStyles.length > 0) allowedStyles = normalizedStyles;
          console.log('✅ [ROLE-CONFIG] Setting allowed styles:', allowedStyles);
          setAllowedServiceStyles(allowedStyles);
          setRoleConfig(roleConfig);
          
          // ✅ DYNAMIC SERVICE STYLES: Backend now handles filtering correctly
          // Center-capable solo roles (trainers, training center, groomers, vets) CAN have at_center
          // Only filter out for solo-only roles (walkers, sitters, taxi)
          const vendorConfig = roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
          const CENTER_CAPABLE_SOLO_ROLES = ['pet_trainer', 'trainer', 'trainer_center', 'training_center', 'pet_groomer', 'groomer', 'veterinarian', 'vet'];
          const SOLO_ONLY_ROLES = ['pet_sitter', 'sitter', 'pet_walker', 'walker', 'pet_taxi'];
          const roleNameNorm = (typeof roleName === 'string' ? roleName : '').toLowerCase().replace(/\s+/g, '_');
          const isCenterCapableSolo = CENTER_CAPABLE_SOLO_ROLES.includes(roleNameNorm);
          const isSoloOnlyRole = SOLO_ONLY_ROLES.includes(roleNameNorm);
          
          if (vendorConfig === 'solo' && isSoloOnlyRole && !isCenterCapableSolo && allowedStyles.includes('at_center')) {
            console.log('⚠️ [ROLE-CONFIG] Solo-only role detected - filtering at_center');
            const filteredStyles = allowedStyles.filter(style => style !== 'at_center');
            setAllowedServiceStyles(filteredStyles);
          } else if (vendorConfig === 'solo' && isCenterCapableSolo) {
            console.log('✅ [ROLE-CONFIG] Center-capable solo role - keeping all styles including at_center');
            // Keep all styles - center-capable solo vendors (trainers, groomers, vets) CAN have center services
          }
        } else {
          console.error('❌ [ROLE-CONFIG] Invalid response format - allowedServiceStyles is not an array:', data);
          setAllowedServiceStyles(['at_home', 'at_center', 'tele']); // Default fallback
          setRoleConfig({});
        }
      } else {
        console.error('❌ [ROLE-CONFIG] API request failed:', data);
        toast.error(data?.error || 'Failed to load role configuration');
        // ✅ Derive from vendorData.roleName when API fails so training center / trainer still see Center + Home
        const fallbackRoleName = (vendorData?.roleName || vendorData?.role_name || '').toLowerCase().replace(/\s+/g, '_');
        const FALLBACK_ROLE_STYLES: Record<string, string[]> = {
          pet_trainer: ['at_home', 'at_center', 'tele'], trainer: ['at_home', 'at_center', 'tele'],
          trainer_center: ['at_home', 'at_center', 'tele'], training_center: ['at_home', 'at_center', 'tele'],
          trainer_solo: ['at_home', 'tele'],
          pet_groomer: ['at_center', 'at_home'], groomer: ['at_center', 'at_home'], groomer_center: ['at_center', 'at_home'],
          groomer_solo: ['at_home'],
          veterinarian: ['at_center', 'tele', 'at_home'], vet: ['at_center', 'tele', 'at_home'], veterinary_clinic: ['at_center', 'tele', 'at_home'],
          vet_solo: ['at_home', 'tele'],
          diagnostics: ['at_home', 'at_center'], diagnostic_center: ['at_home', 'at_center'], diagnostics_center: ['at_home', 'at_center'],
          pet_walker: ['at_home'], walker: ['at_home'], pet_sitter: ['at_home'], sitter: ['at_home'],
        };
        const derived = FALLBACK_ROLE_STYLES[fallbackRoleName] || ['at_home'];
        setAllowedServiceStyles(derived.map(s => (s === 'online' ? 'tele' : s)).filter(s => ['at_center', 'at_home', 'tele'].includes(s)));
        setRoleConfig({});
      }
    } catch (error: any) {
      // ✅ FIX: Handle rate limiting with retry logic
      if (error?.isRateLimit || error?.statusCode === 429) {
        const retryAfter = error?.retryAfter || 5;
        const maxRetries = 3;
        
        if (retryCount < maxRetries) {
          console.log(`⏳ [ROLE-CONFIG] Rate limited, retrying in ${retryAfter}s (attempt ${retryCount + 1}/${maxRetries})`);
          // Wait for retryAfter seconds, then retry with exponential backoff
          const delay = retryAfter * 1000 * Math.pow(2, retryCount);
          setTimeout(() => {
            loadRoleConfiguration(retryCount + 1);
          }, delay);
          return; // Don't set error state, will retry
        } else {
          console.error('❌ [ROLE-CONFIG] Rate limit exceeded after retries');
          toast.error(`Too many requests. Please wait ${retryAfter} seconds and refresh the page.`);
        }
      } else if (error?.message?.includes('CORS') || error?.message?.includes('Failed to fetch')) {
        // ✅ FIX: Handle CORS errors gracefully
        console.error('❌ [ROLE-CONFIG] CORS or network error:', error);
        toast.error('Network error. Please check your connection and try again.');
      } else {
        console.error('❌ [ROLE-CONFIG] Exception during role config load:', error);
        toast.error('Error loading role configuration');
      }
      
      // Only set empty styles if we're not retrying
      if (retryCount >= 3 || (!error?.isRateLimit && error?.statusCode !== 429)) {
        setAllowedServiceStyles([]);
      }
    } finally {
      loadingRef.current = false;
      setLoadingRoleConfig(false);
    }
  };

  // ✅ Role-based labels (e.g. "Training center booking" for trainers, "Clinic booking" for vets)
  const roleNameForLabels = fetchedRoleName || vendorData?.roleName || vendorData?.role_name || '';
  const getStyleIcon = (style: ServiceStyle) => getServiceStyleLabelForRole(roleNameForLabels, style).icon;
  const getStyleName = (style: ServiceStyle) => getServiceStyleLabelForRole(roleNameForLabels, style).label;
  const getStyleDescription = (style: ServiceStyle) => getServiceStyleLabelForRole(roleNameForLabels, style).description;

  // If a service style is selected, show the configuration screen
  if (selectedServiceStyle) {
    return (
      <VendorServiceConfigurationScreen
        vendorId={vendorId}
        vendorData={vendorData}
        serviceStyle={selectedServiceStyle}
        roleConfig={roleConfig}
        roleId={fetchedRoleId}
        roleName={fetchedRoleName || vendorData?.roleName || vendorData?.role_name}
        onBack={() => setSelectedServiceStyle(null)}
        onBrowseCatalog={() => {
          setSelectedServiceStyle(null);
          setShowCatalogView(true);
        }}
      />
    );
  }

  // ✅ NEW: If custom services view is active
  if (showCustomServices) {
    // Pass role name so solo trainer/groomer get correct category and session-package eligibility
    const vendorDataWithRoleName = {
      ...vendorData,
      roleName: fetchedRoleName || vendorData?.roleName || vendorData?.role_name,
      role_name: fetchedRoleName || vendorData?.role_name || vendorData?.roleName,
    };
    return (
      <VendorCustomServiceCreation
        vendorId={vendorId}
        vendorData={vendorDataWithRoleName}
        serviceStyle={vendorData?.serviceStyle}
        allowedServiceStyles={allowedServiceStyles}
        onClose={() => setShowCustomServices(false)}
        onServiceCreated={() => {
          toast.success('Custom service created!');
          setShowCustomServices(false);
          loadRoleConfiguration(); // Refresh service counts
        }}
      />
    );
  }

  // DETACHED: Package Management - 500 errors, will fix later
  // if (showPackages) { return <PackageManagementContainer ... /> }

  // ✅ NEW: If catalog view is active
  if (showCatalogView) {
    // ✅ FIX: Extract roleId from state (fetched), roleConfig, or vendorData
    const catalogRoleId = fetchedRoleId || roleConfig?.id || vendorData?.roleId || vendorData?.role_id || vendorRoleId;
    console.log('📚 [SERVICE-MGMT] Opening catalog with roleId:', catalogRoleId);
    
    return (
      <VendorServiceCatalogView
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => setShowCatalogView(false)}
        mode="multi-select" // ✅ Enable multi-select mode for bulk service addition
        allowedServiceStyles={allowedServiceStyles} // ✅ Pass role-based allowed styles
        roleId={catalogRoleId} // ✅ NEW: Pass roleId directly for catalog filtering
        roleName={fetchedRoleName || vendorData?.roleName || vendorData?.role_name} // ✅ Role-based labels
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

  // ✅ NEW: Check if vendor can create custom services (capability-based + solo groomer/vet always)
  // Solo groomer and solo vet always get custom services (packages remain disabled for them)
  const canCreateCustomServices = capabilities.custom_services || capabilities.customServices || isSoloGroomer || isSoloVet || false;

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

        {/* ❌ REMOVED: Staff management banner - staff has been decommissioned */}

        {/* ✅ FIX: Platform Catalog Section - Show at top for easy access */}
        {/* ✅ FIX: Show Browse Catalog for any vendor with catalog, booking, OR services capability (post-migration canonical roles) */}
        {((capabilities || {}).catalog || (capabilities || {}).booking || (capabilities || {}).services || CapabilityHelper.hasCapability(capabilities, 'services')) && (
          <div className="p-4">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-lg">Browse Service Catalog</h3>
                  <p className="text-sm text-white/90 mb-4">
                    Browse services from the admin catalog and add them to your vendor offerings
                  </p>
                </div>
                <Package className="w-6 h-6 flex-shrink-0" />
              </div>
              
              <Button
                onClick={() => setShowCatalogView(true)}
                className="w-full bg-white text-blue-600 hover:bg-gray-100 font-semibold"
              >
                Browse Catalog
              </Button>
              
              <p className="text-xs text-white/80 mt-3 text-center">
                ℹ️ Add services from the platform catalog to your offerings
              </p>
            </div>
          </div>
        )}

        {/* Service Style Selection */}
        {/* ✅ FIX: Show service style tabs for ALL vendors (solo and business) */}
        {/* Solo vendors will only see at_home and tele (at_center is filtered out by backend) */}
        <div className="p-4">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900 mb-1">
              {isSoloProvider ? 'Manage Your Services' : 'Select Service Type'}
            </h2>
            <p className="text-sm text-gray-600">
              {isSoloProvider 
                ? 'Enable, configure and publish services you want to offer' 
                : 'Choose how you want to deliver your services'
              }
            </p>
          </div>

          <div className="space-y-3">
            {(['at_home', 'at_center', 'tele'] as ServiceStyle[])
              .filter(value => Array.isArray(allowedServiceStyles) && allowedServiceStyles.includes(value))
              .map(value => {
                const config = getServiceStyleLabelForRole(roleNameForLabels, value);
                return { value, label: config.label, icon: config.icon, color: value === 'at_home' ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' : value === 'at_center' ? 'bg-green-50 border-green-200 hover:bg-green-100' : 'bg-purple-50 border-purple-200 hover:bg-purple-100', activeColor: value === 'at_home' ? 'border-blue-500' : value === 'at_center' ? 'border-green-500' : 'border-purple-500', description: config.description };
              })
              .map((type: { value: ServiceStyle; label: string; icon: string; color: string; activeColor: string; description: string }) => {
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
                            : type.description
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
        
        {/* ✅ SOLO VENDOR: Show helpful tip banner */}
        {isSoloProvider && (
          <div className="px-4 -mt-2 mb-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-blue-800 leading-relaxed">
                <span className="font-semibold">💡 Tip:</span> Tap a service type above to enable, configure pricing, and publish services. 
                {canCreateCustomServices && ' You can also create custom services tailored to your expertise.'}
              </p>
            </div>
          </div>
        )}

        {/* ✅ NEW: Custom Services Section (Capability-based) */}
        {canCreateCustomServices && (
          <div className="p-4">
            <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold mb-2 text-lg">Custom Services</h3>
                  <p className="text-sm text-white/90 mb-4">
                    Create your own specialized services and packages tailored to your expertise
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
                ⭐ Available for all service styles (home, tele, center)
              </p>
            </div>
          </div>
        )}

        {/* DETACHED: Package Management - 500 errors, will fix later */}

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
                <span>For center/clinic services, customize pricing or add custom services</span>
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