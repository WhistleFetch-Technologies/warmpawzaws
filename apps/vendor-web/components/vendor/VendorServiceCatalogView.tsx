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
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/session-manager';
import { getVendorRoleId, normalizeServiceStyle, isServiceApplicableToRole } from '@/lib/vendor-utils';

interface VendorServiceCatalogViewProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  onSelectService?: (service: any) => void;
  mode?: 'browse' | 'multi-select';
  allowedServiceStyles?: ('at_home' | 'at_center' | 'tele')[]; // ✅ NEW: Filter by role config
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
  allowedServiceStyles // ✅ NEW: Role-based service style filter
}: VendorServiceCatalogViewProps) {
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

      // ✅ Get vendor's roleId for filtering services (using utility)
      const vendorRoleId = getVendorRoleId(vendorData);
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
            subCategoryId: svc.subCategory?.toLowerCase().replace(/\s+/g, '_') || 'general',
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

      // Load services from admin catalog API - pass roleId if available for better filtering
      const catalogUrl = vendorRoleId 
        ? `/admin/service-catalog?roleId=${vendorRoleId}`
        : '/admin/service-catalog';
      
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
        console.log('📚 [CATALOG] Loaded services:', servicesData);
        console.log('📚 [CATALOG] Total services:', servicesData.services?.length || 0);
        
        if (servicesData.services && servicesData.services.length > 0) {
          console.log('📚 [CATALOG] Sample service (raw):', servicesData.services[0]);
          
          // ✅ CRITICAL: Normalize services from snake_case to camelCase
          const normalizedServices = servicesData.services.map((svc: any) => ({
            ...svc,
            // Normalize IDs
            catalogId: svc.catalogId || svc.id || svc.service_id,
            categoryId: svc.categoryId || svc.category_id || '',
            subCategoryId: svc.subCategoryId || svc.sub_category_id || '',
            serviceGroupId: svc.serviceGroupId || svc.service_group_id || '',
            // Normalize names
            serviceName: svc.serviceName || svc.service_name || svc.name || '',
            categoryName: svc.categoryName || svc.category_name || svc.category || 'Uncategorized',
            subCategoryName: svc.subCategoryName || svc.sub_category_name || '',
            serviceGroupName: svc.serviceGroupName || svc.service_group_name || '',
            // ✅ CRITICAL: Normalize serviceStyle using utility function
            serviceStyle: normalizeServiceStyle(svc.serviceStyle || svc.service_style),
            // Normalize other fields
            applicableRoles: svc.applicableRoles || svc.applicable_roles || [],
            basePrice: parseFloat(svc.basePrice || svc.base_price || '0'),
            duration: svc.duration || svc.duration_minutes || 30,
            isPackage: svc.isPackage || svc.is_package || false,
            description: svc.description || '',
          }));
          
          console.log('📚 [CATALOG] Sample service (normalized):', normalizedServices[0]);
          console.log('📚 [CATALOG] Service styles distribution:', 
            normalizedServices.reduce((acc: any, s: any) => {
              acc[s.serviceStyle] = (acc[s.serviceStyle] || 0) + 1;
              return acc;
            }, {})
          );
          
          setServices(normalizedServices);
        } else {
          console.warn('⚠️ [CATALOG] No services in catalog!');
          toast.error('No services found in catalog. Please contact admin.');
        }
      } else {
        console.error('❌ [CATALOG] Failed to load service catalog');
        toast.error('Failed to load service catalog');
      }

      // Load vendor's enabled services
      const vendorServicesData = await apiClient.get(`/vendor/${vendorId}/services`) as any;

      if (vendorServicesData) {
        const data = vendorServicesData;
        console.log('✅ [VENDOR] Loaded vendor services:', data);
        
        let vendorServicesList: any[] = [];
        
        if (data.allServices && Array.isArray(data.allServices)) {
          vendorServicesList = data.allServices;
        }
        else if (data.services && typeof data.services === 'object') {
          ['at_home', 'at_center', 'tele'].forEach(style => {
            if (data.services[style] && data.services[style].services) {
              vendorServicesList.push(...data.services[style].services);
            }
          });
        }
        else if (data.legacyServices && Array.isArray(data.legacyServices)) {
          vendorServicesList = data.legacyServices;
        }
        else if (Array.isArray(data.services)) {
          vendorServicesList = data.services;
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
            // ✅ Extract role name for service filtering (services use role names, not IDs)
            const roleName = roleConfigData.name || roleConfigData.roleName || roleConfigData.roleCode || '';
            console.log('📋 [CATALOG] Role name from config:', roleName);
            setVendorRoleName(roleName.toLowerCase());
            
            const rawStyles = roleConfigData.config?.serviceStyles || 
                                  roleConfigData.config?.allowedServiceStyles || 
                                  roleConfigData.allowedServiceStyles ||
                                  roleConfigData.serviceStyles ||
                                  ['at_home', 'at_center', 'tele'];
            
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
            
            const allowedStyles = rawStyles.map((style: string) => styleMapping[style] || style);
            console.log('📋 [CATALOG] Raw allowed styles from role config:', rawStyles);
            console.log('📋 [CATALOG] Mapped allowed styles:', allowedStyles);
            setRoleAllowedStyles(allowedStyles);
          }
        } catch (roleError) {
          console.warn('⚠️ Failed to load role config, using prop or defaults:', roleError);
          setRoleAllowedStyles(allowedServiceStyles || ['at_home', 'at_center', 'tele']);
        }
      } else {
        // Use prop-based allowed styles or defaults
        setRoleAllowedStyles(allowedServiceStyles || ['at_home', 'at_center', 'tele']);
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
    const effectiveAllowedStyles = roleAllowedStyles.length > 0 ? roleAllowedStyles : (allowedServiceStyles || []);
    
    console.log('🔍 [GROUPING] Starting with', filteredServices.length, 'services');
    console.log('🔍 [GROUPING] Vendor roleId:', vendorRoleId);
    console.log('🔍 [GROUPING] Allowed service styles:', effectiveAllowedStyles);

    // 1. ✅ Role Filter - Use role NAME (not ID) to match service applicable_roles
    if (vendorRoleName) {
      const beforeFilter = filteredServices.length;
      const roleFilteredServices = filteredServices.filter(service => isServiceApplicable(service, vendorRoleName));
      console.log('🔍 [GROUPING] After role filter:', roleFilteredServices.length, 'services (filtered out:', beforeFilter - roleFilteredServices.length, ')');
      console.log('🔍 [GROUPING] Using role name for filter:', vendorRoleName);
      
      if (roleFilteredServices.length === 0 && services.length > 0) {
        // ✅ FALLBACK: If no services specifically for this role, show ALL services
        // This handles cases where the catalog doesn't have role-specific services yet
        console.warn('⚠️ [GROUPING] No services match vendor role:', vendorRoleName, '- showing all services as fallback');
        console.log('Sample service applicable_roles:', (services[0] as any)?.applicable_roles || services[0]?.applicableRoles);
        // Keep filteredServices as-is (don't apply role filter)
      } else {
        filteredServices = roleFilteredServices;
      }
    } else if (vendorRoleId) {
      // Fallback: if role name not loaded yet but we have roleId, show all services temporarily
      console.warn('⚠️ [GROUPING] Role name not loaded yet, showing all services');
    } else {
      console.warn('⚠️ [GROUPING] No vendor role found - showing all services');
    }

    // 2. ✅ Filter by allowed service styles from role config (only if styles are loaded)
    if (effectiveAllowedStyles.length > 0) {
      const beforeStyleFilter = filteredServices.length;
      filteredServices = filteredServices.filter(service => {
        // ✅ FIX: Use utility function for consistent style normalization
        const serviceStyle = normalizeServiceStyle(service.serviceStyle || (service as any).service_style);
        return effectiveAllowedStyles.includes(serviceStyle);
      });
      console.log('🔍 [GROUPING] After role-allowed styles filter:', filteredServices.length, 'services (filtered out:', beforeStyleFilter - filteredServices.length, ')');
    } else {
      console.log('⏳ [GROUPING] Skipping style filter - no allowed styles loaded yet');
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

    // Group by category and subcategory
    const grouped: { [key: string]: CategoryGroup } = {};

    filteredServices.forEach(service => {
      // Handle both camelCase and snake_case field names
      const categoryName = service.categoryName || service.category_name || service.category || 'Uncategorized';
      const categoryId = service.categoryId || service.category_id || categoryName;
      const catKey = categoryId;
      
      if (!grouped[catKey]) {
        grouped[catKey] = {
          categoryName: categoryName,
          categoryId: categoryId,
          subcategories: []
        };
      }

      const subCatName = service.subCategoryName || service.sub_category_name || 'General';
      const subCatId = service.subCategoryId || service.sub_category_id || 'general';
      
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
      } else {
        newSet.add(serviceKey);
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

      // ✅ FIX: Determine service style - use targetServiceStyle, then service.serviceStyle, then activeStyle filter, then default
      // This ensures services are stored in the correct style tab
      let effectiveServiceStyle: 'at_home' | 'at_center' | 'tele' = 'at_center';
      
      if (targetServiceStyle && ['at_home', 'at_center', 'tele'].includes(targetServiceStyle)) {
        effectiveServiceStyle = targetServiceStyle;
      } else if (service.serviceStyle && ['at_home', 'at_center', 'tele'].includes(service.serviceStyle)) {
        effectiveServiceStyle = service.serviceStyle;
      } else if (activeStyle !== 'all' && ['at_home', 'at_center', 'tele'].includes(activeStyle)) {
        effectiveServiceStyle = activeStyle;
      } else if (allowedServiceStyles && allowedServiceStyles.length > 0) {
        // Use first allowed style as default
        effectiveServiceStyle = allowedServiceStyles[0] as 'at_home' | 'at_center' | 'tele';
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
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Service Catalog</h1>
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
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Service Catalog</h1>
            <p className="text-xs text-gray-500">
              {services.length} services • {groupedServices.length} categories
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
                <p className="text-xs text-blue-700">{selectedServices.size} service(s) selected</p>
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
              { value: 'at_center', label: 'At Center' },
              { value: 'at_home', label: 'At Home' },
              { value: 'tele', label: 'Tele' }
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
            <p className="text-gray-500 mb-2">No services found</p>
            <p className="text-xs text-gray-400">
              {searchQuery ? 'Try a different search term' : 'No services available for your role'}
            </p>
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
                            const serviceKey = service.catalogId || `${service.categoryName}_${service.serviceName}_${idx}`;

                            return (
                              <div
                                key={serviceKey}
                                className={`p-4 pl-12 hover:bg-gray-50 transition-colors ${
                                  selected ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  {/* ✅ FIX: Checkbox separate from content */}
                                  {mode === 'multi-select' && (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleServiceSelection(service);
                                      }}
                                      className="flex-shrink-0 mt-1 p-1 hover:bg-gray-100 rounded"
                                      type="button"
                                    >
                                      {selected ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                      ) : (
                                        <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
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
                                        {service.serviceStyle === 'at_home' ? 'At Home' : 
                                         service.serviceStyle === 'at_center' ? 'At Center' : 
                                         service.serviceStyle === 'tele' ? 'Tele Consultation' : 'Tele'}
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