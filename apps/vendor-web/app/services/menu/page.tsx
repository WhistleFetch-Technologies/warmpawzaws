'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { vendorNavigateBackFromShell } from '@/lib/vendor-route-nav';
import { Plus, Edit2, Trash2, Utensils } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: 'food' | 'drink' | 'treat' | 'combo';
  price: number;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  ingredients?: string[];
  allergens?: string[];
}

export default function CafeMenuPage() {
  const router = useRouter();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'food' as MenuItem['category'],
    price: '',
    preparation_time: '',
    ingredients: '',
    allergens: '',
  });

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(`/vendor/${vendorId}/cafe/menu`);
      if (response.success || response.menu_items) {
        setMenuItems(response.menu_items || []);
      }
    } catch (error: any) {
      console.error('Error loading menu items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        preparation_time: formData.preparation_time ? parseInt(formData.preparation_time) : undefined,
        ingredients: formData.ingredients ? formData.ingredients.split(',').map(i => i.trim()) : [],
        allergens: formData.allergens ? formData.allergens.split(',').map(a => a.trim()) : [],
      };

      if (editingItem) {
        await apiClient.put(`/vendor/${vendorId}/cafe/menu/${editingItem.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${vendorId}/cafe/menu`, payload);
      }
      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      loadMenuItems();
    } catch (error: any) {
      alert(error.message || 'Failed to save menu item');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.delete(`/vendor/${vendorId}/cafe/menu/${itemId}`);
      loadMenuItems();
    } catch (error: any) {
      alert(error.message || 'Failed to delete menu item');
    }
  };

  const toggleAvailability = async (itemId: string, currentStatus: boolean) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.put(`/vendor/${vendorId}/cafe/menu/${itemId}/availability`, {
        is_available: !currentStatus,
      });
      loadMenuItems();
    } catch (error: any) {
      alert(error.message || 'Failed to update availability');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'food',
      price: '',
      preparation_time: '',
      ingredients: '',
      allergens: '',
    });
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price.toString(),
      preparation_time: item.preparation_time?.toString() || '',
      ingredients: item.ingredients?.join(', ') || '',
      allergens: item.allergens?.join(', ') || '',
    });
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const categories = [
    { value: 'food', label: 'Food', icon: '🍽️' },
    { value: 'drink', label: 'Drinks', icon: '🥤' },
    { value: 'treat', label: 'Treats', icon: '🍪' },
    { value: 'combo', label: 'Combos', icon: '🍱' },
  ];

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="🍽️ Menu Management"
          subtitle="Manage your cafe menu items"
          onBack={() => vendorNavigateBackFromShell('/services')}
          actions={[
            <button
              key="add-item"
              type="button"
              onClick={() => {
                resetForm();
                setEditingItem(null);
                setShowAddModal(true);
              }}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              <Plus className="h-5 w-5 shrink-0" />
              Add Item
            </button>,
          ]}
        />

        <main className="w-full px-4 py-6 sm:px-6">
        {menuItems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🍽️</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No menu items yet</h3>
            <p className="text-gray-500 mb-4">Add your first menu item to start your cafe menu</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Add First Item
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => {
              const items = groupedItems[category.value] || [];
              if (items.length === 0) return null;

              return (
                <div key={category.value}>
                  <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">{category.icon}</span>
                    {category.label}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-white rounded-xl p-6 shadow-sm border-2 transition ${
                          item.is_available ? 'border-green-200' : 'border-gray-200 opacity-60'
                        }`}
                      >
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-40 object-cover rounded-lg mb-4"
                          />
                        )}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{item.name}</h3>
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xl font-bold text-orange-600">₹{item.price}</p>
                            {item.preparation_time && (
                              <p className="text-xs text-gray-500">{item.preparation_time} mins</p>
                            )}
                          </div>
                        </div>

                        {item.ingredients && item.ingredients.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">Ingredients:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.ingredients.slice(0, 3).map((ing, idx) => (
                                <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                  {ing}
                                </span>
                              ))}
                              {item.ingredients.length > 3 && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                  +{item.ingredients.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAvailability(item.id, item.is_available)}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                              item.is_available
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {item.is_available ? 'Mark Unavailable' : 'Mark Available'}
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Puppuccino"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the menu item..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as MenuItem['category'] })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preparation Time (minutes)
                </label>
                <input
                  type="number"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Optional"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingredients (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.ingredients}
                  onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Milk, Sugar, Whipped Cream"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allergens (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.allergens}
                  onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Dairy, Nuts"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingItem(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
              >
                {editingItem ? 'Update' : 'Add'} Item
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

