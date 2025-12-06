import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Save, Check, AlertCircle, Clock, DollarSign, Info, Package, ChevronDown, ChevronUp, X, Edit, Trash2, Search, Stethoscope, Scissors, Heart, Activity, Sparkles, GraduationCap, Home, Phone, Syringe, Pill, FileText, Camera, MapPin, Dog, Cat } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { EnhancedPackageCreationModal } from './EnhancedPackageCreationModal';

interface VendorServiceConfigurationScreenProps {
  vendorId: string;
  vendorData: any;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  roleConfig: any;
  onBack: () => void;
}

interface Service {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  subCategoryName?: string;
  duration: number;
  price: number;
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
}

export function VendorServiceConfigurationScreen({ 
  vendorId, 
  vendorData,
  serviceStyle,
  roleConfig,
  onBack 
}: VendorServiceConfigurationScreenProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // ✅ NEW: Search state
  
  // Custom service form
  const [customServiceForm, setCustomServiceForm] = useState({
    serviceName: '',
    description: '',
    duration: 30,
    price: 0
  });
  
  const isPlatformManaged = serviceStyle === 'at_home' || serviceStyle === 'tele';
  
  // Check if this vendor can control pricing based on role config
  const canControlPrice = roleConfig?.pricingControl?.canControlPrice || false;
  const canControlDuration = roleConfig?.pricingControl?.canControlDuration || false;
  
  // For at_center, check if pricing is allowed
  const canEditPricing = serviceStyle === 'at_center' && canControlPrice;

  useEffect(() => {
    loadServices();
  }, [vendorId, serviceStyle]);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      console.log(`🔄 Loading services for vendor ${vendorId}, style: ${serviceStyle}`);
      
      // First check catalog status
      const debugResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/debug/catalog-status`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      
      if (debugResponse.ok) {
        const debugData = await debugResponse.json();
        console.log('📊 Catalog Status:', debugData);
        
        if (debugData.catalogCount === 0) {
          console.warn('⚠️ Catalog is empty! Need to seed it first.');
          toast.error('Service catalog is empty. Please contact admin to seed services.');
          setServices([]);
          setLoading(false);
          return;
        }
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/${serviceStyle}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Services loaded:', data);
        setServices(data.services || []);
      } else {
        const error = await response.text();
        console.error('❌ Failed to load services:', error);
        toast.error('Failed to load services');
        setServices([]);
      }
    } catch (error) {
      console.error('❌ Error loading services:', error);
      toast.error('Error loading services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, isEnabled: !s.isEnabled } : s
    ));
    setHasChanges(true);
  };

  const updateServicePrice = (serviceId: string, price: number) => {
    setServices(services.map(s => 
      s.id === serviceId ? { ...s, customPrice: price } : s
    ));
    setHasChanges(true);
  };

  const updateServiceDuration = (serviceId: string, duration: number) => {
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

  const saveConfiguration = async () => {
    try {
      setSaving(true);
      console.log('💾 Saving service configuration...');
      
      const servicesToSave = services.map(s => ({
        serviceId: s.id,
        serviceName: s.name,
        isEnabled: s.isEnabled,
        customPrice: s.customPrice,
        customDuration: s.customDuration,
        customDescription: s.customDescription,
        price: s.price, // Include base price for validation fallback
        isNewService: s.isCustomService || false
      }));

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/configure`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            serviceStyle,
            services: servicesToSave
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Configuration saved:', data);
        toast.success('Services saved successfully');
        setHasChanges(false);
        return true;
      } else {
        const error = await response.json();
        console.error('❌ Failed to save configuration:', error);
        toast.error(error.error || 'Failed to save configuration');
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
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/publish`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ serviceStyle })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Services published:', data);
        
        if (data.status === 'published') {
          toast.success(`${data.publishedCount} service(s) published successfully!`);
        } else if (data.status === 'pending_approval') {
          toast.success('Services submitted for admin approval');
        }
        
        // Reload services to show updated status
        await loadServices();
      } else {
        const error = await response.json();
        console.error('❌ Failed to publish:', error);
        toast.error(error.error || 'Failed to publish services');
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
        
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/packages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
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
            })
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Package created:', data);
          toast.success('Package created successfully! Pending admin approval.');
          return;
        } else {
          const error = await response.json();
          console.error('❌ Failed to create package:', error);
          toast.error(error.error || 'Failed to create package');
          return;
        }
      }
      
      // Single custom service (not package)
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services/add-custom`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            serviceStyle,
            ...packageData
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Custom service added:', data);
        toast.success('Custom service added successfully!');
        
        // Reload services
        await loadServices();
      } else {
        const error = await response.json();
        console.error('❌ Failed to add custom service:', error);
        toast.error(error.error || 'Failed to add custom service');
      }
    } catch (error) {
      console.error('❌ Error adding custom service:', error);
      toast.error('Error adding custom service');
      throw error;
    }
  };

  const enabledCount = services.filter(s => s.isEnabled).length;
  const publishedCount = services.filter(s => s.publishStatus === 'published').length;
  const pendingCount = services.filter(s => s.publishStatus === 'pending_approval').length;

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'at_home': return '🏠';
      case 'at_center': return '🏥';
      case 'tele': return '📱';
    }
  };

  const getStyleName = () => {
    switch (serviceStyle) {
      case 'at_home': return 'Home Services';
      case 'at_center': return 'Book at Clinic';
      case 'tele': return 'Tele Consultation';
    }
  };

  const getStatusBadge = (service: Service) => {
    if (!service.isEnabled) {
      return <Badge variant="outline" className="text-gray-500">Disabled</Badge>;
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
    const name = service.name.toLowerCase();
    const category = service.categoryName?.toLowerCase() || '';
    const subCategory = service.subCategoryName?.toLowerCase() || '';

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
    ? services.filter(service =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.categoryName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.subCategoryName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
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
        {/* Header */}
        <div className="p-4 bg-white border-b sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getStyleIcon()}</span>
                <h1 className="font-semibold text-gray-900">{getStyleName()}</h1>
              </div>
              <p className="text-xs text-gray-500">{vendorData?.businessName || vendorData?.fullName}</p>
            </div>
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

          {/* Add Custom Service Button - Available for ALL at_center vendors */}
          {serviceStyle === 'at_center' && (
            <Button
              onClick={() => setShowAddCustomDialog(true)}
              variant="outline"
              className="w-full mt-3 border-2 border-dashed border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Custom Service
            </Button>
          )}
        </div>

        {/* Info Banner */}
        <div className={`mx-4 mt-4 p-3 rounded-lg ${
          isPlatformManaged 
            ? 'bg-blue-50 border border-blue-200' 
            : canEditPricing
              ? 'bg-orange-50 border border-orange-200'
              : 'bg-blue-50 border border-blue-200'
        }`}>
          <div className="flex items-start gap-2">
            <Info className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              isPlatformManaged || !canEditPricing ? 'text-blue-500' : 'text-orange-500'
            }`} />
            <div className="flex-1 text-xs">
              {isPlatformManaged ? (
                <p className="text-blue-700">
                  <strong>Platform Managed:</strong> Toggle services you want to offer. Pricing is set by Warmpawz. Publish instantly.
                </p>
              ) : canEditPricing ? (
                <p className="text-orange-700">
                  <strong>Your Pricing:</strong> Set custom prices and durations. Changes require admin approval before going live.
                </p>
              ) : (
                <p className="text-blue-700">
                  <strong>Platform Managed Pricing:</strong> You can enable/disable services, but pricing is controlled by Warmpawz.
                </p>
              )}
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
                                <h4 className="font-semibold text-sm leading-tight">{service.name}</h4>
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
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ₹{service.customPrice || service.price}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {service.customDuration || service.duration}m
                              </span>
                            </div>

                            {/* Description Preview */}
                            <p className="text-xs text-gray-600 line-clamp-2">{service.description}</p>
                          </div>

                          {/* Enable Toggle */}
                          <Switch
                            checked={service.isEnabled}
                            onCheckedChange={() => toggleService(service.id)}
                            className="data-[state=checked]:bg-[#FF8C42] flex-shrink-0"
                          />
                        </div>

                        {/* Expand/Collapse Button */}
                        {service.isEnabled && (canEditPricing || service.whatIncluded?.length) && (
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
                                  <Input
                                    type="number"
                                    value={service.customPrice || service.price}
                                    onChange={(e) => updateServicePrice(service.id, parseInt(e.target.value) || 0)}
                                    className="h-8 text-sm"
                                    min="0"
                                  />
                                </div>
                                {canControlDuration && (
                                  <div>
                                    <Label className="text-xs text-gray-700 mb-1 block">Duration (min)</Label>
                                    <Input
                                      type="number"
                                      value={service.customDuration || service.duration}
                                      onChange={(e) => updateServiceDuration(service.id, parseInt(e.target.value) || 0)}
                                      className="h-8 text-sm"
                                      min="5"
                                      step="5"
                                    />
                                  </div>
                                )}
                              </div>

                              <div>
                                <Label className="text-xs text-gray-700 mb-1 block">Custom Description (Optional)</Label>
                                <Textarea
                                  value={service.customDescription || ''}
                                  onChange={(e) => updateServiceDescription(service.id, e.target.value)}
                                  placeholder="Add specific details about how you deliver this service..."
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
    </div>
  );
}