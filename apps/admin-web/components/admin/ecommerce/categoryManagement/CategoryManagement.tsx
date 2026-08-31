'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Package,
  X,
} from 'lucide-react';
import { Button, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import {
  mapApiCategoryToForm,
  mapFormCategoriesToPutBody,
  type EcommerceCategoryForm,
} from '@/lib/ecommerce-category-admin';
import { getShopCategoryStaticImageUrl } from '@/lib/shop-category-static-images';
import { toast, Toaster } from 'sonner';
import { SubcategoryRulesPanel } from './SubcategoryRulesPanel';

interface Category extends EcommerceCategoryForm {
  createdAt?: string;
  updatedAt?: string;
  is_active?: boolean;
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

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/categories');
      const rawCategories = (data as any).data?.categories || (data as any).categories || [];
      const mappedCategories = rawCategories.map((cat: Record<string, unknown>) =>
        mapApiCategoryToForm(cat)
      ) as Category[];
      setCategories(mappedCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const persistCategories = async (list: Category[]) => {
    const payload = mapFormCategoriesToPutBody(list);
    const res = await apiClient.put<any>('/admin/ecommerce/categories', payload);
    const saved =
      (res as any)?.categories || (res as any)?.data?.categories || [];
    if (Array.isArray(saved) && saved.length > 0) {
      setCategories(saved.map((cat: Record<string, unknown>) => mapApiCategoryToForm(cat)) as Category[]);
    } else {
      await loadCategories();
    }
  };

  const handleToggleEnabled = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    const previous = categories;
    const nextEnabled = !category.enabled;
    const nextList = categories.map((c) =>
      c.id === categoryId ? { ...c, enabled: nextEnabled } : c
    );

    setCategories(nextList);
    try {
      setSaving(true);
      await persistCategories(nextList);
      toast.success(
        nextEnabled ? `"${category.name}" enabled` : `"${category.name}" disabled`
      );
    } catch (error: unknown) {
      setCategories(previous);
      console.error('Error toggling category:', error);
      const msg =
        error instanceof Error
          ? error.message
          : (error as { error?: string })?.error || 'Failed to update category';
      toast.error(msg);
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
      commissionRate: null,
      returnsEnabled: false,
    };
    setEditingCategory(newCategory);
    setShowModal(true);
  };

  const saveCategory = async (category: Category) => {
    const existing = categories.find((c) => c.id === category.id);
    const nextList = existing
      ? categories.map((c) => (c.id === category.id ? { ...category } : c))
      : [...categories, category];

    try {
      setSaving(true);
      await persistCategories(nextList);
      toast.success('Category saved');
      setShowModal(false);
      setEditingCategory(null);
    } catch (error: unknown) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    const hasChildren = categories.some((c) => c.parentId === categoryId);

    if (hasChildren) {
      toast.error('Cannot delete category with subcategories');
      return;
    }

    if (!confirm(`Disable "${category?.name}"? Products keep their category link.`)) {
      return;
    }

    const previous = categories;
    const nextList = categories.map((c) =>
      c.id === categoryId ? { ...c, enabled: false } : c
    );
    setCategories(nextList);

    try {
      setSaving(true);
      await persistCategories(nextList);
      toast.success(`"${category?.name}" disabled`);
    } catch (error: unknown) {
      setCategories(previous);
      console.error('Error disabling category:', error);
      toast.error('Failed to disable category');
    } finally {
      setSaving(false);
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

  const filteredCategories = useMemo(() => {
    let filtered = [...categories]; // Create a copy to avoid mutating state

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.slug?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filterEnabled !== null) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter((c) => {
        // Check both enabled and is_active fields for compatibility
        const isEnabled = c.enabled !== undefined ? c.enabled : (c.is_active !== undefined ? c.is_active : true);
        
        if (filterEnabled === true) {
          // Active Only: must be enabled
          return isEnabled === true;
        } else if (filterEnabled === false) {
          // Disabled Only: must be disabled
          return isEnabled === false;
        }
        return true;
      });
      console.log('[Categories Filter] Applied filter:', filterEnabled, 'Before:', beforeFilter, 'After:', filtered.length, 'Categories:', filtered.map(c => ({ name: c.name, enabled: c.enabled, is_active: c.is_active })));
    }

    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [categories, searchQuery, filterEnabled]);

  const getFilteredCategories = () => filteredCategories;

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
              <p className="text-sm text-gray-500">With Commission Set</p>
              <p className="text-2xl font-bold text-gray-900">
                {categories.filter((c) => c.commissionRate != null && c.commissionRate > 0).length}
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
                        (sum, c) => sum + (c.commissionRate ?? 0),
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterEnabled === null ? 'all' : (filterEnabled === true ? 'true' : 'false')}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const value = e.target.value;
                if (value === 'all') {
                  setFilterEnabled(null);
                } else if (value === 'true') {
                  setFilterEnabled(true);
                } else if (value === 'false') {
                  setFilterEnabled(false);
                }
              }}
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
                  onEdit={(cat) => {
                    setEditingCategory(cat);
                    setShowModal(true);
                  }}
                  onDelete={(id) => deleteCategory(id)}
                  onToggleEnabled={(id) => {
                    void handleToggleEnabled(id);
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
                void handleToggleEnabled(category.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Category Editor Modal */}
      {showModal && editingCategory && (
        <CategoryEditorModal
          category={editingCategory}
          allCategories={categories}
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
}: {
  category: Category;
  expanded: boolean;
  children: Category[];
  onToggleExpanded: () => void;
  onEdit: (category: Category) => void;
  onDelete: (categoryId: string) => void;
  onToggleEnabled: (categoryId: string) => void;
}) {
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
            <CategoryThumbnail category={category} size="sm" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{category.name}</h4>
                <Badge variant={category.enabled ? 'default' : 'outline'}>
                  {category.enabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              {category.description && (
                <p className="text-sm text-gray-500 mt-1">{category.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span>
                  Returns: {category.returnsEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <span>
                  Commission:{' '}
                  {category.commissionRate != null ? `${category.commissionRate}%` : 'Not set'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={() => onToggleEnabled(category.id)} variant="ghost" size="sm">
                {category.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
              <Button onClick={() => onEdit(category)} variant="ghost" size="sm">
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => onDelete(category.id)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
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
        <CategoryThumbnail category={category} size="md" />
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
        <Badge variant={category.enabled ? 'default' : 'outline'}>
          {category.enabled ? 'Active' : 'Disabled'}
        </Badge>
      </div>

      <div className="space-y-2 text-xs text-gray-600 border-t border-gray-200 pt-3">
        <div className="flex justify-between">
          <span>Commission:</span>
          <span className="font-semibold">
            {category.commissionRate != null ? `${category.commissionRate}%` : 'Not set'}
          </span>
        </div>
      </div>

      <Button onClick={onToggleEnabled} variant="outline" className="w-full mt-4" size="sm">
        {category.enabled ? 'Disable' : 'Enable'}
      </Button>
    </div>
  );
}

function CategoryThumbnail({
  category,
  size,
}: {
  category: { name?: string; icon?: string };
  size: 'sm' | 'md';
}) {
  const dim = size === 'md' ? 'w-16 h-16' : 'w-10 h-10';
  const staticSrc = category.name ? getShopCategoryStaticImageUrl(category.name) : undefined;
  if (staticSrc) {
    return (
      <img
        src={staticSrc}
        alt={category.name || 'Category'}
        className={`${dim} rounded-xl object-cover bg-stone-100 border border-gray-200`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-xl bg-stone-100 border border-gray-200 flex items-center justify-center text-2xl`}
    >
      {category.icon || '📁'}
    </div>
  );
}

function ShopCategoryTilePreview({
  name,
  active = false,
}: {
  name: string;
  active?: boolean;
}) {
  const staticSrc = getShopCategoryStaticImageUrl(name);
  return (
    <div
      className={`flex flex-col items-center rounded-2xl bg-stone-50 p-2 ${
        active ? 'ring-2 ring-[#FF8C42] shadow-sm' : 'ring-1 ring-stone-100 opacity-60'
      }`}
    >
      <div className="relative w-full aspect-square rounded-xl bg-white overflow-hidden flex items-center justify-center mb-1.5">
        {staticSrc ? (
          <img
            src={staticSrc}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="w-8 h-8 text-stone-300" aria-hidden />
        )}
      </div>
      <span
        className={`text-[10px] font-bold text-center leading-tight line-clamp-2 w-full px-0.5 ${
          active ? 'text-[#FF8C42]' : 'text-slate-800'
        }`}
      >
        {name.trim() || 'Category name'}
      </span>
    </div>
  );
}

function ShopCategoryGridPreview({ name }: { name: string }) {
  const placeholders = ['Food', 'Toys', 'Grooming'];

  return (
    <div className="rounded-xl border border-gray-200 bg-stone-50/80 p-4">
      <p className="text-xs font-medium text-gray-500 mb-1">Preview</p>
      <p className="text-[11px] text-gray-400 mb-3">Customer shop → Shop by category</p>
      <div className="rounded-2xl bg-white p-3 shadow-sm border border-stone-100 max-w-[280px] mx-auto">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Shop by category</h3>
        <div className="grid grid-cols-4 gap-2">
          <ShopCategoryTilePreview name={name} active />
          {placeholders.map((label) => (
            <ShopCategoryTilePreview key={label} name={label} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Descendant ids (children, grandchildren, ...) of a category, to block cyclic parent picks. */
function descendantCategoryIds(categoryId: string, allCategories: Category[]): Set<string> {
  const result = new Set<string>();
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const c of allCategories) {
      if (c.parentId === current && !result.has(c.id)) {
        result.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return result;
}

// Category Editor Modal Component
function CategoryEditorModal({
  category,
  allCategories,
  onSave,
  onClose,
}: {
  category: Category;
  allCategories: Category[];
  onSave: (category: Category) => void;
  onClose: () => void;
}) {
  const [editedCategory, setEditedCategory] = useState<Category>(() => ({ ...category }));

  const parentOptions = useMemo(() => {
    const blocked = descendantCategoryIds(category.id, allCategories);
    blocked.add(category.id);
    return allCategories.filter((c) => !blocked.has(c.id));
  }, [allCategories, category.id]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-xl font-bold text-gray-900">
            {String(category.id).startsWith('cat_') ? 'New' : 'Edit'} Category
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            <div className="space-y-6 min-w-0">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category Name *
              </label>
              <input
                type="text"
                value={editedCategory.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedCategory({ ...editedCategory, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Slug *</label>
              <input
                type="text"
                value={editedCategory.slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedCategory({ ...editedCategory, slug: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Parent Category</label>
            <select
              value={editedCategory.parentId ?? ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setEditedCategory({
                  ...editedCategory,
                  parentId: e.target.value || null,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            >
              <option value="">None (top-level category)</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Set a parent to make this a subcategory shown as a second-level tab on the customer
              shop page (e.g. "Dry Pet Food" under "Pet Food").
            </p>
          </div>

          {editedCategory.parentId &&
            !String(editedCategory.id).startsWith('cat_') && (
              <SubcategoryRulesPanel
                subcategoryId={editedCategory.id}
                subcategoryName={editedCategory.name}
              />
            )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={editedCategory.description || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setEditedCategory({
                  ...editedCategory,
                  description: e.target.value,
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              rows={3}
            />
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-800">Customer shop image</p>
            <p className="text-xs text-gray-500 mt-1">
              Tile images are fixed assets in the customer app (by category name). To change an image,
              replace files under <code className="text-[11px]">public/images/shop/categories/</code> in
              customer-web.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <CategoryThumbnail category={editedCategory} size="md" />
              <span className="text-xs text-gray-600">
                {getShopCategoryStaticImageUrl(editedCategory.name)
                  ? 'Static image mapped for this category name.'
                  : 'No static image file mapped for this name yet.'}
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Returns Policy</h4>
            <p className="text-xs text-gray-500 mb-3">
              When enabled, customers can request returns for delivered products in this category
              within the platform return window.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedCategory.returnsEnabled === true}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEditedCategory({
                    ...editedCategory,
                    returnsEnabled: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Returns enabled</span>
            </label>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Default Commission</h4>
            <p className="text-xs text-gray-500 mb-3">
              Platform-wide default rate for this category. Vendor-specific overrides are managed
              under E-Commerce → Commission.
            </p>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Commission Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={editedCategory.commissionRate ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = e.target.value;
                  setEditedCategory({
                    ...editedCategory,
                    commissionRate: val === '' ? null : parseFloat(val),
                  });
                }}
                placeholder="Leave empty for platform default"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              />
            </div>
          </div>
            </div>

            <div className="lg:sticky lg:top-6 lg:self-start">
              <ShopCategoryGridPreview name={editedCategory.name} />
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
