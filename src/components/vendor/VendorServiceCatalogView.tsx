import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Check, Search, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { authenticatedFetch } from '../../utils/session-manager'; // ✅ SECURITY FIX

interface VendorServiceCatalogViewProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
  onSelectService?: (service: any) => void;
  mode?: 'browse' | 'multi-select'; // ✅ NEW: Support multi-select mode
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
  mode = 'browse' // ✅ Default to browse mode
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
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set()); // ✅ NEW: Track selected services
  const [adding, setAdding] = useState(false); // ✅ NEW: Track adding state

  useEffect(() => {
    loadCatalogData();
  }, [vendorId]);

  useEffect(() => {
    groupServicesByCategory();
  }, [services, searchQuery, activeStyle, vendorData]);

  const loadCatalogData = async () => {
    try {
      setLoading(true);

      // Load all services from admin catalog API (same as admin panel)
      const servicesRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/service-catalog`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        console.log('📚 [CATALOG] Loaded services:', data);
        setServices(data.services || []);
      }

      // Load vendor's enabled services
      const vendorServicesRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (vendorServicesRes.ok) {
        const data = await vendorServicesRes.json();
        console.log('✅ [VENDOR] Loaded vendor services:', data);
        
        // ✅ FIXED: Parse new response format from updated endpoint
        let vendorServicesList: any[] = [];
        
        // New format: data.allServices (flat array of all enabled services)
        if (data.allServices && Array.isArray(data.allServices)) {
          vendorServicesList = data.allServices;
        }
        // Alternative: data.services (grouped by style)
        else if (data.services && typeof data.services === 'object') {
          ['at_home', 'at_center', 'tele'].forEach(style => {
            if (data.services[style] && data.services[style].services) {
              vendorServicesList.push(...data.services[style].services);
            }
          });
        }
        // Legacy fallback
        else if (data.legacyServices && Array.isArray(data.legacyServices)) {
          vendorServicesList = data.legacyServices;
        }
        else if (Array.isArray(data.services)) {
          vendorServicesList = data.services;
        }
        
        console.log('✅ [VENDOR] Parsed vendor services:', vendorServicesList.length, vendorServicesList);
        setVendorServices(vendorServicesList);
      }

      // Load roles
      const rolesRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/config/roles`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.roles || []);
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

    // 1. Strict Role Filter
    // Only show services applicable to the current vendor's role
    if (vendorData?.roleId) {
      filteredServices = filteredServices.filter(service => isServiceApplicable(service));
    }

    // 2. Service Style Filter
    if (activeStyle !== 'all') {
      filteredServices = filteredServices.filter(service => service.serviceStyle === activeStyle);
    }

    // 3. Search Filter
    if (searchQuery) {
      filteredServices = filteredServices.filter(service =>
        service.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.subCategoryName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Group by category and subcategory (same as admin panel)
    const grouped: { [key: string]: CategoryGroup } = {};

    filteredServices.forEach(service => {
      const categoryKey = service.categoryId || service.categoryName;
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          categoryName: service.categoryName,
          categoryId: service.categoryId,
          subcategories: []
        };
      }

      const subCategoryName = service.subCategoryName || 'Other Services';
      const subCategoryId = service.subCategoryId || 'other';
      
      let subcategory = grouped[categoryKey].subcategories.find(
        sub => sub.subCategoryId === subCategoryId
      );

      if (!subcategory) {
        subcategory = {
          subCategoryName,
          subCategoryId,
          services: []
        };
        grouped[categoryKey].subcategories.push(subcategory);
      }

      subcategory.services.push(service);
    });

    // Convert to array and sort
    const groupedArray = Object.values(grouped).sort((a, b) => 
      a.categoryName.localeCompare(b.categoryName)
    );

    // Sort subcategories within each category
    groupedArray.forEach(category => {
      category.subcategories.sort((a, b) => 
        a.subCategoryName.localeCompare(b.subCategoryName)
      );
    });

    setGroupedServices(groupedArray);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (key: string) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubcategories(newExpanded);
  };

  const expandAll = () => {
    const allCategories = new Set(groupedServices.map(g => g.categoryId));
    const allSubcategories = new Set<string>();
    groupedServices.forEach(cat => {
      cat.subcategories.forEach(sub => {
        allSubcategories.add(`${cat.categoryId}-${sub.subCategoryId}`);
      });
    });
    setExpandedCategories(allCategories);
    setExpandedSubcategories(allSubcategories);
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedSubcategories(new Set());
  };

  const isServiceEnabled = (catalogId: string) => {
    return vendorServices.some(vs => vs.catalogServiceCode === catalogId && vs.isEnabled);
  };

  const getVendorService = (catalogId: string) => {
    return vendorServices.find(vs => vs.catalogServiceCode === catalogId);
  };

  const isServiceApplicable = (service: ServiceCatalogItem) => {
    const vendorRole = vendorData?.roleId;
    if (!vendorRole) return false;
    
    // ✅ CRITICAL FIX: Support both role formats
    // Catalog uses 'role_veterinarian', 'role_vet_clinic' (with prefix)
    // Vendor roleId is 'veterinarian', 'pet_clinic' (without prefix)
    return service.applicableRoles?.some((rolePattern: string) => {
      // Direct match
      if (rolePattern === vendorRole) return true;
      
      // Match with role_ prefix: 'role_pet_clinic' matches 'pet_clinic'
      if (rolePattern === `role_${vendorRole}`) return true;
      
      // Match without role_ prefix: 'pet_clinic' matches 'role_pet_clinic'
      if (`role_${rolePattern}` === vendorRole) return true;
      
      // Special case: 'vet_clinic' and 'pet_clinic' are the same
      if ((rolePattern === 'role_vet_clinic' || rolePattern === 'vet_clinic') && 
          (vendorRole === 'pet_clinic' || vendorRole === 'vet_clinic')) return true;
      
      return false;
    }) || false;
  };

  const getServiceStyleLabel = (style: string) => {
    const labels: Record<string, string> = {
      at_home: '🏠 At Home',
      at_center: '🏥 At Center',
      tele: '📞 Tele'
    };
    return labels[style] || style;
  };

  // ✅ NEW: Toggle service selection for multi-select mode
  const toggleServiceSelection = (catalogId: string) => {
    if (mode !== 'multi-select') return;
    
    const newSelected = new Set(selectedServices);
    if (newSelected.has(catalogId)) {
      newSelected.delete(catalogId);
    } else {
      newSelected.add(catalogId);
    }
    setSelectedServices(newSelected);
  };

  // ✅ NEW: Add all selected services to vendor
  const handleAddAllSelected = async () => {
    if (selectedServices.size === 0) {
      toast.error('Please select at least one service');
      return;
    }

    setAdding(true);
    const successfullyAdded: string[] = [];
    const failed: string[] = [];

    try {
      // Add each selected service
      for (const catalogId of Array.from(selectedServices)) {
        try {
          const service = services.find(s => s.catalogId === catalogId);
          if (!service) continue;

          // ✅ FIX: Call correct endpoint /vendor/services/add
          const response = await authenticatedFetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/add`,
            {
              method: 'POST',
              body: JSON.stringify({
                vendorId,
                serviceData: {
                  catalogServiceCode: catalogId,
                  serviceName: service.serviceName,
                  serviceStyle: service.serviceStyle,
                  isEnabled: true,
                  vendorPrice: service.basePrice,
                  duration: service.duration || 30,
                  description: service.description,
                  isPackage: service.isPackage,
                  packageDetails: service.packageDetails,
                  status: 'active',
                  type: service.serviceStyle // Add type for backend compatibility
                }
              })
            }
          );

          // ✅ FIX: Better error handling with detailed logging
          if (response.ok) {
            const data = await response.json();
            console.log('✅ Service added successfully:', service.serviceName, data);
            successfullyAdded.push(service.serviceName);
          } else {
            const errorText = await response.text();
            console.error('❌ Failed to add service:', service.serviceName, {
              status: response.status,
              statusText: response.statusText,
              error: errorText
            });
            failed.push(service.serviceName);
          }
        } catch (error) {
          console.error('❌ Error adding service:', catalogId, error);
          const service = services.find(s => s.catalogId === catalogId);
          failed.push(service?.serviceName || catalogId);
        }
      }

      // Show results
      if (successfullyAdded.length > 0) {
        toast.success(`Added ${successfullyAdded.length} service(s) successfully!`);
        setSelectedServices(new Set()); // Clear selection
        await loadCatalogData(); // Reload to show updated state
      }

      if (failed.length > 0) {
        toast.error(`Failed to add ${failed.length} service(s). Check console for details.`);
      }

    } catch (error) {
      console.error('Error adding services:', error);
      toast.error('Failed to add services');
    } finally {
      setAdding(false);
    }
  };

  // ✅ NEW: Handle single service add (for browse mode)
  const handleAddSingleService = async (service: ServiceCatalogItem) => {
    if (!service.catalogId) {
      toast.error('Invalid service');
      return;
    }

    setAdding(true);
    try {
      // ✅ FIX: Use correct endpoint /vendor/services/add (not /vendor/services)
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/add`,
        {
          method: 'POST',
          body: JSON.stringify({
            vendorId,
            serviceData: {
              catalogServiceCode: service.catalogId,
              serviceName: service.serviceName,
              serviceStyle: service.serviceStyle,
              isEnabled: true,
              vendorPrice: service.basePrice,
              duration: service.duration || 30,
              description: service.description,
              isPackage: service.isPackage,
              packageDetails: service.packageDetails,
              status: 'active',
              type: service.serviceStyle // Add type for backend compatibility
            }
          })
        }
      );

      if (response.ok) {
        toast.success(`${service.serviceName} added successfully!`);
        await loadCatalogData(); // Reload to show updated state
        
        // Call onSelectService for further configuration
        onSelectService?.(service);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to add service');
      }
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Failed to add service');
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600">Loading catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">Service Catalog</h1>
              <p className="text-xs text-gray-500">Browse & enable services for your business</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services, categories, subcategories..."
              className="pl-10 h-10"
            />
          </div>

          {/* ✅ Multi-Select Mode Header */}
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
                  {adding ? 'Adding...' : `Add ${selectedServices.size} Selected`}
                </Button>
              )}
            </div>
          )}

          {/* Service Style Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
            <button
              onClick={() => setActiveStyle('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeStyle === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Styles
            </button>
            <button
              onClick={() => setActiveStyle('at_home')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeStyle === 'at_home'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              🏠 At Home
            </button>
            <button
              onClick={() => setActiveStyle('at_center')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeStyle === 'at_center'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
              }`}
            >
              🏥 At Center
            </button>
            <button
              onClick={() => setActiveStyle('tele')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeStyle === 'tele'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              📞 Tele
            </button>
          </div>

          {/* Expand/Collapse Controls */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={expandAll}
              className="flex-1 h-8 text-xs"
            >
              Expand All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={collapseAll}
              className="flex-1 h-8 text-xs"
            >
              Collapse All
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
              <div className="text-xs text-gray-500">Total</div>
              <div className="font-semibold text-gray-900">{services.length}</div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
              <div className="text-xs text-gray-500">Enabled</div>
              <div className="font-semibold text-[#FF8C42]">
                {vendorServices.filter(vs => vs.isEnabled).length}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-gray-200 text-center">
              <div className="text-xs text-gray-500">Categories</div>
              <div className="font-semibold text-gray-900">{groupedServices.length}</div>
            </div>
          </div>
        </div>

        {/* Category List (Same structure as admin panel) */}
        <div className="p-4 space-y-3 pb-20">
          {groupedServices.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
              <PackageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="font-medium">No services found</p>
              <p className="text-sm text-gray-400 mt-1">
                {services.length === 0 ? 'No services available' : 'Try adjusting your search'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedServices.map((category) => {
                const isExpanded = expandedCategories.has(category.categoryId);
                const totalServices = category.subcategories.reduce((sum, sub) => sum + sub.services.length, 0);
                const enabledInCategory = category.subcategories.reduce((sum, sub) => {
                  return sum + sub.services.filter(s => isServiceEnabled(s.catalogId || '')).length;
                }, 0);

                return (
                  <div key={category.categoryId} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(category.categoryId)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900">{category.categoryName}</h3>
                          <div className="text-xs text-gray-500">
                            {totalServices} services • {enabledInCategory} enabled
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-gray-100 text-gray-700">
                        {totalServices} services
                      </Badge>
                    </button>

                    {/* Subcategories */}
                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        {category.subcategories.map((subcategory) => {
                          const subKey = `${category.categoryId}-${subcategory.subCategoryId}`;
                          const isSubExpanded = expandedSubcategories.has(subKey);
                          const enabledInSub = subcategory.services.filter(s => isServiceEnabled(s.catalogId || '')).length;

                          return (
                            <div key={subKey} className="border-b border-gray-100 last:border-0">
                              {/* Subcategory Header */}
                              <button
                                onClick={() => toggleSubcategory(subKey)}
                                className="w-full flex items-center justify-between p-3 pl-12 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {isSubExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  )}
                                  <span className="font-medium text-gray-700">{subcategory.subCategoryName}</span>
                                  <Badge className="bg-blue-50 text-blue-700 text-xs">
                                    {enabledInSub > 0 && `${enabledInSub}/`}{subcategory.services.length}
                                  </Badge>
                                </div>
                              </button>

                              {/* Services */}
                              {isSubExpanded && (
                                <div className="bg-gray-50 px-4 py-2">
                                  {subcategory.services.map((service, idx) => {
                                    const isEnabled = isServiceEnabled(service.catalogId || '');
                                    const vendorService = getVendorService(service.catalogId || '');
                                    const isApplicable = isServiceApplicable(service);

                                    return (
                                      <div
                                        key={service.catalogId || idx}
                                        className={`bg-white p-3 mb-2 rounded-lg border-2 transition-colors ${
                                          isEnabled
                                            ? 'border-[#FF8C42] bg-orange-50'
                                            : selectedServices.has(service.catalogId || '') && mode === 'multi-select'
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-[#FF8C42]'
                                        }`}
                                        onClick={() => {
                                          if (mode === 'multi-select' && !isEnabled && service.catalogId) {
                                            toggleServiceSelection(service.catalogId);
                                          }
                                        }}
                                      >
                                        <div className="flex items-start justify-between">
                                          {/* ✅ Multi-Select Checkbox */}
                                          {mode === 'multi-select' && !isEnabled && service.catalogId && (
                                            <div className="mr-3 flex-shrink-0 pt-1">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleServiceSelection(service.catalogId!);
                                                }}
                                                className="w-6 h-6 rounded border-2 border-gray-300 flex items-center justify-center hover:border-blue-500 transition-colors"
                                              >
                                                {selectedServices.has(service.catalogId) ? (
                                                  <CheckSquare className="w-5 h-5 text-blue-600" />
                                                ) : (
                                                  <Square className="w-5 h-5 text-gray-400" />
                                                )}
                                              </button>
                                            </div>
                                          )}

                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h4 className="font-medium text-gray-900">{service.serviceName}</h4>
                                              <Badge className={
                                                service.serviceStyle === 'at_home' ? 'bg-blue-100 text-blue-700 text-xs' :
                                                service.serviceStyle === 'at_center' ? 'bg-green-100 text-green-700 text-xs' :
                                                'bg-purple-100 text-purple-700 text-xs'
                                              }>
                                                {getServiceStyleLabel(service.serviceStyle)}
                                              </Badge>
                                              {service.isPackage && (
                                                <Badge className="bg-orange-100 text-orange-700 text-xs">📦 Package</Badge>
                                              )}
                                            </div>

                                            <p className="text-sm text-gray-600 mb-2">{service.description}</p>

                                            <div className="flex flex-wrap gap-2 mb-2">
                                              {!service.isPackage && (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                  ₹{vendorService?.vendorPrice || service.basePrice}
                                                </span>
                                              )}
                                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                {service.duration || 30} min
                                              </span>
                                            </div>

                                            {isEnabled && vendorService && (
                                              <div className="mt-2 pt-2 border-t border-orange-200">
                                                <div className="flex items-center justify-between">
                                                  <div className="text-xs text-gray-600">
                                                    <span className="font-medium">Status:</span> {vendorService.status}
                                                  </div>
                                                  <button 
                                                    onClick={() => onSelectService?.(service)}
                                                    className="text-xs text-[#FF8C42] hover:text-[#FF7829] font-medium flex items-center gap-1"
                                                  >
                                                    Manage Settings &rarr;
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          {/* ✅ Action Button - Only show in browse mode */}
                                          {mode !== 'multi-select' && (
                                            <div className="flex gap-1 ml-4">
                                              <div>
                                                {isEnabled ? (
                                                  <button
                                                    onClick={() => onSelectService?.(service)}
                                                    className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 border border-green-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                                  >
                                                    ✓ Added
                                                  </button>
                                                ) : (
                                                  <button
                                                    onClick={() => handleAddSingleService(service)}
                                                    className="px-3 py-1.5 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                                  >
                                                    <Plus className="w-3 h-3" />
                                                    Add
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}