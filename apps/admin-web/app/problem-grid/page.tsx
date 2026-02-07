'use client';

/**
 * ============================================================================
 * ADMIN PROBLEM GRID MANAGEMENT
 * ============================================================================
 * 
 * Full CRUD management for Problem Grid items
 * - List all problem grid categories
 * - Add, edit, delete items
 * - Assign to roles/services
 * - Configure service style mappings
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, Search, Filter, ChevronRight, 
  Grid3X3, X, Save, AlertCircle, Check, Eye, EyeOff,
  Tag, Layers, Settings, Move, GripVertical, ChevronDown,
  Loader2, RefreshCw, Upload, Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Types
interface ProblemGridItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  iconUrl?: string;
  color?: string;
  category: string;
  roleIds: string[];
  serviceStyles: ('at_home' | 'at_center' | 'tele')[];
  keywords: string[];
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProblemGridCategory {
  id: string;
  name: string;
  description?: string;
  roleId?: string;
  roleName?: string;
  itemCount: number;
  isActive: boolean;
}

interface Role {
  id: string;
  name: string;
  displayName: string;
}

const SERVICE_STYLES = [
  { value: 'at_home', label: 'Home', icon: '🏠' },
  { value: 'at_center', label: 'Center', icon: '🏥' },
  { value: 'tele', label: 'Tele', icon: '📱' },
];

const PRESET_COLORS = [
  '#FF8C42', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722',
  '#00BCD4', '#795548', '#607D8B', '#E91E63', '#3F51B5',
];

export default function ProblemGridManagement() {
  // State
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ProblemGridCategory[]>([]);
  const [items, setItems] = useState<ProblemGridItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<ProblemGridItem | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    iconUrl: '',
    color: '#FF8C42',
    category: '',
    roleIds: [] as string[],
    serviceStyles: [] as string[],
    keywords: '',
    isActive: true,
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch categories, items, and roles in parallel
      const [categoriesRes, itemsRes, rolesRes] = await Promise.all([
        fetch('/api/admin/problem-grid/categories').then(r => r.json()),
        fetch('/api/admin/problem-grid/items').then(r => r.json()),
        fetch('/api/config/roles').then(r => r.json()),
      ]);

      setCategories(categoriesRes.categories || mockCategories);
      setItems(itemsRes.items || mockItems);
      setRoles(rolesRes.roles || mockRoles);
    } catch (error) {
      console.error('Error loading data:', error);
      // Use mock data for development
      setCategories(mockCategories);
      setItems(mockItems);
      setRoles(mockRoles);
    } finally {
      setLoading(false);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    if (selectedCategory && item.category !== selectedCategory) return false;
    if (!showInactive && !item.isActive) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(query) ||
             item.description?.toLowerCase().includes(query) ||
             item.keywords.some(k => k.toLowerCase().includes(query));
    }
    return true;
  });

  // Open create modal
  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      icon: '',
      iconUrl: '',
      color: '#FF8C42',
      category: selectedCategory || '',
      roleIds: [],
      serviceStyles: ['at_home', 'at_center'],
      keywords: '',
      isActive: true,
    });
    setEditingItem(null);
    setModalMode('create');
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (item: ProblemGridItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      icon: item.icon || '',
      iconUrl: item.iconUrl || '',
      color: item.color || '#FF8C42',
      category: item.category,
      roleIds: item.roleIds,
      serviceStyles: item.serviceStyles,
      keywords: item.keywords.join(', '),
      isActive: item.isActive,
    });
    setEditingItem(item);
    setModalMode('edit');
    setShowModal(true);
  };

  // Save item
  const saveItem = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.category) {
      toast.error('Category is required');
      return;
    }
    if (formData.serviceStyles.length === 0) {
      toast.error('At least one service style is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
      };

      const url = modalMode === 'edit' 
        ? `/api/admin/problem-grid/items/${editingItem?.id}`
        : '/api/admin/problem-grid/items';
      
      const method = modalMode === 'edit' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(modalMode === 'edit' ? 'Item updated!' : 'Item created!');
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  // Delete item
  const deleteItem = async (id: string) => {
    try {
      await fetch(`/api/admin/problem-grid/items/${id}`, {
        method: 'DELETE',
      });
      toast.success('Item deleted');
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  // Toggle item active status
  const toggleItemStatus = async (item: ProblemGridItem) => {
    try {
      await fetch(`/api/admin/problem-grid/items/${item.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      toast.success(item.isActive ? 'Item deactivated' : 'Item activated');
      loadData();
    } catch (error) {
      console.error('Error toggling item:', error);
      toast.error('Failed to update item');
    }
  };

  // Get role display name
  const getRoleName = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role?.displayName || role?.name || roleId;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Grid3X3 className="w-7 h-7 text-[#FF8C42]" />
                Problem Grid Management
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                Manage problem grid items that appear on customer home and service dashboard
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={openCreateModal} className="bg-[#FF8C42] hover:bg-[#E67A35]">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Categories */}
          <div className="w-64 flex-shrink-0">
            <Card className="bg-white rounded-xl p-4 border border-gray-100 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Categories
              </h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    selectedCategory === null
                      ? 'bg-[#FF8C42] text-white'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  All Items ({items.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between ${
                      selectedCategory === cat.id
                        ? 'bg-[#FF8C42] text-white'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <Badge variant="secondary" className={
                      selectedCategory === cat.id ? 'bg-white/20 text-white' : ''
                    }>
                      {cat.itemCount}
                    </Badge>
                  </button>
                ))}
              </div>

              {/* Filter options */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Show inactive items
                </label>
              </div>
            </Card>
          </div>

          {/* Main content */}
          <div className="flex-1">
            {/* Search bar */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problem grid items..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
                />
              </div>
            </div>

            {/* Items grid */}
            {filteredItems.length === 0 ? (
              <Card className="bg-white rounded-xl p-12 text-center border border-gray-100">
                <Grid3X3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No items found</h3>
                <p className="text-gray-500 mb-4">
                  {searchQuery 
                    ? 'Try a different search term'
                    : 'Create your first problem grid item'}
                </p>
                <Button onClick={openCreateModal} className="bg-[#FF8C42] hover:bg-[#E67A35]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <Card 
                    key={item.id}
                    className={`bg-white rounded-xl p-4 border transition ${
                      item.isActive 
                        ? 'border-gray-100 hover:border-[#FF8C42]' 
                        : 'border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                          style={{ backgroundColor: `${item.color}20`, color: item.color }}
                        >
                          {item.iconUrl ? (
                            <img src={item.iconUrl} alt="" className="w-8 h-8" />
                          ) : (
                            item.icon || '🐾'
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{item.name}</h4>
                          <p className="text-xs text-gray-500">{item.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleItemStatus(item)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                          title={item.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {item.isActive ? (
                            <Eye className="w-4 h-4 text-green-600" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <button 
                          onClick={() => openEditModal(item)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    {/* Service styles */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {item.serviceStyles.map((style) => {
                        const styleInfo = SERVICE_STYLES.find(s => s.value === style);
                        return (
                          <Badge key={style} variant="secondary" className="text-xs">
                            {styleInfo?.icon} {styleInfo?.label}
                          </Badge>
                        );
                      })}
                    </div>

                    {/* Roles */}
                    {item.roleIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.roleIds.slice(0, 3).map((roleId) => (
                          <span key={roleId} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {getRoleName(roleId)}
                          </span>
                        ))}
                        {item.roleIds.length > 3 && (
                          <span className="text-xs text-gray-400">
                            +{item.roleIds.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {modalMode === 'edit' ? 'Edit Item' : 'Create New Item'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Bath & Brush"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this problem/need"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none h-20 resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="Emoji (e.g., 🛁)"
                    className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
                  />
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl border border-gray-200"
                    style={{ backgroundColor: `${formData.color}20` }}
                  >
                    {formData.icon || '🐾'}
                  </div>
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full transition ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-[#FF8C42]' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Service Styles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Styles *</label>
                <div className="flex gap-2">
                  {SERVICE_STYLES.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => {
                        const styles = formData.serviceStyles.includes(style.value)
                          ? formData.serviceStyles.filter(s => s !== style.value)
                          : [...formData.serviceStyles, style.value];
                        setFormData({ ...formData, serviceStyles: styles });
                      }}
                      className={`flex-1 py-3 rounded-xl border-2 transition ${
                        formData.serviceStyles.includes(style.value)
                          ? 'border-[#FF8C42] bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-xl">{style.icon}</span>
                      <span className="block text-sm mt-1">{style.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Roles</label>
                <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-xl">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => {
                        const roleIds = formData.roleIds.includes(role.id)
                          ? formData.roleIds.filter(r => r !== role.id)
                          : [...formData.roleIds, role.id];
                        setFormData({ ...formData, roleIds });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        formData.roleIds.includes(role.id)
                          ? 'bg-[#FF8C42] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {role.displayName || role.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  placeholder="Comma-separated keywords for search"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-[#FF8C42] outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  e.g., bath, brush, grooming, clean
                </p>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900">Active</p>
                  <p className="text-sm text-gray-500">Show this item to customers</p>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`w-12 h-6 rounded-full transition ${
                    formData.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition ${
                    formData.isActive ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={saveItem}
                disabled={saving}
                className="flex-1 bg-[#FF8C42] hover:bg-[#E67A35]"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {modalMode === 'edit' ? 'Update' : 'Create'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Item?</h3>
            <p className="text-gray-600 mb-6">
              This action cannot be undone. The item will be permanently removed.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => deleteItem(deleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Mock data for development
const mockCategories: ProblemGridCategory[] = [
  { id: 'grooming', name: 'Grooming', itemCount: 6, isActive: true },
  { id: 'vet', name: 'Veterinary', itemCount: 8, isActive: true },
  { id: 'training', name: 'Training', itemCount: 4, isActive: true },
  { id: 'nutrition', name: 'Nutrition', itemCount: 5, isActive: true },
  { id: 'walking', name: 'Walking', itemCount: 3, isActive: true },
  { id: 'behavior', name: 'Behavior', itemCount: 5, isActive: true },
];

const mockItems: ProblemGridItem[] = [
  {
    id: '1',
    name: 'Bath & Brush',
    description: 'Complete bathing and brushing service',
    icon: '🛁',
    color: '#4CAF50',
    category: 'grooming',
    roleIds: ['groomer'],
    serviceStyles: ['at_home', 'at_center'],
    keywords: ['bath', 'brush', 'clean', 'wash'],
    displayOrder: 1,
    isActive: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: '2',
    name: 'Vaccination',
    description: 'Routine vaccinations for your pet',
    icon: '💉',
    color: '#2196F3',
    category: 'vet',
    roleIds: ['vet'],
    serviceStyles: ['at_center', 'at_home'],
    keywords: ['vaccine', 'shot', 'immunization'],
    displayOrder: 1,
    isActive: true,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

const mockRoles: Role[] = [
  { id: 'vet', name: 'vet', displayName: 'Veterinarian' },
  { id: 'groomer', name: 'groomer', displayName: 'Groomer' },
  { id: 'trainer', name: 'trainer', displayName: 'Trainer' },
  { id: 'walker', name: 'walker', displayName: 'Dog Walker' },
  { id: 'nutritionist', name: 'nutritionist', displayName: 'Nutritionist' },
  { id: 'behaviorist', name: 'behaviorist', displayName: 'Behaviorist' },
];
