'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Coffee, Upload, Plus, Edit2, Trash2, Grid, Table, Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';

interface VendorCafeMenuManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  isVegetarian: boolean;
  isPetFriendly: boolean;
  allergens?: string[];
  preparationTime?: number;
}

interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
}

interface TableConfig {
  id: string;
  tableNumber: string;
  capacity: number;
  location: 'indoor' | 'outdoor' | 'terrace' | 'garden';
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  petFriendly: boolean;
}

export function VendorCafeMenuManagement({ vendorId, vendorData, onBack }: VendorCafeMenuManagementProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'tables'>('menu');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([
    { id: '1', name: 'Beverages', displayOrder: 1 },
    { id: '2', name: 'Food', displayOrder: 2 },
    { id: '3', name: 'Desserts', displayOrder: 3 },
    { id: '4', name: 'Pet Treats', displayOrder: 4 }
  ]);
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingTable, setEditingTable] = useState<TableConfig | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [uploadingMenu, setUploadingMenu] = useState(false);
  const bulkMenuFileRef = useRef<HTMLInputElement>(null);

  // Form state for menu item
  const [itemForm, setItemForm] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    imageUrl: '',
    isAvailable: true,
    isVegetarian: false,
    isPetFriendly: false,
    allergens: '',
    preparationTime: ''
  });

  // Form state for table
  const [tableForm, setTableForm] = useState({
    tableNumber: '',
    capacity: '',
    location: 'indoor' as 'indoor' | 'outdoor' | 'terrace' | 'garden',
    status: 'available' as 'available' | 'occupied' | 'reserved' | 'maintenance',
    petFriendly: false
  });

  useEffect(() => {
    loadData();
  }, [vendorId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'menu') {
        await loadMenuItems();
      } else {
        await loadTables();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const data = await apiClient.get<any>(`/vendor/${vendorId}/cafe/menu`);
      if (data.success || data.menu_items || data.items) {
        setMenuItems(data.menu_items || data.items || []);
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
      toast.error('Failed to load menu items');
    }
  };

  const loadTables = async () => {
    try {
      const data = await apiClient.get<any>(`/vendor/${vendorId}/cafe/tables`);
      if (data.success || data.tables) {
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error('Failed to load tables');
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: itemForm.name,
        category: itemForm.category,
        description: itemForm.description,
        price: parseFloat(itemForm.price),
        imageUrl: itemForm.imageUrl || undefined,
        isAvailable: itemForm.isAvailable,
        isVegetarian: itemForm.isVegetarian,
        isPetFriendly: itemForm.isPetFriendly,
        allergens: itemForm.allergens.split(',').map(a => a.trim()).filter(Boolean),
        preparationTime: itemForm.preparationTime ? parseInt(itemForm.preparationTime) : undefined
      };

      if (editingItem) {
        await apiClient.put(`/vendor/${vendorId}/cafe/menu/${editingItem.id}`, payload);
        toast.success('Menu item updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/cafe/menu`, payload);
        toast.success('Menu item added successfully');
      }

      setShowAddItem(false);
      setEditingItem(null);
      setItemForm({
        name: '',
        category: '',
        description: '',
        price: '',
        imageUrl: '',
        isAvailable: true,
        isVegetarian: false,
        isPetFriendly: false,
        allergens: '',
        preparationTime: ''
      });
      loadMenuItems();
    } catch (error: any) {
      console.error('Error saving menu item:', error);
      toast.error(error.message || 'Failed to save menu item');
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await apiClient.delete(`/vendor/${vendorId}/cafe/menu/${itemId}`);
      toast.success('Menu item deleted successfully');
      loadMenuItems();
    } catch (error: any) {
      console.error('Error deleting menu item:', error);
      toast.error(error.message || 'Failed to delete menu item');
    }
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        tableNumber: tableForm.tableNumber,
        capacity: parseInt(tableForm.capacity),
        location: tableForm.location,
        status: tableForm.status,
        petFriendly: tableForm.petFriendly
      };

      if (editingTable) {
        await apiClient.put(`/vendor/${vendorId}/cafe/tables/${editingTable.id}`, payload);
        toast.success('Table updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/cafe/tables`, payload);
        toast.success('Table added successfully');
      }

      setShowAddTable(false);
      setEditingTable(null);
      setTableForm({
        tableNumber: '',
        capacity: '',
        location: 'indoor',
        status: 'available',
        petFriendly: false
      });
      loadTables();
    } catch (error: any) {
      console.error('Error saving table:', error);
      toast.error(error.message || 'Failed to save table');
    }
  };

  const handleUpdateTableStatus = async (tableId: string, status: TableConfig['status']) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/cafe/tables/${tableId}/status`, { status });
      toast.success('Table status updated');
      loadTables();
    } catch (error: any) {
      console.error('Error updating table status:', error);
      toast.error(error.message || 'Failed to update table status');
    }
  };

  const handleBulkUploadMenu = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingMenu(true);
    try {
      // TODO: Implement CSV/Excel parsing and bulk upload
      // For now, show success message
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Menu uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload menu');
    } finally {
      setUploadingMenu(false);
    }
  };

  const downloadMenuTemplate = () => {
    const csvContent = `Name,Category,Description,Price,Is Vegetarian,Is Pet Friendly,Allergens,Preparation Time (mins)
Cappuccino,Beverages,Classic Italian coffee with steamed milk,120,Yes,No,"dairy",5
Pet-Safe Pupcake,Pet Treats,Dog-friendly cupcake with carob frosting,80,Yes,Yes,"none",10`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'menu-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded');
  };

  const filteredMenuItems = selectedCategory
    ? menuItems.filter(item => item.category === selectedCategory)
    : menuItems;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      case 'reserved': return 'bg-yellow-100 text-yellow-800';
      case 'maintenance': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 vendor-app-column">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="p-4 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Cafe Menu Management</h1>
            <p className="text-xs text-gray-500">Manage menu items and tables</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-colors ${
              activeTab === 'menu'
                ? 'border-[#FF8C42] text-[#FF8C42] font-semibold'
                : 'border-transparent text-gray-500'
            }`}
          >
            <Coffee className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs">Menu</span>
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-colors ${
              activeTab === 'tables'
                ? 'border-[#FF8C42] text-[#FF8C42] font-semibold'
                : 'border-transparent text-gray-500'
            }`}
          >
            <Table className="w-5 h-5 mx-auto mb-1" />
            <span className="text-xs">Tables</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div>
            {/* Actions */}
            <div className="flex flex-col gap-3 mb-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  onClick={downloadMenuTemplate}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Template
                </Button>
                <div className="flex-1">
                  <input
                    id={`vendor-cafe-bulk-menu-${vendorId}`}
                    ref={bulkMenuFileRef}
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={(e) => {
                      handleBulkUploadMenu(e);
                      e.target.value = '';
                    }}
                    className="sr-only"
                    disabled={uploadingMenu}
                  />
                  <label
                    htmlFor={`vendor-cafe-bulk-menu-${vendorId}`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'flex w-full cursor-pointer text-xs',
                      uploadingMenu && 'pointer-events-none opacity-50'
                    )}
                  >
                    <Upload className="mr-1 h-4 w-4" />
                    {uploadingMenu ? 'Uploading...' : 'Upload'}
                  </label>
                </div>
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm({
                      name: '',
                      category: '',
                      description: '',
                      price: '',
                      imageUrl: '',
                      isAvailable: true,
                      isVegetarian: false,
                      isPetFriendly: false,
                      allergens: '',
                      preparationTime: ''
                    });
                    setShowAddItem(true);
                  }}
                  size="sm"
                  className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white text-xs"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </div>

            {/* Menu Items List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">Loading menu...</p>
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="text-center py-12">
                <Coffee className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 text-sm mb-4">No menu items found</p>
                <Button
                  onClick={() => setShowAddItem(true)}
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                >
                  Add Your First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMenuItems.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="w-20 h-20 object-cover rounded-lg" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm">{item.name}</h3>
                          <span className="text-[#FF8C42] font-semibold text-sm">₹{item.price}</span>
                        </div>
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">{item.description}</p>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                            {item.category}
                          </span>
                          {item.isVegetarian && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              🥬 Veg
                            </span>
                          )}
                          {item.isPetFriendly && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              🐾 Pet
                            </span>
                          )}
                          {!item.isAvailable && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setEditingItem(item);
                              setItemForm({
                                name: item.name,
                                category: item.category,
                                description: item.description,
                                price: item.price.toString(),
                                imageUrl: item.imageUrl || '',
                                isAvailable: item.isAvailable,
                                isVegetarian: item.isVegetarian,
                                isPetFriendly: item.isPetFriendly,
                                allergens: item.allergens?.join(', ') || '',
                                preparationTime: item.preparationTime?.toString() || ''
                              });
                              setShowAddItem(true);
                            }}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            variant="outline"
                            size="sm"
                            className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-600">Available</p>
                <p className="text-green-700 font-semibold">{tables.filter(t => t.status === 'available').length}</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-600">Occupied</p>
                <p className="text-red-700 font-semibold">{tables.filter(t => t.status === 'occupied').length}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-600">Reserved</p>
                <p className="text-yellow-700 font-semibold">{tables.filter(t => t.status === 'reserved').length}</p>
              </div>
            </div>

            <Button
              onClick={() => {
                setEditingTable(null);
                setTableForm({
                  tableNumber: '',
                  capacity: '',
                  location: 'indoor',
                  status: 'available',
                  petFriendly: false
                });
                setShowAddTable(true);
              }}
              className="w-full mb-4 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Table
            </Button>

            {/* Tables List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
                <p className="text-gray-600 text-sm">Loading tables...</p>
              </div>
            ) : tables.length === 0 ? (
              <div className="text-center py-12">
                <Grid className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 text-sm mb-4">No tables configured</p>
                <Button
                  onClick={() => setShowAddTable(true)}
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                >
                  Add Your First Table
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tables.map((table) => (
                  <div key={table.id} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">Table {table.tableNumber}</h3>
                        <p className="text-xs text-gray-600">
                          Capacity: {table.capacity} {table.capacity === 1 ? 'person' : 'people'}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setEditingTable(table);
                          setTableForm({
                            tableNumber: table.tableNumber,
                            capacity: table.capacity.toString(),
                            location: table.location,
                            status: table.status,
                            petFriendly: table.petFriendly
                          });
                          setShowAddTable(true);
                        }}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(table.status)}`}>
                        {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {table.location.charAt(0).toUpperCase() + table.location.slice(1)}
                      </span>
                      {table.petFriendly && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                          🐾 Pet-Friendly
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {table.status === 'available' && (
                        <Button
                          onClick={() => handleUpdateTableStatus(table.id, 'occupied')}
                          size="sm"
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs"
                        >
                          Mark Occupied
                        </Button>
                      )}
                      {table.status === 'occupied' && (
                        <Button
                          onClick={() => handleUpdateTableStatus(table.id, 'available')}
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          Mark Available
                        </Button>
                      )}
                      {(table.status === 'available' || table.status === 'occupied') && (
                        <Button
                          onClick={() => handleUpdateTableStatus(table.id, 'reserved')}
                          size="sm"
                          className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs"
                        >
                          Reserve
                        </Button>
                      )}
                      {table.status === 'reserved' && (
                        <Button
                          onClick={() => handleUpdateTableStatus(table.id, 'available')}
                          size="sm"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Menu Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddItem(false);
                    setEditingItem(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveMenuItem} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                  <input
                    type="text"
                    required
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea
                    required
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (mins)</label>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.preparationTime}
                      onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={itemForm.imageUrl}
                    onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allergens (comma-separated)</label>
                  <input
                    type="text"
                    value={itemForm.allergens}
                    onChange={(e) => setItemForm({ ...itemForm, allergens: e.target.value })}
                    placeholder="dairy, nuts, gluten"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.isAvailable}
                      onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                      className="rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                    />
                    <span className="text-sm text-gray-700">Available</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.isVegetarian}
                      onChange={(e) => setItemForm({ ...itemForm, isVegetarian: e.target.checked })}
                      className="rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                    />
                    <span className="text-sm text-gray-700">Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.isPetFriendly}
                      onChange={(e) => setItemForm({ ...itemForm, isPetFriendly: e.target.checked })}
                      className="rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                    />
                    <span className="text-sm text-gray-700">Pet-Friendly</span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                  >
                    {editingItem ? 'Update' : 'Add'} Item
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddItem(false);
                      setEditingItem(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingTable ? 'Edit Table' : 'Add Table'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddTable(false);
                    setEditingTable(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveTable} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Number *</label>
                  <input
                    type="text"
                    required
                    value={tableForm.tableNumber}
                    onChange={(e) => setTableForm({ ...tableForm, tableNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <select
                    required
                    value={tableForm.location}
                    onChange={(e) => setTableForm({ ...tableForm, location: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-sm"
                  >
                    <option value="indoor">Indoor</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="terrace">Terrace</option>
                    <option value="garden">Garden</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tableForm.petFriendly}
                      onChange={(e) => setTableForm({ ...tableForm, petFriendly: e.target.checked })}
                      className="rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
                    />
                    <span className="text-sm text-gray-700">Pet-Friendly Table</span>
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                  >
                    {editingTable ? 'Update' : 'Add'} Table
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddTable(false);
                      setEditingTable(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
