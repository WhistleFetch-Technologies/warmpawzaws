'use client';

import { useState, useEffect } from 'react';
import { Plus, Coffee, Users, Calendar, Clock, MapPin, Edit, Trash2, Eye, EyeOff, Utensils, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface CafeVendorDashboardProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface Table {
  id?: string;
  number: string;
  capacity: number;
  location: string;
  isAvailable: boolean;
  description?: string;
}

interface MenuItem {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  imageUrl?: string;
}

export function CafeVendorDashboard({ vendorId, vendorData, onBack }: CafeVendorDashboardProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tables' | 'menu' | 'reservations'>('overview');
  const [showTableModal, setShowTableModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);

  const [tableForm, setTableForm] = useState<Table>({
    number: '',
    capacity: 2,
    location: 'indoor',
    isAvailable: true,
    description: '',
  });

  const [menuForm, setMenuForm] = useState<MenuItem>({
    name: '',
    description: '',
    price: 0,
    category: 'food',
    isAvailable: true,
    imageUrl: '',
  });

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTables(),
        loadMenuItems(),
        loadReservations(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/cafe/tables`);
      setTables(response.tables || response || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      setTables([]);
    }
  };

  const loadMenuItems = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/cafe/menu`);
      setMenuItems(response.menu || response.items || []);
    } catch (error) {
      console.error('Error loading menu:', error);
      setMenuItems([]);
    }
  };

  const loadReservations = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bookings?category=cafe`);
      setReservations(response.bookings || response || []);
    } catch (error) {
      console.error('Error loading reservations:', error);
      setReservations([]);
    }
  };

  const handleSaveTable = async () => {
    if (!tableForm.number || tableForm.capacity <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      if (editingTable?.id) {
        await apiClient.put<any>(`/vendor/${vendorId}/cafe/tables/${editingTable.id}`, tableForm);
        toast.success('Table updated successfully!');
      } else {
        await apiClient.post<any>(`/vendor/${vendorId}/cafe/tables`, tableForm);
        toast.success('Table added successfully!');
      }
      setShowTableModal(false);
      setEditingTable(null);
      resetTableForm();
      loadTables();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save table');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.description || menuForm.price <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      if (editingMenuItem?.id) {
        await apiClient.put<any>(`/vendor/${vendorId}/cafe/menu/${editingMenuItem.id}`, menuForm);
        toast.success('Menu item updated successfully!');
      } else {
        await apiClient.post<any>(`/vendor/${vendorId}/cafe/menu`, menuForm);
        toast.success('Menu item added successfully!');
      }
      setShowMenuModal(false);
      setEditingMenuItem(null);
      resetMenuForm();
      loadMenuItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save menu item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;

    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/cafe/tables/${tableId}`);
      toast.success('Table deleted successfully!');
      loadTables();
    } catch (error: any) {
      toast.error('Failed to delete table');
    }
  };

  const handleDeleteMenuItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/cafe/menu/${itemId}`);
      toast.success('Menu item deleted successfully!');
      loadMenuItems();
    } catch (error: any) {
      toast.error('Failed to delete menu item');
    }
  };

  const resetTableForm = () => {
    setTableForm({
      number: '',
      capacity: 2,
      location: 'indoor',
      isAvailable: true,
      description: '',
    });
  };

  const resetMenuForm = () => {
    setMenuForm({
      name: '',
      description: '',
      price: 0,
      category: 'food',
      isAvailable: true,
      imageUrl: '',
    });
  };

  const handleEditTable = (table: Table) => {
    setEditingTable(table);
    setTableForm(table);
    setShowTableModal(true);
  };

  const handleEditMenuItem = (item: MenuItem) => {
    setEditingMenuItem(item);
    setMenuForm(item);
    setShowMenuModal(true);
  };

  const stats = {
    totalTables: tables.length,
    availableTables: tables.filter(t => t.isAvailable).length,
    totalMenuItems: menuItems.length,
    activeMenuItems: menuItems.filter(m => m.isAvailable).length,
    todayReservations: reservations.filter(r => {
      const today = new Date().toISOString().split('T')[0];
      return r.bookingDate === today || r.scheduled_date === today;
    }).length,
    totalReservations: reservations.length,
  };

  if (loading && tables.length === 0 && menuItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pet Cafe Management</h1>
            <p className="text-gray-600 mt-1">Manage tables, menu, and reservations</p>
          </div>
          <div className="flex gap-3">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                ← Back
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tables</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTables}</p>
              </div>
              <Table className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Tables</p>
                <p className="text-2xl font-bold text-green-600">{stats.availableTables}</p>
              </div>
              <Coffee className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Menu Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMenuItems}</p>
              </div>
              <Utensils className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Reservations</p>
                <p className="text-2xl font-bold text-orange-600">{stats.todayReservations}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: 'overview', label: 'Overview', icon: Coffee },
            { id: 'tables', label: 'Tables', icon: Table },
            { id: 'menu', label: 'Menu', icon: Utensils },
            { id: 'reservations', label: 'Reservations', icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recent Reservations */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Reservations</h3>
                <div className="space-y-3">
                  {reservations.slice(0, 5).map((reservation) => (
                    <div key={reservation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Table {reservation.tableNumber || 'N/A'}</p>
                        <p className="text-sm text-gray-500">
                          {reservation.bookingDate || reservation.scheduled_date} at {reservation.bookingTime || reservation.scheduled_time}
                        </p>
                      </div>
                      <Badge variant="outline">{reservation.status || 'pending'}</Badge>
                    </div>
                  ))}
                  {reservations.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No reservations yet</p>
                  )}
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    onClick={() => { resetTableForm(); setEditingTable(null); setShowTableModal(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Table
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => { resetMenuForm(); setEditingMenuItem(null); setShowMenuModal(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Menu Item
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab('reservations')}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View All Reservations
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Tables Tab */}
        {activeTab === 'tables' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Manage Tables</h2>
              <Button
                onClick={() => { resetTableForm(); setEditingTable(null); setShowTableModal(true); }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Table
              </Button>
            </div>

            {tables.length === 0 ? (
              <Card className="p-12 text-center">
                <Table className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Tables Added</h3>
                <p className="text-gray-600 mb-4">Add your first table to get started</p>
                <Button onClick={() => { resetTableForm(); setShowTableModal(true); }} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Table
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.map((table) => (
                  <Card key={table.id || table.number} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">Table {table.number}</h3>
                        <p className="text-sm text-gray-500 capitalize">{table.location}</p>
                      </div>
                      {table.isAvailable ? (
                        <Badge className="bg-green-500">Available</Badge>
                      ) : (
                        <Badge variant="outline">Occupied</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <Users className="w-4 h-4" />
                      <span>Capacity: {table.capacity}</span>
                    </div>
                    {table.description && (
                      <p className="text-sm text-gray-600 mb-3">{table.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTable(table)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.id && handleDeleteTable(table.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Menu Tab */}
        {activeTab === 'menu' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Manage Menu</h2>
              <Button
                onClick={() => { resetMenuForm(); setEditingMenuItem(null); setShowMenuModal(true); }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Menu Item
              </Button>
            </div>

            {menuItems.length === 0 ? (
              <Card className="p-12 text-center">
                <Utensils className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Menu Items</h3>
                <p className="text-gray-600 mb-4">Add your first menu item</p>
                <Button onClick={() => { resetMenuForm(); setShowMenuModal(true); }} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Menu Item
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menuItems.map((item) => (
                  <Card key={item.id || item.name} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-500 capitalize">{item.category}</p>
                      </div>
                      {item.isAvailable ? (
                        <Badge className="bg-green-500">Available</Badge>
                      ) : (
                        <Badge variant="outline">Unavailable</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-orange-600">₹{item.price}</span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditMenuItem(item)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => item.id && handleDeleteMenuItem(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reservations Tab */}
        {activeTab === 'reservations' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Reservations</h2>
            {reservations.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Reservations</h3>
                <p className="text-gray-600">Reservations will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {reservations.map((reservation) => (
                  <Card key={reservation.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">Table {reservation.tableNumber || 'N/A'}</h3>
                          <Badge variant="outline">{reservation.status || 'pending'}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{reservation.bookingDate || reservation.scheduled_date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{reservation.bookingTime || reservation.scheduled_time}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>{reservation.guestCount || reservation.guests || 1} guests, {reservation.petCount || 1} pets</span>
                          </div>
                          {reservation.customerName && (
                            <div className="flex items-center gap-2">
                              <span>Customer: {reservation.customerName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table Modal */}
        {showTableModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingTable ? 'Edit Table' : 'Add New Table'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Table Number *</Label>
                    <Input
                      value={tableForm.number}
                      onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })}
                      placeholder="e.g., T1, T2"
                    />
                  </div>
                  <div>
                    <Label>Capacity *</Label>
                    <Input
                      type="number"
                      value={tableForm.capacity}
                      onChange={(e) => setTableForm({ ...tableForm, capacity: Number(e.target.value) })}
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <select
                      value={tableForm.location}
                      onChange={(e) => setTableForm({ ...tableForm, location: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="indoor">Indoor</option>
                      <option value="outdoor">Outdoor</option>
                      <option value="rooftop">Rooftop</option>
                    </select>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={tableForm.description}
                      onChange={(e) => setTableForm({ ...tableForm, description: e.target.value })}
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isAvailable"
                      checked={tableForm.isAvailable}
                      onChange={(e) => setTableForm({ ...tableForm, isAvailable: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="isAvailable">Available for booking</Label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowTableModal(false); resetTableForm(); setEditingTable(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={handleSaveTable}
                      disabled={loading}
                    >
                      {editingTable ? 'Update' : 'Add'} Table
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Menu Item Modal */}
        {showMenuModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingMenuItem ? 'Edit Menu Item' : 'Add Menu Item'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Item Name *</Label>
                    <Input
                      value={menuForm.name}
                      onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                      placeholder="e.g., Puppuccino, Doggy Burger"
                    />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={menuForm.description}
                      onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                      placeholder="Describe the item"
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Price (₹) *</Label>
                      <Input
                        type="number"
                        value={menuForm.price}
                        onChange={(e) => setMenuForm({ ...menuForm, price: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <select
                        value={menuForm.category}
                        onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="food">Food</option>
                        <option value="drink">Drink</option>
                        <option value="treat">Treat</option>
                        <option value="special">Special</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>Image URL (Optional)</Label>
                    <Input
                      value={menuForm.imageUrl}
                      onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="menuAvailable"
                      checked={menuForm.isAvailable}
                      onChange={(e) => setMenuForm({ ...menuForm, isAvailable: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="menuAvailable">Available</Label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowMenuModal(false); resetMenuForm(); setEditingMenuItem(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={handleSaveMenuItem}
                      disabled={loading}
                    >
                      {editingMenuItem ? 'Update' : 'Add'} Item
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
