'use client';

import { useState, useEffect } from 'react';
import { Package, Stethoscope, Ambulance, Microscope, Plus, Edit2, Trash2, Search, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { Button } from '@/components/ui/button';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  minStock: number;
  price: number;
  unit: string;
}

interface VendorBusinessHubProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

export function VendorBusinessHub({ vendorId, vendorData, onBack }: VendorBusinessHubProps) {
  const isVet = vendorData?.roleId?.includes('vet') || vendorData?.serviceCategory === 'veterinary';
  const [activeTab, setActiveTab] = useState(isVet ? 'vet-services' : 'inventory');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', sku: '', category: '', quantity: 0, minStock: 5, price: 0, unit: 'pcs' });

  useEffect(() => {
    if (activeTab === 'inventory') {
      loadInventory();
    }
  }, [activeTab, vendorId]);

  const loadInventory = async () => {
    try {
      setInventoryLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/products`);
      setInventory((response.products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        category: p.category || '',
        quantity: p.stock_quantity || p.quantity || 0,
        minStock: p.min_stock || 5,
        price: p.price || 0,
        unit: p.unit || 'pcs',
      })));
    } catch (error) {
      console.error('Error loading inventory:', error);
      // Show demo data if API fails
      setInventory([
        { id: '1', name: 'Dog Food - Premium', sku: 'DF001', category: 'Food', quantity: 25, minStock: 10, price: 850, unit: 'kg' },
        { id: '2', name: 'Cat Treats', sku: 'CT001', category: 'Treats', quantity: 50, minStock: 20, price: 150, unit: 'pack' },
        { id: '3', name: 'Flea Shampoo', sku: 'FS001', category: 'Grooming', quantity: 8, minStock: 15, price: 450, unit: 'bottle' },
        { id: '4', name: 'Pet Vitamins', sku: 'PV001', category: 'Health', quantity: 30, minStock: 10, price: 320, unit: 'bottle' },
      ]);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.name || itemForm.quantity < 0 || itemForm.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const productData = {
        name: itemForm.name,
        sku: itemForm.sku,
        category: itemForm.category,
        stock_quantity: itemForm.quantity,
        min_stock: itemForm.minStock,
        price: itemForm.price,
        unit: itemForm.unit,
      };
      if (editingItem) {
        await apiClient.put<any>(`/vendor/${vendorId}/products/${editingItem.id}`, productData);
        setInventory(inventory.map(item => item.id === editingItem.id ? { ...item, ...itemForm } : item));
        toast.success('Item updated successfully');
      } else {
        const response = await apiClient.post<any>(`/vendor/${vendorId}/products`, productData);
        setInventory([...inventory, { ...itemForm, id: response.product?.id || response.id || Date.now().toString() }]);
        toast.success('Item added successfully');
      }
      setShowAddModal(false);
      setEditingItem(null);
      setItemForm({ name: '', sku: '', category: '', quantity: 0, minStock: 5, price: 0, unit: 'pcs' });
    } catch (error) {
      toast.error('Failed to save item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/products/${itemId}`);
      setInventory(inventory.filter(item => item.id !== itemId));
      toast.success('Item deleted');
    } catch (error) {
      toast.error('Failed to delete item');
    }
  };

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockItems = inventory.filter(item => item.quantity <= item.minStock);

  const closeItemModal = () => {
    setShowAddModal(false);
    setEditingItem(null);
    setItemForm({ name: '', sku: '', category: '', quantity: 0, minStock: 5, price: 0, unit: 'pcs' });
  };

  const inFormMode = showAddModal;

  const listTitle =
    isVet && activeTab === 'vet-services'
      ? 'Business Hub'
      : isVet && activeTab === 'inventory'
        ? 'Pharmacy'
        : 'Inventory';

  const listSubtitle =
    isVet && activeTab === 'vet-services'
      ? 'Manage vet services & equipment'
      : isVet && activeTab === 'inventory'
        ? 'Manage inventory & stock'
        : 'Manage inventory & store settings';

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column min-h-screen bg-white">
        <VendorHeader
          title={
            inFormMode
              ? editingItem
                ? 'Edit item'
                : 'Add item'
              : listTitle
          }
          subtitle={inFormMode ? 'Enter product details below' : listSubtitle}
          onBack={inFormMode ? closeItemModal : onBack}
          actions={
            inFormMode
              ? [
                  <Button
                    key="save-item"
                    type="button"
                    size="sm"
                    className="h-9 shrink-0 bg-orange-500 text-white hover:bg-orange-600"
                    onClick={handleSaveItem}
                  >
                    {editingItem ? 'Save' : 'Add'}
                  </Button>,
                ]
              : activeTab === 'inventory'
                ? [
                    <Button
                      key="add-inv"
                      type="button"
                      size="sm"
                      className="h-9 shrink-0 bg-orange-500 text-white hover:bg-orange-600"
                      onClick={() => {
                        setEditingItem(null);
                        setItemForm({ name: '', sku: '', category: '', quantity: 0, minStock: 5, price: 0, unit: 'pcs' });
                        setShowAddModal(true);
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add
                    </Button>,
                  ]
                : undefined
          }
        />

      <div className="px-4 py-4 sm:px-6">
        <div className="flex gap-3 mb-4">
          {isVet && (
            <button
              onClick={() => setActiveTab('vet-services')}
              className={`flex flex-1 items-center justify-center gap-3 rounded-lg px-4 py-2 font-medium ${
                activeTab === 'vet-services'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Services
            </button>
          )}
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-1 items-center justify-center gap-3 rounded-lg px-4 py-2 font-medium ${
              activeTab === 'inventory'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Package className="w-4 h-4" />
            {isVet ? 'Pharmacy' : 'Inventory'}
          </button>
        </div>

        {activeTab === 'vet-services' && isVet && (
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-0">
                <Stethoscope className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Consultation Services</h3>
                  <p className="text-sm text-gray-600">Manage consultation services</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-0">
                <Ambulance className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Ambulance Services</h3>
                  <p className="text-sm text-gray-600">Manage ambulance fleet</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-0">
                <Microscope className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">Diagnostics</h3>
                  <p className="text-sm text-gray-600">Manage diagnostic services</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="text-sm text-amber-800">
                  <strong>{lowStockItems.length} items</strong> are running low on stock
                </p>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-4 text-sm"
              />
            </div>

            {/* Inventory List */}
            {inventoryLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No items found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInventory.map(item => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{item.name}</h4>
                          {item.quantity <= item.minStock && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">Low Stock</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">SKU: {item.sku} • {item.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{item.quantity} {item.unit}</p>
                        <p className="text-sm text-gray-500">₹{item.price}/{item.unit}</p>
                      </div>
                      <div className="flex gap-1 ml-3">
                        <button
                          onClick={() => { setEditingItem(item); setItemForm({ ...item }); setShowAddModal(true); }}
                          className="p-2 text-gray-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-4">
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Item Name *"
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="SKU"
                        value={itemForm.sku}
                        onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Category"
                        value={itemForm.category}
                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={itemForm.quantity || ''}
                        onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                      <input
                        type="number"
                        placeholder="Min Stock"
                        value={itemForm.minStock || ''}
                        onChange={(e) => setItemForm({ ...itemForm, minStock: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Unit"
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <input
                      type="number"
                      placeholder="Price *"
                      value={itemForm.price || ''}
                      onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={closeItemModal}
                      className="w-full rounded-lg border border-gray-200 py-2 font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

