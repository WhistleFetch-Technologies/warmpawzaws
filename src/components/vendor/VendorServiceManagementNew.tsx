import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X,
  Phone,
  Home,
  Building2,
  Check,
  MapPin
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorServiceManagementNewProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface CatalogService {
  id: string;
  name: string;
  description: string;
  icon: string;
  serviceStyles: string[]
  basePrice: number;
  duration: number;
  category: string;
  subCategory: string;
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
}

interface VendorService {
  id: string;
  catalogServiceId: string;
  catalogServiceName: string;
  serviceType: 'tele_consulting' | 'home_visit' | 'clinic_visit';
  pricing: {
    basePrice: number;
    currency: string;
  };
  duration: number;
  serviceArea?: {
    cities: string[];
    radius: number;
  };
  availability: {
    enabled: boolean;
    days: string[];
    timeSlots: { start: string; end: string }[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function VendorServiceManagementNew({ vendorId, vendorData, onBack }: VendorServiceManagementNewProps) {
  const [services, setServices] = useState<VendorService[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [selectedCatalogService, setSelectedCatalogService] = useState<CatalogService | null>(null);
  const [saving, setSaving] = useState(false);
  const [isCustomClinicService, setIsCustomClinicService] = useState(false);
  const [roleConfig, setRoleConfig] = useState<any>(null);
  const [allowedServiceStyles, setAllowedServiceStyles] = useState<string[]>([]);
  const [loadingRoleConfig, setLoadingRoleConfig] = useState(true);

  // Debug logging
  useEffect(() => {
    console.log('🔧 VendorServiceManagementNew initialized with:');
    console.log('   vendorId:', vendorId);
    console.log('   vendorData:', vendorData);
    console.log('   vendorData.id:', vendorData?.id);
    console.log('   vendorData.fullName:', vendorData?.fullName);
    console.log('   vendorData.businessName:', vendorData?.businessName);
  }, [vendorId, vendorData]);

  // Form state
  const [formData, setFormData] = useState({
    customServiceName: '',
    customServiceDescription: '',
    basePrice: '',
    duration: '30',
    availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timeSlotStart: '09:00',
    timeSlotEnd: '18:00',
    serviceArea: {
      cities: [''],
      radius: 10
    },
    isActive: true
  });

  useEffect(() => {
    loadServices();
    loadRoleConfiguration();
  }, [vendorId]);

  const loadRoleConfiguration = async () => {
    try {
      setLoadingRoleConfig(true);
      console.log('🔧 Loading role configuration for vendor:', vendorData);
      
      const roleId = vendorData?.roleId;
      if (!roleId) {
        console.warn('⚠️ No roleId found in vendorData, using default service styles');
        // Default to all service styles if no role
        setAllowedServiceStyles(['tele_consulting', 'home_visit', 'clinic_visit']);
        return;
      }

      console.log('📡 Fetching role configuration for roleId:', roleId);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles/${roleId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Role configuration loaded:', data.role);
        setRoleConfig(data.role);

        // Extract service styles from role configuration
        // Role config uses: ['at_home', 'at_center', 'tele']
        // We need to map to: ['home_visit', 'clinic_visit', 'tele_consulting']
        if (data.role?.serviceStyles && data.role.serviceStyles.length > 0) {
          const styleMap: Record<string, string> = {
            'at_home': 'home_visit',
            'at_center': 'clinic_visit',
            'tele': 'tele_consulting'
          };
          
          const mappedStyles = data.role.serviceStyles
            .map((style: string) => styleMap[style])
            .filter((style: string | undefined) => style !== undefined);
          
          console.log('📋 Role serviceStyles:', data.role.serviceStyles);
          console.log('📋 Mapped to allowed service styles:', mappedStyles);
          
          // ✅ SAFEGUARD: If mapped styles is empty (e.g. only incompatible styles), fallback to all
          if (mappedStyles.length === 0) {
            console.warn('⚠️ Mapped styles empty, using defaults as safeguard');
            setAllowedServiceStyles(['tele_consulting', 'home_visit', 'clinic_visit']);
          } else {
            setAllowedServiceStyles(mappedStyles);
          }
        } else {
          // Fallback: allow all styles if not configured
          console.warn('⚠️ No serviceStyles found in role config, using defaults');
          setAllowedServiceStyles(['tele_consulting', 'home_visit', 'clinic_visit']);
        }
      } else {
        console.error('❌ Failed to load role configuration');
        // Fallback to all styles
        setAllowedServiceStyles(['tele_consulting', 'home_visit', 'clinic_visit']);
      }
    } catch (error) {
      console.error('❌ Error loading role configuration:', error);
      // Fallback to all styles
      setAllowedServiceStyles(['tele_consulting', 'home_visit', 'clinic_visit']);
    } finally {
      setLoadingRoleConfig(false);
    }
  };

  const ensureVendorExists = async () => {
    try {
      console.log('🔧 Ensuring vendor exists in database...');
      console.log('📋 Vendor data being sent:', {
        vendorId: vendorId,
        phone: vendorData?.phone,
        fullName: vendorData?.fullName,
        businessName: vendorData?.businessName,
        vendorType: vendorData?.vendorType,
        serviceStyle: vendorData?.serviceStyle
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/ensure-exists`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId: vendorId,
            phone: vendorData?.phone || '',
            fullName: vendorData?.fullName || 'Vendor',
            businessName: vendorData?.businessName || '',
            vendorType: vendorData?.vendorType || 'service_provider',
            serviceStyle: vendorData?.serviceStyle || 'both'
          })
        }
      );

      console.log('📡 ensureVendorExists response status:', response.status);
      const data = await response.json();
      console.log('📡 ensureVendorExists response data:', data);
      
      if (response.ok) {
        console.log('✅ Vendor exists in database:', data.vendor);
        return true;
      } else {
        console.error('❌ Failed to ensure vendor exists:', data);
        return false;
      }
    } catch (error) {
      console.error('❌ Error ensuring vendor exists:', error);
      return false;
    }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // FIRST: Ensure vendor exists in DB
      await ensureVendorExists();
      
      console.log('📡 Loading services for vendor:', vendorId);
      console.log('📡 Making request to:', `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services?vendorId=${vendorId}`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services?vendorId=${vendorId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📡 Response data:', data);

      if (response.ok) {
        console.log('✅ Services loaded:', data.services);
        setServices(data.services || []);
      } else {
        console.error('❌ Failed to load services:', data);
        // Just show empty state - vendor might not be in DB yet or just got approved
        console.log('⚠️ No services found for vendor - showing empty state');
        setServices([]);
      }
    } catch (error) {
      console.error('❌ Error loading services:', error);
      // Don't show error toast - just empty state
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalogServices = async (serviceType: string) => {
    try {
      setLoadingCatalog(true);
      const roleId = vendorData?.roleId || 'default';
      
      // Map service type to service style
      // serviceType: 'tele_consulting', 'home_visit', 'clinic_visit'
      // serviceStyle in catalog: 'at_home', 'at_center', 'tele'
      const styleMap: Record<string, string> = {
        'tele_consulting': 'tele',
        'home_visit': 'at_home',
        'clinic_visit': 'at_center' // Clinic visits are 'at_center' in the new catalog
      };
      
      const serviceStyle = styleMap[serviceType];
      
      console.log(`📋 Loading catalog services for role: ${roleId}, style: ${serviceStyle}`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/service-catalog/role/${roleId}?serviceStyle=${serviceStyle}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded catalog services:', data);
        
        // Transform catalog services to match component interface
        const transformedServices = (data.services || []).map((service: any) => ({
          id: `catalog-${service.categoryId}-${service.subCategoryId}-${Date.now()}`,
          name: service.serviceName,
          description: service.description,
          icon: '💊', // Default icon, could be improved based on category
          serviceStyles: [serviceStyle],
          basePrice: service.isPackage ? 0 : service.basePrice,
          duration: service.duration || 30,
          category: service.categoryName,
          subCategory: service.subCategoryName,
          isPackage: service.isPackage,
          packageDetails: service.packageDetails
        }));
        
        setCatalogServices(transformedServices);
        console.log('✅ Transformed catalog services:', transformedServices.length, 'services');
      } else {
        console.error('❌ Failed to load catalog services');
        toast.error('Failed to load catalog services');
      }
    } catch (error) {
      console.error('Error loading catalog services:', error);
      toast.error('Failed to load catalog services');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const handleServiceTypeSelect = (serviceType: string) => {
    setSelectedServiceType(serviceType);
    setSelectedCatalogService(null);
    
    // For clinic visits, skip catalog and go straight to custom form
    if (serviceType === 'clinic_visit') {
      setIsCustomClinicService(true);
      // Pre-populate with default values for clinic visit
      setFormData({
        ...formData,
        customServiceName: '',
        customServiceDescription: '',
        basePrice: '',
        duration: '30'
      });
    } else {
      // For tele and home visits, load catalog
      setIsCustomClinicService(false);
      loadCatalogServices(serviceType);
    }
  };

  const handleCatalogServiceSelect = (service: CatalogService) => {
    setSelectedCatalogService(service);
    setFormData({
      ...formData,
      basePrice: service.basePrice?.toString() || '',
      duration: service.duration?.toString() || '30'
    });
  };

  const handleSaveService = async () => {
    if (!selectedCatalogService || !formData.basePrice) {
      toast.error('Please select a service and set a price');
      return;
    }

    // Validate service area for home visits
    if (selectedServiceType === 'home_visit' && !formData.serviceArea.cities[0]) {
      toast.error('Please add at least one service area city for home visits');
      return;
    }

    setSaving(true);
    try {
      const serviceData: Partial<VendorService> = {
        id: `vendor_service_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        catalogServiceId: selectedCatalogService.id,
        catalogServiceName: selectedCatalogService.name,
        serviceType: selectedServiceType as any,
        pricing: {
          basePrice: parseFloat(formData.basePrice),
          currency: 'INR'
        },
        duration: parseInt(formData.duration),
        availability: {
          enabled: true,
          days: formData.availableDays,
          timeSlots: [{ start: formData.timeSlotStart, end: formData.timeSlotEnd }]
        },
        isActive: formData.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add service area only for home visits
      if (selectedServiceType === 'home_visit') {
        serviceData.serviceArea = {
          cities: formData.serviceArea.cities.filter(c => c.trim() !== ''),
          radius: formData.serviceArea.radius
        };
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            service: serviceData
          })
        }
      );

      if (response.ok) {
        await loadServices();
        resetForm();
        toast.success('Service created successfully!');
      } else {
        toast.error('Failed to create service');
      }
    } catch (error) {
      console.error('Error saving service:', error);
      toast.error('Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCustomClinicService = async () => {
    // Validate required fields for custom clinic service
    if (!formData.customServiceName || !formData.customServiceDescription || !formData.basePrice) {
      toast.error('Please fill in service name, description, and price');
      return;
    }

    setSaving(true);
    try {
      const serviceData: Partial<VendorService> = {
        id: `vendor_service_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        catalogServiceId: 'custom_clinic', // Special ID for custom clinic services
        catalogServiceName: formData.customServiceName,
        serviceType: 'clinic_visit',
        pricing: {
          basePrice: parseFloat(formData.basePrice),
          currency: 'INR'
        },
        duration: parseInt(formData.duration),
        availability: {
          enabled: true,
          days: formData.availableDays,
          timeSlots: [{ start: formData.timeSlotStart, end: formData.timeSlotEnd }]
        },
        isActive: formData.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add custom description to service data
      (serviceData as any).customDescription = formData.customServiceDescription;

      console.log('📤 Creating custom clinic service:', serviceData);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            service: serviceData
          })
        }
      );

      const responseData = await response.json();
      console.log('📥 Backend response:', responseData);

      if (response.ok) {
        console.log('✅ Service created successfully, reloading services...');
        await loadServices();
        resetForm();
        toast.success('Custom clinic service created successfully!');
      } else {
        console.error('❌ Failed to create service:', responseData);
        toast.error(responseData.error || 'Failed to create service');
      }
    } catch (error) {
      console.error('❌ Error saving custom clinic service:', error);
      toast.error('Failed to save service: ' + String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/${serviceId}?vendorId=${vendorId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        await loadServices();
        toast.success('Service deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete service');
    }
  };

  const toggleServiceStatus = async (service: VendorService) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            vendorId,
            service: { ...service, isActive: !service.isActive }
          })
        }
      );

      if (response.ok) {
        await loadServices();
        toast.success(`Service ${service.isActive ? 'deactivated' : 'activated'}`);
      }
    } catch (error) {
      console.error('Error toggling service:', error);
    }
  };

  const resetForm = () => {
    setIsCreatingNew(false);
    setSelectedServiceType('');
    setSelectedCatalogService(null);
    setIsCustomClinicService(false);
    setCatalogServices([]);
    setFormData({
      customServiceName: '',
      customServiceDescription: '',
      basePrice: '',
      duration: '30',
      availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      timeSlotStart: '09:00',
      timeSlotEnd: '18:00',
      serviceArea: {
        cities: [''],
        radius: 10
      },
      isActive: true
    });
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'tele_consulting': return <Phone className="w-5 h-5" />;
      case 'home_visit': return <Home className="w-5 h-5" />;
      case 'clinic_visit': return <Building2 className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case 'tele_consulting': return 'Tele Consulting';
      case 'home_visit': return 'Home Visit';
      case 'clinic_visit': return 'Clinic Visit';
      default: return type;
    }
  };

  const addServiceAreaCity = () => {
    setFormData({
      ...formData,
      serviceArea: {
        ...formData.serviceArea,
        cities: [...formData.serviceArea.cities, '']
      }
    });
  };

  const updateServiceAreaCity = (index: number, value: string) => {
    const newCities = [...formData.serviceArea.cities];
    newCities[index] = value;
    setFormData({
      ...formData,
      serviceArea: {
        ...formData.serviceArea,
        cities: newCities
      }
    });
  };

  const removeServiceAreaCity = (index: number) => {
    if (formData.serviceArea.cities.length <= 1) return;
    const newCities = formData.serviceArea.cities.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      serviceArea: {
        ...formData.serviceArea,
        cities: newCities
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-20">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">Service Management</h1>
              <p className="text-xs text-gray-500">{vendorData?.businessName || vendorData?.fullName}</p>
            </div>
          </div>

          {!isCreatingNew && (
            <Button
              onClick={() => setIsCreatingNew(true)}
              className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add New Service
            </Button>
          )}
        </div>

        {/* Create New Service Flow */}
        {isCreatingNew && (
          <div className="p-4 border-b-8 border-gray-100 bg-orange-50">
            <div className="bg-white rounded-xl border border-orange-200 p-4 space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Add New Service</h2>
                <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step 1: Select Service Type */}
              {!selectedServiceType && (
                <>
                  <p className="text-sm text-gray-600 mb-3">Step 1: Select Service Type</p>
                  {loadingRoleConfig ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading options...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'tele_consulting', label: 'Tele Consulting', icon: '📞' },
                        { value: 'home_visit', label: 'Home Visit', icon: '🏠' },
                        { value: 'clinic_visit', label: 'Clinic Visit', icon: '🏥' }
                      ]
                        .filter(type => allowedServiceStyles.includes(type.value))
                        .map(type => (
                          <button
                            key={type.value}
                            onClick={() => handleServiceTypeSelect(type.value)}
                            className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-[#FF8C42] hover:bg-orange-50 transition-all"
                          >
                            <div className="text-3xl mb-2">{type.icon}</div>
                            <div className="text-xs font-medium text-gray-700">{type.label}</div>
                          </button>
                        ))}
                    </div>
                  )}
                  {!loadingRoleConfig && allowedServiceStyles.length === 0 && (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      No service styles configured for your role
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Select Catalog Service OR Custom Clinic Service Form */}
              {selectedServiceType && !selectedCatalogService && !isCustomClinicService && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Step 2: Select Service from Catalog</p>
                    <button
                      onClick={() => setSelectedServiceType('')}
                      className="text-xs text-[#FF8C42]"
                    >
                      Change Type
                    </button>
                  </div>
                  
                  {loadingCatalog ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading services...</p>
                    </div>
                  ) : catalogServices.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No services available for this type
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {catalogServices.map(service => (
                        <button
                          key={service.id}
                          onClick={() => handleCatalogServiceSelect(service)}
                          className="w-full flex items-center gap-3 p-3 border-2 border-gray-200 rounded-xl hover:border-[#FF8C42] hover:bg-orange-50 transition-all text-left"
                        >
                          <div className="text-2xl">{service.icon || '🔧'}</div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 text-sm">{service.name}</div>
                            <div className="text-xs text-gray-500">{service.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Custom Clinic Service Form */}
              {isCustomClinicService && selectedServiceType === 'clinic_visit' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Step 2: Create Custom Clinic Service</p>
                    <button
                      onClick={() => {
                        setSelectedServiceType('');
                        setIsCustomClinicService(false);
                      }}
                      className="text-xs text-[#FF8C42]"
                    >
                      Change Type
                    </button>
                  </div>

                  {/* Service Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Service Name<span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customServiceName}
                      onChange={(e) => setFormData({ ...formData, customServiceName: e.target.value })}
                      placeholder="e.g., Dental Cleaning, X-Ray, Surgery"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Description<span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.customServiceDescription}
                      onChange={(e) => setFormData({ ...formData, customServiceDescription: e.target.value })}
                      placeholder="Describe what this service includes..."
                      rows={3}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42] resize-none"
                    />
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Price (₹)<span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.basePrice}
                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                        placeholder="500"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Duration (min)
                      </label>
                      <select
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      >
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                        <option value="60">60</option>
                        <option value="90">90</option>
                        <option value="120">120</option>
                      </select>
                    </div>
                  </div>

                  {/* Available Days */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <button
                          key={day}
                          onClick={() => {
                            const days = formData.availableDays.includes(day)
                              ? formData.availableDays.filter(d => d !== day)
                              : [...formData.availableDays, day];
                            setFormData({ ...formData, availableDays: days });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            formData.availableDays.includes(day)
                              ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                              : 'bg-white text-gray-600 border-gray-300'
                          }`}
                        >
                          {day.substring(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.timeSlotStart}
                        onChange={(e) => setFormData({ ...formData, timeSlotStart: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.timeSlotEnd}
                        onChange={(e) => setFormData({ ...formData, timeSlotEnd: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveCustomClinicService}
                      disabled={saving}
                      className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Creating...' : 'Create Service'}
                    </Button>
                  </div>
                </>
              )}

              {/* Step 3: Configure Service Details */}
              {selectedCatalogService && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">Step 3: Configure Service</p>
                    <button
                      onClick={() => setSelectedCatalogService(null)}
                      className="text-xs text-[#FF8C42]"
                    >
                      Change Service
                    </button>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{selectedCatalogService.icon || '🔧'}</span>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{selectedCatalogService.name}</div>
                        <div className="text-xs text-gray-600">{getServiceTypeLabel(selectedServiceType)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Price (₹)<span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.basePrice}
                        onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                        placeholder="500"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Duration (min)
                      </label>
                      <select
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      >
                        <option value="15">15</option>
                        <option value="30">30</option>
                        <option value="45">45</option>
                        <option value="60">60</option>
                        <option value="90">90</option>
                        <option value="120">120</option>
                      </select>
                    </div>
                  </div>

                  {/* Service Area for Home Visits */}
                  {selectedServiceType === 'home_visit' && (
                    <div className="border-t border-gray-200 pt-4 mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Service Area Cities<span className="text-red-500">*</span>
                        </label>
                        <button
                          onClick={addServiceAreaCity}
                          className="text-xs text-[#FF8C42] flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add City
                        </button>
                      </div>
                      <div className="space-y-2">
                        {formData.serviceArea.cities.map((city, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={city}
                              onChange={(e) => updateServiceAreaCity(index, e.target.value)}
                              placeholder="e.g., Bangalore, Indore"
                              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF8C42]"
                            />
                            {formData.serviceArea.cities.length > 1 && (
                              <button
                                onClick={() => removeServiceAreaCity(index)}
                                className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Service Radius (km)
                        </label>
                        <input
                          type="number"
                          value={formData.serviceArea.radius}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            serviceArea: { ...formData.serviceArea, radius: parseInt(e.target.value) || 10 }
                          })}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#FF8C42]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Available Days */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <button
                          key={day}
                          onClick={() => {
                            const days = formData.availableDays.includes(day)
                              ? formData.availableDays.filter(d => d !== day)
                              : [...formData.availableDays, day];
                            setFormData({ ...formData, availableDays: days });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            formData.availableDays.includes(day)
                              ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                              : 'bg-white text-gray-600 border-gray-300'
                          }`}
                        >
                          {day.substring(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Slots */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={formData.timeSlotStart}
                        onChange={(e) => setFormData({ ...formData, timeSlotStart: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={formData.timeSlotEnd}
                        onChange={(e) => setFormData({ ...formData, timeSlotEnd: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#FF8C42]"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSaveService}
                      disabled={saving}
                      className="flex-1 bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Creating...' : 'Create Service'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Existing Services List */}
        <div className="p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Your Services ({services.length})</h2>
          
          {services.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm">No services added yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Add New Service" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {services.map(service => (
                <div key={service.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{service.catalogServiceName}</h3>
                        <Badge className={`text-xs ${
                          service.isActive 
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {getServiceTypeIcon(service.serviceType)}
                        <span>{getServiceTypeLabel(service.serviceType)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Price</div>
                      <div className="font-semibold text-gray-900">₹{service.pricing.basePrice}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-500">Duration</div>
                      <div className="font-semibold text-gray-900">{service.duration} min</div>
                    </div>
                  </div>

                  {service.serviceArea && (
                    <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-1 text-xs text-blue-700">
                        <MapPin className="w-3 h-3" />
                        <span>Service Areas: {service.serviceArea.cities.join(', ')}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleServiceStatus(service)}
                      className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      {service.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteService(service.id)}
                      className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}