'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  FolderTree,
  Check,
  Tag,
  BarChart3,
  Search,
  List,
  Grid,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { Button, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast, Toaster } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  order: number;
  enabled: boolean;
  featured: boolean;
  metadata?: {
    commissionRate?: number;
    gstRate?: number;
    allowReturns?: boolean;
    returnWindow?: number;
    shippingCategory?: string;
    requiresPrescription?: boolean;
  };
  stats?: {
    productCount?: number;
    totalSales?: number;
    totalRevenue?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const getDefaultCategories = (): Category[] => [
    {
      id: 'food',
      name: 'Pet Food',
      slug: 'food',
      description: 'Nutritious food for all pets',
      icon: '🍖',
      color: 'bg-orange-100 text-orange-700',
      order: 1,
      enabled: true,
      featured: true,
      metadata: {
        commissionRate: 12,
        gstRate: 5,
        allowReturns: true,
        returnWindow: 7,
        shippingCategory: 'standard',
      },
      stats: { productCount: 0, totalSales: 0, totalRevenue: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'toys',
      name: 'Toys & Entertainment',
      slug: 'toys',
      description: 'Fun toys for active pets',
      icon: '🎾',
      color: 'bg-blue-100 text-blue-700',
      order: 2,
      enabled: true,
      featured: true,
      metadata: {
        commissionRate: 15,
        gstRate: 18,
        allowReturns: true,
        returnWindow: 14,
        shippingCategory: 'standard',
      },
      stats: { productCount: 0, totalSales: 0, totalRevenue: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/categories');
      setCategories((data as any).data?.categories || (data as any).categories || getDefaultCategories());
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories(getDefaultCategories());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.put('/admin/ecommerce/categories', { categories });
      toast.success('Categories updated successfully');
    } catch (error) {
      console.error('Error updating categories:', error);
      toast.error('Error updating categories');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: 'New Category',
      slug: `new-category-${Date.now()}`,
      order: categories.length + 1,
      enabled: true,
      featured: false,
      metadata: {
        commissionRate: 15,
        gstRate: 18,
        allowReturns: true,
        returnWindow: 14,
        shippingCategory: 'standard',
      },
      stats: { productCount: 0, totalSales: 0, totalRevenue: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingCategory(newCategory);
    setShowModal(true);
  };

  const saveCategory = (category: Category) => {
    const existing = categories.find((c) => c.id === category.id);
    if (existing) {
      setCategories(
        categories.map((c) =>
          c.id === category.id ? { ...category, updatedAt: new Date().toISOString() } : c
        )
      );
    } else {
      setCategories([...categories, category]);
    }
    setShowModal(false);
    setEditingCategory(null);
  };

  const deleteCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    const hasChildren = categories.some((c) => c.parentId === categoryId);

    if (hasChildren) {
      toast.error('Cannot delete category with subcategories');
      return;
    }

    if (confirm(`Are you sure you want to delete "${category?.name}"?`)) {
      setCategories(categories.filter((c) => c.id !== categoryId));
      toast.success('Category deleted');
    }
  };

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getFilteredCategories = () => {
    let filtered = categories;

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterEnabled !== null) {
      filtered = filtered.filter((c) => c.enabled === filterEnabled);
    }

    return filtered.sort((a, b) => a.order - b.order);
  };

  const getRootCategories = () => {
    return getFilteredCategories().filter((c) => !c.parentId);
  };

  const getChildCategories = (parentId: string) => {
    return getFilteredCategories().filter((c) => c.parentId === parentId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Toaster position="top-right" richColors />
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">Enterprise Category Management</h2>
          <p className="text-gray-500 text-sm mt-1">
            Hierarchical category system with advanced metadata
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} variant="outline">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
          <Button onClick={addCategory} className="bg-[#FF8C42] text-white hover:bg-[#E67A32]">
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderTree className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Categories</p>
              <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {categories.filter((c) => c.enabled).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Tag className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Featured</p>
              <p className="text-2xl font-bold text-gray-900">
                {categories.filter((c) => c.featured).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Commission</p>
              <p className="text-2xl font-bold text-gray-900">
                {categories.length > 0
                  ? (
                      categories.reduce(
                        (sum, c) => sum + (c.metadata?.commissionRate || 0),
                        0
                      ) / categories.length
                    ).toFixed(1)
                  : '0.0'}
                %
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterEnabled === null ? 'all' : filterEnabled.toString()}
              onChange={(e) =>
                setFilterEnabled(
                  e.target.value === 'all' ? null : e.target.value === 'true'
                )
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            >
              <option value="all">All Status</option>
              <option value="true">Active Only</option>
              <option value="false">Disabled Only</option>
            </select>

            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-4 py-2 ${
                  viewMode === 'tree'
                    ? 'bg-[#FF8C42] text-white'
                    : 'bg-white text-gray-600'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 ${
                  viewMode === 'grid'
                    ? 'bg-[#FF8C42] text-white'
                    : 'bg-white text-gray-600'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Display */}
      {viewMode === 'tree' ? (
        <div className="bg-white rounded-xl border border-gray-200">
          {getRootCategories().length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No categories found</p>
              <Button onClick={addCategory} variant="outline">
                Create First Category
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {getRootCategories().map((category) => (
                <CategoryTreeItem
                  key={category.id}
                  category={category}
                  expanded={expandedCategories.has(category.id)}
                  children={getChildCategories(category.id)}
                  onToggleExpanded={() => toggleExpanded(category.id)}
                  onEdit={() => {
                    setEditingCategory(category);
                    setShowModal(true);
                  }}
                  onDelete={() => deleteCategory(category.id)}
                  onToggleEnabled={() => {
                    setCategories(
                      categories.map((c) =>
                        c.id === category.id ? { ...c, enabled: !c.enabled } : c
                      )
                    );
                  }}
                  onToggleFeatured={() => {
                    setCategories(
                      categories.map((c) =>
                        c.id === category.id ? { ...c, featured: !c.featured } : c
                      )
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {getFilteredCategories().map((category) => (
            <CategoryGridItem
              key={category.id}
              category={category}
              onEdit={() => {
                setEditingCategory(category);
                setShowModal(true);
              }}
              onDelete={() => deleteCategory(category.id)}
              onToggleEnabled={() => {
                setCategories(
                  categories.map((c) =>
                    c.id === category.id ? { ...c, enabled: !c.enabled } : c
                  )
                );
              }}
            />
          ))}
        </div>
      )}

      {/* Category Editor Modal */}
      {showModal && editingCategory && (
        <CategoryEditorModal
          category={editingCategory}
          onSave={saveCategory}
          onClose={() => {
            setShowModal(false);
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
}

// Category Tree Item Component
function CategoryTreeItem({
  category,
  expanded,
  children,
  onToggleExpanded,
  onEdit,
  onDelete,
  onToggleEnabled,
  onToggleFeatured,
}: any) {
  return (
    <div>
      <div className="p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-4">
          {children.length > 0 && (
            <button onClick={onToggleExpanded} className="p-1 hover:bg-gray-200 rounded">
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )}
            </button>
          )}

          <div className="flex items-center gap-3 flex-1">
            <div className="text-3xl">{category.icon || '📁'}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{category.name}</h4>
                {category.featured && (
                  <Badge className="bg-yellow-100 text-yellow-700">Featured</Badge>
                )}
                <Badge variant={category.enabled ? 'default' : 'outline'}>
                  {category.enabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              {category.description && (
                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>Commission: {category.metadata?.commissionRate || 0}%</span>
                <span>GST: {category.metadata?.gstRate || 0}%</span>
                {category.metadata?.allowReturns && (
                  <span>Returns: {category.metadata?.returnWindow || 0} days</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onToggleFeatured} variant="ghost" size="sm">
                <Tag className="w-4 h-4" />
              </Button>
              <Button onClick={onToggleEnabled} variant="ghost" size="sm">
                {category.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button onClick={onEdit} variant="ghost" size="sm">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button onClick={onDelete} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div className="pl-12 bg-gray-50">
          {children.map((child: Category) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              expanded={false}
              children={[]}
              onToggleExpanded={() => {}}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleEnabled={onToggleEnabled}
              onToggleFeatured={onToggleFeatured}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Category Grid Item Component
function CategoryGridItem({ category, onEdit, onDelete, onToggleEnabled }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="text-4xl">{category.icon || '📁'}</div>
        <div className="flex items-center gap-1">
          <Button onClick={onEdit} variant="ghost" size="sm">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button onClick={onDelete} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <h4 className="font-semibold text-gray-900 mb-1">{category.name}</h4>
      {category.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{category.description}</p>
      )}

      <div className="flex items-center gap-2 mb-3">
        {category.featured && <Badge className="bg-yellow-100 text-yellow-700">Featured</Badge>}
        <Badge variant={category.enabled ? 'default' : 'outline'}>
          {category.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      <div className="space-y-2 text-xs text-gray-600 border-t border-gray-200 pt-3">
        <div className="flex justify-between">
          <span>Commission:</span>
          <span className="font-semibold">{category.metadata?.commissionRate || 0}%</span>
        </div>
        <div className="flex justify-between">
          <span>GST Rate:</span>
          <span className="font-semibold">{category.metadata?.gstRate || 0}%</span>
        </div>
        {category.metadata?.allowReturns && (
          <div className="flex justify-between">
            <span>Return Window:</span>
            <span className="font-semibold">{category.metadata?.returnWindow || 0} days</span>
          </div>
        )}
      </div>

      <Button onClick={onToggleEnabled} variant="outline" className="w-full mt-4" size="sm">
        {category.enabled ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );
}

// Category Editor Modal Component
function CategoryEditorModal({ category, onSave, onClose }: any) {
  const [editedCategory, setEditedCategory] = useState<Category>(() => ({
    ...category,
    metadata: category.metadata || {
      commissionRate: 0,
      gstRate: 0,
      allowReturns: false,
      returnWindow: 0,
      shippingCategory: 'standard',
      requiresPrescription: false,
    },
  }));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-900">
            {category.id.startsWith('cat_') ? 'Edit' : 'New'} Category
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name *
              </label>
              <input
                type="text"
                value={editedCategory.name}
                onChange={(e) => setEditedCategory({ ...editedCategory, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slug *</label>
              <input
                type="text"
                value={editedCategory.slug}
                onChange={(e) => setEditedCategory({ ...editedCategory, slug: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={editedCategory.description || ''}
              onChange={(e) =>
                setEditedCategory({
                  ...editedCategory,
                  description: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Icon (Emoji)</label>
              <input
                type="text"
                value={editedCategory.icon || ''}
                onChange={(e) => setEditedCategory({ ...editedCategory, icon: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                placeholder="🐶"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color Class</label>
              <input
                type="text"
                value={editedCategory.color || ''}
                onChange={(e) =>
                  setEditedCategory({
                    ...editedCategory,
                    color: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                placeholder="bg-blue-100 text-blue-700"
              />
            </div>
          </div>

          {/* Metadata */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Category Metadata</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  value={editedCategory.metadata?.commissionRate || 0}
                  onChange={(e) =>
                    setEditedCategory({
                      ...editedCategory,
                      metadata: {
                        ...editedCategory.metadata,
                        commissionRate: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">GST Rate (%)</label>
                <input
                  type="number"
                  value={editedCategory.metadata?.gstRate || 0}
                  onChange={(e) =>
                    setEditedCategory({
                      ...editedCategory,
                      metadata: {
                        ...editedCategory.metadata,
                        gstRate: parseFloat(e.target.value),
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Window (days)
                </label>
                <input
                  type="number"
                  value={editedCategory.metadata?.returnWindow || 0}
                  onChange={(e) =>
                    setEditedCategory({
                      ...editedCategory,
                      metadata: {
                        ...editedCategory.metadata,
                        returnWindow: parseInt(e.target.value),
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipping Category
                </label>
                <select
                  value={editedCategory.metadata?.shippingCategory || 'standard'}
                  onChange={(e) =>
                    setEditedCategory({
                      ...editedCategory,
                      metadata: {
                        ...editedCategory.metadata,
                        shippingCategory: e.target.value as any,
                      },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                >
                  <option value="standard">Standard</option>
                  <option value="fragile">Fragile</option>
                  <option value="refrigerated">Refrigerated</option>
                  <option value="hazardous">Hazardous</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-8">
                <input
                  type="checkbox"
                  checked={editedCategory.metadata?.allowReturns || false}
                  onChange={(e) =>
                    setEditedCategory({
                      ...editedCategory,
                      metadata: {
                        ...editedCategory.metadata,
                        allowReturns: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4"
                />
                <label className="text-sm">Allow Returns</label>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(editedCategory)}
            className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Category
          </Button>
        </div>
      </div>
    </div>
  );
}
