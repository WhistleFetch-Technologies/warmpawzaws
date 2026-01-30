import { useState, useEffect } from 'react';
import { Plus, ChevronDown, ChevronRight, Edit, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '../../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { DeleteCategoryModal } from './DeleteCategoryModal';
import { BulkActionsModal } from './BulkActionsModal';
import { ExportCategoriesModal } from './ExportCategoriesModal';
import { CreateServiceModal } from './CreateServiceModal';
import { CreateCategoryModal } from './CreateCategoryModal';
import { CreateSubCategoryModal } from './CreateSubCategoryModal';
import { EditCategoryModal } from './EditCategoryModal';
import { EditSubCategoryModal } from './EditSubCategoryModal';
import { EditServiceModal } from './EditServiceModal';

interface Service {
  id: string;
  name: string;
  code: string;
  description: string;
  basePrice: number;
  duration: string;
  gstInclusion: string;
  gstRate: number;
  showFinalPrice: boolean;
  status: 'active' | 'inactive';
  serviceType: 'at-home' | 'at-center';
}

interface SubCategory {
  id: string;
  name: string;
  description: string;
  services: Service[];
  status: 'active' | 'inactive';
}

interface Category {
  id: string;
  name: string;
  icon: string;
  description: string;
  itemCount: number;
  subCategories: SubCategory[];
  status: 'active' | 'inactive';
  expanded?: boolean;
}

interface CategoriesTabProps {
  onRefresh: () => void;
}

export function CategoriesTab({ onRefresh }: CategoriesTabProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateService, setShowCreateService] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateSubCategory, setShowCreateSubCategory] = useState(false);
  const [showEditCategory, setShowEditCategory] = useState(false);
  const [showEditSubCategory, setShowEditSubCategory] = useState(false);
  const [showEditService, setShowEditService] = useState(false);
  const [showDeleteCategory, setShowDeleteCategory] = useState(false);
  const [showDeleteSubCategory, setShowDeleteSubCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingItem, setDeletingItem] = useState<any>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      console.log('Loading categories...');
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/categories`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Categories loaded:', data);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setCategories(prev => prev.map(cat => 
      cat.id === categoryId ? { ...cat, expanded: !cat.expanded } : cat
    ));
  };

  const toggleSubCategory = (categoryId: string, subCategoryId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          subCategories: cat.subCategories.map(sub =>
            sub.id === subCategoryId ? { ...sub, expanded: !sub.expanded } as any : sub
          )
        };
      }
      return cat;
    }));
  };

  const handleAddService = (categoryId: string, subCategoryId?: string) => {
    setSelectedCategory(categoryId);
    setSelectedSubCategory(subCategoryId || null);
    setShowCreateService(true);
  };

  const handleAddSubCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowCreateSubCategory(true);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/categories/${categoryId}`,
        {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        loadCategories();
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/services/${serviceId}`,
        {
          method: 'DELETE',
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        loadCategories();
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const handleSeedVeterinaryServices = async () => {
    if (!confirm('This will seed 101 comprehensive veterinary services across 10 subcategories. Continue?')) return;
    
    try {
      setSeeding(true);
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/seed-veterinary-services`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        alert(`Success! Seeded ${data.stats.totalServices} veterinary services across ${data.stats.totalSubCategories} subcategories`);
        loadCategories();
        onRefresh();
      } else {
        alert('Failed to seed veterinary services');
      }
    } catch (error) {
      console.error('Error seeding veterinary services:', error);
      alert('Error seeding veterinary services');
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedAllServices = async () => {
    if (!confirm('This will seed 150+ services across ALL categories (Veterinary, Grooming, Training, Walking). This may replace existing services. Continue?')) return;
    
    try {
      setSeeding(true);
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/seed-all-services`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const breakdown = data.stats.breakdown.map((b: any) => 
          `${b.category}: ${b.services} services`
        ).join('\n');
        alert(`Success! Seeded ${data.stats.totalServices} services across ${data.stats.categoriesSeeded} categories\n\n${breakdown}`);
        loadCategories();
        onRefresh();
      } else {
        alert('Failed to seed all services');
      }
    } catch (error) {
      console.error('Error seeding all services:', error);
      alert('Error seeding all services');
    } finally {
      setSeeding(false);
    }
  };

  const getCategoryIcon = (iconName: string) => {
    const icons: any = {
      'healthcare': '🏥',
      'grooming': '✂️',
      'walkers': '🚶',
      'boarding': '🏠',
      'sunset': '🌅',
      'insurance': '🛡️',
      'mating': '💕'
    };
    return icons[iconName] || '📦';
  };

  // Filter categories based on status, category selection, and search
  const filteredCategories = categories.filter(category => {
    // Status filter
    if (statusFilter !== 'all' && category.status !== statusFilter) return false;
    
    // Category filter
    if (categoryFilter !== 'all' && category.id !== categoryFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      // Search in category name
      if (category.name.toLowerCase().includes(query)) return true;
      // Search in subcategories
      const hasMatchingSubCategory = category.subCategories.some(sub => 
        sub.name.toLowerCase().includes(query)
      );
      if (hasMatchingSubCategory) return true;
      // Search in services
      const hasMatchingService = category.subCategories.some(sub =>
        (sub.services || []).some(service => service.name.toLowerCase().includes(query))
      );
      if (hasMatchingService) return true;
      return false;
    }
    
    return true;
  });

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">Organize and manage service and product categories</p>
        
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status</span>
            <select 
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Category</span>
            <select 
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="pl-3 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Button variant="outline" className="text-sm">
            Sort-by
          </Button>
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={() => setShowBulkActions(true)}
          >
            Bulk Actions
          </Button>
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={() => setShowExport(true)}
          >
            Export
          </Button>
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={handleSeedVeterinaryServices}
            disabled={seeding}
          >
            Seed Vet Only
          </Button>
          <Button 
            variant="outline" 
            className="text-sm"
            onClick={handleSeedAllServices}
            disabled={seeding}
          >
            Seed All
          </Button>
          <Button 
            onClick={() => setShowCreateCategory(true)}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Loading categories...</div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">No categories found</div>
            <Button 
              className="mt-4 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              onClick={() => setShowCreateCategory(true)}
            >
              Create First Category
            </Button>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.id} className="border border-gray-200 rounded-lg bg-white">
              {/* Category Header */}
              <div className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <button 
                  onClick={() => toggleCategory(category.id)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  {category.expanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-lg">
                  {getCategoryIcon(category.icon)}
                </div>
                
                <div className="flex-1">
                  <div className="text-sm">{category.name}</div>
                  <div className="text-xs text-gray-500">{category.itemCount} items</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
                    onClick={() => handleAddSubCategory(category.id)}
                  >
                    <Plus className="w-3 h-3" />
                    Add Sub
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
                    onClick={() => {
                      setEditingCategory(category);
                      setShowEditCategory(true);
                    }}
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1 text-red-600 border-red-600 hover:bg-red-600 hover:text-white"
                    onClick={() => {
                      setDeletingItem(category);
                      setShowDeleteCategory(true);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subcategories */}
              {category.expanded && (
                <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
                  {category.subCategories.map((subCategory) => (
                    <div key={subCategory.id} className="mb-2 last:mb-0">
                      {/* Subcategory Header */}
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <button 
                          onClick={() => toggleSubCategory(category.id, subCategory.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {(subCategory as any).expanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>
                        
                        <div className="flex-1">
                          <div className="text-sm">{subCategory.name}</div>
                          <div className="text-xs text-gray-500">
                            {subCategory.description} ({(subCategory.services || []).length} items)
                          </div>
                        </div>

                        <span className={`px-2 py-1 rounded-full text-xs ${
                          subCategory.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {subCategory.status === 'active' ? 'Active' : 'Inactive'}
                        </span>

                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1 text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
                            onClick={() => handleAddService(category.id, subCategory.id)}
                          >
                            <Plus className="w-3 h-3" />
                            Add Services
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1"
                            onClick={() => {
                              setEditingSubCategory(subCategory);
                              setShowEditSubCategory(true);
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-1 text-red-600"
                            onClick={() => {
                              setDeletingItem(subCategory);
                              setShowDeleteSubCategory(true);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Services */}
                      {(subCategory as any).expanded && (subCategory.services || []).length > 0 && (
                        <div className="ml-8 mt-2 space-y-1">
                          {(subCategory.services || []).map((service) => (
                            <div 
                              key={service.id} 
                              className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50"
                            >
                              <div className="flex-1">
                                <div className="text-sm flex items-center gap-2">
                                  {service.name}
                                  {(service as any).subscriptionConfig?.enabled && (
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                      📅 Subscription
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Code: {service.code} | ₹{service.basePrice} | {service.duration}
                                  {(service as any).subscriptionConfig?.enabled && (
                                    <span className="ml-2 text-blue-600">
                                      • Weekly/Monthly Plans Available
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                service.status === 'active' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {service.status === 'active' ? 'Active' : 'Inactive'}
                              </span>

                              <div className="flex items-center gap-1">
                                <button 
                                  className="p-1 hover:bg-blue-50 rounded"
                                  onClick={() => {
                                    setEditingService(service);
                                    setShowEditService(true);
                                  }}
                                >
                                  <Edit className="w-3 h-3 text-blue-600" />
                                </button>
                                <button 
                                  className="p-1 hover:bg-red-50 rounded"
                                  onClick={() => handleDeleteService(service.id)}
                                >
                                  <Trash2 className="w-3 h-3 text-red-600" />
                                </button>
                              </div>
                            </div>
                          ))}
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

      {/* Modals */}
      <CreateServiceModal
        isOpen={showCreateService}
        onClose={() => {
          setShowCreateService(false);
          setSelectedCategory(null);
          setSelectedSubCategory(null);
        }}
        categoryId={selectedCategory}
        subCategoryId={selectedSubCategory}
        categoryName={
          selectedCategory 
            ? categories.find(c => c.id === selectedCategory)?.name 
            : undefined
        }
        subCategoryName={
          selectedCategory && selectedSubCategory
            ? categories
                .find(c => c.id === selectedCategory)
                ?.subCategories.find(s => s.id === selectedSubCategory)?.name
            : undefined
        }
        onSuccess={() => {
          setShowCreateService(false);
          setSelectedCategory(null);
          setSelectedSubCategory(null);
          loadCategories();
          onRefresh();
        }}
      />

      <CreateCategoryModal
        isOpen={showCreateCategory}
        onClose={() => setShowCreateCategory(false)}
        onSuccess={() => {
          setShowCreateCategory(false);
          loadCategories();
          onRefresh();
        }}
      />

      <CreateSubCategoryModal
        isOpen={showCreateSubCategory}
        onClose={() => {
          setShowCreateSubCategory(false);
          setSelectedCategory(null);
        }}
        parentCategoryId={selectedCategory || ''}
        parentCategoryName={
          categories.find(c => c.id === selectedCategory)?.name || ''
        }
        onSuccess={() => {
          setShowCreateSubCategory(false);
          setSelectedCategory(null);
          loadCategories();
          onRefresh();
        }}
      />

      <EditCategoryModal
        isOpen={showEditCategory}
        onClose={() => setShowEditCategory(false)}
        category={editingCategory}
        onSuccess={() => {
          setShowEditCategory(false);
          loadCategories();
          onRefresh();
        }}
      />

      <EditSubCategoryModal
        isOpen={showEditSubCategory}
        onClose={() => setShowEditSubCategory(false)}
        subcategory={editingSubCategory}
        parentCategoryName={
          categories.find(c => c.subCategories.some(sub => sub.id === editingSubCategory?.id))?.name || ''
        }
        onSuccess={() => {
          setShowEditSubCategory(false);
          loadCategories();
          onRefresh();
        }}
      />

      <EditServiceModal
        isOpen={showEditService}
        onClose={() => setShowEditService(false)}
        service={editingService}
        onSuccess={() => {
          setShowEditService(false);
          loadCategories();
          onRefresh();
        }}
      />

      <DeleteCategoryModal
        isOpen={showDeleteCategory}
        onClose={() => setShowDeleteCategory(false)}
        category={deletingItem}
        type="category"
        onSuccess={() => {
          setShowDeleteCategory(false);
          loadCategories();
          onRefresh();
        }}
      />

      <DeleteCategoryModal
        isOpen={showDeleteSubCategory}
        onClose={() => setShowDeleteSubCategory(false)}
        category={deletingItem}
        type="subcategory"
        onSuccess={() => {
          setShowDeleteSubCategory(false);
          loadCategories();
          onRefresh();
        }}
      />

      <BulkActionsModal
        isOpen={showBulkActions}
        onClose={() => setShowBulkActions(false)}
        categories={categories}
        onRefresh={onRefresh}
      />

      <ExportCategoriesModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        categories={categories}
      />
    </div>
  );
}