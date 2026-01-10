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

interface VendorServiceCatalogViewProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
  onSelectService?: (service: any) => void;
  mode?: 'browse' | 'multi-select';
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
  mode = 'browse'
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

  useEffect(() => {
    loadCatalogData();
  }, [vendorId]);

  useEffect(() => {
    groupServicesByCategory();
  }, [services, searchQuery, activeStyle, vendorData]);

  const loadCatalogData = async () => {
    try {
      setLoading(true);

      console.log('📚 [CATALOG] Loading service catalog...');

      // Load all services from admin catalog API
      const servicesData = await apiClient.get('/make-server-3dd53475/admin/service-catalog') as any;
        }
      );

      if (servicesData) {
        const data = servicesRes;
        console.log('📚 [CATALOG] Loaded services:', data);
        console.log('📚 [CATALOG] Total services:', data.services?.length || 0);
        
        if (data.services && data.services.length > 0) {
          console.log('📚 [CATALOG] Sample service:', data.services[0]);
          setServices(data.services);
        } else {
          console.warn('⚠️ [CATALOG] No services in catalog!');
          toast.error('No services found in catalog. Please contact admin.');
        }
      } else {
        console.error('❌ [CATALOG] Failed to load:', servicesRes.status, await servicesRes.text());
        toast.error('Failed to load service catalog');
      }

      // Load vendor's enabled services
      const vendorServicesRes = await apiClient.get(`/make-server-3dd53475/vendor/services/`) as any; }
        }
      );

      if (vendorServicesRes.ok) {
        const data = vendorServicesRes;
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

      // Load roles
      const rolesRes = await apiClient.get('/make-server-3dd53475/config/roles') as any;
        }
      );

      if (rolesRes.ok) {
        const data = rolesRes;
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

    console.log('🔍 [GROUPING] Starting with', filteredServices.length, 'services');
    console.log('🔍 [GROUPING] Vendor roleId:', vendorData?.roleId);
    console.log('🔍 [GROUPING] Vendor data:', vendorData);

    // 1. Strict Role Filter - BUT be more lenient
    if (vendorData?.roleId) {
      const beforeFilter = filteredServices.length;
      filteredServices = filteredServices.filter(service => isServiceApplicable(service));
      console.log('🔍 [GROUPING] After role filter:', filteredServices.length, 'services (filtered out:', beforeFilter - filteredServices.length, ')');
      
      // If ALL services are filtered out, show a sample to debug
      if (filteredServices.length === 0 && services.length > 0) {
        console.error('❌ [GROUPING] ALL SERVICES FILTERED OUT BY ROLE!');
        console.error('Sample service applicableRoles:', services[0]?.applicableRoles);
        console.error('Vendor roleId:', vendorData?.roleId);
        console.error('Vendor role type:', typeof vendorData?.roleId);
      }
    } else {
      console.warn('⚠️ [GROUPING] No vendor roleId found, showing all services');
    }

    // 2. Service Style Filter
    if (activeStyle !== 'all') {
      filteredServices = filteredServices.filter(service => service.serviceStyle === activeStyle);
      console.log('🔍 [GROUPING] After style filter:', filteredServices.length, 'services');
    }

    // 3. Search Filter
    if (searchQuery) {
      filteredServices = filteredServices.filter(service =>
        service.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.categoryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.subCategoryName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.description || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log('🔍 [GROUPING] After search filter:', filteredServices.length, 'services');
    }

    // Group by category and subcategory
    const grouped: { [key: string]: CategoryGroup } = {};

    filteredServices.forEach(service => {
      const catKey = service.categoryId || service.categoryName;
      
      if (!grouped[catKey]) {
        grouped[catKey] = {
          categoryName: service.categoryName,
          categoryId: service.categoryId,
          subcategories: []
        };
      }

      const subCatName = service.subCategoryName || 'General';
      const subCatId = service.subCategoryId || 'general';
      
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

  const isServiceApplicable = (service: ServiceCatalogItem): boolean => {
    // ✅ CRITICAL FIX: Be MORE LENIENT with role filtering
    // If no roles specified, service is available to everyone
    if (!service.applicableRoles || service.applicableRoles.length === 0) {
      return true;
    }
    
    const vendorRoleId = vendorData?.roleId;
    
    // ✅ FIX: If vendor has no role, SHOW ALL SERVICES (don't hide them!)
    if (!vendorRoleId) {
      console.warn('⚠️ Vendor has no roleId, showing service:', service.serviceName);
      return true; // CHANGED FROM false TO true
    }

    // Check if vendor's role is in the service's applicable roles
    // Handle both string and array cases
    let applicableRoles = service.applicableRoles;
    if (typeof applicableRoles === 'string') {
      try {
        applicableRoles = JSON.parse(applicableRoles);
      } catch {
        applicableRoles = [applicableRoles];
      }
    }

    const isApplicable = applicableRoles.includes(vendorRoleId);
    
    if (!isApplicable) {
      console.log('❌ Service not applicable:', service.serviceName, '| Needs:', applicableRoles, '| Vendor has:', vendorRoleId);
    }
    
    return isApplicable;
  };

  const isServiceAdded = (service: ServiceCatalogItem): boolean => {
    return vendorServices.some(vs => {
      if (vs.catalogId && service.catalogId) {
        return vs.catalogId === service.catalogId;
      }
      return vs.serviceName === service.serviceName && 
             vs.categoryName === service.categoryName;
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

  const toggleServiceSelection = (service: ServiceCatalogItem) => {
    const serviceKey = service.catalogId || `${service.categoryName}_${service.serviceName}`;
    
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
    const serviceKey = service.catalogId || `${service.categoryName}_${service.serviceName}`;
    return selectedServices.has(serviceKey);
  };

  const handleAddService = async (service: ServiceCatalogItem) => {
    try {
      setAdding(true);

      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/services/add`,
        {
          method: 'POST',
          body: JSON.stringify({
            vendorId,
            catalogId: service.catalogId,
            categoryId: service.categoryId,
            categoryName: service.categoryName,
            subCategoryId: service.subCategoryId,
            subCategoryName: service.subCategoryName,
            serviceGroupId: service.serviceGroupId,
            serviceGroupName: service.serviceGroupName,
            serviceName: service.serviceName,
            serviceStyle: service.serviceStyle,
            basePrice: service.basePrice,
            isPackage: service.isPackage,
            packageDetails: service.packageDetails,
            description: service.description,
            duration: service.duration,
            isActive: true
          })
        }
      );

      if (data && data.success) {
        const result = response;
        console.log('✅ Service added:', result);
        toast.success(`Added ${service.serviceName}`);
        
        setVendorServices(prev => [...prev, {
          ...service,
          vendorServiceId: result.vendorServiceId || result.id
        }]);

        if (mode === 'browse' && onSelectService) {
          onSelectService(service);
        }
      } else {
        const error = response;
        toast.error(error.error || 'Failed to add service');
      }
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Failed to add service');
    } finally {
      setAdding(false);
    }
  };

  const handleAddAllSelected = async () => {
    try {
      setAdding(true);
      
      const servicesToAdd: ServiceCatalogItem[] = [];
      
      groupedServices.forEach(category => {
        category.subcategories.forEach(subcategory => {
          subcategory.services.forEach(service => {
            if (isServiceSelected(service) && !isServiceAdded(service)) {
              servicesToAdd.push(service);
            }
          });
        });
      });

      console.log(`Adding ${servicesToAdd.length} selected services...`);

      for (const service of servicesToAdd) {
        await handleAddService(service);
      }

      setSelectedServices(new Set());
      toast.success(`Added ${servicesToAdd.length} services`);

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

        {/* Style Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'at_center', 'at_home', 'tele'].map(style => (
            <button
              key={style}
              onClick={() => setActiveStyle(style as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeStyle === style
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {style === 'all' ? 'All' : style === 'at_center' ? 'At Center' : style === 'at_home' ? 'At Home' : 'Tele'}
            </button>
          ))}
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

                            return (
                              <div
                                key={idx}
                                className={`p-4 pl-12 hover:bg-gray-50 transition-colors ${
                                  selected ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      {mode === 'multi-select' && (
                                        <button
                                          onClick={() => toggleServiceSelection(service)}
                                          className="flex-shrink-0"
                                        >
                                          {selected ? (
                                            <CheckSquare className="w-5 h-5 text-blue-600" />
                                          ) : (
                                            <Square className="w-5 h-5 text-gray-400" />
                                          )}
                                        </button>
                                      )}
                                      <h5 className="font-medium text-gray-900">{service.serviceName}</h5>
                                    </div>
                                    
                                    {service.description && (
                                      <p className="text-xs text-gray-600 mb-2">{service.description}</p>
                                    )}

                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                        ₹{service.basePrice}
                                      </span>
                                      
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {service.serviceStyle === 'at_home' ? 'At Home' : 
                                         service.serviceStyle === 'at_center' ? 'At Center' : 'Tele'}
                                      </span>

                                      {service.duration && (
                                        <span className="text-xs text-gray-500">{service.duration} min</span>
                                      )}

                                      {service.isPackage && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                          Package
                                        </span>
                                      )}

                                      {added && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          <Check className="w-3 h-3 mr-1" />
                                          Added
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {mode === 'browse' && (
                                    <Button
                                      onClick={() => added ? null : handleAddService(service)}
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