'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  Plus, 
  Check, 
  Search, 
  X, 
  CheckSquare, 
  Square 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/session-manager';
import { getVendorRoleId, normalizeServiceStyle, isServiceApplicableToRole } from '@/lib/vendor-utils';
import { getServiceStyleLabel } from '@/lib/service-style-labels';

interface VendorServiceCatalogViewProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  onSelectService?: (service: any) => void;
  mode?: 'browse' | 'multi-select';
  allowedServiceStyles?: ('at_home' | 'at_center' | 'tele')[]; // ✅ NEW: Filter by role config
  roleId?: string; // ✅ NEW: Direct roleId prop for catalog filtering
  roleName?: string | null; // ✅ For role-based labels (e.g. "Training center booking")
}

interface ServiceCatalogItem {
  catalogId?: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceGroupId?: string;
  serviceGroupName?: string;
  serviceName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[];
  basePrice: number;
  isPackage: boolean;
  packageDetails?: {
    sessionsPerDay: number;
    sessionDuration: number;
    packageDuration: number;
    totalSessions: number;
    pricingBySize: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
  };
  description: string;
  duration?: number;
  // Snake_case variants for API compatibility
  service_name?: string;
  category_name?: string;
  category?: string;
  sub_category_name?: string;
  category_id?: string;
  sub_category_id?: string;
  id?: string;
}

interface CategoryGroup {
  categoryName: string;
  categoryId: string;
  subcategories: {
    subCategoryName: string;
    subCategoryId: string;
    services: ServiceCatalogItem[];
  }[];
}

export function VendorServiceCatalogView({ 
  vendorId, 
  vendorData, 
  onBack,
  onSelectService,
  mode = 'browse',
  allowedServiceStyles, // ✅ NEW: Role-based service style filter
  roleId: propRoleId, // ✅ NEW: Direct roleId prop
  roleName: propRoleName // ✅ For role-based labels
}: VendorServiceCatalogViewProps) {
  const roleNameForLabels = propRoleName ?? vendorData?.roleName ?? vendorData?.role_name ?? '';
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [groupedServices, setGroupedServices] = useState<CategoryGroup[]>([]);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStyle, setActiveStyle] = useState<'all' | 'at_home' | 'at_center' | 'tele'>('all');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [roleAllowedStyles, setRoleAllowedStyles] = useState<string[]>([]); // ✅ NEW: Store allowed styles from API
  const [vendorRoleName, setVendorRoleName] = useState<string>(''); // ✅ NEW: Store role name for filtering

  useEffect(() => {
    loadCatalogData();
  }, [vendorId]);

  useEffect(() => {
    groupServicesByCategory();
  }, [services, searchQuery, activeStyle, vendorData, roleAllowedStyles, vendorRoleName]);

  const loadCatalogData = async () => {
    try {
      setLoading(true);

      // ✅ Get vendor's roleId for filtering services - prefer prop, then try utility, then localStorage
      let vendorRoleId = propRoleId || getVendorRoleId(vendorData);
      
      // ✅ FIX: If roleId still not available, try to get from localStorage
      if (!vendorRoleId && typeof window !== 'undefined') {
        const storedVendorData = localStorage.getItem('vendorData');
        if (storedVendorData) {
          try {
            const parsed = JSON.parse(storedVendorData);
            vendorRoleId = parsed.roleId || parsed.role_id || parsed.selected_role_id;
          } catch (e) {
            console.warn('📚 [CATALOG] Failed to parse stored vendorData');
          }
        }
      }
      
      console.log('📚 [CATALOG] Loading service catalog for roleId:', vendorRoleId);

      // ✅ NEW: Try local service catalog first (faster, role-specific)
      const { getServiceCatalogForRole } = await import('@/lib/service-catalogs');
      const localCatalog = getServiceCatalogForRole(vendorRoleId);
      
      if (localCatalog && localCatalog.length > 0) {
        console.log('📚 [CATALOG] Using local service catalog:', localCatalog.length, 'services');
        // Transform local catalog to match expected format
        const normalizedServices = localCatalog
          .filter((svc: any) => svc.category) // ✅ FIX: Filter out services without category
          .map((svc: any) => ({
            catalogId: svc.id,
            categoryId: (svc.category || 'Uncategorized').toLowerCase().replace(/\s+/g, '_'),
            categoryName: svc.category || 'Uncategorized',
            subCategoryId: (svc.subCategory != null ? String(svc.subCategory).toLowerCase().replace(/\s+/g, '_') : '') || 'general',
            subCategoryName: svc.subCategory || 'General',
            serviceName: svc.name,
            serviceStyle: svc.serviceStyle,
            applicableRoles: svc.applicableRoles || [],
            basePrice: svc.priceRange?.min || 0,
            duration: svc.duration,
            description: svc.description,
            isPackage: svc.isPackage || false,
            packageDetails: svc.packageDetails,
          }));
        
        setServices(normalizedServices);
      }

      // Load services from service catalog API - pass roleId for better filtering
      // NOTE: Using /service-catalog/role/:roleId (public endpoint) instead of /admin/service-catalog
      // which requires admin authentication and causes redirect issues for vendor users
      const catalogUrl = vendorRoleId 
        ? `/service-catalog/role/${vendorRoleId}`
        : '/service-catalog/categories';
      
      let servicesData: any = null;
      try {
        servicesData = await apiClient.get(catalogUrl) as any;
      } catch (apiError) {
        console.warn('📚 [CATALOG] Admin API failed, using local catalog:', apiError);
        // If API fails and we have local catalog, continue with that
        if (localCatalog && localCatalog.length > 0) {
          // Already set above, continue
        } else {
          throw apiError;
        }
      }

      if (servicesData) {
        console.log('📚 [CATALOG] Loaded services data:', servicesData);
        
        // ✅ FIX: Handle different API response structures
        let servicesArray: any[] = [];
        if (Array.isArray(servicesData)) {
          servicesArray = servicesData;
        } else if (servicesData.services && Array.isArray(servicesData.services)) {
          servicesArray = servicesData.services;
        } else if (servicesData.data && Array.isArray(servicesData.data)) {
          servicesArray = servicesData.data;
        } else if (servicesData.results && Array.isArray(servicesData.results)) {
          servicesArray = servicesData.results;
        }
        
        console.log('📚 [CATALOG] Total services found:', servicesArray.length);
        
        if (servicesArray.length > 0) {
          console.log('📚 [CATALOG] Sample service (raw):', servicesArray[0]);
          
          // ✅ CRITICAL: Normalize services from snake_case to camelCase
          const normalizedServices = servicesArray.map((svc: any) => {
            const rawStyle = svc.serviceStyle || svc.service_style;
            const normalizedStyle = normalizeServiceStyle(rawStyle);
            // ✅ FIX: Handle null categoryId - use categoryName as fallback for categoryId
            const categoryName = svc.categoryName || svc.category_name || svc.category || 'General';
            const categoryId = svc.categoryId || svc.category_id || (categoryName ? categoryName.toLowerCase().replace(/\s+/g, '_') : 'general');
            return {
              ...svc,
              // Normalize IDs
              catalogId: svc.catalogId || svc.id || svc.service_id,
              categoryId: categoryId,
              subCategoryId: svc.subCategoryId || svc.sub_category_id || '',
              serviceGroupId: svc.serviceGroupId || svc.service_group_id || '',
              // Normalize names
              serviceName: svc.serviceName || svc.service_name || svc.name || '',
              categoryName: categoryName,
              subCategoryName: svc.subCategoryName || svc.sub_category_name || '',
              serviceGroupName: svc.serviceGroupName || svc.service_group_name || '',
              // ✅ CRITICAL: Normalize serviceStyle using utility function
              serviceStyle: normalizedStyle,
              // Normalize other fields
              applicableRoles: svc.applicableRoles || svc.applicable_roles || [],
              basePrice: parseFloat(svc.basePrice || svc.base_price || '0'),
              duration: svc.duration || svc.duration_minutes || 30,
              isPackage: svc.isPackage || svc.is_package || false,
              description: svc.description || '',
            };
          });
          
          console.log('📚 [CATALOG] Sample service (normalized):', normalizedServices[0]);
          const styleDistribution = normalizedServices.reduce((acc: any, s: any) => {
            acc[s.serviceStyle] = (acc[s.serviceStyle] || 0) + 1;
            return acc;
          }, {});
          console.log('📚 [CATALOG] Service styles distribution:', styleDistribution);
          
          setServices(normalizedServices);
          console.log('✅ [CATALOG] Services set in state:', normalizedServices.length);
        } else {
          console.warn('⚠️ [CATALOG] No services in catalog response!');
          console.warn('⚠️ [CATALOG] Response structure:', Object.keys(servicesData));
          // ✅ FIX: Don't show error if local catalog has services
          if (!localCatalog || localCatalog.length === 0) {
            toast.error('No services found in catalog. Please contact admin.');
          }
        }
      } else {
        console.error('❌ [CATALOG] Failed to load service catalog');
        toast.error('Failed to load service catalog');
      }

      // Load vendor's enabled services
      const vendorServicesData = await apiClient.get(`/vendor/${vendorId}/services`) as any;

      // ✅ CRITICAL FIX: Extract role name from vendor services API response first (more reliable)
      let roleNameFromVendorAPI: string | null = null;
      if (vendorServicesData?.role) {
        roleNameFromVendorAPI = vendorServicesData.role.name || vendorServicesData.role.display_name || null;
        console.log('📋 [CATALOG] Role name from vendor services API:', roleNameFromVendorAPI);
      }

      if (vendorServicesData) {
        const data = vendorServicesData;
        console.log('✅ [VENDOR] Loaded vendor services:', data);
        
        let vendorServicesList: any[] = [];
        
        if (data.allServices && Array.isArray(data.allServices)) {
          vendorServicesList = data.allServices;
        }
        else if (Array.isArray(data.services)) {
          vendorServicesList = data.services;
        }
        else if ((data.servicesByStyle || data.services) && typeof (data.servicesByStyle || data.services) === 'object' && !Array.isArray(data.services)) {
          const grouped = data.servicesByStyle || data.services;
          ['at_home', 'at_center', 'tele'].forEach((style: string) => {
            const bucket = grouped[style];
            if (bucket?.services && Array.isArray(bucket.services)) {
              vendorServicesList.push(...bucket.services);
            }
          });
        }
        else if (data.legacyServices && Array.isArray(data.legacyServices)) {
          vendorServicesList = data.legacyServices;
        }
        
        console.log('✅ [VENDOR] Parsed vendor services:', vendorServicesList.length);
        setVendorServices(vendorServicesList);
      }

      // ✅ Load role configuration to get allowed service styles AND role name
      const currentVendorRoleId = vendorData?.roleId || vendorData?.role_id;
      if (currentVendorRoleId) {
        try {
          const roleConfigData = await apiClient.get(`/config/roles/${currentVendorRoleId}`) as any;
          if (roleConfigData) {
            // ✅ CRITICAL FIX: Use role name from vendor services API if available, otherwise from config
            const roleName = roleNameFromVendorAPI || roleConfigData.name || roleConfigData.roleName || roleConfigData.roleCode || '';
            console.log('📋 [CATALOG] Role name from config:', roleName);
            setVendorRoleName(roleName.toLowerCase());
            
            // ✅ FIX: Extract serviceStyles correctly from role config
            // The API returns: { solo: [], business: [...], selected: [...] }
            const serviceStylesObj = roleConfigData.config?.serviceStyles || 
                                     roleConfigData.config?.allowedServiceStyles || 
                                     roleConfigData.serviceStyles;
            
            console.log('📋 [CATALOG] Raw serviceStylesObj from role config:', serviceStylesObj);
            
            let rawStyles: string[] = [];
            
            if (serviceStylesObj) {
              // If it's an object with selected/business/solo properties
              if (typeof serviceStylesObj === 'object' && !Array.isArray(serviceStylesObj)) {
                // Prefer 'selected' if available, otherwise use 'business' or 'solo' based on vendor type
                const vendorType = vendorData?.vendorConfiguration || vendorData?.vendor_type || 'business';
                console.log('📋 [CATALOG] Vendor type:', vendorType, 'serviceStylesObj keys:', Object.keys(serviceStylesObj));
                
                if (serviceStylesObj.selected && Array.isArray(serviceStylesObj.selected) && serviceStylesObj.selected.length > 0) {
                  rawStyles = serviceStylesObj.selected;
                  console.log('📋 [CATALOG] Using selected styles:', rawStyles);
                } else if (serviceStylesObj.business && Array.isArray(serviceStylesObj.business) && serviceStylesObj.business.length > 0) {
                  rawStyles = serviceStylesObj.business;
                  console.log('📋 [CATALOG] Using business styles:', rawStyles);
                } else if (serviceStylesObj.solo && Array.isArray(serviceStylesObj.solo) && serviceStylesObj.solo.length > 0) {
                  rawStyles = serviceStylesObj.solo;
                  console.log('📋 [CATALOG] Using solo styles:', rawStyles);
                } else {
                  // Fallback: try to flatten all arrays from the object
                  const allStyles = Object.values(serviceStylesObj).flat().filter((s: any) => typeof s === 'string');
                  rawStyles = Array.from(new Set(allStyles)) as string[];
                  console.log('📋 [CATALOG] Flattened all styles from object:', rawStyles);
                }
              } else if (Array.isArray(serviceStylesObj)) {
                rawStyles = serviceStylesObj;
                console.log('📋 [CATALOG] serviceStylesObj is already an array:', rawStyles);
              } else if (typeof serviceStylesObj === 'string') {
                rawStyles = [serviceStylesObj];
                console.log('📋 [CATALOG] serviceStylesObj is a string, converted to array:', rawStyles);
              }
            }
            
            // Final fallback if nothing was extracted
            if (rawStyles.length === 0) {
              rawStyles = roleConfigData.allowedServiceStyles || ['at_home', 'at_center', 'tele'];
              console.log('📋 [CATALOG] Using fallback styles:', rawStyles);
            }
            
            // ✅ FIX: Map role config naming to service catalog naming
            const styleMapping: { [key: string]: string } = {
              'at_clinic': 'at_center',
              'at_center': 'at_center',
              'video_consultation': 'tele',
              'tele': 'tele',
              'tele_consultation': 'tele',
              'home_visit': 'at_home',
              'at_home': 'at_home',
              'home_service': 'at_home'
            };
            
            let allowedStyles = rawStyles.map((style: string) => styleMapping[style] || style);
            console.log('📋 [CATALOG] Raw allowed styles from role config:', rawStyles);
            console.log('📋 [CATALOG] Mapped allowed styles:', allowedStyles);
            
            // ✅ SOLO PROVIDER ENFORCEMENT: Solo vendors cannot have at_center
            const isSoloProvider = vendorData?.vendorConfiguration === 'solo' || 
                                   vendorData?.isSoloProvider === true ||
                                   vendorData?.is_solo_provider === true ||
                                   vendorData?.vendor_type === 'solo';
            if (isSoloProvider) {
              allowedStyles = allowedStyles.filter((s: string) => s !== 'at_center');
              console.log('📋 [CATALOG] Solo provider - filtered out at_center. Final styles:', allowedStyles);
            }
            
            setRoleAllowedStyles(allowedStyles);
          }
        } catch (roleError) {
          console.warn('⚠️ Failed to load role config, using prop or defaults:', roleError);
          let fallbackStyles = allowedServiceStyles || ['at_home', 'at_center', 'tele'];
          // ✅ SOLO PROVIDER ENFORCEMENT
          const isSoloProvider = vendorData?.vendorConfiguration === 'solo' || 
                                 vendorData?.isSoloProvider === true ||
                                 vendorData?.is_solo_provider === true ||
                                 vendorData?.vendor_type === 'solo';
          if (isSoloProvider) {
            fallbackStyles = fallbackStyles.filter((s: string) => s !== 'at_center');
          }
          setRoleAllowedStyles(fallbackStyles);
        }
      } else {
        // Use prop-based allowed styles or defaults
        let propStyles = allowedServiceStyles || ['at_home', 'at_center', 'tele'];
        // ✅ SOLO PROVIDER ENFORCEMENT
        const isSoloProvider = vendorData?.vendorConfiguration === 'solo' || 
                               vendorData?.isSoloProvider === true ||
                               vendorData?.is_solo_provider === true ||
                               vendorData?.vendor_type === 'solo';
        if (isSoloProvider) {
          propStyles = propStyles.filter((s: string) => s !== 'at_center');
        }
        setRoleAllowedStyles(propStyles);
      }
      
      // Load roles list for reference
      try {
        const rolesData = await apiClient.get('/config/roles') as any;
        if (rolesData && rolesData.roles) {
          setRoles(rolesData.roles || []);
        }
      } catch (roleError) {
        console.warn('Failed to load roles list:', roleError);
      }

    } catch (error) {
      console.error('❌ Error loading catalog:', error);
      toast.error('Failed to load service catalog');
    } finally {
      setLoading(false);
    }
  };

  const groupServicesByCategory = () => {
    let filteredServices = [...services];

    const vendorRoleId = getVendorRoleId(vendorData);
    
    console.log('🔍 [GROUPING] Starting with', filteredServices.length, 'services');
    console.log('🔍 [GROUPING] Vendor roleId:', vendorRoleId);
    console.log('🔍 [GROUPING] Total services from API:', services.length);

    // ✅ FIX: DO NOT apply role-based filtering that blocks services
    // Backend already filters services by role, so frontend should show all services returned by API
    // Only apply role filter as a preference, but never block all services
    if (vendorRoleName && filteredServices.length > 0) {
      const beforeFilter = filteredServices.length;
      const roleFilteredServices = filteredServices.filter(service => {
        return isServiceApplicable(service, vendorRoleName);
      });
      console.log('🔍 [GROUPING] Role filter would show:', roleFilteredServices.length, 'services (filtered out:', beforeFilter - roleFilteredServices.length, ')');
      
      // ✅ CRITICAL FIX: Only apply role filter if it doesn't result in empty list
      // If role filter results in 0 services but API returned services, show all services
      if (roleFilteredServices.length > 0) {
        filteredServices = roleFilteredServices;
        console.log('🔍 [GROUPING] Applied role filter - showing', filteredServices.length, 'services');
      } else {
        console.warn('⚠️ [GROUPING] Role filter would hide all services - showing all services from API instead');
        // Keep filteredServices as-is (show all services from API)
      }
    } else {
      console.log('🔍 [GROUPING] No role filter applied - showing all services from API');
    }

    // Phase 2: Respect allowedServiceStyles — never show a style that isn't allowed (Walker: no at_center).
    if (roleAllowedStyles.length > 0) {
      const beforeStyleFilter = filteredServices.length;
      const styleFilteredServices = filteredServices.filter(service => {
        const style = normalizeServiceStyle(service.serviceStyle || (service as any).service_style);
        return roleAllowedStyles.includes(style);
      });
      console.log('🔍 [GROUPING] Style filter would show:', styleFilteredServices.length, 'services (removed', beforeStyleFilter - styleFilteredServices.length, ')');
      
      // ✅ CRITICAL FIX: Only apply style filter if it doesn't result in empty list
      // If style filter results in 0 services but API returned services, show all services
      if (styleFilteredServices.length > 0) {
        filteredServices = styleFilteredServices;
        console.log('🔍 [GROUPING] Applied style filter - showing', filteredServices.length, 'services');
      } else {
        console.warn('⚠️ [GROUPING] Style filter would hide all services - showing all services from API instead');
        // Keep filteredServices as-is (show all services from API)
      }
    } else {
      console.log('🔍 [GROUPING] No style filter applied - roleAllowedStyles is empty');
    }

    // 3. User-selected style filter
    if (activeStyle !== 'all') {
      filteredServices = filteredServices.filter(service => {
        const style = normalizeServiceStyle(service.serviceStyle || (service as any).service_style);
        return style === activeStyle;
      });
      console.log('🔍 [GROUPING] After user style filter:', filteredServices.length, 'services');
    }

    // 3. Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredServices = filteredServices.filter(service => {
        const serviceName = (service.serviceName || service.service_name || '').toLowerCase();
        const categoryName = (service.categoryName || service.category_name || service.category || '').toLowerCase();
        const subCategoryName = (service.subCategoryName || service.sub_category_name || '').toLowerCase();
        const description = (service.description || '').toLowerCase();
        
        return serviceName.includes(query) ||
               categoryName.includes(query) ||
               subCategoryName.includes(query) ||
               description.includes(query);
      });
      console.log('🔍 [GROUPING] After search filter:', filteredServices.length, 'services');
    }

    // ✅ Only group services that have a proper category (no "Uncategorized" section)
    // ✅ FIX: Allow "General" category and handle null categoryId properly
    const withCategory = filteredServices.filter(service => {
      const raw = service.categoryName || service.category_name || service.category;
      const categoryId = service.categoryId || service.category_id;
      // Include if categoryName exists and is not "Uncategorized", or if categoryId exists
      return (raw && String(raw).trim() && String(raw).toLowerCase() !== 'uncategorized') || 
             (categoryId && String(categoryId).trim());
    });

    // Group by category and subcategory
    // ✅ FIX: Use a combination of normalized categoryName to prevent duplicates
    const grouped: { [key: string]: CategoryGroup } = {};
    const serviceKeys = new Set<string>(); // Track services to prevent duplicates

    withCategory.forEach(service => {
      // Handle both camelCase and snake_case field names
      const categoryName = service.categoryName || service.category_name || service.category || 'General';
      // ✅ FIX: Use normalized categoryName as key to prevent duplicates
      const normalizedCategoryName = categoryName.trim().toLowerCase();
      const catKey = normalizedCategoryName;
      
      // Generate categoryId from categoryName if null/empty, using consistent format
      const categoryId = service.categoryId || service.category_id || 
        (categoryName ? categoryName.toLowerCase().replace(/\s+/g, '_') : 'general');
      
      if (!grouped[catKey]) {
        grouped[catKey] = {
          categoryName: categoryName,
          categoryId: categoryId,
          subcategories: []
        };
      }

      const subCatName = service.subCategoryName || service.sub_category_name || 'General';
      const subCatId = service.subCategoryId || service.sub_category_id || 'general';
      
      // ✅ FIX: Create unique service key to prevent duplicates
      const serviceKey = `${service.serviceId || service.id || ''}_${service.serviceStyle || ''}_${service.serviceName || ''}`;
      if (serviceKeys.has(serviceKey)) {
        console.warn('⚠️ [GROUPING] Duplicate service detected, skipping:', serviceKey);
        return; // Skip duplicate service
      }
      serviceKeys.add(serviceKey);
      
      let subcategory = grouped[catKey].subcategories.find(
        sub => sub.subCategoryId === subCatId
      );

      if (!subcategory) {
        subcategory = {
          subCategoryName: subCatName,
          subCategoryId: subCatId,
          services: []
        };
        grouped[catKey].subcategories.push(subcategory);
      }

      subcategory.services.push(service);
    });

    const result = Object.values(grouped);
    console.log('✅ [GROUPING] Final groups:', result.length, 'categories');
    result.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat.categoryName} (${cat.subcategories.length} subcategories)`);
    });
    
    setGroupedServices(result);
  };

  const isServiceApplicable = (service: ServiceCatalogItem, roleName: string): boolean => {
    // Use utility function for consistent service applicability checking
    return isServiceApplicableToRole(service, roleName);
  };

  const isServiceAdded = (service: ServiceCatalogItem): boolean => {
    // ✅ FIX: Handle both camelCase and snake_case property names
    const catalogServiceId = service.catalogId || (service as any).id || (service as any).service_id;
    const catalogServiceName = (service.serviceName || (service as any).service_name || '').toLowerCase();
    const catalogCategoryName = (service.categoryName || (service as any).category_name || '').toLowerCase();
    const catalogServiceStyle = service.serviceStyle || (service as any).service_style;
    
    return vendorServices.some(vs => {
      // Check by service_id (UUID) match
      const vsServiceId = vs.serviceId || vs.service_id || vs.catalogId || vs.catalog_id;
      if (vsServiceId && catalogServiceId && vsServiceId === catalogServiceId) {
        return true;
      }
      
      // Check by name + category + style match
      const vsServiceName = (vs.serviceName || vs.service_name || vs.name || '').toLowerCase();
      const vsCategoryName = (vs.categoryName || vs.category_name || vs.category || '').toLowerCase();
      const vsServiceStyle = vs.serviceStyle || vs.service_style;
      
      // Match by name and category (and optionally style)
      if (vsServiceName === catalogServiceName && vsCategoryName === catalogCategoryName) {
        // If styles match or no style specified, it's a match
        if (!catalogServiceStyle || !vsServiceStyle || catalogServiceStyle === vsServiceStyle) {
          return true;
        }
      }
      
      return false;
    });
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  const getServiceKey = (service: ServiceCatalogItem | any): string => {
    // Handle both camelCase and snake_case property names from API
    const catalogId = service.catalogId || (service as any).id || (service as any).catalog_id;
    const categoryName = service.categoryName || (service as any).category_name || 'unknown';
    const serviceName = service.serviceName || (service as any).service_name || (service as any).display_name || 'unknown';
    return catalogId || `${categoryName}_${serviceName}`;
  };

  const toggleServiceSelection = (service: ServiceCatalogItem) => {
    const serviceKey = getServiceKey(service);
    
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceKey)) {
        newSet.delete(serviceKey);
        console.log('[SELECTION] Removed service:', serviceKey, 'New count:', newSet.size);
      } else {
        newSet.add(serviceKey);
        console.log('[SELECTION] Added service:', serviceKey, 'New count:', newSet.size);
      }
      return newSet;
    });
  };

  const isServiceSelected = (service: ServiceCatalogItem): boolean => {
    const serviceKey = getServiceKey(service);
    return selectedServices.has(serviceKey);
  };

  const handleAddService = async (service: ServiceCatalogItem, targetServiceStyle?: 'at_home' | 'at_center' | 'tele') => {
    // ✅ FIX: Skip if already added
    if (isServiceAdded(service)) {
      toast.info(`${service.serviceName} is already added`);
      return;
    }
    
    try {
      setAdding(true);

      // Phase 2: Determine service style from allowed styles only; never default to at_center when role is Walker.
      const allowed = roleAllowedStyles.length > 0 ? roleAllowedStyles : (allowedServiceStyles || []);
      const defaultStyle = (allowed[0] as 'at_home' | 'at_center' | 'tele') || 'at_home';
      let effectiveServiceStyle: 'at_home' | 'at_center' | 'tele' = defaultStyle;
      
      if (targetServiceStyle && ['at_home', 'at_center', 'tele'].includes(targetServiceStyle) && allowed.includes(targetServiceStyle)) {
        effectiveServiceStyle = targetServiceStyle;
      } else if (service.serviceStyle && allowed.includes(service.serviceStyle)) {
        effectiveServiceStyle = service.serviceStyle as 'at_home' | 'at_center' | 'tele';
      } else if (activeStyle !== 'all' && allowed.includes(activeStyle)) {
        effectiveServiceStyle = activeStyle;
      } else if (allowed.length > 0) {
        effectiveServiceStyle = allowed[0] as 'at_home' | 'at_center' | 'tele';
      }
      
      console.log(`📋 [CATALOG] Adding service "${service.serviceName}" with serviceStyle: ${effectiveServiceStyle}`);

      // Use catalogId as serviceId for backward compatibility with backend
      const effectiveServiceId = service.catalogId || (service as any).id || (service as any).service_id;
      
      const data = await apiClient.post(`/vendor/${vendorId}/services`, {
        vendorId,
        serviceId: effectiveServiceId, // Backend expects serviceId
        catalogId: service.catalogId, // Also send catalogId for fallback
        categoryId: service.categoryId,
        categoryName: service.categoryName,
        subCategoryId: service.subCategoryId,
        subCategoryName: service.subCategoryName,
        serviceGroupId: service.serviceGroupId,
        serviceGroupName: service.serviceGroupName,
        serviceName: service.serviceName,
        serviceStyle: effectiveServiceStyle, // ✅ FIX: Use determined service style (not defaulting to at_center)
        basePrice: service.basePrice,
        duration: service.duration,
        isPackage: service.isPackage,
        packageDetails: service.packageDetails,
        description: service.description,
        isActive: true,
        publishStatus: 'draft' // ✅ NEW: Start as draft, vendor publishes later
      }) as any;

      if (data && data.success) {
        const result = data;
        
        // ✅ FIX: Handle alreadyExists flag from backend
        if (result.alreadyExists) {
          console.log('📋 Service already exists:', service.serviceName);
          toast.info(`${service.serviceName} is already added`);
          
          // Update vendorServices with existing service info from backend
          setVendorServices(prev => {
            const exists = prev.some(s => 
              (s.vendorServiceId === result.vendorServiceId) ||
              (s.serviceId === service.catalogId) ||
              ((s.serviceName || '').toLowerCase() === (service.serviceName || '').toLowerCase() &&
               (s.serviceStyle || '').toLowerCase() === (service.serviceStyle || '').toLowerCase())
            );
            if (!exists) {
              return [...prev, {
                ...service,
                vendorServiceId: result.vendorServiceId,
                publishStatus: result.publishStatus || 'draft',
                isEnabled: result.isEnabled ?? true
              }];
            }
            return prev;
          });
        } else {
          console.log('✅ Service added:', result);
          toast.success(`Added ${service.serviceName} (Draft)`);
          
          setVendorServices(prev => [...prev, {
            ...service,
            vendorServiceId: result.vendorServiceId || result.id,
            publishStatus: 'draft'
          }]);

          if (mode === 'browse' && onSelectService) {
            onSelectService(service);
          }
        }
      } else {
        // Handle error response
        if (data?.error?.includes('already exists') || data?.alreadyExists) {
          toast.info(`${service.serviceName} is already added`);
          // Refresh vendor services list to sync state
          const vendorServicesData = await apiClient.get(`/vendor/${vendorId}/services`) as any;
          if (vendorServicesData?.allServices) {
            setVendorServices(vendorServicesData.allServices);
          }
        } else {
          toast.error(data?.error || 'Failed to add service');
        }
      }
    } catch (error: any) {
      console.error('Error adding service:', error);
      // Handle 409 conflict from error response
      if (error?.message?.includes('already exists') || error?.status === 409) {
        toast.info(`${service.serviceName} is already added`);
      } else {
        toast.error('Failed to add service');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleAddAllSelected = async () => {
    try {
      setAdding(true);
      
      const servicesToAdd: ServiceCatalogItem[] = [];
      const alreadyAddedCount = { count: 0 };
      
      groupedServices.forEach(category => {
        category.subcategories.forEach(subcategory => {
          subcategory.services.forEach(service => {
            if (isServiceSelected(service)) {
              if (isServiceAdded(service)) {
                alreadyAddedCount.count++;
              } else {
                servicesToAdd.push(service);
              }
            }
          });
        });
      });

      console.log(`Adding ${servicesToAdd.length} new services, ${alreadyAddedCount.count} already added`);

      let successCount = 0;
      // ✅ FIX: Use activeStyle filter when adding services in bulk
      const targetStyle = activeStyle !== 'all' ? activeStyle : undefined;
      for (const service of servicesToAdd) {
        try {
          await handleAddService(service, targetStyle);
          successCount++;
        } catch (e) {
          // Individual errors handled in handleAddService
        }
      }

      setSelectedServices(new Set());
      
      if (successCount > 0 && alreadyAddedCount.count > 0) {
        toast.success(`Added ${successCount} services (${alreadyAddedCount.count} already existed)`);
      } else if (successCount > 0) {
        toast.success(`Added ${successCount} services as draft`);
      } else if (alreadyAddedCount.count > 0) {
        toast.info(`All ${alreadyAddedCount.count} selected services were already added`);
      }

    } catch (error) {
      console.error('Error adding services:', error);
      toast.error('Failed to add some services');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        <div className="bg-white border-b border-gray-200 p-4 safe-area-top">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="w-11 h-11 min-w-[44px]" title="Back to Service Management">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Browse Catalog</h1>
              <p className="text-xs text-gray-500">Service Management</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading services...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 safe-area-top">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="w-11 h-11 min-w-[44px]" title="Back to Service Management">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Browse Catalog</h1>
            <p className="text-xs text-gray-500">
              Service Management · {services.length} services · {groupedServices.length} categories
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        {/* Multi-Select Mode Header */}
        {mode === 'multi-select' && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Multi-Select Mode</p>
                <p className="text-xs text-blue-700">
                  {selectedServices.size} service{selectedServices.size !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            {selectedServices.size > 0 && (
              <Button
                onClick={handleAddAllSelected}
                disabled={adding}
                className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
              >
                Add Selected
              </Button>
            )}
          </div>
        )}

        {/* Style Filters - Only show allowed styles from role config */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(() => {
            const effectiveStyles = roleAllowedStyles.length > 0 ? roleAllowedStyles : (allowedServiceStyles || ['at_home', 'at_center', 'tele']);
            const styleOptions = [
              { value: 'all', label: 'All' },
              { value: 'at_center', label: getServiceStyleLabel(roleNameForLabels, 'at_center') },
              { value: 'at_home', label: getServiceStyleLabel(roleNameForLabels, 'at_home') },
              { value: 'tele', label: getServiceStyleLabel(roleNameForLabels, 'tele') }
            ].filter(opt => opt.value === 'all' || effectiveStyles.includes(opt.value));
            
            return styleOptions.map(style => (
              <button
                key={style.value}
                onClick={() => setActiveStyle(style.value as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeStyle === style.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {style.label}
              </button>
            ));
          })()}
        </div>
      </div>

      {/* Services List */}
      <div className="p-4 space-y-3">
        {groupedServices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">
              {services.length > 0 
                ? 'No services match your current filters' 
                : 'No services found'}
            </p>
            <p className="text-xs text-gray-400">
              {searchQuery 
                ? 'Try a different search term or clear filters' 
                : services.length > 0
                  ? 'Try selecting a different service style tab or clear filters'
                  : 'No services available in the catalog'}
            </p>
            {services.length > 0 && (
              <Button
                onClick={() => {
                  setSearchQuery('');
                  setActiveStyle('all');
                }}
                variant="outline"
                size="sm"
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          groupedServices.map(category => (
            <div key={category.categoryId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.categoryId)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900">{category.categoryName}</h3>
                  <p className="text-xs text-gray-500">
                    {category.subcategories.reduce((acc, sub) => acc + sub.services.length, 0)} services
                  </p>
                </div>
                <div className={`transform transition-transform ${expandedCategories.has(category.categoryId) ? 'rotate-180' : ''}`}>
                  ▼
                </div>
              </button>

              {/* Subcategories */}
              {expandedCategories.has(category.categoryId) && (
                <div className="border-t border-gray-200">
                  {category.subcategories.map(subcategory => (
                    <div key={subcategory.subCategoryId} className="border-b border-gray-100 last:border-b-0">
                      {/* Subcategory Header */}
                      <button
                        onClick={() => toggleSubcategory(subcategory.subCategoryId)}
                        className="w-full p-3 pl-8 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="text-left">
                          <h4 className="text-sm font-medium text-gray-800">{subcategory.subCategoryName}</h4>
                          <p className="text-xs text-gray-500">{subcategory.services.length} services</p>
                        </div>
                        <div className={`transform transition-transform ${expandedSubcategories.has(subcategory.subCategoryId) ? 'rotate-180' : ''}`}>
                          ▼
                        </div>
                      </button>

                      {/* Services */}
                      {expandedSubcategories.has(subcategory.subCategoryId) && (
                        <div className="divide-y divide-gray-100">
                          {subcategory.services.map((service, idx) => {
                            const added = isServiceAdded(service);
                            const selected = isServiceSelected(service);
                            const serviceKey = getServiceKey(service); // ✅ FIX: Use consistent key generation
                            
                            // ✅ Check if service is live (published and enabled)
                            const isLive = vendorServices.some(vs => {
                              const vsServiceId = vs.serviceId || vs.service_id || vs.catalogId || vs.catalog_id;
                              const catalogServiceId = service.catalogId || (service as any).id || (service as any).service_id;
                              if (vsServiceId && catalogServiceId && vsServiceId === catalogServiceId) {
                                const isEnabled = vs.isEnabled !== undefined ? vs.isEnabled : (vs.is_enabled !== undefined ? vs.is_enabled : true);
                                const publishStatus = vs.publishStatus || vs.publish_status || 'draft';
                                return isEnabled && publishStatus === 'published';
                              }
                              return false;
                            });
                            
                            // ✅ Disable selection if service is live (published and enabled) in multi-select mode
                            const isDisabled = mode === 'multi-select' && isLive;

                            return (
                              <div
                                key={serviceKey}
                                className={`p-4 pl-12 hover:bg-gray-50 transition-colors ${
                                  selected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                } ${isDisabled ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  {/* ✅ FIX: Checkbox separate from content */}
                                  {mode === 'multi-select' && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!isDisabled) {
                                          toggleServiceSelection(service);
                                        }
                                      }}
                                      disabled={isDisabled}
                                      className={`flex-shrink-0 mt-1 p-1 hover:bg-gray-100 rounded ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                                      type="button"
                                      title={isDisabled ? 'This service is already live and cannot be selected' : ''}
                                    >
                                      {selected ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                      ) : (
                                        <Square className={`w-5 h-5 ${isDisabled ? 'text-gray-300' : 'text-gray-400 hover:text-gray-600'}`} />
                                      )}
                                    </button>
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h5 className="font-medium text-gray-900">{service.serviceName || service.service_name || 'Unnamed Service'}</h5>
                                      {added && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          <Check className="w-3 h-3 mr-1" />
                                          Live
                                        </span>
                                      )}
                                    </div>
                                    
                                    {service.description && (
                                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{service.description}</p>
                                    )}

                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        ₹{Number(service.basePrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </span>
                                      
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {service.serviceStyle && getServiceStyleLabel(roleNameForLabels, service.serviceStyle)}
                                      </span>

                                      {service.duration && (
                                        <span className="text-xs text-gray-500">{service.duration} min</span>
                                      )}

                                      {service.isPackage && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                          Package
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {mode === 'browse' && (
                                    <Button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!added) {
                                          // ✅ FIX: Use activeStyle filter when adding service
                                          const targetStyle = activeStyle !== 'all' ? activeStyle : undefined;
                                          handleAddService(service, targetStyle);
                                        }
                                      }}
                                      disabled={added || adding}
                                      size="sm"
                                      className={added ? 'bg-gray-300 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}