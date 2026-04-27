'use client';

/**
 * ============================================================================
 * VENDOR CUSTOM SERVICE CREATION - ENHANCED UNIFIED MODAL
 * ============================================================================
 * 
 * This component provides a unified service/package creation experience that
 * adapts based on vendor role:
 * 
 * - TRAINERS/WALKERS/SITTERS: Simple session packages (X sessions over Y days)
 * - VET CLINICS/GROOMING CENTERS: Comprehensive packages (subscriptions, combos, memberships)
 * 
 * Features:
 * - Auto-detects vendor role and shows appropriate options
 * - Category auto-selection based on vendor role
 * - Role-specific package types unlock when category is selected
 * - Unified UI with conditional feature display
 * 
 * ============================================================================
 */

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  Plus, Save, X, AlertCircle, Clock, IndianRupee, Package, FileText,
  CheckCircle, Tag, Info, ArrowLeft, Sparkles, Calendar, Users, Percent,
  Star, Repeat, CreditCard, Zap, Gift, Shield, Heart, Pencil, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  getAllMicroCategoriesForRole, 
  getMicroCategoriesForRole,
  MicroCategory 
} from '@/lib/service-micro-categories';
import { getVendorRoleId, getVendorRoleName } from '@/lib/vendor-utils';
import { getServiceStyleLabelForRole } from '@/lib/service-style-labels';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const SpecializationSelector = lazy(() =>
  import('@/components/vendor/SpecializationSelector').then((m) => ({ default: m.SpecializationSelector }))
);

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CustomService {
  id?: string;
  serviceName: string;
  description: string;
  duration: number;
  price: number;
  categoryName: string;
  subCategoryName?: string;
  isPackage: boolean;
  packageType?: PackageType;
  packageDetails?: {
    // Session-based (trainers/walkers)
    sessionsPerDay?: number;
    sessionDuration?: number;
    packageDuration?: number; // days
    totalSessions?: number;
    pricingBySize?: {
      small: number;
      medium: number;
      large: number;
      extraLarge: number;
    };
    // Comprehensive (vet/grooming)
    includedServices?: Array<{ id: string; name: string; quantity?: number }>;
    subscriptionBillingCycle?: 'monthly' | 'quarterly' | 'yearly';
    membershipBenefits?: string[];
    discountPercentage?: number;
    validityDays?: number;
    maxUsageCount?: number; // -1 for unlimited
    usageInterval?: 'per_day' | 'per_week' | 'per_month' | 'total';
  };
  whatIncluded?: string[];
  whatNotIncluded?: string[];
  petTypes?: string[];
  publishStatus?: 'draft' | 'pending_approval' | 'published' | 'rejected';
  rejectionReason?: string;
}

type PackageType = 'session' | 'combo' | 'subscription' | 'membership' | 'unlimited';

// Vendor role categories
type VendorRoleCategory = 'trainer_walker' | 'vet_clinic' | 'grooming_center' | 'diagnostics' | 'other';

interface VendorCustomServiceCreationEnhancedProps {
  vendorId: string;
  vendorData?: any;
  serviceStyle?: 'at_center' | 'at_home' | 'tele' | 'both';
  allowedServiceStyles?: string[];
  onClose: () => void;
  onServiceCreated: () => void;
}

// ============================================================================
// ROLE CONFIGURATION
// ============================================================================

// Map vendor roles to their category (use role NAME e.g. trainer_solo, groomer_solo)
const VENDOR_ROLE_MAPPING: Record<string, VendorRoleCategory> = {
  'pet_trainer': 'trainer_walker',
  'trainer_solo': 'trainer_walker',
  'trainer_center': 'trainer_walker',
  'dog_trainer': 'trainer_walker',
  'obedience_trainer': 'trainer_walker',
  'dog_walker': 'trainer_walker',
  'pet_walker': 'trainer_walker',
  'pet_sitter': 'trainer_walker',
  'dog_sitter': 'trainer_walker',
  'vet': 'vet_clinic',
  'vet_clinic': 'vet_clinic',
  'veterinary': 'vet_clinic',
  'animal_hospital': 'vet_clinic',
  'diagnostic_center': 'diagnostics',
  'diagnostics_center': 'diagnostics',
  'diagnostics': 'diagnostics',
  'diagnostics_provider': 'diagnostics',
  'diagnostics_solo': 'diagnostics',
  'groomer': 'grooming_center',
  'groomer_solo': 'grooming_center',
  'groomer_center': 'grooming_center',
  'grooming': 'grooming_center',
  'pet_groomer': 'grooming_center',
  'grooming_center': 'grooming_center',
  'spa': 'grooming_center',
  'pet_spa': 'grooming_center',
};

// Default categories per vendor role
const DEFAULT_CATEGORIES: Record<VendorRoleCategory, string> = {
  'trainer_walker': 'Training & Walking',
  'vet_clinic': 'Veterinary Services',
  'grooming_center': 'Grooming & Spa',
  'diagnostics': 'Lab Tests',
  'other': '',
};

// Package types available per vendor category
const PACKAGE_TYPES_BY_ROLE: Record<VendorRoleCategory, PackageType[]> = {
  'trainer_walker': ['session'], // Only session packages
  'vet_clinic': ['session', 'combo', 'subscription', 'membership', 'unlimited'],
  'grooming_center': ['session', 'combo', 'subscription', 'membership', 'unlimited'],
  'diagnostics': ['session', 'combo', 'subscription', 'membership', 'unlimited'],
  'other': ['session'],
};

// Package type configurations
const PACKAGE_TYPE_CONFIG: Record<PackageType, {
  label: string;
  icon: any;
  description: string;
  color: string;
}> = {
  'session': {
    label: 'Session Package',
    icon: Calendar,
    description: 'Fixed number of sessions over a time period',
    color: 'blue'
  },
  'combo': {
    label: 'Combo Package',
    icon: Package,
    description: 'Bundle multiple services together at a discount',
    color: 'purple'
  },
  'subscription': {
    label: 'Subscription Plan',
    icon: Repeat,
    description: 'Recurring billing with regular services',
    color: 'green'
  },
  'membership': {
    label: 'Membership',
    icon: Star,
    description: 'VIP access with discounts and perks',
    color: 'amber'
  },
  'unlimited': {
    label: 'Unlimited Plan',
    icon: Zap,
    description: 'Unlimited usage within validity period',
    color: 'pink'
  }
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VendorCustomServiceCreationEnhanced({
  vendorId,
  vendorData,
  serviceStyle,
  allowedServiceStyles = ['at_center', 'at_home', 'tele'],
  onClose,
  onServiceCreated
}: VendorCustomServiceCreationEnhancedProps) {
  // ============================================================================
  // EARLY VALIDATION
  // ============================================================================
  
  // ✅ FIX: Handle missing vendorId gracefully
  if (!vendorId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white vendor-app-column px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border-2 border-[#FF8C42] hover:bg-orange-50 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-[#FF8C42]" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 flex-1">
              Custom Services
            </h1>
          </div>
        </div>
        <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-red-300">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 font-semibold mb-2">Session Error</p>
          <p className="text-sm text-gray-500 mb-4">Unable to load vendor information. Please try again.</p>
          <Button onClick={onClose} variant="outline">Go Back</Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE
  // ============================================================================
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [customServices, setCustomServices] = useState<CustomService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  /** When set, POST body sends this UUID so backend resolves `service_categories` by primary key (avoids slug mismatches in prod). */
  const [platformCategoryId, setPlatformCategoryId] = useState<string | null>(null);
  const [subCategoryName, setSubCategoryName] = useState('');
  const [isPackage, setIsPackage] = useState(false);
  const [packageType, setPackageType] = useState<PackageType>('session');
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<'at_center' | 'at_home' | 'tele'>(
    serviceStyle && serviceStyle !== 'both' ? serviceStyle : 'at_center'
  );
  
  // Session package fields (trainers/walkers)
  const [sessionsPerDay, setSessionsPerDay] = useState(1);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [packageDuration, setPackageDuration] = useState(7);
  const [smallPrice, setSmallPrice] = useState(0);
  const [mediumPrice, setMediumPrice] = useState(0);
  const [largePrice, setLargePrice] = useState(0);
  const [extraLargePrice, setExtraLargePrice] = useState(0);
  
  // Comprehensive package fields (vet/grooming)
  const [includedServices, setIncludedServices] = useState<Array<{ id: string; name: string; quantity: number }>>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [membershipBenefits, setMembershipBenefits] = useState<string[]>(['']);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [validityDays, setValidityDays] = useState(30);
  const [maxUsageCount, setMaxUsageCount] = useState(-1); // -1 = unlimited
  const [usageInterval, setUsageInterval] = useState<'per_day' | 'per_week' | 'per_month' | 'total'>('total');
  const [packagePrice, setPackagePrice] = useState(0);
  
  // Additional details
  const [whatIncluded, setWhatIncluded] = useState<string[]>(['']);
  const [whatNotIncluded, setWhatNotIncluded] = useState<string[]>(['']);
  const [petTypes, setPetTypes] = useState<string[]>([]);

  // Categories
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const [availableMicroCategories, setAvailableMicroCategories] = useState<MicroCategory[]>([]);
  const [selectedMicroCategory, setSelectedMicroCategory] = useState<MicroCategory | null>(null);
  const [catalogCategories, setCatalogCategories] = useState<any[]>([]);
  
  // Specializations (optional – for discovery / "What's your pet's need?")
  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<string[]>([]);
  const [specRefreshKey, setSpecRefreshKey] = useState(0);
  
  // Available vendor services for combo packages
  const [vendorServices, setVendorServices] = useState<any[]>([]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Determine vendor role category (use role NAME e.g. trainer_solo, groomer_solo - not UUID)
  const vendorRoleCategory = useMemo((): VendorRoleCategory => {
    const roleName = getVendorRoleName(vendorData) || (vendorData?.roleId || vendorData?.role_id || '');
    const roleLower = String(roleName).toLowerCase().replace(/[-_\s]/g, '_');
    return VENDOR_ROLE_MAPPING[roleLower] || 'other';
  }, [vendorData]);

  // Get available package types for this vendor
  const availablePackageTypes = useMemo(() => {
    return PACKAGE_TYPES_BY_ROLE[vendorRoleCategory] || ['session'];
  }, [vendorRoleCategory]);

  // Check if vendor supports comprehensive packages
  const supportsComprehensivePackages = useMemo(() => {
    return vendorRoleCategory === 'vet_clinic' || vendorRoleCategory === 'grooming_center' || vendorRoleCategory === 'diagnostics';
  }, [vendorRoleCategory]);

  // Determine effective service styles
  const isSoloProvider = vendorData?.vendorConfiguration === 'solo' || 
                         vendorData?.isSoloProvider || 
                         vendorData?.is_solo_provider;
  
  const effectiveStyles = useMemo(() => {
    const styles = allowedServiceStyles.filter(style => 
      ['at_center', 'at_home', 'tele'].includes(style)
    ) as ('at_center' | 'at_home' | 'tele')[];
    
    return isSoloProvider ? styles.filter(s => s !== 'at_center') : styles;
  }, [allowedServiceStyles, isSoloProvider]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // ✅ Check if this is a trainer/walker/sitter/groomer who can create session packages even as solo (solo trainer, solo groomer)
  const isTrainerWalkerSitter = useMemo(() => {
    const roleName = (getVendorRoleName(vendorData) || (vendorData?.roleId || vendorData?.role_id || '')).toLowerCase();
    return roleName.includes('trainer') || roleName.includes('walker') || roleName.includes('sitter') || roleName.includes('groomer');
  }, [vendorData]);
  
  // ✅ Solo trainers/walkers/sitters CAN create session packages
  // Other solo providers cannot create any packages
  const canCreateSessionPackage = !isSoloProvider || isTrainerWalkerSitter;
  
  // ✅ Refetch specializations when create modal opens (to get latest from Catalog > Categories)
  useEffect(() => {
    if (showCreateDialog) setSpecRefreshKey((k) => k + 1);
  }, [showCreateDialog]);

  // ✅ FIX: Ensure non-trainer/walker/sitter solo providers cannot create packages
  useEffect(() => {
    if (isSoloProvider && !isTrainerWalkerSitter && isPackage) {
      setIsPackage(false);
    }
    // Force session package type for solo trainers/walkers/sitters
    if (isSoloProvider && isTrainerWalkerSitter && isPackage && packageType !== 'session') {
      setPackageType('session');
    }
  }, [isSoloProvider, isTrainerWalkerSitter, isPackage, packageType]);
  
  // Set default category based on vendor role
  useEffect(() => {
    if (!categoryName && vendorRoleCategory !== 'other') {
      setCategoryName(DEFAULT_CATEGORIES[vendorRoleCategory]);
    }
  }, [vendorRoleCategory, categoryName]);

  // Load catalog categories - use vendor-accessible endpoint to avoid 401 redirect
  // GET /admin/service-catalog requires admin auth and caused redirect to /auth when vendor opened Custom Services
  useEffect(() => {
    const loadCatalogCategories = async () => {
      try {
        const data = await apiClient.get('/service-catalog/categories') as any;
        if (data?.success && Array.isArray(data.categories)) {
          const list = data.categories.map((c: any) => ({
            id: c.id || '',
            category_id: (c.category_id != null && String(c.category_id).trim()) || '',
            name: c.name || c.categoryName || '',
          })).filter(
            (c: { id: string; name: string; category_id?: string }) =>
              c.id && (String(c.name || '').trim() || String(c.category_id || '').trim())
          );
          setCatalogCategories(list);
        } else {
          // Fallback: build from micro-categories if no catalog
          setCatalogCategories([]);
        }
      } catch (error) {
        console.error('Error loading catalog categories:', error);
        setCatalogCategories([]);
      }
    };
    loadCatalogCategories();
  }, []);

  // Load micro-categories for role - use role NAME for catalog lookup (diagnostics use "Diagnostics Center" not UUID)
  const roleId = getVendorRoleId(vendorData);
  const roleName = getVendorRoleName(vendorData);
  useEffect(() => {
    if (roleId || roleName) {
      const categories = getAllMicroCategoriesForRole(roleId, roleName ?? undefined);
      setAvailableCategories(categories);
    }
  }, [roleId, roleName]);

  // Load micro-categories when category changes
  useEffect(() => {
    if (categoryName && (roleId || roleName)) {
      const micros = getMicroCategoriesForRole(roleId, roleName ?? undefined);
      setAvailableMicroCategories(micros);
    } else {
      setAvailableMicroCategories([]);
    }
  }, [categoryName, roleId, roleName]);

  // Load vendor services for combo packages
  useEffect(() => {
    if (supportsComprehensivePackages) {
      loadVendorServices();
    }
  }, [vendorId, supportsComprehensivePackages]);

  // Load custom services
  useEffect(() => {
    loadCustomServices();
  }, [vendorId]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadCustomServices = async () => {
    try {
      setLoading(true);
      // Timeout safeguard (15s) - prevents infinite hang if API never responds
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), 15000)
      );
      const data = await Promise.race([
        apiClient.get(`/vendor/${vendorId}/services?custom=true`) as Promise<any>,
        timeoutPromise,
      ]);
      if (data?.success) {
        setCustomServices(Array.isArray(data.services) ? data.services : []);
      }
    } catch (error) {
      console.error('Error loading custom services:', error);
      toast.error('Error loading custom services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorServices = async () => {
    try {
      const data = await apiClient.get(`/vendor/${vendorId}/services`) as any;
      if (data?.success) {
        // Backend returns services as object (servicesByStyle) or array - use allServices for combo dropdown
        const list = Array.isArray(data.services)
          ? data.services
          : Array.isArray(data.allServices)
            ? data.allServices
            : [];
        setVendorServices(list);
      }
    } catch (error) {
      console.error('Error loading vendor services:', error);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const applyMicroCategoryTemplate = (micro: MicroCategory) => {
    setSelectedMicroCategory(micro);
    setServiceName(micro.name);
    setDescription(micro.description || '');
    setDuration(micro.commonDuration || 60);
    setPrice(micro.priceRange ? Math.floor((micro.priceRange.min + micro.priceRange.max) / 2) : 0);
    setSubCategoryName(micro.name);
    toast.success(`✨ Applied template: ${micro.name}`);
  };

  const handleAddIncluded = () => setWhatIncluded([...whatIncluded, '']);
  const handleRemoveIncluded = (index: number) => setWhatIncluded(whatIncluded.filter((_, i) => i !== index));
  const handleUpdateIncluded = (index: number, value: string) => {
    const updated = [...whatIncluded];
    updated[index] = value;
    setWhatIncluded(updated);
  };

  const handleAddNotIncluded = () => setWhatNotIncluded([...whatNotIncluded, '']);
  const handleRemoveNotIncluded = (index: number) => setWhatNotIncluded(whatNotIncluded.filter((_, i) => i !== index));
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

  const handleAddBenefit = () => setMembershipBenefits([...membershipBenefits, '']);
  const handleRemoveBenefit = (index: number) => setMembershipBenefits(membershipBenefits.filter((_, i) => i !== index));
  const handleUpdateBenefit = (index: number, value: string) => {
    const updated = [...membershipBenefits];
    updated[index] = value;
    setMembershipBenefits(updated);
  };

  const handleToggleService = (service: any) => {
    const exists = includedServices.find(s => s.id === service.id);
    if (exists) {
      setIncludedServices(includedServices.filter(s => s.id !== service.id));
    } else {
      setIncludedServices([...includedServices, { id: service.id, name: service.serviceName || service.name, quantity: 1 }]);
    }
  };

  const handleUpdateServiceQuantity = (id: string, quantity: number) => {
    setIncludedServices(includedServices.map(s => s.id === id ? { ...s, quantity } : s));
  };

  // ============================================================================
  // VALIDATION & SUBMISSION
  // ============================================================================

  const validateForm = (): boolean => {
    if (!serviceName.trim()) {
      toast.error('Service name is required');
      return false;
    }
    // ✅ Duplicate name check (case-insensitive) - service names must be unique per vendor
    const nameNorm = (s: string) => (s || '').trim().toLowerCase();
    const isDuplicateName = customServices.some(
      (s) => nameNorm(s.serviceName || s.name || '') === nameNorm(serviceName)
    );
    if (isDuplicateName) {
      toast.error('A service with this name already exists. Please use a different name.');
      return false;
    }
    if (!description.trim()) {
      toast.error('Service description is required');
      return false;
    }
    if (!categoryName.trim() || (categoryName === 'other' && !subCategoryName.trim())) {
      toast.error('Category is required');
      return false;
    }
    if (duration <= 0) {
      toast.error('Duration must be greater than 0');
      return false;
    }

    if (isPackage) {
      if (packageType === 'session') {
        // Session package validation
        if (packagePrice <= 0) {
          toast.error('Package price must be greater than 0');
          return false;
        }
        if (packageDuration <= 0) {
          toast.error('Package duration must be greater than 0');
          return false;
        }
      } else {
        // Comprehensive package validation
        if (packagePrice <= 0) {
          toast.error('Package price must be greater than 0');
          return false;
        }
        if (packageType === 'combo' && includedServices.length === 0) {
          toast.error('Please add at least one service to the combo package');
          return false;
        }
        if (validityDays <= 0) {
          toast.error('Validity days must be greater than 0');
          return false;
        }
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
    if (!validateForm()) return;
    
    try {
      setSaving(true);
      
      const effectiveCategoryName = categoryName === 'other' && subCategoryName.trim()
        ? subCategoryName.trim()
        : categoryName.trim();
      const categoryForApi = platformCategoryId ?? effectiveCategoryName;

      const customService: any = {
        serviceName: serviceName.trim(),
        description: description.trim(),
        duration: isPackage && packageType === 'session' ? sessionDuration : duration,
        price: isPackage ? 0 : price,
        category: categoryForApi,
        categoryName: categoryForApi,
        subCategoryName: categoryName === 'other' ? undefined : (subCategoryName.trim() || undefined),
        serviceStyle: selectedServiceStyle,
        isPackage,
        packageType: isPackage ? packageType : undefined,
        packageDetails: isPackage ? buildPackageDetails() : undefined,
        whatIncluded: whatIncluded.filter(i => i.trim() !== ''),
        whatNotIncluded: whatNotIncluded.filter(i => i.trim() !== ''),
        petTypes: petTypes.length > 0 ? petTypes : ['dog', 'cat'],
        publishStatus: 'draft',
        specializationIds: selectedSpecializationIds.length > 0 ? selectedSpecializationIds : undefined,
      };
      
      const data = await apiClient.post(`/vendor/${vendorId}/services/custom`, customService) as any;

      if (data?.success) {
        toast.success('Custom service created successfully!');
        resetForm();
        setShowCreateDialog(false);
        await loadCustomServices();
        onServiceCreated();
      } else {
        toast.error(data?.error || 'Failed to create custom service');
      }
    } catch (error: any) {
      console.error('Error creating custom service:', error);
      const message =
        (typeof error?.originalError?.error === 'string' && error.originalError.error) ||
        error?.message ||
        'Error creating custom service';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const buildPackageDetails = () => {
    if (packageType === 'session') {
      return {
        sessionsPerDay,
        sessionDuration,
        packageDuration,
        totalSessions: sessionsPerDay * packageDuration,
        price: packagePrice
      };
    }
    
    return {
      includedServices: packageType === 'combo' ? includedServices : undefined,
      subscriptionBillingCycle: packageType === 'subscription' ? billingCycle : undefined,
      membershipBenefits: packageType === 'membership' ? membershipBenefits.filter(b => b.trim()) : undefined,
      discountPercentage: packageType === 'membership' ? discountPercentage : undefined,
      validityDays,
      maxUsageCount: packageType === 'unlimited' ? -1 : maxUsageCount,
      usageInterval,
      packagePrice,
      sessionDuration: sessionDuration || undefined,
      sessionsPerDay: sessionsPerDay || undefined,
    };
  };

  const handlePublishService = async (serviceId: string) => {
    try {
      const data = await apiClient.post(`/vendor/${vendorId}/services/custom/${serviceId}/publish`, {}) as any;
      if (data?.success) {
        toast.success('Service submitted for admin approval!');
        await loadCustomServices();
      } else {
        toast.error(data?.error || 'Failed to publish service');
      }
    } catch (error) {
      console.error('Error publishing service:', error);
      toast.error('Error publishing service');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      const data = await apiClient.delete(`/vendor/${vendorId}/services/${serviceId}`) as any;
      if (data?.success) {
        toast.success('Service deleted successfully');
        await loadCustomServices();
      } else {
        toast.error(data?.error || 'Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Error deleting service');
    }
  };

  const handleUpdatePrice = async (service: any) => {
    const currentPrice = service.price ?? service.customPrice ?? 0;
    const raw = window.prompt('Enter new price (₹)', String(currentPrice));
    if (raw == null || raw === '') return;
    const newPrice = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    if (Number.isNaN(newPrice) || newPrice < 0) {
      toast.error('Please enter a valid price');
      return;
    }
    try {
      const data = await apiClient.put(`/vendor/${vendorId}/services/${service.id}`, {
        price: newPrice,
        customPrice: newPrice,
      }) as any;
      if (data?.success !== false) {
        toast.success('Price updated');
        await loadCustomServices();
      } else {
        toast.error(data?.error || 'Failed to update price');
      }
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Failed to update price');
    }
  };

  const handleUnpublish = async (serviceId: string) => {
    if (!confirm('Unpublish this service? It will move back to draft and won\'t be visible to customers.')) return;
    try {
      const data = await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, {
        publishStatus: 'draft',
        isEnabled: false,
      }) as any;
      if (data?.success !== false) {
        toast.success('Service unpublished');
        await loadCustomServices();
      } else {
        toast.error(data?.error || 'Failed to unpublish');
      }
    } catch (error) {
      console.error('Error unpublishing service:', error);
      toast.error('Failed to unpublish');
    }
  };

  const resetForm = () => {
    setServiceName('');
    setDescription('');
    setDuration(60);
    setPrice(0);
    setCategoryName(DEFAULT_CATEGORIES[vendorRoleCategory] || '');
    setPlatformCategoryId(null);
    setSubCategoryName('');
    setIsPackage(false);
    setPackageType('session');
    setSessionsPerDay(1);
    setSessionDuration(60);
    setPackageDuration(7);
    setSmallPrice(0);
    setMediumPrice(0);
    setLargePrice(0);
    setExtraLargePrice(0);
    setIncludedServices([]);
    setBillingCycle('monthly');
    setMembershipBenefits(['']);
    setDiscountPercentage(0);
    setValidityDays(30);
    setMaxUsageCount(-1);
    setUsageInterval('total');
    setPackagePrice(0);
    setWhatIncluded(['']);
    setWhatNotIncluded(['']);
    setPetTypes([]);
    setSelectedMicroCategory(null);
    setSelectedSpecializationIds([]);
    if (effectiveStyles.length > 0) {
      setSelectedServiceStyle(effectiveStyles[0]);
    }
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

  const getPackageTypeBadge = (type?: PackageType) => {
    if (!type) return null;
    const config = PACKAGE_TYPE_CONFIG[type];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <Badge className={`bg-${config.color}-100 text-${config.color}-700`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="vendor-root-scroll min-h-0 bg-gradient-to-b from-orange-50 to-white vendor-app-column overscroll-y-contain px-6 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border-2 border-[#FF8C42] hover:bg-orange-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF8C42]" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">
            Custom Services
          </h1>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create
          </Button>
        </div>
        
        {/* Role Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">
                {vendorRoleCategory === 'trainer_walker' && '🎓 Trainer/Walker Services'}
                {vendorRoleCategory === 'vet_clinic' && '🏥 Vet Clinic Services'}
                {vendorRoleCategory === 'grooming_center' && '✨ Grooming Center Services'}
                {vendorRoleCategory === 'diagnostics' && '🔬 Diagnostics Center Services'}
                {vendorRoleCategory === 'other' && '📋 Custom Services'}
              </p>
              <p>
                {vendorRoleCategory === 'trainer_walker' 
                  ? 'Create training sessions and walking packages with session-based pricing.'
                  : supportsComprehensivePackages
                    ? 'Create services, subscriptions, combo packages, and membership plans.'
                    : 'Create custom services tailored to your business.'
                }
              </p>
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
            onClick={() => setShowCreateDialog(true)}
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
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{service.serviceName}</h3>
                  <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {service.categoryName}
                    </Badge>
                    {service.isPackage && getPackageTypeBadge(service.packageType)}
                    {getStatusBadge(service.publishStatus || 'draft')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-[#FF8C42]" />
                  <span>{service.duration} mins</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <IndianRupee className="w-4 h-4 text-[#FF8C42]" />
                  <span>
                    {service.isPackage
                      ? `Package · ₹${service.price ?? service.packageDetails?.price ?? service.packageDetails?.packagePrice ?? 0}`
                      : `₹${service.price}`}
                  </span>
                </div>
              </div>

              {/* Package Details */}
              {service.isPackage && service.packageDetails && (
                <div className="bg-orange-50 rounded-lg p-3 mb-3 text-sm">
                  {service.packageType === 'session' && service.packageDetails.pricingBySize && (
                    <>
                      <div className="text-gray-700">
                        <div>Price: ₹{service.packageDetails.price ?? service.packageDetails.packagePrice ?? service.packageDetails.pricingBySize?.small ?? service.price ?? 0}</div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        {service.packageDetails.totalSessions} sessions over {service.packageDetails.packageDuration} days
                      </p>
                    </>
                  )}
                  {service.packageType !== 'session' && service.packageDetails.validityDays && (
                    <div className="text-gray-700">
                      <p>Validity: {service.packageDetails.validityDays} days</p>
                      {service.packageDetails.includedServices && (
                        <p>{service.packageDetails.includedServices.length} services included</p>
                      )}
                    </div>
                  )}
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

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
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
                {(service.publishStatus === 'published' || service.publishStatus === 'pending_approval') && (
                  <Button
                    onClick={() => handleUnpublish(service.id!)}
                    size="sm"
                    variant="outline"
                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                  >
                    <EyeOff className="w-4 h-4 mr-1" />
                    Unpublish
                  </Button>
                )}
                {!service.isPackage && (
                  <Button
                    onClick={() => handleUpdatePrice(service)}
                    size="sm"
                    variant="outline"
                    className="text-gray-700 border-gray-200 hover:bg-gray-50"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Update Price
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

      {/* Create Service Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[420px] max-h-[90vh] overflow-y-auto bg-white border border-gray-200 shadow-xl rounded-2xl">
          <DialogHeader className="border-b border-gray-100 pb-4 mb-4 space-y-2 bg-gradient-to-r from-[#FF8C42]/10 to-[#FF6B35]/10 -mx-6 -mt-6 px-6 pt-6 rounded-t-2xl">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FF8C42]" />
              Create Custom Service
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-2 leading-relaxed">
              {vendorRoleCategory === 'trainer_walker' 
                ? 'Add a training session or walking package.'
                : supportsComprehensivePackages
                  ? 'Add a service, package, subscription, or membership plan.'
                  : 'Add a new custom service. All custom services require admin approval.'
              }
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

            {/* Service Type Selector */}
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
                    <span className="text-xl">{getServiceStyleLabelForRole(vendorData?.roleName ?? vendorData?.role_name, style)?.icon}</span>
                    <div className="flex-1">
                      <p className={`font-medium ${selectedServiceStyle === style ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                        {getServiceStyleLabelForRole(vendorData?.roleName ?? vendorData?.role_name, style)?.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {getServiceStyleLabelForRole(vendorData?.roleName ?? vendorData?.role_name, style)?.description}
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
                  const v = e.target.value;
                  setCategoryName(v);
                  setSubCategoryName('');
                  setSelectedMicroCategory(null);
                  const trimmedId = v.trim();
                  const platformRow = catalogCategories.find(
                    (c: { id?: string }) => c.id && String(c.id).trim() === trimmedId
                  );
                  if (platformRow?.id && String(platformRow.id).trim() === trimmedId) {
                    setPlatformCategoryId(trimmedId);
                  } else {
                    setPlatformCategoryId(null);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="">Select Category...</option>
                
                {availableCategories.length > 0 && (
                  <optgroup label="📚 Suggested Categories">
                    {availableCategories.map((cat: MicroCategory) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                
                {catalogCategories.length > 0 && (
                  <optgroup label="🗂️ All Platform Categories">
                    {catalogCategories.map((cat: { id?: string; category_id?: string; name?: string }) => {
                      const idStr = cat.id && String(cat.id).trim();
                      const optionValue = idStr
                        ? idStr
                        : (cat.category_id && String(cat.category_id).trim()) || cat.name || '';
                      return (
                        <option
                          key={cat.id || cat.category_id || cat.name}
                          value={optionValue}
                        >
                          {cat.name || cat.category_id || 'Category'}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                
                <optgroup label="✨ Custom">
                  <option value="other">Other (Custom Category)</option>
                </optgroup>
              </select>
              
              {categoryName === 'other' && (
                <div className="mt-2">
                  <Label htmlFor="customCategoryName">Custom Category Name *</Label>
                  <Input
                    id="customCategoryName"
                    placeholder="Enter custom category name..."
                    value={subCategoryName}
                    onChange={(e) => setSubCategoryName(e.target.value)}
                    className="border-[#FF8C42]"
                  />
                </div>
              )}
            </div>

            {/* 360°: Specializations (optional) – multi-select; links to "What's your pet needs?" discovery */}
            <div className="space-y-2">
              <Label>Specializations (Optional)</Label>
              <p className="text-xs text-gray-500 mb-1">
                Select the specializations this service or package covers so customers can find it when they choose a need.
              </p>
              <Suspense fallback={<div className="py-4 text-sm text-gray-500">Loading specializations...</div>}>
                <SpecializationSelector
                  roleId={getVendorRoleId(vendorData) || ''}
                  selected={selectedSpecializationIds}
                  onChange={setSelectedSpecializationIds}
                  refreshTrigger={specRefreshKey}
                />
              </Suspense>
            </div>

            {/* Is Package Toggle */}
            {/* ✅ Solo trainers/walkers/sitters CAN create session packages */}
            {/* ✅ Other solo providers cannot create packages - only custom services */}
            {canCreateSessionPackage && (
              <div className="flex items-center justify-between py-2 border-y border-gray-200">
                <div>
                  <Label htmlFor="isPackage">
                    {isSoloProvider && isTrainerWalkerSitter ? 'Session Package' : 'Package/Plan'}
                  </Label>
                  <p className="text-xs text-gray-500">
                    {isSoloProvider && isTrainerWalkerSitter 
                      ? 'Create a session package with duration, sessions & frequency'
                      : vendorRoleCategory === 'trainer_walker' 
                        ? 'Create a session package'
                        : 'Create a package, subscription, or membership'
                    }
                  </p>
                </div>
                <Switch
                  id="isPackage"
                  checked={isPackage}
                  onCheckedChange={setIsPackage}
                />
              </div>
            )}
            
            {/* Solo Provider Info - For non-trainer/walker/sitter */}
            {isSoloProvider && !isTrainerWalkerSitter && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 my-2">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">💡 Note:</span> As a solo provider, you can create custom services. 
                  Package creation is available for business accounts only.
                </p>
              </div>
            )}
            
            {/* Solo Trainer/Walker/Sitter Info */}
            {isSoloProvider && isTrainerWalkerSitter && isPackage && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 my-2">
                <p className="text-xs text-green-800">
                  <span className="font-semibold">✅ Session Package:</span> Define the number of sessions, 
                  duration per session, and frequency. Customers can track their package usage.
                </p>
              </div>
            )}

            {/* Package Type Selection - Only for comprehensive vendors; solo trainer/groomer get session only */}
            {isPackage && supportsComprehensivePackages && !(isSoloProvider && isTrainerWalkerSitter) && (
              <div className="space-y-2">
                <Label>Package Type</Label>
                <div className="grid grid-cols-1 gap-2">
                  {availablePackageTypes.map((type) => {
                    const config = PACKAGE_TYPE_CONFIG[type];
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPackageType(type)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          packageType === type
                            ? 'border-[#FF8C42] bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${packageType === type ? 'text-[#FF8C42]' : 'text-gray-400'}`} />
                        <div className="flex-1">
                          <p className={`font-medium ${packageType === type ? 'text-[#FF8C42]' : 'text-gray-900'}`}>
                            {config.label}
                          </p>
                          <p className="text-xs text-gray-500">{config.description}</p>
                        </div>
                        {packageType === type && <CheckCircle className="w-5 h-5 text-[#FF8C42]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Single Service Pricing */}
            {!isPackage && (
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
            )}

            {/* Session Package Fields (Trainers/Walkers or session type) */}
            {isPackage && packageType === 'session' && (
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
                  <Label>Package Price (₹) *</Label>
                  <Input
                    placeholder="Enter package price"
                    type="number"
                    value={packagePrice || ''}
                    onChange={(e) => setPackagePrice(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </>
            )}

            {/* Combo Package Fields */}
            {isPackage && packageType === 'combo' && supportsComprehensivePackages && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Included Services *</Label>
                  <p className="text-xs text-gray-500">Select services to include in this combo</p>
                  
                  {vendorServices.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
                      {vendorServices.map((service) => (
                        <div
                          key={service.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                            includedServices.find(s => s.id === service.id)
                              ? 'bg-orange-50 border border-[#FF8C42]'
                              : 'bg-white border border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => handleToggleService(service)}
                        >
                          <CheckCircle className={`w-4 h-4 ${
                            includedServices.find(s => s.id === service.id) ? 'text-[#FF8C42]' : 'text-gray-300'
                          }`} />
                          <span className="flex-1 text-sm">{service.serviceName || service.name}</span>
                          <span className="text-xs text-gray-500">₹{service.price}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No services available. Create services first.</p>
                  )}
                  
                  {includedServices.length > 0 && (
                    <div className="mt-2 p-2 bg-orange-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        Selected: {includedServices.length} services
                      </p>
                      {includedServices.map(s => (
                        <span key={s.id} className="text-xs text-gray-600">{s.name}, </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Validity (days) *</Label>
                    <Input
                      type="number"
                      value={validityDays}
                      onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Package Price (₹) *</Label>
                    <Input
                      type="number"
                      value={packagePrice || ''}
                      onChange={(e) => setPackagePrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Subscription Package Fields */}
            {isPackage && packageType === 'subscription' && supportsComprehensivePackages && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Max Usage</Label>
                    <Input
                      type="number"
                      value={maxUsageCount === -1 ? '' : maxUsageCount}
                      onChange={(e) => setMaxUsageCount(e.target.value ? parseInt(e.target.value) : -1)}
                      placeholder="Unlimited"
                      min="-1"
                    />
                    <p className="text-xs text-gray-500">Leave empty for unlimited</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Usage Interval</Label>
                    <select
                      value={usageInterval}
                      onChange={(e) => setUsageInterval(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="per_day">Per Day</option>
                      <option value="per_week">Per Week</option>
                      <option value="per_month">Per Month</option>
                      <option value="total">Total</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subscription Price (₹) *</Label>
                  <Input
                    type="number"
                    value={packagePrice || ''}
                    onChange={(e) => setPackagePrice(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
            )}

            {/* Membership Package Fields */}
            {isPackage && packageType === 'membership' && supportsComprehensivePackages && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Discount %</Label>
                    <Input
                      type="number"
                      value={discountPercentage || ''}
                      onChange={(e) => setDiscountPercentage(parseInt(e.target.value) || 0)}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Validity (days)</Label>
                    <Input
                      type="number"
                      value={validityDays}
                      onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Membership Benefits</Label>
                  {membershipBenefits.map((benefit, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={benefit}
                        onChange={(e) => handleUpdateBenefit(index, e.target.value)}
                        placeholder="e.g., Priority booking"
                      />
                      {membershipBenefits.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveBenefit(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={handleAddBenefit}>
                    <Plus className="w-4 h-4 mr-1" /> Add Benefit
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Membership Price (₹) *</Label>
                  <Input
                    type="number"
                    value={packagePrice || ''}
                    onChange={(e) => setPackagePrice(parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
            )}

            {/* Unlimited Package Fields */}
            {isPackage && packageType === 'unlimited' && supportsComprehensivePackages && (
              <div className="space-y-4">
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-pink-700">
                    <Zap className="w-5 h-5" />
                    <span className="font-medium">Unlimited Usage Plan</span>
                  </div>
                  <p className="text-xs text-pink-600 mt-1">
                    Customers can use this service unlimited times within the validity period.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Validity (days) *</Label>
                    <Input
                      type="number"
                      value={validityDays}
                      onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan Price (₹) *</Label>
                    <Input
                      type="number"
                      value={packagePrice || ''}
                      onChange={(e) => setPackagePrice(parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>
              </div>
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

          <DialogFooter className="border-t border-orange-100 pt-4 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowCreateDialog(false);
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateService}
              disabled={saving}
              className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white hover:from-[#FF7A2E] hover:to-[#FF5A1F]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Service
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
