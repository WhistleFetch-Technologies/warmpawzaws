import React, { useState, useEffect } from 'react';
import { Coffee, Upload, Plus, Edit2, Trash2, Grid, Table, Download } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

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
  preparationTime?: number; // in minutes
}

interface MenuCategory {
  id: string;
  name: string;
  displayOrder: number;
  icon?: string;
}

interface TableConfig {
  id: string;
  tableNumber: string;
  capacity: number;
  location: string; // 'indoor', 'outdoor', 'terrace', etc.
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  petFriendly: boolean;
}

interface VendorCafeMenuManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
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
    location: 'indoor',
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
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/cafe/${vendorId}/menu`,
        {
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );
      const data = await response.json();
      if (data.success) {
        setMenuItems(data.items || []);
      }
    } catch (error) {
      console.error('Error loading menu items:', error);
    }
  };

  const loadTables = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/cafe/${vendorId}/tables`,
        {
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );
      const data = await response.json();
      if (data.success) {
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
    }
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `${getApiBaseUrl()}/vendor/cafe/${vendorId}/menu/${editingItem.id}`
        : `${getApiBaseUrl()}/vendor/cafe/${vendorId}/menu`;

      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: (getAuthHeaders().Authorization || "")
        },
        body: JSON.stringify({
          ...itemForm,
          price: parseFloat(itemForm.price),
          allergens: itemForm.allergens.split(',').map(a => a.trim()).filter(Boolean),
          preparationTime: itemForm.preparationTime ? parseInt(itemForm.preparationTime) : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
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
      }
    } catch (error) {
      console.error('Error saving menu item:', error);
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/cafe/${vendorId}/menu/${itemId}`,
        {
          method: 'DELETE',
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );

      const data = await response.json();
      if (data.success) {
        loadMenuItems();
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
    }
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTable
        ? `${getApiBaseUrl()}/vendor/cafe/${vendorId}/tables/${editingTable.id}`
        : `${getApiBaseUrl()}/vendor/cafe/${vendorId}/tables`;

      const method = editingTable ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: (getAuthHeaders().Authorization || "")
        },
        body: JSON.stringify({
          ...tableForm,
          capacity: parseInt(tableForm.capacity)
        })
      });

      const data = await response.json();
      if (data.success) {
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
      }
    } catch (error) {
      console.error('Error saving table:', error);
    }
  };

  const handleUpdateTableStatus = async (tableId: string, status: TableConfig['status']) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/cafe/${vendorId}/tables/${tableId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: (getAuthHeaders().Authorization || "")
          },
          body: JSON.stringify({ status })
        }
      );

      const data = await response.json();
      if (data.success) {
        loadTables();
      }
    } catch (error) {
      console.error('Error updating table status:', error);
    }
  };

  const handleBulkUploadMenu = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // In a real implementation, this would parse CSV/Excel and upload
    // For now, we'll just show the upload UI state
    setUploadingMenu(true);
    
    // Simulate upload
    setTimeout(() => {
      setUploadingMenu(false);
      alert('Menu uploaded successfully! (Demo mode)');
    }, 2000);
  };

  const downloadMenuTemplate = () => {
    // Create CSV template
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {onBack && (
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700 mb-4">
              ← Back to Dashboard
            </button>
          )}
          <h1 className="text-3xl text-gray-900 mb-2">Cafe Management</h1>
          <p className="text-gray-600">Manage your menu items and table configurations</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('menu')}
                className={`py-4 px-2 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'menu'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Coffee size={20} />
                Menu Management
              </button>
              <button
                onClick={() => setActiveTab('tables')}
                className={`py-4 px-2 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'tables'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Table size={20} />
                Table Management
              </button>
            </div>
          </div>

          {/* Menu Tab */}
          {activeTab === 'menu' && (
            <div className="p-6">
              {/* Menu Actions */}
              <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
                <div className="flex gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadMenuTemplate}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                  >
                    <Download size={20} />
                    Download Template
                  </button>
                  <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 cursor-pointer">
                    <Upload size={20} />
                    {uploadingMenu ? 'Uploading...' : 'Bulk Upload'}
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleBulkUploadMenu}
                      className="hidden"
                      disabled={uploadingMenu}
                    />
                  </label>
                  <button
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Add Item
                  </button>
                </div>
              </div>

              {/* Menu Items Grid */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading menu...</p>
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="text-center py-12">
                  <Coffee className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No menu items found</p>
                  <button
                    onClick={() => setShowAddItem(true)}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Your First Item
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredMenuItems.map((item) => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-48 object-cover" />
                      )}
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-gray-900">{item.name}</h3>
                          <span className="text-blue-600">₹{item.price}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {item.category}
                          </span>
                          {item.isVegetarian && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                              🥬 Veg
                            </span>
                          )}
                          {item.isPetFriendly && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                              🐾 Pet-Friendly
                            </span>
                          )}
                          {!item.isAvailable && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                              Unavailable
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
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
                            className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center justify-center gap-2 text-sm"
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center justify-center gap-2 text-sm"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
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
            <div className="p-6">
              {/* Table Actions */}
              <div className="flex justify-between mb-6">
                <div className="flex gap-4">
                  <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-sm text-gray-600">Available: </span>
                    <span className="text-green-700">{tables.filter(t => t.status === 'available').length}</span>
                  </div>
                  <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-gray-600">Occupied: </span>
                    <span className="text-red-700">{tables.filter(t => t.status === 'occupied').length}</span>
                  </div>
                  <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <span className="text-sm text-gray-600">Reserved: </span>
                    <span className="text-yellow-700">{tables.filter(t => t.status === 'reserved').length}</span>
                  </div>
                </div>
                <button
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Add Table
                </button>
              </div>

              {/* Tables Grid */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading tables...</p>
                </div>
              ) : tables.length === 0 ? (
                <div className="text-center py-12">
                  <Grid className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No tables configured</p>
                  <button
                    onClick={() => setShowAddTable(true)}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Your First Table
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {tables.map((table) => (
                    <div key={table.id} className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg text-gray-900">Table {table.tableNumber}</h3>
                          <p className="text-sm text-gray-600">
                            Capacity: {table.capacity} {table.capacity === 1 ? 'person' : 'people'}
                          </p>
                        </div>
                        <button
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
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>
                      <div className="mb-3">
                        <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(table.status)}`}>
                          {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3 text-xs">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {table.location.charAt(0).toUpperCase() + table.location.slice(1)}
                        </span>
                        {table.petFriendly && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                            🐾 Pet-Friendly
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {table.status === 'available' && (
                          <button
                            onClick={() => handleUpdateTableStatus(table.id, 'occupied')}
                            className="flex-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                          >
                            Mark Occupied
                          </button>
                        )}
                        {table.status === 'occupied' && (
                          <button
                            onClick={() => handleUpdateTableStatus(table.id, 'available')}
                            className="flex-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                          >
                            Mark Available
                          </button>
                        )}
                        {(table.status === 'available' || table.status === 'occupied') && (
                          <button
                            onClick={() => handleUpdateTableStatus(table.id, 'reserved')}
                            className="flex-1 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                          >
                            Reserve
                          </button>
                        )}
                        {table.status === 'reserved' && (
                          <button
                            onClick={() => handleUpdateTableStatus(table.id, 'available')}
                            className="flex-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Menu Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl text-gray-900 mb-4">
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </h2>
              <form onSubmit={handleSaveMenuItem} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Item Name *</label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Category *</label>
                    <select
                      required
                      value={itemForm.category}
                      onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Description *</label>
                    <textarea
                      required
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Preparation Time (mins)</label>
                    <input
                      type="number"
                      min="0"
                      value={itemForm.preparationTime}
                      onChange={(e) => setItemForm({ ...itemForm, preparationTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={itemForm.imageUrl}
                      onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Allergens (comma-separated)</label>
                    <input
                      type="text"
                      value={itemForm.allergens}
                      onChange={(e) => setItemForm({ ...itemForm, allergens: e.target.value })}
                      placeholder="dairy, nuts, gluten"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.isAvailable}
                      onChange={(e) => setItemForm({ ...itemForm, isAvailable: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Available</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.isVegetarian}
                      onChange={(e) => setItemForm({ ...itemForm, isVegetarian: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Vegetarian</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.isPetFriendly}
                      onChange={(e) => setItemForm({ ...itemForm, isPetFriendly: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Pet-Friendly</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddItem(false);
                      setEditingItem(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Table Modal */}
      {showAddTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-2xl text-gray-900 mb-4">
                {editingTable ? 'Edit Table' : 'Add Table'}
              </h2>
              <form onSubmit={handleSaveTable} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Table Number *</label>
                  <input
                    type="text"
                    required
                    value={tableForm.tableNumber}
                    onChange={(e) => setTableForm({ ...tableForm, tableNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Capacity *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Location *</label>
                  <select
                    required
                    value={tableForm.location}
                    onChange={(e) => setTableForm({ ...tableForm, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Pet-Friendly Table</span>
                  </label>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingTable ? 'Update Table' : 'Add Table'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTable(false);
                      setEditingTable(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}