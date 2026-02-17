'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Edit, Trash2, Plus, Package, Folder } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ServiceItem {
  id: string;
  service_id: string;
  service_name: string;
  display_name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  sub_category_id?: string;
  sub_category_name?: string;
  applicable_roles: string[];
  service_style: 'at_center' | 'at_home' | 'tele' | 'all';
  base_price: number;
  duration_minutes: number;
  status: 'active' | 'inactive' | 'draft' | 'archived';
  publish_status: 'published' | 'unpublished' | 'archived';
  display_order: number;
  metadata?: Record<string, any>;
}

interface CategoryGroup {
  category_id?: string;
  category_name: string;
  itemCount: number;
  services: ServiceItem[];
  subcategories?: SubcategoryGroup[];
}

interface SubcategoryGroup {
  sub_category_id?: string;
  sub_category_name: string;
  itemCount: number;
  services: ServiceItem[];
}

interface HierarchicalServiceListProps {
  searchQuery?: string;
  filterCategory?: string;
  filterStatus?: string;
  filterStyle?: string;
  onEdit?: (service: ServiceItem) => void;
  onDelete?: (service: ServiceItem) => void;
  onAddService?: (categoryId?: string, subcategoryId?: string) => void;
  onAddSubcategory?: (categoryId: string) => void;
}

export function HierarchicalServiceList({
  searchQuery = '',
  filterCategory,
  filterStatus,
  filterStyle,
  onEdit,
  onDelete,
  onAddService,
  onAddSubcategory,
}: HierarchicalServiceListProps) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [groupedServices, setGroupedServices] = useState<CategoryGroup[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, [filterCategory, filterStatus]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/service-catalog?groupBy=subcategory');
      
      if (response.grouped && Array.isArray(response.services)) {
        // Services are already grouped
        setGroupedServices(response.services);
      } else {
        // Group services manually
        const grouped = groupServicesByCategory(response.services || []);
        setGroupedServices(grouped);
      }
      
      setServices(response.services?.flatMap((cat: any) => 
        cat.services || []
      ) || response.services || []);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupServicesByCategory = (services: ServiceItem[]): CategoryGroup[] => {
    const grouped: Record<string, CategoryGroup> = {};

    services.forEach((service) => {
      const categoryKey = service.category_name || service.category_id || 'Uncategorized';
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          category_id: service.category_id,
          category_name: categoryKey,
          itemCount: 0,
          services: [],
          subcategories: [] as SubcategoryGroup[],
        };
      }

      if (service.sub_category_name || service.sub_category_id) {
        const subcatKey = service.sub_category_name || service.sub_category_id || 'Uncategorized';
        if (!grouped[categoryKey].subcategories) {
          grouped[categoryKey].subcategories = [];
        }
        let subcategory = grouped[categoryKey].subcategories.find((s: SubcategoryGroup) => 
          (s.sub_category_name || s.sub_category_id) === subcatKey
        );
        if (!subcategory) {
          subcategory = {
            sub_category_id: service.sub_category_id,
            sub_category_name: subcatKey,
            itemCount: 0,
            services: [],
          };
          grouped[categoryKey].subcategories.push(subcategory);
        }
        subcategory.services.push(service);
        subcategory.itemCount++;
      } else {
        grouped[categoryKey].services.push(service);
      }
      
      grouped[categoryKey].itemCount++;
    });

    return Object.values(grouped);
  };

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleSubcategory = (categoryName: string, subcategoryName: string) => {
    const key = `${categoryName}:${subcategoryName}`;
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSubcategories(newExpanded);
  };

  const filterServices = (service: ServiceItem): boolean => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      if (
        !service.service_name?.toLowerCase().includes(query) &&
        !service.display_name?.toLowerCase().includes(query) &&
        !(service.description || '').toLowerCase().includes(query) &&
        !service.category_name?.toLowerCase().includes(query) &&
        !service.sub_category_name?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    if (filterCategory && service.category_id !== filterCategory) return false;
    if (filterStatus && service.status !== filterStatus) return false;
    if (filterStyle) {
      const style = (service.service_style || '').replace('at_center', 'centre').replace('at_home', 'home');
      if (style !== filterStyle) return false;
    }
    return true;
  };

  const renderService = (service: ServiceItem) => {
    if (!filterServices(service)) return null;

    return (
      <div
        key={service.id || service.service_id}
        className="flex items-center justify-between p-3 hover:bg-gray-50 border-b border-gray-100"
      >
        <div className="flex items-center gap-3 flex-1">
          <Package className="w-4 h-4 text-gray-400" />
          <div className="flex-1">
            <div className="font-medium text-gray-900">{service.display_name || service.service_name}</div>
            <div className="text-sm text-gray-500">{service.description || 'No description'}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {service.service_style?.replace('_', ' ').toUpperCase() || 'AT CENTER'}
              </span>
              <span className="text-xs text-gray-500">{service.duration_minutes} mins</span>
              <span className="text-xs text-gray-500">INR {service.base_price}</span>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                {service.applicable_roles?.length || 0} Roles
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit?.(service)}
            className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
            title="Edit Service"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete?.(service)}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete Service"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
        Loading services...
      </div>
    );
  }

  if (groupedServices.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No services found. Click "Add Service" to create your first service.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groupedServices.map((category) => {
        const isExpanded = expandedCategories.has(category.category_name);
        const hasSubcategories = category.subcategories && category.subcategories.length > 0;

        return (
          <div key={category.category_name} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Category Header */}
            <div className="bg-gray-50 px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => toggleCategory(category.category_name)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
                <Folder className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-semibold text-gray-900">{category.category_name}</div>
                  <div className="text-sm text-gray-500">{category.itemCount} items</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onAddSubcategory && (
                  <button
                    onClick={() => onAddSubcategory?.(category.category_id || '')}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                    title="Add Subcategory"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add Sub
                  </button>
                )}
                {onAddService && (
                  <button
                    onClick={() => onAddService?.(category.category_id)}
                    className="px-3 py-1 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                    title="Add Service"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add Service
                  </button>
                )}
                <button className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Content */}
            {isExpanded && (
              <div className="bg-white">
                {/* Subcategories */}
                {hasSubcategories &&
                  category.subcategories?.map((subcategory) => {
                    const subcatKey = `${category.category_name}:${subcategory.sub_category_name}`;
                    const isSubcatExpanded = expandedSubcategories.has(subcatKey);

                    return (
                      <div key={subcategory.sub_category_name} className="border-t border-gray-200">
                        {/* Subcategory Header */}
                        <div className="bg-gray-50 px-4 py-2 flex items-center justify-between hover:bg-gray-100 transition pl-12">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => toggleSubcategory(category.category_name, subcategory.sub_category_name)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isSubcatExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <Folder className="w-4 h-4 text-purple-600" />
                            <div>
                              <div className="font-medium text-gray-900">{subcategory.sub_category_name}</div>
                              <div className="text-xs text-gray-500">{subcategory.itemCount} items</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {onAddService && (
                              <button
                                onClick={() => onAddService?.(category.category_id, subcategory.sub_category_id)}
                                className="px-2 py-1 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                              >
                                <Plus className="w-3 h-3 inline mr-1" />
                                Add
                              </button>
                            )}
                            <button className="p-1 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded transition">
                              <Edit className="w-3 h-3" />
                            </button>
                            <button className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Subcategory Services */}
                        {isSubcatExpanded && (
                          <div className="pl-16">
                            {subcategory.services.map((service) => renderService(service))}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Services directly under category (no subcategory) */}
                {category.services.length > 0 && (
                  <div className="pl-8">
                    {category.services.map((service) => renderService(service))}
                  </div>
                )}

                {/* Empty state */}
                {!hasSubcategories && category.services.length === 0 && (
                  <div className="pl-8 p-4 text-sm text-gray-500">
                    No services in this category yet.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

