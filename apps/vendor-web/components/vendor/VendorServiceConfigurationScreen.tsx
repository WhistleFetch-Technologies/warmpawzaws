'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, Save, Check, AlertCircle, Clock, IndianRupee, Info, Package, ChevronDown, ChevronUp, X, Edit, Trash2, Search, Stethoscope, Scissors, Heart, Activity, Sparkles, GraduationCap, Home, Phone, Syringe, Pill, FileText, Camera, MapPin, Dog, Cat, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { EnhancedPackageCreationModal } from './EnhancedPackageCreationModal';
import { getServiceStyleLabelForRole } from '@/lib/service-style-labels';

interface VendorServiceConfigurationScreenProps {
  vendorId: string;
  vendorData?: any;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  roleConfig: any;
  roleId?: string | null; // ✅ Optional: pass from parent (e.g. fetched from /vendor/:id/services)
  roleName?: string | null; // ✅ Role name for role-based labels (e.g. "Training center booking")
  onBack: () => void;
  onBrowseCatalog?: () => void; // ✅ Optional: navigate to Browse Catalog from inside config screen
}

interface Service {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  subCategoryName?: string;
  duration: number;
  price: number;
  basePrice?: number; // ✅ FIX: Add basePrice for API compatibility
  isPlatformManaged: boolean;
  isEnabled: boolean;
  customPrice?: number;
  customDuration?: number;
  customDescription?: string;
  publishStatus?: 'draft' | 'pending_approval' | 'published' | 'rejected';
  rejectionReason?: string;
  isPackage: boolean;
  packageDetails?: any;
  whatIncluded?: string[];
  whatNotIncluded?: string[];
  icon?: string;
  petTypes?: string[];
  isCustomService?: boolean;
  // ✅ FIX: Add optional aliases for API response compatibility
  serviceName?: string;
  category?: string;
  subCategory?: string;
  // ✅ FIX: Add catalog service properties for toggle functionality
  isPlatformService?: boolean;
  isVendorEnabled?: boolean;
  serviceId?: string;
  catalogServiceId?: string;
}

export function VendorServiceConfigurationScreen({ 
  vendorId, 
  vendorData,
  serviceStyle,
  roleConfig,
  roleId: roleIdProp,
  roleName: roleNameProp,
  onBack,
  onBrowseCatalog,
}: VendorServiceConfigurationScreenProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // ✅ NEW: Search state
  const [showBulkActions, setShowBulkActions] = useState(false); // ✅ NEW: Bulk actions state
  const [viewMode, setViewMode] = useState<'all' | 'enabled' | 'published'>('all'); // ✅ NEW: View mode filter
  const [editingService, setEditingService] = useState<Service | null>(null); // ✅ Service being edited (opens Edit modal)
  const [editForm, setEditForm] = useState({ price: 0, duration: 30, description: '' }); // ✅ Edit modal form state
  const [savingEdit, setSavingEdit] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<Service | null>(null); // ✅ NEW: Delete confirmation
  const [staffCount, setStaffCount] = useState<number>(0); // ✅ NEW: Track staff count for solo vendor check
  
  // Custom service form
  const [customServiceForm, setCustomServiceForm] = useState({
    serviceName: '',
    description: '',
    duration: 30,
    price: 0
  });
  
  const isPlatformManaged = serviceStyle === 'at_home' || serviceStyle === 'tele';

  // ✅ Run a PUT with retry on 503 (transient overload) so save/publish work seamlessly
  const putWithRetry = async <T,>(putFn: () => Promise<T>, maxRetries = 2): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await putFn();
      } catch (e: any) {
        lastErr = e;
        const is503 = e?.statusCode === 503 || e?.message?.includes('temporarily unavailable');
        if (is503 && attempt < maxRetries) {
          const delayMs = 1000 * (attempt + 1);
          await new Promise<void>(r => setTimeout(r, delayMs));
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  };

  const delayMs = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  
  // ✅ FIX: Use vendor's actual role - never default to 'veterinarian' (would show wrong catalog)
  const roleId = roleIdProp ?? vendorData?.roleId ?? vendorData?.role_id ?? vendorData?.roleName ?? roleConfig?.name ?? roleConfig?.roleId ?? null;
  
  // ✅ FIX: Check if vendor is solo provider
  const vendorConfiguration = vendorData?.vendorConfiguration || vendorData?.vendor_configuration || roleConfig?.vendorConfiguration || roleConfig?.vendor_configuration;
  const isSoloProvider = vendorConfiguration === 'solo' || vendorData?.isSoloProvider || vendorData?.is_solo_provider || false;
  
  // ✅ CRITICAL: Solo providers cannot access at_center services
  useEffect(() => {
    if (isSoloProvider && serviceStyle === 'at_center') {
      toast.error('Solo providers cannot use "at_center" service style. Only "at_home" and "tele" are allowed.');
      onBack();
      return;
    }
  }, [isSoloProvider, serviceStyle, onBack]);
  
  // Next-gen CRUD: Vendors can edit price/duration for ALL services (catalog + custom, all styles).
  // No platform price control — vendor-set price reflects immediately on customer web.
  const canControlPrice = roleConfig?.pricingControl?.canControlPrice ?? true;
  const canControlDuration = roleConfig?.pricingControl?.canControlDuration ?? true;
  const canEditPricing = true; // Allow price edit for all services including catalog; no platform control

  useEffect(() => {
    // Don't load services if solo provider trying to access at_center
    if (isSoloProvider && serviceStyle === 'at_center') {
      return;
    }
    loadServices();
    loadStaffCount(); // ✅ Load staff count to check if vendor is solo
  }, [vendorId, serviceStyle, roleId, isSoloProvider]);

  // ✅ Load staff count to determine if vendor is solo
  const loadStaffCount = async () => {
    try {
      const response = await apiClient.get<{ staff: any[] }>(`/vendor/${vendorId}/staff`);
      const staffList = response.staff || [];
      setStaffCount(staffList.length);
    } catch (error) {
      console.error('Error loading staff count:', error);
      // If error, assume solo vendor (no staff)
      setStaffCount(0);
    }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      
      console.log(`🔄 Loading services for vendor ${vendorId}, style: ${serviceStyle}, roleId: ${roleId}`);
      
      // ✅ FIX: Fetch BOTH catalog services AND vendor's enabled services, then merge
      // This ensures vendor sees all available services from platform catalog
      
      // 1. Fetch vendor's ADDED services first (source of truth for what vendor has)
      // 2. Fetch service catalog only for vendor's actual role (never default to veterinarian)
      let catalogServices: any[] = [];
      if (roleId) {
        try {
          const catalogData = await apiClient.get(`/service-catalog/role/${roleId}?serviceStyle=${serviceStyle}`) as any;
          if (catalogData?.services) {
            catalogServices = catalogData.services;
            console.log(`📚 Catalog services loaded: ${catalogServices.length}`);
          }
          if (catalogData?.message && catalogData?.success === false) {
            toast.error(catalogData.message);
            onBack();
            return;
          }
        } catch (catalogError: any) {
          console.warn('⚠️ Could not load catalog services:', catalogError);
          if (catalogError?.response?.data?.error || catalogError?.message) {
            const errorMsg = catalogError?.response?.data?.error || catalogError?.message;
            if (errorMsg.includes('Solo providers') || errorMsg.includes('at_center')) {
              toast.error(errorMsg);
              onBack();
              return;
            }
          }
        }
      } else {
        console.log('⚠️ No roleId - showing only vendor\'s added services (no catalog)');
      }
      
      // 2. Fetch vendor's own added services for this style
      let vendorServices: any[] = [];
      try {
        const vendorData = await apiClient.get(`/vendor/${vendorId}/services/${serviceStyle}`) as any;
        if (vendorData?.services) {
          vendorServices = vendorData.services;
          console.log(`🏪 Vendor services loaded: ${vendorServices.length}`);
          // ✅ No need to filter here - backend endpoint /vendor/:vendorId/services/:serviceStyle
          // already validates that serviceStyle is allowed before returning services
        }
        // ✅ FIX: Check for error message from API
        if (vendorData?.error && vendorData?.success === false) {
          toast.error(vendorData.error);
          onBack();
          return;
        }
      } catch (vendorError: any) {
        console.warn('⚠️ Could not load vendor services:', vendorError);
        // ✅ FIX: Show error message if API returns specific error
        if (vendorError?.response?.data?.error || vendorError?.message) {
          const errorMsg = vendorError?.response?.data?.error || vendorError?.message;
          if (errorMsg.includes('Solo providers') || errorMsg.includes('at_center')) {
            toast.error(errorMsg);
            onBack();
            return;
          }
        }
      }
      
      // 3. Build list: VENDOR'S ADDED SERVICES FIRST (for publishing), then catalog services not yet added
      // ✅ CRITICAL FIX: Match vendor services by service_id (UUID foreign key to service_catalog.id)
      // vendor_services.service_id is UUID that references service_catalog.id (UUID)
      // We must match by catalog UUID, not by TEXT service_id
      const vendorServiceIds = new Set<string>();
      const vendorServiceMap = new Map<string, any>();
      
      // Backend GET /vendor/:vendorId/services/:style resolves identity id → vendor id and returns only that vendor's services.
      // So when vendorId is identity id (e.g. e23c969e), response services have vendor_id = resolved id (e.g. 45f32970).
      // We must NOT filter by s.vendor_id !== vendorId or we would skip all returned services.
      vendorServices.forEach((s: any) => {
        // ✅ CRITICAL: vendor_services.service_id is UUID (references service_catalog.id)
        const catalogUuid = s.service_id; // This is service_catalog.id (UUID)
        const vendorServiceId = s.id; // This is vendor_services.id (UUID)
        
        // Map by catalog UUID (for matching with catalog services)
        if (catalogUuid) {
          vendorServiceIds.add(String(catalogUuid));
          if (!vendorServiceMap.has(String(catalogUuid))) {
            vendorServiceMap.set(String(catalogUuid), s);
          }
        }
        
        // Also map by vendor_services.id for direct lookups
        if (vendorServiceId) {
          vendorServiceMap.set(`vendor_${vendorServiceId}`, s);
        }
      });
      
      // ✅ CRITICAL: Match catalog services by catalog.id (UUID), not by serviceId (TEXT)
      const catalogIds = new Set(catalogServices.map((s: any) => s.catalogId || s.id).filter(Boolean));
      
      // Helper: format a catalog item with optional vendor overrides
      const formatMerged = (catalogSvc: any, vendorSvc: any, catalogId: string) => {
        // ✅ CRITICAL FIX: Only use vendor_services.id if service is actually added to vendor
        // NEVER use catalog.id (UUID) as service.id - it might match another vendor's vendor_services.id
        // For services not yet added, use catalog serviceId (TEXT) with prefix to avoid UUID conflicts
        const catalogServiceIdText = catalogSvc.serviceId || catalogSvc.service_id || catalogId;
        const catalogIdUuid = catalogSvc.catalogId || catalogSvc.id; // service_catalog.id (UUID)
        
        // ✅ CRITICAL: Use vendorSvc.id when service is added and IDs don't collide.
        // Do NOT require vendorSvc.vendor_id === vendorId: backend already returned only this vendor's
        // services (resolved from identity id), so vendor_id may be resolved id (45f32970) while vendorId is identity id (e23c969e).
        const serviceId = (vendorSvc?.id && vendorSvc.id !== catalogIdUuid)
          ? vendorSvc.id  // Use vendor_services.id (UUID) if service is added and IDs don't match
          : `temp_${catalogServiceIdText}`; // Use catalog serviceId (TEXT) as temp ID
        
        return {
          ...catalogSvc,
          id: serviceId,
          vendorServiceId: vendorSvc?.id ? vendorSvc.id : undefined,
          serviceId: catalogServiceIdText,
          catalogServiceId: catalogServiceIdText,
          name: catalogSvc.name || catalogSvc.serviceName || catalogSvc.service_name || 'Unnamed Service',
          serviceName: catalogSvc.serviceName || catalogSvc.service_name || catalogSvc.name || 'Unnamed Service',
          price: vendorSvc?.customPrice ?? vendorSvc?.custom_price ?? catalogSvc.price ?? catalogSvc.basePrice ?? catalogSvc.base_price ?? 0,
          basePrice: catalogSvc.basePrice ?? catalogSvc.base_price ?? catalogSvc.price ?? 0,
          customPrice: vendorSvc?.customPrice ?? vendorSvc?.custom_price,
          duration: vendorSvc?.customDuration ?? vendorSvc?.custom_duration ?? catalogSvc.duration ?? catalogSvc.duration_minutes ?? 30,
          customDuration: vendorSvc?.customDuration ?? vendorSvc?.custom_duration,
          categoryName: catalogSvc.categoryName || catalogSvc.category_name || catalogSvc.category || 'Platform Services',
          category: catalogSvc.category || catalogSvc.category_name || catalogSvc.categoryName || 'Platform Services',
          subCategoryName: catalogSvc.subCategoryName || catalogSvc.sub_category_name || catalogSvc.subCategory || '',
          subCategory: catalogSvc.subCategory || catalogSvc.sub_category_name || catalogSvc.subCategoryName || '',
          isEnabled: vendorSvc ? (vendorSvc.isEnabled !== undefined ? vendorSvc.isEnabled : (vendorSvc.is_enabled !== undefined ? vendorSvc.is_enabled : true)) : false,
          publishStatus: vendorSvc?.publishStatus || vendorSvc?.publish_status || 'draft',
          description: vendorSvc?.customDescription || vendorSvc?.custom_description || catalogSvc.description || '',
          customDescription: vendorSvc?.customDescription || vendorSvc?.custom_description || '',
          isPlatformService: true,
          isVendorEnabled: !!vendorSvc,
        };
      };
      
      // Vendor's added services FIRST (so they always show for publishing, regardless of catalog role)
      const vendorAddedFromCatalog: any[] = [];
      catalogServices.forEach((catalogSvc: any) => {
        // ✅ CRITICAL: Match by catalog.id (UUID), not by serviceId (TEXT)
        // catalogSvc.catalogId is service_catalog.id (UUID) - this matches vendor_services.service_id (UUID)
        const catalogUuid = catalogSvc.catalogId || catalogSvc.id; // Use catalog UUID for matching
        const vendorSvc = catalogUuid ? vendorServiceMap.get(String(catalogUuid)) : null;
        if (vendorSvc) {
          // vendorSvc came from our GET request; backend already filtered by resolved vendor id, so it's ours
          const catalogServiceIdText = catalogSvc.serviceId || catalogSvc.service_id || 'unknown';
          vendorAddedFromCatalog.push(formatMerged(catalogSvc, vendorSvc, catalogServiceIdText));
        }
      });
      const catalogNotAdded = catalogServices
        .filter((catalogSvc: any) => {
          // ✅ CRITICAL: Check by catalog.id (UUID), not by serviceId (TEXT)
          const catalogUuid = catalogSvc.catalogId || catalogSvc.id;
          return catalogUuid ? !vendorServiceIds.has(String(catalogUuid)) : true;
        })
        .map((catalogSvc: any) => {
          const catalogServiceIdText = catalogSvc.serviceId || catalogSvc.service_id || 'unknown';
          const finalCatalogId = catalogServiceIdText || (catalogSvc.catalogId ? `catalog_${catalogSvc.catalogId}` : 'unknown');
          return formatMerged(catalogSvc, null, finalCatalogId);
        });
      
      // Vendor services not in catalog (e.g. custom or from different catalog)
      const customVendorServices = vendorServices
        .filter((s: any) => {
          // Check if vendor service's service_id (catalog UUID) is in the catalog
          const catalogUuid = s.service_id; // This is service_catalog.id (UUID)
          return catalogUuid ? !catalogIds.has(String(catalogUuid)) : true;
        })
        .map((svc: any) => ({
          ...svc,
          vendorServiceId: svc.id,
          name: svc.name || svc.serviceName || svc.service_name || 'Custom Service',
          serviceName: svc.serviceName || svc.service_name || svc.name || 'Custom Service',
          price: svc.price ?? svc.basePrice ?? svc.base_price ?? 0,
          basePrice: svc.basePrice ?? svc.base_price ?? svc.price ?? 0,
          duration: svc.duration ?? svc.duration_minutes ?? 30,
          categoryName: svc.categoryName || svc.category_name || 'Custom Services',
          isEnabled: svc.isEnabled !== undefined ? svc.isEnabled : (svc.is_enabled !== undefined ? svc.is_enabled : true),
          publishStatus: svc.publishStatus || svc.publish_status || 'draft',
          isPlatformService: false,
          isVendorEnabled: true,
        }));
      
      // ✅ FIX: Vendor's added services first, then catalog not yet added
      const allServices = [...vendorAddedFromCatalog, ...customVendorServices, ...catalogNotAdded];
      console.log(`✅ Total services: ${allServices.length} (${vendorAddedFromCatalog.length} added, ${customVendorServices.length} custom, ${catalogNotAdded.length} available to add)`);
      
      setServices(allServices);
    } catch (error) {
      console.error('❌ Error loading services:', error);
      toast.error('Error loading services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    const newEnabled = !service.isEnabled;
    
    // Optimistically update UI
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, isEnabled: newEnabled } : s
    ));
    
    try {
      if (newEnabled && service.isPlatformService && !service.isVendorEnabled) {
        // ✅ FIX: First time enabling a catalog service - ADD to vendor offerings
        console.log(`➕ Adding catalog service ${service.serviceName} to vendor offerings...`);
        const result = await apiClient.post(`/vendor/${vendorId}/services/add-from-catalog`, {
          catalogServiceId: service.serviceId || service.catalogServiceId || service.id,
          serviceStyle: serviceStyle,
          customPrice: service.customPrice || service.basePrice || service.price,
          customDuration: Math.max(5, Math.min(1440, Number(service.customDuration ?? service.duration ?? 30) || 30)),
          isEnabled: true
        }) as any;
        
        if (result?.success) {
          toast.success(`${service.serviceName} added to your offerings!`);
          // Update the service with the new vendor service ID
          setServices(services.map(s => 
            s.id === serviceId ? { 
              ...s, 
              isEnabled: true, 
              isVendorEnabled: true,
              id: result.vendorServiceId || result.id || s.id 
            } : s
          ));
        } else {
          throw new Error(result?.error || 'Failed to add service');
        }
      } else if (!newEnabled && service.isVendorEnabled) {
        // Disabling an enabled vendor service - just update status
        console.log(`➖ Disabling vendor service ${service.serviceName}...`);
        await apiClient.put(`/vendor/${vendorId}/services/${service.id}`, {
          is_enabled: false,
          duration: service.customDuration ?? service.duration ?? 30,
        });
        toast.success(`${service.serviceName} disabled`);
        await loadServices(); // Reload to ensure state is synced
      } else if (newEnabled && service.isVendorEnabled) {
        // Re-enabling a previously disabled vendor service
        console.log(`✅ Re-enabling vendor service ${service.serviceName}...`);
        await apiClient.put(`/vendor/${vendorId}/services/${service.id}`, {
          is_enabled: true,
          duration: service.customDuration ?? service.duration ?? 30,
        });
        toast.success(`${service.serviceName} enabled`);
        await loadServices(); // Reload to ensure state is synced
      } else if (newEnabled && !service.isVendorEnabled && service.isPlatformService) {
        // Enabling a catalog service that hasn't been added yet - add it
        console.log(`➕ Adding and enabling catalog service ${service.serviceName}...`);
        const result = await apiClient.post(`/vendor/${vendorId}/services/add-from-catalog`, {
          catalogServiceId: service.serviceId || service.catalogServiceId || service.id,
          serviceStyle: serviceStyle,
          customPrice: service.customPrice || service.basePrice || service.price,
          customDuration: Math.max(5, Math.min(1440, Number(service.customDuration ?? service.duration ?? 30) || 30)),
          isEnabled: true
        }) as any;
        
        if (result?.success) {
          toast.success(`${service.serviceName} added and enabled!`);
          await loadServices(); // Reload to get the new vendor service ID
        } else {
          throw new Error(result?.error || 'Failed to add service');
        }
      }
      
      setHasChanges(false); // Changes saved immediately
    } catch (error: any) {
      console.error('Error toggling service:', error);
      toast.error(error.message || 'Failed to update service');
      // Revert optimistic update on error
      setServices(services.map(s => 
        s.id === serviceId ? { ...s, isEnabled: !newEnabled } : s
      ));
    }
  };

  const updateServicePrice = (serviceId: string, price: number) => {
    // ✅ NEW: Validate price
    if (price < 0) {
      toast.error('Price cannot be negative');
      return;
    }
    if (price > 1000000) {
      toast.error('Price is too high. Maximum is ₹10,00,000');
      return;
    }
    
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, customPrice: price } : s
    ));
    setHasChanges(true);
  };

  const updateServiceDuration = (serviceId: string, duration: number) => {
    // ✅ NEW: Validate duration
    if (duration < 5) {
      toast.error('Duration must be at least 5 minutes');
      return;
    }
    if (duration > 1440) {
      toast.error('Duration cannot exceed 24 hours (1440 minutes)');
      return;
    }
    
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, customDuration: duration } : s
    ));
    setHasChanges(true);
  };

  const updateServiceDescription = (serviceId: string, description: string) => {
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, customDescription: description } : s
    ));
    setHasChanges(true);
  };

  const toggleExpanded = (serviceId: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceId)) {
      newExpanded.delete(serviceId);
    } else {
      newExpanded.add(serviceId);
    }
    setExpandedServices(newExpanded);
  };

  // ✅ NEW: Bulk selection functions
  const enableAllServices = () => {
    setServices(services.map(s => ({ ...s, isEnabled: true })));
    setHasChanges(true);
    toast.success('All services enabled');
  };

  const disableAllServices = () => {
    setServices(services.map(s => ({ ...s, isEnabled: false })));
    setHasChanges(true);
    toast.success('All services disabled');
  };

  // ✅ NEW: Batch publish/unpublish - run one request at a time with retry to avoid 503
  const batchPublishServices = async () => {
    const enabledServices = services.filter(s => s.isEnabled && s.publishStatus !== 'published');
    if (enabledServices.length === 0) {
      toast.info('No enabled services to publish');
      return;
    }

    try {
      setIsPublishing(true);
      for (let i = 0; i < enabledServices.length; i++) {
        const service = enabledServices[i];
        if (service.id && service.id.startsWith('temp_')) {
          const catalogId = service.serviceId || service.catalogServiceId || service.id.replace('temp_', '');
          await apiClient.post(`/vendor/${vendorId}/services/add-from-catalog`, {
            catalogServiceId: catalogId,
            serviceStyle: serviceStyle,
            customPrice: service.customPrice || service.basePrice || service.price,
            customDuration: Math.max(5, Math.min(1440, Number(service.customDuration ?? service.duration ?? 30) || 30)),
            isEnabled: true,
            publish_status: 'published'
          });
        } else if (!service.isVendorEnabled && service.isPlatformService) {
          await apiClient.post(`/vendor/${vendorId}/services/add-from-catalog`, {
            catalogServiceId: service.serviceId || service.catalogServiceId || service.id,
            serviceStyle: serviceStyle,
            customPrice: service.customPrice || service.basePrice || service.price,
            customDuration: Math.max(5, Math.min(1440, Number(service.customDuration ?? service.duration ?? 30) || 30)),
            isEnabled: true,
            publish_status: 'published'
          });
        } else {
          if (!service.id || service.id.startsWith('temp_')) {
            toast.error(`Service "${service.serviceName || service.name}" is not yet added. Please add it first.`);
            continue;
          }
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(service.id);
          if (!isUUID) continue;
          const vendorServiceId = service.vendorServiceId ?? service.id;
          await putWithRetry(() =>
            apiClient.put(`/vendor/${vendorId}/services/${vendorServiceId}`, { publish_status: 'published' })
          );
        }
        if (i < enabledServices.length - 1) await delayMs(250);
      }
      toast.success(`${enabledServices.length} service(s) published successfully!`);
      await loadServices();
    } catch (error) {
      console.error('Error batch publishing:', error);
      toast.error('Error publishing services');
    } finally {
      setIsPublishing(false);
    }
  };

  const batchUnpublishServices = async () => {
    const publishedServices = services.filter(s => s.publishStatus === 'published');
    if (publishedServices.length === 0) {
      toast.info('No published services to unpublish');
      return;
    }

    try {
      setIsPublishing(true);
      for (let i = 0; i < publishedServices.length; i++) {
        const service = publishedServices[i];
        const vendorServiceId = service.vendorServiceId ?? service.id;
        await putWithRetry(() =>
          apiClient.put(`/vendor/${vendorId}/services/${vendorServiceId}`, { publish_status: 'draft' })
        );
        if (i < publishedServices.length - 1) await delayMs(250);
      }
      toast.success(`${publishedServices.length} service(s) unpublished successfully!`);
      await loadServices();
    } catch (error) {
      console.error('Error batch unpublishing:', error);
      toast.error('Error unpublishing services');
    } finally {
      setIsPublishing(false);
    }
  };

  const enableCategory = (category: string) => {
    setServices(services.map(s => 
      s.categoryName === category ? { ...s, isEnabled: true } : s
    ));
    setHasChanges(true);
    toast.success(`All ${category} services enabled`);
  };

  const disableCategory = (category: string) => {
    setServices(services.map(s => 
      s.categoryName === category ? { ...s, isEnabled: false } : s
    ));
    setHasChanges(true);
    toast.success(`All ${category} services disabled`);
  };

  // ✅ NEW: Delete Service (for custom services and services added via service management)
  const deleteService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    // ✅ FIX: Validate service is actually added to vendor before deleting
    if (!service.isVendorEnabled || service.id.startsWith('temp_')) {
      toast.error('Service not yet added to your vendor. Cannot delete.');
      return;
    }
    
    // ✅ FIX: Validate service.id is a UUID (vendor_services.id)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(service.id);
    if (!isUUID || service.id === service.serviceId || service.id === service.catalogServiceId) {
      toast.error('Invalid service ID. Cannot delete.');
      return;
    }
    
    try {
      const data = await apiClient.delete(`/vendor/${vendorId}/services/${serviceId}`) as any;

      if (data && data.success) {
        toast.success('Service deleted successfully');
        setServices(services.filter(s => s.id !== serviceId));
        setShowDeleteDialog(null);
        setHasChanges(false);
        // Reload services to ensure UI is in sync
        await loadServices();
      } else {
        toast.error(data?.error || 'Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Error deleting service');
    }
  };

  // ✅ NEW: Unpublish Service
  const unpublishService = async (serviceId: string) => {
    try {
      // Unpublish by updating publish_status
      const data = await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, { publish_status: 'draft' }) as any;

      if (data && data.success) {
        toast.success('Service unpublished successfully');
        await loadServices(); // Reload to get updated status
      } else {
        toast.error(data?.error || 'Failed to unpublish service');
      }
    } catch (error) {
      console.error('Error unpublishing service:', error);
      toast.error('Error unpublishing service');
    }
  };

  // ✅ Save edits from Edit modal (unpublished services only)
  const saveEditService = async () => {
    if (!editingService) return;
    if (editForm.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }
    if (editForm.duration < 5) {
      toast.error('Duration must be at least 5 minutes');
      return;
    }
    try {
      setSavingEdit(true);
      const data = await apiClient.put(`/vendor/${vendorId}/services/${editingService.id}`, {
        customPrice: editForm.price,
        customDuration: editForm.duration,
        description: editForm.description,
      }) as any;
      if (data && data.success) {
        toast.success('Service updated. You can publish when ready.');
        setEditingService(null);
        await loadServices();
      } else {
        toast.error(data?.error || 'Failed to update service');
      }
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update service');
    } finally {
      setSavingEdit(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      console.log('💾 Saving service configuration...');
      
      // ✅ FIX: Only save services that have a vendor_services row (vendor-added or custom)
      // Must have isVendorEnabled === true AND a valid vendor_services.id
      const servicesWithVendorRow = services.filter(s => {
        // Must be explicitly enabled in vendor_services
        if (s.isVendorEnabled !== true) return false;
        // Must have a vendor_services.id (not just catalog ID)
        // When isVendorEnabled is true, s.id should be vendor_services.id
        if (!s.id) return false;
        // ✅ CRITICAL: If id starts with 'temp_', it's not a vendor_services.id
        if (s.id.startsWith('temp_')) {
          console.warn(`⚠️ Service ${s.name || s.serviceName} has temp ID. Skipping.`);
          return false;
        }
        // ✅ CRITICAL: Validate it's a UUID format (vendor_services.id is always UUID)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id);
        if (!isUUID) {
          console.warn(`⚠️ Service ${s.name || s.serviceName} has invalid ID format: ${s.id}. Skipping.`);
          return false;
        }
        // ✅ CRITICAL: If id equals serviceId or catalogServiceId, it's likely a catalog ID, not vendor_services.id
        if (s.id === s.serviceId || s.id === s.catalogServiceId || s.id === s.catalogId) {
          console.warn(`⚠️ Service ${s.name || s.serviceName} has catalog ID instead of vendor_services.id. Skipping.`);
          return false;
        }
        return true;
      });
      
      if (servicesWithVendorRow.length === 0) {
        toast.info('No services to save. Please add services from catalog first.');
        return false;
      }
      
      const servicesToSave = servicesWithVendorRow.map(s => ({
        vendorServiceId: s.id, // ✅ FIX: This is vendor_services.id when isVendorEnabled is true
        catalogServiceId: s.serviceId || s.catalogServiceId, // Catalog ID for reference
        serviceName: s.name || s.serviceName || 'Unnamed Service',
        isEnabled: s.isEnabled,
        customPrice: s.customPrice,
        customDuration: s.customDuration,
        customDescription: s.customDescription,
        price: s.price || s.basePrice || 0, // Include base price for validation fallback
        isNewService: s.isCustomService || false
      }));

      // ✅ NEW: Validate enabled services
      const invalidServices = servicesToSave.filter(s => {
        if (!s.isEnabled) return false;
        const price = s.customPrice ?? s.price ?? 0;
        const duration = s.customDuration ?? 30;
        return price <= 0 || duration < 5;
      });

      if (invalidServices.length > 0) {
        toast.error(`Please fix ${invalidServices.length} service(s) with invalid price or duration`);
        return false;
      }

      // ✅ Run PUTs sequentially with retry on 503 so save works seamlessly (no Lambda/DB overload)
      for (let i = 0; i < servicesToSave.length; i++) {
        const service = servicesToSave[i];
        const price = service.customPrice ?? service.price ?? 0;
        if (service.vendorServiceId === service.catalogServiceId) {
          console.error(`❌ CRITICAL: vendorServiceId matches catalogServiceId! Skipping ${service.serviceName}`);
          continue;
        }
        // ✅ duration_minutes is NOT NULL: always send a valid number (backend fallback is 30)
        const durationMins = Math.max(5, Math.min(1440, Number(service.customDuration ?? service.duration ?? 30) || 30));
        console.log(`💾 Saving service: vendorServiceId=${service.vendorServiceId}, serviceName=${service.serviceName}`);
        await putWithRetry(() =>
          apiClient.put(`/vendor/${vendorId}/services/${service.vendorServiceId}`, {
            is_enabled: service.isEnabled,
            price,
            customPrice: service.customPrice,
            duration: durationMins,
            customDuration: service.customDuration ?? service.duration ?? durationMins,
            description: service.customDescription,
          })
        );
        if (i < servicesToSave.length - 1) await delayMs(250);
      }
      const data: { success: boolean; error?: string } = { success: true };

      if (data && data.success) {
        console.log('✅ Configuration saved:', data);
        toast.success('Services saved successfully');
        setHasChanges(false);
        return true;
      } else {
        console.error('❌ Failed to save configuration:', data);
        toast.error(data?.error || 'Failed to save configuration');
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving configuration:', error);
      toast.error('Error saving configuration');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publishServices = async () => {
    try {
      setIsPublishing(true);
      
      // First save the configuration
      const saved = await saveConfiguration();
      if (!saved) return;
      
      console.log('🚀 Publishing services...');
      
      const toPublish = services.filter(
        s => s.isEnabled && s.isVendorEnabled === true && (s.vendorServiceId || s.id) && s.id !== s.serviceId && s.id !== s.catalogServiceId
      );
      for (let i = 0; i < toPublish.length; i++) {
        const service = toPublish[i];
        const vendorServiceId = service.vendorServiceId ?? service.id;
        await putWithRetry(() =>
          apiClient.put(`/vendor/${vendorId}/services/${vendorServiceId}`, { publish_status: 'published' })
        );
        if (i < toPublish.length - 1) await delayMs(250);
      }
      const data: { success: boolean; status?: string; publishedCount?: number; error?: string } = { success: true };

      if (data && data.success) {
        console.log('✅ Services published:', data);
        toast.success('Services published successfully!');
        await loadServices();
      } else {
        console.error('❌ Failed to publish:', data);
        toast.error(data?.error || 'Failed to publish services');
      }
    } catch (error) {
      console.error('❌ Error publishing services:', error);
      toast.error('Error publishing services');
    } finally {
      setIsPublishing(false);
    }
  };

  const addCustomService = async (packageData: any) => {
    try {
      console.log('➕ Adding custom service/package...', packageData);
      
      // ✅ Check if this is a package (not a single custom service)
      if (packageData.isPackage) {
        // Route to package creation endpoint
        console.log('📦 Creating package via package endpoints...');
        
        const data = await apiClient.post(`/vendor/${vendorId}/packages`, {
          packageName: packageData.serviceName,
          packageType: packageData.packageType, // 'combo', 'subscription', 'membership', 'unlimited'
          description: packageData.description,
          category: roleConfig?.label || 'General',
          
          // Pricing
          originalPrice: packageData.originalPrice || 0,
          packagePrice: packageData.packagePrice,
          discount: packageData.originalPrice > 0 ? packageData.originalPrice - packageData.packagePrice : 0,
          discountPercentage: packageData.originalPrice > 0 ? 
            ((packageData.originalPrice - packageData.packagePrice) / packageData.originalPrice * 100) : 0,
          
          // Validity
          validityType: 'days',
          validityPeriod: packageData.validityDays,
          
          // Usage
          usageType: packageData.maxUsageCount === -1 ? 'unlimited' : 'sessions',
          totalSessions: packageData.maxUsageCount === -1 ? 0 : packageData.maxUsageCount,
          unlimitedUsage: packageData.maxUsageCount === -1,
          
          // Included Services
          includedServices: packageData.includedServices || [],
          includedServicesDetails: packageData.includedServices || [],
          
          // Benefits
          benefits: packageData.specialBenefits || [],
          membershipPerks: {
            priorityBooking: false,
            discountOnServices: packageData.discountPercentage || 0,
            freeAddOns: [],
            dedicatedSupport: false,
            exclusiveOffers: false
          },
          
          // Terms
          terms: packageData.termsAndConditions ? [packageData.termsAndConditions] : [],
          refundPolicy: '',
          cancellationPolicy: packageData.cancellationPolicy || '',
          
          // Subscription
          isRecurring: packageData.packageType === 'subscription',
          billingCycle: 'monthly'
        }) as any;
        
        if (data && data.success) {
          console.log('✅ Package created:', data);
          toast.success('Package created successfully! Pending admin approval.');
          return;
        } else {
          console.error('❌ Failed to create package:', data);
          toast.error(data?.error || 'Failed to create package');
          return;
        }
      }
      
      // Single custom service (not package)
      // Backend requires category/categoryName; modal form does not include it — supply from roleConfig
      const categoryName = roleConfig?.label || packageData.categoryName || packageData.category || 'General';
      const data = await apiClient.post(`/vendor/${vendorId}/services/custom`, {
        serviceStyle,
        category: categoryName,
        categoryName,
        publishStatus: 'draft',
        ...packageData
      }) as any;

      if (data && data.success) {
        console.log('✅ Custom service added:', data);
        toast.success('Custom service added successfully!');
        // Reload services; do not throw so modal can close (EnhancedPackageCreationModal calls onClose after onSubmit resolves)
        try {
          await loadServices();
        } catch (reloadErr) {
          console.warn('Services list reload failed after adding custom service:', reloadErr);
          toast.info('Service added. List may refresh shortly.');
        }
      } else {
        console.error('❌ Failed to add custom service:', data);
        toast.error(data?.error || 'Failed to add custom service');
      }
    } catch (error: any) {
      console.error('❌ Error adding custom service:', error);
      const message = error?.message || error?.originalError?.error || 'Error adding custom service';
      toast.error(typeof message === 'string' ? message : 'Error adding custom service');
      throw error;
    }
  };

  const enabledCount = services.filter(s => s.isEnabled).length;
  const publishedCount = services.filter(s => s.publishStatus === 'published').length;
  const pendingCount = services.filter(s => s.publishStatus === 'pending_approval').length;

  // ✅ Role-based labels (e.g. "Training center booking" for trainers)
  const roleNameForLabels = roleNameProp ?? vendorData?.roleName ?? vendorData?.role_name ?? '';
  const styleLabelConfig = getServiceStyleLabelForRole(roleNameForLabels, serviceStyle);
  const getStyleIcon = () => styleLabelConfig.icon;
  const getStyleName = () => styleLabelConfig.label;

  const getStatusBadge = (service: Service) => {
    // Only show publish status badge - the enabled/disabled state is shown by the Switch toggle
    // This prevents duplicate UI elements for the same state
    if (!service.isEnabled) {
      // Don't show "Disabled" badge since the Switch already shows "Off"
      return null;
    }
    
    switch (service.publishStatus) {
      case 'published':
        return <Badge className="bg-green-500">Live</Badge>;
      case 'pending_approval':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  // 🎨 Smart Icon Mapping for Pet Healthcare Services
  const getServiceIcon = (service: Service) => {
    const name = (service.name || service.serviceName || '').toLowerCase();
    const category = (service.categoryName || service.category || '').toLowerCase();
    const subCategory = (service.subCategoryName || service.subCategory || '').toLowerCase();

    // Veterinary Services - Medical Icons
    if (category.includes('veterinary') || category.includes('medical') || category.includes('health')) {
      if (name.includes('consultation') || name.includes('checkup') || name.includes('exam')) {
        return <Stethoscope className="w-6 h-6 text-[#FF8C42]" />;
      }
      if (name.includes('vaccination') || name.includes('vaccine') || name.includes('shot')) {
        return <Syringe className="w-6 h-6 text-blue-600" />;
      }
      if (name.includes('medication') || name.includes('medicine') || name.includes('prescription')) {
        return <Pill className="w-6 h-6 text-green-600" />;
      }
      if (name.includes('surgery') || name.includes('operation')) {
        return <Activity className="w-6 h-6 text-red-600" />;
      }
      if (name.includes('x-ray') || name.includes('scan') || name.includes('ultrasound') || name.includes('imaging')) {
        return <Camera className="w-6 h-6 text-purple-600" />;
      }
      if (name.includes('report') || name.includes('test') || name.includes('lab')) {
        return <FileText className="w-6 h-6 text-gray-600" />;
      }
      if (name.includes('emergency') || name.includes('icu') || name.includes('critical')) {
        return <Heart className="w-6 h-6 text-red-500" />;
      }
      // Default veterinary icon
      return <Stethoscope className="w-6 h-6 text-[#FF8C42]" />;
    }

    // Grooming Services - Styling Icons
    if (category.includes('grooming') || category.includes('spa') || category.includes('beauty')) {
      if (name.includes('bath') || name.includes('wash') || name.includes('clean')) {
        return <Sparkles className="w-6 h-6 text-blue-500" />;
      }
      if (name.includes('haircut') || name.includes('trim') || name.includes('cut') || name.includes('styling')) {
        return <Scissors className="w-6 h-6 text-pink-600" />;
      }
      if (name.includes('nail') || name.includes('paw')) {
        return '🐾';
      }
      if (name.includes('spa') || name.includes('massage')) {
        return <Sparkles className="w-6 h-6 text-purple-500" />;
      }
      // Default grooming icon
      return <Scissors className="w-6 h-6 text-[#FF8C42]" />;
    }

    // Training & Behavior Services
    if (category.includes('training') || category.includes('behavior')) {
      if (name.includes('obedience') || name.includes('basic')) {
        return <GraduationCap className="w-6 h-6 text-blue-600" />;
      }
      if (name.includes('agility') || name.includes('advanced')) {
        return '🏆';
      }
      if (name.includes('behavior') || name.includes('therapy')) {
        return '🧠';
      }
      // Default training icon
      return <GraduationCap className="w-6 h-6 text-[#FF8C42]" />;
    }

    // Walking & Exercise Services
    if (category.includes('walking') || name.includes('walk') || name.includes('exercise')) {
      return '🚶';
    }

    // Boarding & Daycare
    if (category.includes('boarding') || category.includes('daycare') || name.includes('hotel')) {
      return <Home className="w-6 h-6 text-green-600" />;
    }

    // Pet Sitting
    if (category.includes('sitting') || name.includes('sitting')) {
      return '👤';
    }

    // Transportation
    if (category.includes('transportation') || name.includes('transport') || name.includes('taxi')) {
      return '🚗';
    }

    // Adoption Services
    if (category.includes('adoption') || name.includes('adopt')) {
      return <Heart className="w-6 h-6 text-pink-500" />;
    }

    // Food & Nutrition
    if (category.includes('food') || category.includes('nutrition') || name.includes('diet')) {
      return '🍖';
    }

    // Pet Types
    if (name.includes('dog') && !name.includes('cat')) {
      return <Dog className="w-6 h-6 text-amber-600" />;
    }
    if (name.includes('cat') && !name.includes('dog')) {
      return <Cat className="w-6 h-6 text-gray-600" />;
    }

    // Tele Consultation
    if (serviceStyle === 'tele' || name.includes('tele') || name.includes('video')) {
      return <Phone className="w-6 h-6 text-green-600" />;
    }

    // Home Services
    if (serviceStyle === 'at_home') {
      return <Home className="w-6 h-6 text-[#FF8C42]" />;
    }

    // Package
    if (service.isPackage) {
      return <Package className="w-6 h-6 text-[#FF8C42]" />;
    }

    // Default fallback - use the icon from service data or a generic pet icon
    if (service.icon) {
      return service.icon;
    }
    
    // Ultimate fallback - generic pet care
    return '🐕';
  };

  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const category = service.categoryName || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // ✅ Filter services based on search query
  const filteredServices = searchQuery
    ? services.filter(service => {
        const query = searchQuery.toLowerCase();
        const name = (service.name || service.serviceName || '').toLowerCase();
        const description = (service.description || '').toLowerCase();
        const categoryName = (service.categoryName || service.category || '').toLowerCase();
        const subCategoryName = (service.subCategoryName || service.subCategory || '').toLowerCase();
        
        return name.includes(query) ||
               description.includes(query) ||
               categoryName.includes(query) ||
               subCategoryName.includes(query);
      })
    : services;

  // ✅ Group filtered services by category
  const filteredGroupedServices = filteredServices.reduce((acc, service) => {
    const category = service.categoryName || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-24">
        {/* Header - Service Management > [Style] with Browse Catalog link */}
        <div className="p-4 bg-white border-b sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center" title="Back to Service Management">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getStyleIcon()}</span>
                <h1 className="font-semibold text-gray-900">{getStyleName()}</h1>
              </div>
              <p className="text-xs text-gray-500">Service Management · {vendorData?.businessName || vendorData?.fullName}</p>
            </div>
            {onBrowseCatalog && (
              <button
                onClick={onBrowseCatalog}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                title="Browse platform catalog"
              >
                <Package className="w-4 h-4" />
                Add from Catalog
              </button>
            )}
          </div>

          {/* ✅ Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-10 h-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-blue-600">{enabledCount}</div>
              <div className="text-xs text-blue-700">Enabled</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-600">{publishedCount}</div>
              <div className="text-xs text-green-700">Live</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-xs text-yellow-700">Pending</div>
            </div>
          </div>

          {/* ✅ NEW: Staff Assignment & Bulk Actions */}
          {services.length > 0 && (
            <div className="mt-3 space-y-2">
              {/* Staff Assignment Button - Disabled for solo vendors */}
              {enabledCount > 0 && (
                <Button
                  onClick={() => {
                    // Navigate to staff management - using window.location or router if available
                    if (typeof window !== 'undefined') {
                      window.location.href = `/staff?assignServices=true&serviceStyle=${serviceStyle}`;
                    } else {
                      toast.info('Please go to Staff Management to assign services to your team');
                    }
                  }}
                  disabled={staffCount === 0 || isSoloProvider}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                  title={staffCount === 0 || isSoloProvider ? 'Add staff members first to assign services' : 'Assign services to your staff members'}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Assign Services to Staff
                  {staffCount === 0 && <span className="ml-2 text-xs">(No staff)</span>}
                </Button>
              )}

              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="w-full text-xs font-medium text-[#FF8C42] py-2 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
              >
                {showBulkActions ? 'Hide Bulk Actions' : 'Show Bulk Actions'}
              </button>
              
              {showBulkActions && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={enableAllServices}
                      className="text-xs"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Enable All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={disableAllServices}
                      className="text-xs"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Disable All
                    </Button>
                  </div>
                  {/* ✅ NEW: Batch Publish/Unpublish */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={batchPublishServices}
                      disabled={isPublishing || services.filter(s => s.isEnabled && s.publishStatus !== 'published').length === 0}
                      className="text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Publish All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={batchUnpublishServices}
                      disabled={isPublishing || publishedCount === 0}
                      className="text-xs bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    >
                      <X className="w-3 h-3 mr-1" />
                      Unpublish All
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom services/packages are managed via Service Management → "Manage Custom Services" */}
        </div>

        {/* Info Banner */}
        <div className="mx-4 mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-orange-500" />
            <div className="flex-1 text-xs">
              <p className="text-orange-700">
                <strong>Your pricing:</strong> Set price and duration for any service (catalog or custom). Publish/unpublish to show or hide on customer booking. Changes reflect immediately on customer web.
              </p>
            </div>
          </div>
        </div>

        {/* Services List */}
        <div className="p-4 space-y-4">
          {services.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="font-semibold mb-2">No Services Available</h3>
              <p className="text-sm text-gray-600 mb-4">
                No services found in the catalog for this service style.
              </p>
              {serviceStyle === 'at_center' && (
                <Button 
                  onClick={() => setShowAddCustomDialog(true)}
                  className="bg-[#FF8C42] hover:bg-[#ff7a28]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Service
                </Button>
              )}
            </div>
          ) : (
            <>
              {Object.entries(filteredGroupedServices).map(([category, categoryServices]) => (
                <div key={category} className="space-y-2">
                  {/* Category Header */}
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-px flex-1 bg-gray-300"></div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{category}</h3>
                    <div className="h-px flex-1 bg-gray-300"></div>
                  </div>

                  {/* Services in Category */}
                  {categoryServices.map((service) => (
                    <div
                      key={service.id}
                      className={`bg-white rounded-xl border-2 transition-all ${
                        service.isEnabled 
                          ? 'border-[#FF8C42] shadow-sm' 
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Service Header - Always Visible */}
                      <div className="p-3">
                        <div className="flex items-start gap-3">
                          {/* Icon */}
                          <div className="text-2xl flex-shrink-0">{getServiceIcon(service)}</div>

                          {/* Service Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex-1">
                                <h4 className="font-semibold text-sm leading-tight">{service.name || service.serviceName || 'Unnamed Service'}</h4>
                                {service.subCategoryName && (
                                  <p className="text-xs text-gray-500">{service.subCategoryName}</p>
                                )}
                                {service.isPackage && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    <Package className="w-3 h-3 mr-1" />
                                    Package
                                  </Badge>
                                )}
                                {service.isCustomService && (
                                  <Badge variant="outline" className="text-xs mt-1 ml-1">Custom</Badge>
                                )}
                              </div>
                              {getStatusBadge(service)}
                            </div>

                            {/* Quick Info */}
                            <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                              <span className="flex items-center gap-1 font-semibold text-[#FF8C42]">
                                ₹{Number(service.customPrice || service.price || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {service.customDuration || service.duration}m
                              </span>
                            </div>

                            {/* Description Preview */}
                            <p className="text-xs text-gray-600 line-clamp-2">{service.description}</p>

                            {/* ✅ Service Action Buttons: Edit only when unpublished; Delete only when unpublished; Unpublish only when published */}
                            {service.isEnabled && (
                              <div className="flex gap-1 mt-2">
                                {/* Edit Button - Only for unpublished (draft/rejected) services */}
                                {(service.publishStatus === 'draft' || service.publishStatus === 'rejected') && (
                                  <button
                                    onClick={() => {
                                      setEditingService(service);
                                      setEditForm({
                                        price: service.customPrice ?? service.price ?? 0,
                                        duration: service.customDuration ?? service.duration ?? 30,
                                        description: service.customDescription ?? service.description ?? '',
                                      });
                                    }}
                                    className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors flex items-center gap-1"
                                    title="Edit service"
                                  >
                                    <Edit className="w-3 h-3" />
                                    Edit
                                  </button>
                                )}
                                
                                {/* Unpublish Button - Only for published services */}
                                {service.publishStatus === 'published' && (
                                  <button
                                    onClick={() => unpublishService(service.id)}
                                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                                    title="Unpublish service"
                                  >
                                    📴 Unpublish
                                  </button>
                                )}
                                
                                {/* Delete Button - Only for unpublished services */}
                                {(service.publishStatus === 'draft' || service.publishStatus === 'rejected') && (
                                  <button
                                    onClick={() => setShowDeleteDialog(service)}
                                    className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors flex items-center gap-1"
                                    title="Delete service"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Enable Toggle with Label */}
                          <div className="flex flex-col items-center gap-1 flex-shrink-0">
                            <Switch
                              checked={service.isEnabled}
                              onCheckedChange={() => toggleService(service.id)}
                              aria-label={service.isEnabled ? 'Disable service' : 'Enable service'}
                            />
                            <span className={`text-[10px] font-medium ${service.isEnabled ? 'text-[#FF8C42]' : 'text-gray-500'}`}>
                              {service.isEnabled ? 'On' : 'Off'}
                            </span>
                          </div>
                        </div>

                        {/* Expand/Collapse Button - show for all enabled services so price/duration can be edited */}
                        {service.isEnabled && (
                          <button
                            onClick={() => toggleExpanded(service.id)}
                            className="w-full mt-2 pt-2 border-t flex items-center justify-center gap-1 text-xs text-[#FF8C42] font-medium"
                          >
                            {expandedServices.has(service.id) ? (
                              <>Hide Details <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>View Details <ChevronDown className="w-4 h-4" /></>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Expanded Section */}
                      {service.isEnabled && expandedServices.has(service.id) && (
                        <div className="px-3 pb-3 space-y-3 border-t bg-gray-50">
                          {/* Rejection Reason */}
                          {service.publishStatus === 'rejected' && service.rejectionReason && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 mt-3">
                              <p className="text-xs text-red-700">
                                <strong>Rejected:</strong> {service.rejectionReason}
                              </p>
                            </div>
                          )}

                          {/* What's Included */}
                          {(service.whatIncluded && service.whatIncluded.length > 0) && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">What's Included:</p>
                              <ul className="text-xs text-gray-600 space-y-0.5">
                                {service.whatIncluded.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-1">
                                    <Check className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Pricing & Duration - Editable if allowed */}
                          {canEditPricing && (
                            <div className="mt-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs text-gray-700 mb-1 block">Your Price (₹)</Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                    <Input
                                      type="number"
                                      value={service.customPrice || service.price || 0}
                                      onChange={(e) => updateServicePrice(service.id, parseInt(e.target.value) || 0)}
                                      className={`h-8 text-sm pl-8 ${
                                        (service.customPrice || service.price || 0) <= 0 
                                          ? 'border-red-300 focus:border-red-500' 
                                          : ''
                                      }`}
                                      min="0"
                                      max="1000000"
                                    />
                                  </div>
                                  {(service.customPrice || service.price || 0) <= 0 && (
                                    <p className="text-xs text-red-500 mt-1">Price must be greater than 0</p>
                                  )}
                                  {service.price && service.customPrice && service.customPrice !== service.price && (
                                    <p className="text-xs text-gray-500 mt-1">Base: ₹{Number(service.price).toLocaleString('en-IN')}</p>
                                  )}
                                </div>
                                {canControlDuration && (
                                  <div>
                                    <Label className="text-xs text-gray-700 mb-1 block">Duration (min)</Label>
                                    <Input
                                      type="number"
                                      value={service.customDuration || service.duration}
                                      onChange={(e) => updateServiceDuration(service.id, parseInt(e.target.value) || 0)}
                                      className={`h-8 text-sm ${
                                        (service.customDuration || service.duration || 0) < 5 
                                          ? 'border-red-300 focus:border-red-500' 
                                          : ''
                                      }`}
                                      min="5"
                                      max="1440"
                                      step="5"
                                    />
                                    {(service.customDuration || service.duration || 0) < 5 && (
                                      <p className="text-xs text-red-500 mt-1">Minimum 5 minutes</p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div>
                                <Label className="text-xs text-gray-700 mb-1 block">Custom Description (Optional)</Label>
                                <Textarea
                                  value={service.customDescription || ''}
                                  onChange={(e) => updateServiceDescription(service.id, e.target.value)}
                                  placeholder="Enter service description details..."
                                  className="text-xs"
                                  rows={2}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      {enabledCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-[430px] mx-auto p-4 flex gap-2">
            {hasChanges && (
              <Button
                onClick={saveConfiguration}
                disabled={saving}
                variant="outline"
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            )}
            <Button
              onClick={publishServices}
              disabled={isPublishing || saving}
              className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28] text-white"
            >
              {isPublishing ? 'Publishing...' : `Publish ${enabledCount} Service${enabledCount > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}

      {/* Enhanced Package Creation Modal */}
      <EnhancedPackageCreationModal
        open={showAddCustomDialog}
        onClose={() => setShowAddCustomDialog(false)}
        onSubmit={addCustomService}
        serviceStyle={serviceStyle === 'at_center' ? 'at_center' : 'at_clinic'}
        availableServices={services.filter(s => s.isEnabled).map(s => ({
          id: s.id,
          name: s.name,
          description: s.description
        }))}
      />
      
      {/* ✅ Edit Service Modal: open with service data, save updates and close */}
      <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update price, duration, and description. After saving, you can publish when ready.
            </DialogDescription>
          </DialogHeader>
          {editingService && (
            <div className="space-y-4 py-4">
              <p className="text-sm font-medium text-gray-700">{editingService.name || editingService.serviceName}</p>
              <div className="space-y-2">
                <Label className="text-xs text-gray-700">Price (₹) *</Label>
                <Input
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm((f) => ({ ...f, price: parseInt(e.target.value, 10) || 0 }))}
                  min={0}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-700">Duration (minutes) *</Label>
                <Input
                  type="number"
                  value={editForm.duration}
                  onChange={(e) => setEditForm((f) => ({ ...f, duration: parseInt(e.target.value, 10) || 0 }))}
                  min={5}
                  max={1440}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-700">Description (optional)</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Service description..."
                  rows={3}
                  className="text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingService(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditService} disabled={savingEdit}>
              {savingEdit ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NEW: Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Service?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{showDeleteDialog?.name || showDeleteDialog?.serviceName || 'this service'}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => showDeleteDialog && deleteService(showDeleteDialog.id)}
            >
              Delete Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}