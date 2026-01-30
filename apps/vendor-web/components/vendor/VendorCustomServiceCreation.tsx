'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Plus, 
  Save, 
  X, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Package,
  FileText,
  CheckCircle,
  Tag,
  Info,
  ArrowLeft,
  Sparkles,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';
import { 
  getAllMicroCategoriesForRole, 
  getMicroCategoriesForRole,
  MicroCategory 
} from '@/lib/service-micro-categories';
import { getVendorRoleId } from '@/lib/vendor-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface CustomService {
  id?: string;
  serviceName: string;
  description: string;
  duration: number; // minutes
  price: number;
  categoryName: string;
  subCategoryName?: string;
  isPackage: boolean;
  packageDetails?: {
    sessionsPerDay: number;
    sessionDuration: number;
    packageDuration: number; // days
    totalSessions: number;
    pricingBySize: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
  };
  whatIncluded?: string[];
  whatNotIncluded?: string[];
  petTypes?: string[];
  publishStatus?: 'draft' | 'pending_approval' | 'published' | 'rejected';
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VendorCustomServiceCreationProps {
  vendorId: string;
  vendorData?: any;
  serviceStyle?: 'at_center' | 'at_home' | 'tele' | 'both'; // ✅ UPDATED: Support all service styles
  allowedServiceStyles?: string[]; // ✅ NEW: Allowed styles from role config
  onClose: () => void;
  onServiceCreated: () => void;
}

export function VendorCustomServiceCreation({
  vendorId,
  vendorData,
  serviceStyle,
  allowedServiceStyles = ['at_center', 'at_home', 'tele'], // ✅ Default to all if not specified
  onClose,
  onServiceCreated
}: VendorCustomServiceCreationProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingService, setEditingService] = useState<CustomService | null>(null);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  const [subCategoryName, setSubCategoryName] = useState('');
  const [isPackage, setIsPackage] = useState(false);
  
  // ✅ NEW: Service style selection for this custom service
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<'at_center' | 'at_home' | 'tele'>(
    serviceStyle && serviceStyle !== 'both' ? serviceStyle : 'at_center'
  );
  
  // ✅ Determine which service styles this vendor can use
  const availableStyles = allowedServiceStyles.filter(style => 
    ['at_center', 'at_home', 'tele'].includes(style)
  ) as ('at_center' | 'at_home' | 'tele')[];
  
  // ✅ Solo providers typically don't have at_center
  const isSoloProvider = vendorData?.vendorConfiguration === 'solo' || 
                         vendorData?.isSoloProvider || 
                         vendorData?.is_solo_provider;
  const effectiveStyles = isSoloProvider 
    ? availableStyles.filter(s => s !== 'at_center') 
    : availableStyles;
  
  // Package details
  const [sessionsPerDay, setSessionsPerDay] = useState(1);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [packageDuration, setPackageDuration] = useState(7);
  const [smallPrice, setSmallPrice] = useState(0);
  const [mediumPrice, setMediumPrice] = useState(0);
  const [largePrice, setLargePrice] = useState(0);
  const [extraLargePrice, setExtraLargePrice] = useState(0);
  
  // Additional details
  const [whatIncluded, setWhatIncluded] = useState<string[]>(['']);
  const [whatNotIncluded, setWhatNotIncluded] = useState<string[]>(['']);
  const [petTypes, setPetTypes] = useState<string[]>([]);

  // 🎨 AI-POWERED MICRO-CATEGORIES
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [availableMicroCategories, setAvailableMicroCategories] = useState<MicroCategory[]>([]);
  const [selectedMicroCategory, setSelectedMicroCategory] = useState<MicroCategory | null>(null);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]); // ✅ NEW: Categories from admin catalog

  // ✅ NEW: Load categories from admin catalog (441 services)
  useEffect(() => {
    const loadCatalogCategories = async () => {
      try {
        console.log('📚 [CUSTOM-SERVICE] Loading catalog categories...');
        const data = await apiClient.get('/admin/service-catalog') as any;

        if (data && data.success) {
          // data already available
          console.log('📚 [CUSTOM-SERVICE] Loaded catalog services:', data.services?.length || 0);
          
          // ✅ FIX: Ensure services is always an array
          const services = Array.isArray(data.services) ? data.services : [];
          
          // Extract unique categories from services
          const categoriesMap = new Map();
          services.forEach((service: any) => {
            if (service.categoryId && service.categoryName) {
              categoriesMap.set(service.categoryId, {
                id: service.categoryId,
                name: service.categoryName
              });
            }
          });
          
          const uniqueCategories = Array.from(categoriesMap.values());
          console.log('✅ [CUSTOM-SERVICE] Unique categories:', uniqueCategories.length);
          setCatalogCategories(uniqueCategories);
        } else {
          console.warn('⚠️ [CUSTOM-SERVICE] No catalog data or failed response');
          setCatalogCategories([]);
        }
      } catch (error) {
        console.error('❌ [CUSTOM-SERVICE] Error loading catalog categories:', error);
        setCatalogCategories([]);
      }
    };

    loadCatalogCategories();
  }, []);

  // Load available categories and micro-categories for this vendor role
  useEffect(() => {
    const roleId = getVendorRoleId(vendorData);
    if (roleId) {
      const categories = getAllMicroCategoriesForRole(vendorData.roleId);
      setAvailableCategories(categories);
      console.log('🎨 Loaded AI micro-categories for role:', vendorData.roleId, categories);
    }
  }, [vendorData?.roleId]);

  // When category changes, load relevant micro-categories
  useEffect(() => {
    if (categoryName && vendorData?.roleId) {
      const micros = getMicroCategoriesForRole(vendorData.roleId);
      setAvailableMicroCategories(micros);
      console.log('🎨 Loaded micro-categories for category:', categoryName, micros);
    } else {
      setAvailableMicroCategories([]);
    }
  }, [categoryName, vendorData?.roleId]);

  // Apply micro-category template to form
  const applyMicroCategoryTemplate = (micro: MicroCategory) => {
    setSelectedMicroCategory(micro);
    setServiceName(micro.name);
    setDescription(micro.description || '');
    setDuration(micro.commonDuration || 60);
    setPrice(micro.priceRange ? Math.floor((micro.priceRange.min + micro.priceRange.max) / 2) : 0); // Average price
    setSubCategoryName(micro.name);
    toast.success(`✨ Applied template: ${micro.name}`);
  };

  // ✅ ROLE-BASED ENFORCEMENT: Only show styles allowed by role config
  useEffect(() => {
    // If there are no effective styles available, close the dialog
    if (effectiveStyles.length === 0) {
      console.error('❌ No service styles available for this vendor type');
      toast.error('Custom services are not available for your vendor configuration');
      onClose();
      return;
    }
    
    // Set default service style to first available
    if (!effectiveStyles.includes(selectedServiceStyle)) {
      setSelectedServiceStyle(effectiveStyles[0]);
    }
  }, [effectiveStyles, selectedServiceStyle, onClose]);

  useEffect(() => {
    loadCustomServices();
  }, [vendorId]);

  const loadCustomServices = async () => {
    try {
      setLoading(true);
      console.log(`📋 Loading custom services for vendor: ${vendorId}`);
      
      const data = await apiClient.get(`/vendor/${vendorId}/services?custom=true`) as any;

      if (data && data.success) {
        // data already available
        console.log('✅ Custom services loaded:', data);
        // ✅ FIX: Ensure services is always an array
        const services = Array.isArray(data.services) ? data.services : [];
        setCustomServices(services);
      } else {
        console.error('❌ Failed to load custom services:', data);
        setCustomServices([]);
        toast.error(data?.error || 'Failed to load custom services');
      }
    } catch (error) {
      console.error('❌ Error loading custom services:', error);
      toast.error('Error loading custom services');
    } finally {
      setLoading(false);
    }
  };

  const handleAddIncluded = () => {
    setWhatIncluded([...whatIncluded, '']);
  };

  const handleRemoveIncluded = (index: number) => {
    setWhatIncluded(whatIncluded.filter((_, i) => i !== index));
  };

  const handleUpdateIncluded = (index: number, value: string) => {
    const updated = [...whatIncluded];
    updated[index] = value;
    setWhatIncluded(updated);
  };

  const handleAddNotIncluded = () => {
    setWhatNotIncluded([...whatNotIncluded, '']);
  };

  const handleRemoveNotIncluded = (index: number) => {
    setWhatNotIncluded(whatNotIncluded.filter((_, i) => i !== index));
  };

  const handleUpdateNotIncluded = (index: number, value: string) => {
    const updated = [...whatNotIncluded];
    updated[index] = value;
    setWhatNotIncluded(updated);
  };

  const handlePetTypeToggle = (petType: string) => {
    if (petTypes.includes(petType)) {
      setPetTypes(petTypes.filter(p => p !== petType));
    } else {
      setPetTypes([...petTypes, petType]);
    }
  };

  const validateForm = (excludeServiceId?: string): boolean => {
    if (!serviceName.trim()) {
      toast.error('Service name is required');
      return false;
    }
    // ✅ Duplicate name validation: service names must be unique per vendor (case-insensitive)
    const nameNorm = (s: string) => (s || '').trim().toLowerCase();
    const isDuplicateName = customServices.some(
      (s) => s.id !== excludeServiceId && nameNorm(s.serviceName || '') === nameNorm(serviceName)
    );
    if (isDuplicateName) {
      toast.error('A service with this name already exists. Please use a different name.');
      return false;
    }
    if (!description.trim()) {
      toast.error('Service description is required');
      return false;
    }
    // ✅ FIX: If "other" is selected, validate that custom category name is provided
    if (!categoryName.trim() || (categoryName === 'other' && !subCategoryName.trim())) {
      toast.error('Category name is required');
      return false;
    }
    if (duration <= 0) {
      toast.error('Duration must be greater than 0');
      return false;
    }
    
    if (isPackage) {
      if (smallPrice <= 0 || mediumPrice <= 0 || largePrice <= 0 || extraLargePrice <= 0) {
        toast.error('All package prices must be greater than 0');
        return false;
      }
      if (packageDuration <= 0) {
        toast.error('Package duration must be greater than 0');
        return false;
      }
    } else {
      if (price <= 0) {
        toast.error('Price must be greater than 0');
        return false;
      }
    }
    
    return true;
  };

  const handleCreateService = async () => {
    if (!validateForm(undefined)) return;
    
    try {
      setSaving(true);
      console.log('💾 Creating custom service...');
      
      // ✅ FIX: If "other" is selected, use subCategoryName as the actual category name
      const effectiveCategoryName = categoryName === 'other' && subCategoryName.trim()
        ? subCategoryName.trim() // Use custom category name when "other" is selected
        : categoryName.trim(); // Use selected category name otherwise
      
      const customService: CustomService & { serviceStyle: string } = {
        serviceName: serviceName.trim(),
        description: description.trim(),
        duration: isPackage ? sessionDuration : duration,
        price: isPackage ? 0 : price,
        categoryName: effectiveCategoryName, // ✅ Use effective category (handles "other" case)
        subCategoryName: categoryName === 'other' ? undefined : (subCategoryName.trim() || undefined), // ✅ Don't send subCategory if "other" was used as category
        serviceStyle: selectedServiceStyle, // ✅ FIX: Now sending service style to API
        isPackage,
        packageDetails: isPackage ? {
          sessionsPerDay,
          sessionDuration,
          packageDuration,
          totalSessions: sessionsPerDay * packageDuration,
          pricingBySize: {
            small: smallPrice,
            medium: mediumPrice,
            large: largePrice,
            extraLarge: extraLargePrice
          }
        } : undefined,
        whatIncluded: whatIncluded.filter(i => i.trim() !== ''),
        whatNotIncluded: whatNotIncluded.filter(i => i.trim() !== ''),
        petTypes: petTypes.length > 0 ? petTypes : ['dog', 'cat'], // Default
        publishStatus: 'draft' // Start as draft
      };
      
      console.log('📤 Sending custom service:', customService);
      
      const data = await apiClient.post(`/vendor/${vendorId}/services/custom`, customService) as any;

      if (data && data.success) {
        // data already available
        console.log('✅ Custom service created:', data);
        toast.success('Custom service created successfully!');
        
        // Reset form
        resetForm();
        setShowCreateDialog(false);
        
        // Reload services
        await loadCustomServices();
        onServiceCreated();
      } else {
        console.error('❌ Failed to create custom service:', data);
        toast.error(data?.error || 'Failed to create custom service');
      }
    } catch (error) {
      console.error('❌ Error creating custom service:', error);
      toast.error('Error creating custom service');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishService = async (serviceId: string) => {
    try {
      console.log(`📤 Publishing custom service: ${serviceId}`);
      
      const data = await apiClient.post(`/vendor/${vendorId}/services/custom/${serviceId}/publish`, {}) as any;

      if (data && data.success) {
        // data already available
        console.log('✅ Service published:', data);
        toast.success('Service submitted for admin approval!');
        await loadCustomServices();
      } else {
        console.error('❌ Failed to publish service:', data);
        toast.error(data?.error || 'Failed to publish service');
      }
    } catch (error) {
      console.error('❌ Error publishing service:', error);
      toast.error('Error publishing service');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      console.log(`🗑️ Deleting custom service: ${serviceId}`);
      
      const data = await apiClient.delete(`/vendor/${vendorId}/services/${serviceId}`) as any;

      if (data && data.success) {
        console.log('✅ Service deleted');
        toast.success('Service deleted successfully');
        await loadCustomServices();
      } else {
        console.error('❌ Failed to delete service:', data);
        toast.error(data?.error || 'Failed to delete service');
      }
    } catch (error) {
      console.error('❌ Error deleting service:', error);
      toast.error('Error deleting service');
    }
  };

  // ✅ Open Edit modal with service data (only for draft/rejected)
  const openEditDialog = (service: CustomService) => {
    setEditingService(service);
    setServiceName(service.serviceName || '');
    setDescription(service.description || '');
    setDuration(service.duration || 60);
    setPrice(service.price ?? 0);
    setCategoryName(service.categoryName || '');
    setSubCategoryName(service.subCategoryName || '');
    setIsPackage(!!service.isPackage);
    if (service.packageDetails) {
      setSessionsPerDay(service.packageDetails.sessionsPerDay || 1);
      setSessionDuration(service.packageDetails.sessionDuration || 60);
      setPackageDuration(service.packageDetails.packageDuration || 7);
      setSmallPrice(service.packageDetails.pricingBySize?.small ?? 0);
      setMediumPrice(service.packageDetails.pricingBySize?.medium ?? 0);
      setLargePrice(service.packageDetails.pricingBySize?.large ?? 0);
      setExtraLargePrice(service.packageDetails.pricingBySize?.extraLarge ?? 0);
    }
    setShowEditDialog(true);
  };

  const handleUpdateService = async () => {
    if (!editingService?.id || !validateForm(editingService.id)) return;
    try {
      setSaving(true);
      const payload: any = {
        serviceName: serviceName.trim(),
        description: description.trim(),
        duration: isPackage ? sessionDuration : duration,
        price: isPackage ? 0 : price,
      };
      if (editingService.isPackage && isPackage) {
        payload.packageDetails = {
          sessionsPerDay,
          sessionDuration,
          packageDuration,
          totalSessions: sessionsPerDay * packageDuration,
          pricingBySize: { small: smallPrice, medium: mediumPrice, large: largePrice, extraLarge: extraLargePrice },
        };
      }
      const data = await apiClient.put(`/vendor/${vendorId}/services/${editingService.id}`, payload) as any;
      if (data && data.success) {
        toast.success('Service updated. You can submit for approval when ready.');
        resetForm();
        setShowEditDialog(false);
        setEditingService(null);
        await loadCustomServices();
        onServiceCreated();
      } else {
        toast.error(data?.error || 'Failed to update service');
      }
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Error updating service');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setServiceName('');
    setDescription('');
    setDuration(60);
    setPrice(0);
    setCategoryName('');
    setSubCategoryName('');
    setIsPackage(false);
    setSessionsPerDay(1);
    setSessionDuration(60);
    setPackageDuration(7);
    setSmallPrice(0);
    setMediumPrice(0);
    setLargePrice(0);
    setExtraLargePrice(0);
    setWhatIncluded(['']);
    setWhatNotIncluded(['']);
    setPetTypes([]);
    setSelectedMicroCategory(null);
    // ✅ Reset to first available style
    if (effectiveStyles.length > 0) {
      setSelectedServiceStyle(effectiveStyles[0]);
    }
  };
  
  // ✅ Service style labels for display
  const SERVICE_STYLE_LABELS: Record<string, { label: string; icon: string; description: string }> = {
    at_center: { label: 'At Center', icon: '🏥', description: 'Service at your location' },
    at_home: { label: 'Home Visit', icon: '🏠', description: 'Service at customer\'s home' },
    tele: { label: 'Tele Consultation', icon: '📹', description: 'Video consultation' },
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="text-gray-600">Draft</Badge>;
      case 'pending_approval':
        return <Badge className="bg-orange-500">Pending Approval</Badge>;
      case 'published':
        return <Badge className="bg-green-500">Published</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white w-full max-w-[430px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          {/* ✅ FIX: Improved back button styling to match theme */}
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border-2 border-[#FF8C42] hover:bg-orange-50 transition-colors shadow-sm"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF8C42]" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">
            Custom Services
          </h1>
          <Button
            onClick={() => { setEditingService(null); resetForm(); setShowCreateDialog(true); }}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
        
        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Create Your Custom Services</p>
              <p>Create custom services tailored to your business. Choose the service type (at center, home visit, or tele consultation) based on your offerings. All custom services require admin approval before going live.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Services List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 mt-4">Loading custom services...</p>
        </div>
      ) : customServices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-300">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-semibold mb-2">No Custom Services Yet</p>
          <p className="text-sm text-gray-500 mb-4">Create your first custom service to get started</p>
          <Button
            onClick={() => { setEditingService(null); resetForm(); setShowCreateDialog(true); }}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Service
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {customServices.map((service) => (
            <div key={service.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              {/* Service Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{service.serviceName}</h3>
                  <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {service.categoryName}
                    </Badge>
                    {service.subCategoryName && (
                      <Badge variant="outline" className="text-xs">{service.subCategoryName}</Badge>
                    )}
                    {getStatusBadge(service.publishStatus || 'draft')}
                  </div>
                </div>
              </div>

              {/* Service Details */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-[#FF8C42]" />
                  <span>{service.duration} mins</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4 text-[#FF8C42]" />
                  <span>
                    {service.isPackage ? 'Package' : `₹${service.price}`}
                  </span>
                </div>
              </div>

              {/* Package Details */}
              {service.isPackage && service.packageDetails && (
                <div className="bg-orange-50 rounded-lg p-3 mb-3 text-sm">
                  <p className="font-semibold text-gray-900 mb-2">Package Details:</p>
                  <div className="grid grid-cols-2 gap-2 text-gray-700">
                    <div>Small: ₹{service.packageDetails.pricingBySize.small}</div>
                    <div>Medium: ₹{service.packageDetails.pricingBySize.medium}</div>
                    <div>Large: ₹{service.packageDetails.pricingBySize.large}</div>
                    <div>X-Large: ₹{service.packageDetails.pricingBySize.extraLarge}</div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    {service.packageDetails.totalSessions} sessions over {service.packageDetails.packageDuration} days
                  </p>
                </div>
              )}

              {/* Rejection Reason */}
              {service.publishStatus === 'rejected' && service.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-red-900 mb-1">Rejection Reason:</p>
                      <p className="text-red-800">{service.rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions: Edit only for unpublished (draft/rejected); Delete only for unpublished */}
              <div className="flex items-center gap-2 flex-wrap">
                {(service.publishStatus === 'draft' || service.publishStatus === 'rejected') && (
                  <Button
                    onClick={() => openEditDialog(service)}
                    size="sm"
                    variant="outline"
                    className="text-gray-700 border-gray-200 hover:bg-gray-50"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                )}
                {service.publishStatus === 'draft' && (
                  <Button
                    onClick={() => handlePublishService(service.id!)}
                    size="sm"
                    className="bg-[#FF8C42] text-white hover:bg-[#FF7A2E]"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Submit for Approval
                  </Button>
                )}
                {(service.publishStatus === 'draft' || service.publishStatus === 'rejected') && (
                  <Button
                    onClick={() => handleDeleteService(service.id!)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog: same form for create and edit */}
      <Dialog
        open={showCreateDialog || showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setEditingService(null);
          }
        }}
      >
        <DialogContent className="max-w-[420px] max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-xl rounded-2xl">
          <DialogHeader className="border-b border-gray-100 pb-4 mb-4 space-y-2 bg-gradient-to-r from-[#FF8C42]/10 to-[#FF6B35]/10 -mx-6 -mt-6 px-6 pt-6 rounded-t-2xl">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              {editingService ? 'Edit Custom Service' : 'Create Custom Service'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2 mb-0 leading-relaxed">
              {editingService
                ? 'Update the service details below. After saving, you can submit for approval when ready.'
                : 'Add a new custom service. All custom services require admin approval before going live.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 mt-4">
            {/* Service Name */}
            <div className="space-y-2">
              <Label htmlFor="serviceName">Service Name *</Label>
              <Input
                id="serviceName"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g., Premium Spa Treatment"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your service..."
                rows={3}
              />
            </div>

            {/* ✅ NEW: Service Style Selector */}
            <div className="space-y-2">
              <Label>Service Type *</Label>
              <p className="text-xs text-gray-500 mb-2">
                Choose where this service will be provided
              </p>
              <div className="grid grid-cols-1 gap-2">
                {effectiveStyles.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setSelectedServiceStyle(style)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                      selectedServiceStyle === style
                        ? 'border-[#FF8C42] bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                    }`}
                  >
                    <span className="text-xl">{SERVICE_STYLE_LABELS[style]?.icon}</span>
                    <div className="flex-1">
                      <p className={`font-medium ${selectedServiceStyle === style ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                        {SERVICE_STYLE_LABELS[style]?.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {SERVICE_STYLE_LABELS[style]?.description}
                      </p>
                    </div>
                    {selectedServiceStyle === style && (
                      <CheckCircle className="w-5 h-5 text-[#FF8C42]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category *</Label>
              <select
                id="categoryName"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setSubCategoryName(''); // Reset sub-category
                  setSelectedMicroCategory(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="">Select Category...</option>
                
                {/* ✅ AI-POWERED CATEGORIES (with templates) */}
                {availableCategories.length > 0 && (
                  <optgroup label="📚 Suggested Categories (With Templates)">
                    {availableCategories.map(cat => (
                      <option key={cat.category} value={cat.category}>
                        {cat.categoryLabel} ({cat.microCategories.length} templates)
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {/* ✅ CATALOG CATEGORIES (from 441 services) */}
                {catalogCategories.length > 0 && (
                  <optgroup label="🗂️ All Platform Categories">
                    {catalogCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {/* ✅ OTHER OPTION - Always Available */}
                <optgroup label="✨ Custom">
                  <option value="other">Other (Custom Category)</option>
                </optgroup>
              </select>
              
              {/* ✅ Custom Category Name Input (when "Other" selected) */}
              {categoryName === 'other' && (
                <div className="mt-2">
                  <Label htmlFor="customCategoryName">Custom Category Name *</Label>
                  <Input
                    id="customCategoryName"
                    placeholder="Enter custom category name..."
                    value={subCategoryName}
                    onChange={(e) => {
                      // ✅ FIX: Store custom category name in subCategoryName temporarily,
                      // then use it as categoryName when submitting
                      setSubCategoryName(e.target.value);
                    }}
                    className="border-[#FF8C42]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Define your own category name (e.g., "Spa Services", "Pet Photography")
                  </p>
                </div>
              )}
            </div>

            {/* 🎨 AI-POWERED MICRO-CATEGORY TEMPLATES */}
            {availableMicroCategories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#FF8C42]" />
                  <Label>AI-Suggested Service Templates</Label>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Click a template to auto-fill service details
                </p>
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {availableMicroCategories.map((micro) => (
                    <button
                      key={micro.id}
                      type="button"
                      onClick={() => applyMicroCategoryTemplate(micro)}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        selectedMicroCategory?.id === micro.id
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 bg-white hover:border-[#FF8C42] hover:bg-orange-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {micro.icon && <span className="text-xl">{micro.icon}</span>}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {micro.name}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {micro.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {micro.commonDuration}m
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {micro.priceRange ? `₹${micro.priceRange.min}-₹${micro.priceRange.max}` : 'Price not set'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-Category */}
            <div className="space-y-2">
              <Label htmlFor="subCategoryName">Sub-Category (Optional)</Label>
              <Input
                id="subCategoryName"
                value={subCategoryName}
                onChange={(e) => setSubCategoryName(e.target.value)}
                placeholder="e.g., Luxury Grooming"
              />
            </div>

            {/* Is Package Toggle */}
            <div className="flex items-center justify-between py-2 border-y border-gray-200">
              <div>
                <Label htmlFor="isPackage">Package Service</Label>
                <p className="text-xs text-gray-500">Service sold as a package with multiple sessions</p>
              </div>
              <Switch
                id="isPackage"
                checked={isPackage}
                onCheckedChange={setIsPackage}
              />
            </div>

            {/* Single Service Pricing */}
            {!isPackage && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (mins) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (₹) *</Label>
                    <Input
                      id="price"
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Package Pricing */}
            {isPackage && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sessionDuration">Session Duration (mins) *</Label>
                    <Input
                      id="sessionDuration"
                      type="number"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionsPerDay">Sessions/Day *</Label>
                    <Input
                      id="sessionsPerDay"
                      type="number"
                      value={sessionsPerDay}
                      onChange={(e) => setSessionsPerDay(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="packageDuration">Package Duration (days) *</Label>
                  <Input
                    id="packageDuration"
                    type="number"
                    value={packageDuration}
                    onChange={(e) => setPackageDuration(parseInt(e.target.value) || 0)}
                    min="1"
                  />
                  <p className="text-xs text-gray-500">
                    Total: {sessionsPerDay * packageDuration} sessions
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Package Pricing by Pet Size *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Small (₹)"
                      type="number"
                      value={smallPrice}
                      onChange={(e) => setSmallPrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <Input
                      placeholder="Medium (₹)"
                      type="number"
                      value={mediumPrice}
                      onChange={(e) => setMediumPrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <Input
                      placeholder="Large (₹)"
                      type="number"
                      value={largePrice}
                      onChange={(e) => setLargePrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <Input
                      placeholder="Extra Large (₹)"
                      type="number"
                      value={extraLargePrice}
                      onChange={(e) => setExtraLargePrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Pet Types */}
            <div className="space-y-2">
              <Label>Applicable Pet Types</Label>
              <div className="flex gap-2 flex-wrap">
                {['dog', 'cat', 'bird', 'rabbit', 'hamster'].map(petType => (
                  <button
                    key={petType}
                    type="button"
                    onClick={() => handlePetTypeToggle(petType)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      petTypes.includes(petType)
                        ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    {petType.charAt(0).toUpperCase() + petType.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ✅ FIX: Improved DialogFooter styling */}
          <DialogFooter className="border-t border-orange-100 pt-4 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setEditingService(null);
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={editingService ? handleUpdateService : handleCreateService}
              disabled={saving}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white hover:from-[#FF7A2E] hover:to-[#FF5A1F] shadow-md"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  {editingService ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingService ? 'Save' : 'Create Service'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}