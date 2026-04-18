'use client';

export const dynamic = 'force-dynamic';

/**
 * Solo Provider Service Management Page
 * 
 * This page allows solo vendors to:
 * 1. Browse services from the platform catalog (filtered to at_home and tele only)
 * 2. Enable/disable services for their profile
 * 3. Publish enabled services to make them available to customers
 * 4. Create custom services (if capability enabled)
 * 
 * Note: Solo providers cannot use "at_center" service style
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Search, 
  Filter, 
  Check, 
  X, 
  Plus, 
  Eye, 
  EyeOff,
  Home,
  Phone,
  Globe,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface ServiceItem {
  id: string;
  catalogId?: string;
  name: string;
  serviceName?: string;
  category: string;
  categoryName?: string;
  subCategory?: string;
  subCategoryName?: string;
  description: string;
  price: number;
  basePrice?: number;
  duration: number;
  serviceStyle: 'at_home' | 'tele';
  isEnabled: boolean;
  isPublished: boolean;
  publishStatus?: 'draft' | 'pending_approval' | 'published' | 'rejected';
  isCustomService?: boolean;
  isPlatformService?: boolean;
  /** Stable index from last load — stable sort within enabled/disabled groups after publish */
  _listOrder?: number;
}

interface CategoryGroup {
  name: string;
  services: ServiceItem[];
  expanded: boolean;
}

type ServiceStyleFilter = 'all' | 'at_home' | 'tele';
type ServiceStatusFilter = 'all' | 'enabled' | 'published' | 'disabled';

export default function SoloProviderServiceManagePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [filteredServices, setFilteredServices] = useState<ServiceItem[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState<ServiceStyleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ServiceStatusFilter>('all');
  
  // Stats
  const [stats, setStats] = useState({
    totalServices: 0,
    enabledServices: 0,
    publishedServices: 0,
    homeServices: 0,
    teleServices: 0,
  });

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
    
    // Load vendor data
    const storedVendorData = localStorage.getItem('vendorData');
    if (storedVendorData) {
      try {
        setVendorData(JSON.parse(storedVendorData));
      } catch (e) {
        console.error('Error parsing vendor data:', e);
      }
    }
  }, [router]);

  useEffect(() => {
    if (vendorId) {
      loadServices();
    }
  }, [vendorId]);

  // Apply filters
  useEffect(() => {
    let filtered = [...services];
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }
    
    // Style filter
    if (styleFilter !== 'all') {
      filtered = filtered.filter(s => s.serviceStyle === styleFilter);
    }
    
    // Status filter
    if (statusFilter === 'enabled') {
      filtered = filtered.filter(s => s.isEnabled);
    } else if (statusFilter === 'published') {
      filtered = filtered.filter(s => s.isPublished || s.publishStatus === 'published');
    } else if (statusFilter === 'disabled') {
      filtered = filtered.filter(s => !s.isEnabled);
    }

    // Pre-publish: keep merge order. Post-publish: enabled groups first (stable within groups).
    const postPublishLayout = services.some(
      s => s.isPublished || s.publishStatus === 'published'
    );
    const displayOrdered = postPublishLayout
      ? [...filtered].sort((a, b) => {
          const ae = !!a.isEnabled;
          const be = !!b.isEnabled;
          if (ae !== be) return ae ? -1 : 1;
          return (a._listOrder ?? 0) - (b._listOrder ?? 0);
        })
      : filtered;
    
    setFilteredServices(displayOrdered);
    
    // Group by category (same sequence as displayed)
    const groups: { [key: string]: ServiceItem[] } = {};
    displayOrdered.forEach(service => {
      const category = service.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(service);
    });
    
    setCategoryGroups(Object.entries(groups).map(([name, svcs]) => ({
      name,
      services: svcs,
      expanded: true,
    })));
    
  }, [services, searchQuery, styleFilter, statusFilter]);

  const loadServices = async () => {
    if (!vendorId) return;
    
    try {
      setLoading(true);
      
      // ✅ FIX: Fetch vendor's services FIRST to get actual role (never default to veterinarian)
      const enabledRes = await apiClient.get<any>(`/vendor/${vendorId}/services?isSoloProvider=true`).catch(() => ({ services: [], allServices: [], role: null }));
      const roleId = enabledRes?.role?.id ?? vendorData?.roleId ?? vendorData?.role_id ?? null;
      
      // Only fetch catalog for vendor's actual role - if no roleId, show only vendor's added services
      let catalogRes: any = { services: [] };
      if (roleId) {
        catalogRes = await apiClient.get<any>(`/service-catalog/role/${roleId}?serviceStyle=at_home,tele`).catch(() => ({ services: [] }));
      }
      
      // Process catalog services
      const catalogServices = (catalogRes?.services || []).map((svc: any) => ({
        id: svc.id || svc.catalogId,
        catalogId: svc.id || svc.catalogId,
        name: svc.serviceName || svc.name || svc.service_name,
        category: svc.categoryName || svc.category || svc.category_name || 'General',
        subCategory: svc.subCategoryName || svc.sub_category_name,
        description: svc.description || '',
        price: svc.basePrice || svc.price || 0,
        duration: svc.duration || 30,
        serviceStyle: svc.serviceStyle || svc.service_style || 'at_home',
        isEnabled: false,
        isPublished: false,
        isPlatformService: true,
      }));
      
      // Process vendor's added services - use serviceId (catalog id) for correct matching
      const addedIds = new Set<string>();
      const vendorServices = (enabledRes?.allServices || enabledRes?.services || []).filter((svc: any) => {
        const style = svc.serviceStyle || svc.service_style;
        return style !== 'at_center';
      }).map((svc: any) => {
        const catalogId = svc.serviceId || svc.catalogServiceId || svc.catalog_service_id || svc.id;
        addedIds.add(catalogId);
        return {
          id: svc.id,
          catalogId,
          name: svc.serviceName || svc.name || svc.service_name,
          category: svc.categoryName || svc.category || svc.category_name || 'General',
          subCategory: svc.subCategoryName || svc.sub_category_name,
          description: svc.description || '',
          price: svc.customPrice ?? svc.custom_price ?? svc.basePrice ?? svc.price ?? 0,
          duration: svc.customDuration ?? svc.custom_duration ?? svc.duration ?? 30,
          serviceStyle: svc.serviceStyle || svc.service_style || 'at_home',
          isEnabled: svc.isEnabled !== false,
          isPublished: svc.publishStatus === 'published' || svc.isPublished === true,
          publishStatus: svc.publishStatus || svc.publish_status,
          isCustomService: svc.isCustomService || svc.is_custom_service || svc.source === 'custom',
          isPlatformService: !svc.isCustomService && !svc.is_custom_service,
        };
      });
      
      // Merge: vendor's ADDED services first (for publishing), then catalog services not yet added
      const mergedServices: ServiceItem[] = [];
      vendorServices.forEach((svc: ServiceItem) => mergedServices.push(svc));
      catalogServices.forEach((svc: any) => {
        const catalogId = svc.catalogId || svc.id;
        if (!addedIds.has(catalogId) && (svc.serviceStyle === 'at_home' || svc.serviceStyle === 'tele')) {
          mergedServices.push(svc);
          addedIds.add(catalogId);
        }
      });
      
      setServices(
        mergedServices.map((s, index) => ({
          ...s,
          _listOrder: index,
        }))
      );
      
      // Calculate stats
      const enabledCount = mergedServices.filter(s => s.isEnabled).length;
      const publishedCount = mergedServices.filter(s => s.isPublished).length;
      const homeCount = mergedServices.filter(s => s.serviceStyle === 'at_home').length;
      const teleCount = mergedServices.filter(s => s.serviceStyle === 'tele').length;
      
      setStats({
        totalServices: mergedServices.length,
        enabledServices: enabledCount,
        publishedServices: publishedCount,
        homeServices: homeCount,
        teleServices: teleCount,
      });
      
    } catch (error: any) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = (serviceId: string, enabled: boolean) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, isEnabled: enabled } : s
    ));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!vendorId) return;
    
    try {
      setSaving(true);
      
      // Get all enabled services
      const enabledServices = services.filter(s => s.isEnabled);
      
      // Save to backend
      const response = await apiClient.post<any>(`/vendor/${vendorId}/services/bulk-update`, {
        services: enabledServices.map(s => ({
          catalogServiceId: s.catalogId || s.id,
          serviceStyle: s.serviceStyle,
          isEnabled: s.isEnabled,
          customPrice: s.price,
          customDuration: s.duration,
        })),
        isSoloProvider: true,
      });
      
      if (response.success) {
        toast.success('Services saved successfully');
        setHasChanges(false);
        loadServices(); // Refresh to get updated data
      } else {
        toast.error(response.error || 'Failed to save services');
      }
    } catch (error: any) {
      console.error('Error saving services:', error);
      toast.error(error.message || 'Failed to save services');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishServices = async () => {
    if (!vendorId) return;
    
    // Get enabled services that aren't published yet
    const toPublish = services.filter(s => s.isEnabled && !s.isPublished);
    
    if (toPublish.length === 0) {
      toast.info('No services to publish. Enable some services first.');
      return;
    }
    
    try {
      setSaving(true);
      
      const response = await apiClient.post<any>(`/vendor/${vendorId}/services/publish`, {
        serviceIds: toPublish.map(s => s.id),
        isSoloProvider: true,
      });
      
      if (response.success) {
        toast.success(`${toPublish.length} service(s) published successfully`);
        loadServices();
      } else {
        toast.error(response.error || 'Failed to publish services');
      }
    } catch (error: any) {
      console.error('Error publishing services:', error);
      toast.error(error.message || 'Failed to publish services');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryExpanded = (categoryName: string) => {
    setCategoryGroups(prev => prev.map(g => 
      g.name === categoryName ? { ...g, expanded: !g.expanded } : g
    ));
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'at_home': return <Home className="w-4 h-4" />;
      case 'tele': return <Phone className="w-4 h-4" />;
      default: return <Globe className="w-4 h-4" />;
    }
  };

  const getStyleLabel = (style: string) => {
    switch (style) {
      case 'at_home': return 'Home Visit';
      case 'tele': return 'Tele-consultation';
      default: return style;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Manage Services"
          subtitle="Enable and publish services for customers"
          onBack={() => router.back()}
          actions={
            hasChanges
              ? [
                  <Button
                    key="save"
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="h-9 whitespace-nowrap bg-indigo-500 px-3 text-sm text-white hover:bg-indigo-600"
                  >
                    {saving ? (
                      <RefreshCw className="mr-1.5 inline h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-1.5 inline h-4 w-4" />
                    )}
                    Save
                  </Button>,
                ]
              : []
          }
        />

        <div className="w-full px-4 py-6 sm:px-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-sm text-gray-500">Total Services</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalServices}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-green-100">
            <div className="text-sm text-gray-500">Enabled</div>
            <div className="text-2xl font-bold text-green-600">{stats.enabledServices}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
            <div className="text-sm text-gray-500">Published</div>
            <div className="text-2xl font-bold text-blue-600">{stats.publishedServices}</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Home className="w-3 h-3" /> / <Phone className="w-3 h-3" />
            </div>
            <div className="text-2xl font-bold text-indigo-600">{stats.homeServices} / {stats.teleServices}</div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-indigo-800">
                <strong>Solo Provider Services:</strong> As a solo provider, you can offer services through home visits or tele-consultation.
                Enable the services you want to offer, then publish them to make them visible to customers.
              </p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={styleFilter}
                onChange={(e) => setStyleFilter(e.target.value as ServiceStyleFilter)}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Styles</option>
                <option value="at_home">Home Visit</option>
                <option value="tele">Tele-consultation</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ServiceStatusFilter)}
                className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="enabled">Enabled</option>
                <option value="published">Published</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Publish Button */}
        {stats.enabledServices > stats.publishedServices && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {stats.enabledServices - stats.publishedServices} service(s) ready to publish
                </p>
                <p className="text-xs text-green-600">
                  Publishing makes your services visible to customers
                </p>
              </div>
            </div>
            <Button
              onClick={handlePublishServices}
              disabled={saving}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              Publish All
            </Button>
          </div>
        )}

        {/* Services List */}
        {categoryGroups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try adjusting your search criteria' : 'No services available for your role'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {categoryGroups.map((group) => (
              <div key={group.name} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategoryExpanded(group.name)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{group.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {group.services.length} service{group.services.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {group.expanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {/* Services */}
                {group.expanded && (
                  <div className="divide-y divide-gray-100">
                    {group.services.map((service) => (
                      <div key={service.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 truncate">{service.name}</h3>
                              {service.isCustomService && (
                                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                              {service.description || 'No description available'}
                            </p>
                            
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
                                {getStyleIcon(service.serviceStyle)}
                                {getStyleLabel(service.serviceStyle)}
                              </span>
                              <span>₹{service.price}</span>
                              <span>{service.duration} min</span>
                              {service.isPublished && (
                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                  Published
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-xs text-gray-500 mb-1">
                                {service.isEnabled ? 'Enabled' : 'Disabled'}
                              </p>
                              <Switch
                                checked={service.isEnabled}
                                onCheckedChange={(checked) => handleToggleService(service.id, checked)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Custom Services CTA */}
        <div className="mt-6 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg mb-2">Create Custom Services</h3>
              <p className="text-white/90 text-sm mb-4">
                Can't find the service you want to offer? Create your own custom services.
              </p>
              <Button
                onClick={() => router.push('/services?add=true')}
                className="bg-white text-orange-600 hover:bg-gray-100 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Service
              </Button>
            </div>
            <Plus className="w-8 h-8 opacity-50" />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
