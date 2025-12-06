import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Plus,
  Package as PackageIcon
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface VendorServiceCatalogViewProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
  onSelectService?: (service: any) => void;
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
  onSelectService 
}: VendorServiceCatalogViewProps) {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [groupedServices, setGroupedServices] = useState<CategoryGroup[]>([]);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    loadCatalogData();
  }, [vendorId]);

  useEffect(() => {
    groupServicesByCategory();
  }, [services, searchQuery]);

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
        setVendorServices(data.services || []);
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

    // Apply search filter
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
                                            : isApplicable
                                            ? 'border-gray-200 hover:border-[#FF8C42]'
                                            : 'border-gray-100 opacity-60'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between">
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

                                            <div className="flex flex-wrap gap-1">
                                              {service.applicableRoles.map(roleId => {
                                                const role = roles.find(r => r.id === roleId);
                                                return (
                                                  <span key={roleId} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                                                    {role?.name || roleId}
                                                  </span>
                                                );
                                              })}
                                            </div>

                                            {!isApplicable && (
                                              <div className="mt-2 text-xs text-gray-500 italic">
                                                Not available for your role
                                              </div>
                                            )}

                                            {isEnabled && vendorService && (
                                              <div className="mt-2 pt-2 border-t border-orange-200">
                                                <div className="text-xs text-gray-600">
                                                  <span className="font-medium">Status:</span> {vendorService.status}
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          <div className="flex gap-1 ml-4">
                                            {isApplicable && (
                                              <div>
                                                {isEnabled ? (
                                                  <Badge className="bg-green-500 text-white border-green-600">
                                                    ✓ Enabled
                                                  </Badge>
                                                ) : (
                                                  <button
                                                    onClick={() => onSelectService?.(service)}
                                                    className="px-3 py-1.5 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                                                  >
                                                    <Plus className="w-3 h-3" />
                                                    Add
                                                  </button>
                                                )}
                                              </div>
                                            )}
                                          </div>
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