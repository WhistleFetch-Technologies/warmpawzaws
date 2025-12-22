/**
 * VENDOR TABLE MANAGEMENT
 * 
 * Manages tables for pet cafes with:
 * - Table configuration and layout
 * - Table availability and status
 * - Capacity management
 * - Booking integration
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Grid, 
  Table as TableIcon,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { authenticatedFetch } from '../../utils/session-manager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';

interface VendorTableManagementProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface Table {
  id: string;
  tableNumber: string;
  capacity: number;
  location: 'indoor' | 'outdoor' | 'terrace' | 'private';
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  petFriendly: boolean;
  currentBookingId?: string;
  currentBookingTime?: string;
  amenities?: string[];
  description?: string;
}

interface Booking {
  id: string;
  bookingId: string;
  tableId: string;
  tableNumber: string;
  customerName: string;
  petName: string;
  guestCount: number;
  petCount: number;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  status: string;
}

const LOCATIONS = ['indoor', 'outdoor', 'terrace', 'private'];
const STATUSES = ['available', 'occupied', 'reserved', 'maintenance'];

export function VendorTableManagement({ 
  vendorId, 
  vendorData, 
  onBack 
}: VendorTableManagementProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [activeView, setActiveView] = useState<'tables' | 'bookings' | 'layout'>('tables');

  // Form state
  const [formData, setFormData] = useState({
    tableNumber: '',
    capacity: '2',
    location: 'indoor' as 'indoor' | 'outdoor' | 'terrace' | 'private',
    status: 'available' as 'available' | 'occupied' | 'reserved' | 'maintenance',
    petFriendly: true,
    description: '',
    amenities: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch tables
      const tablesResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cafe/tables/${vendorId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (tablesResponse.ok) {
        const data = await tablesResponse.json();
        setTables(data.tables || data.data?.tables || []);
      }

      // Fetch bookings
      if (activeView === 'bookings') {
        await fetchBookings();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/bookings?serviceType=cafe`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || data.data?.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tableNumber || !formData.capacity) {
      toast.error('Table number and capacity are required');
      return;
    }

    try {
      const tableData = {
        vendorId,
        tableNumber: formData.tableNumber,
        capacity: parseInt(formData.capacity),
        location: formData.location,
        status: formData.status,
        petFriendly: formData.petFriendly,
        description: formData.description,
        amenities: formData.amenities
      };

      const url = editingTable
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/cafe/${vendorId}/tables/${editingTable.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cafe/tables`;

      const response = await authenticatedFetch(url, {
        method: editingTable ? 'PUT' : 'POST',
        body: JSON.stringify(tableData)
      });

      if (response.ok) {
        toast.success(editingTable ? 'Table updated successfully' : 'Table added successfully');
        setShowAddModal(false);
        setEditingTable(null);
        resetForm();
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save table');
      }
    } catch (error: any) {
      console.error('Error saving table:', error);
      toast.error(error.message || 'Failed to save table');
    }
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;

    try {
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/cafe/tables/${tableId}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        toast.success('Table deleted successfully');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete table');
      }
    } catch (error: any) {
      console.error('Error deleting table:', error);
      toast.error('Failed to delete table');
    }
  };

  const handleStatusChange = async (tableId: string, newStatus: string) => {
    try {
      const response = await authenticatedFetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/cafe/${vendorId}/tables/${tableId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.ok) {
        toast.success('Table status updated');
        fetchData();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      tableNumber: '',
      capacity: '2',
      location: 'indoor',
      status: 'available',
      petFriendly: true,
      description: '',
      amenities: []
    });
  };

  const handleEdit = (table: Table) => {
    setEditingTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      capacity: table.capacity.toString(),
      location: table.location,
      status: table.status,
      petFriendly: table.petFriendly,
      description: table.description || '',
      amenities: table.amenities || []
    });
    setShowAddModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700 border-green-200';
      case 'occupied': return 'bg-red-100 text-red-700 border-red-200';
      case 'reserved': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'maintenance': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getLocationIcon = (location: string) => {
    switch (location) {
      case 'indoor': return '🏠';
      case 'outdoor': return '🌳';
      case 'terrace': return '🏢';
      case 'private': return '🔒';
      default: return '📍';
    }
  };

  useEffect(() => {
    if (activeView === 'bookings') {
      fetchBookings();
    }
  }, [activeView]);

  if (loading && tables.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tables...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Table Management</h1>
            <p className="text-xs text-gray-500">
              {tables.filter(t => t.status === 'available').length} available • {tables.filter(t => t.status === 'occupied').length} occupied
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['tables', 'bookings', 'layout'].map(view => (
            <button
              key={view}
              onClick={() => setActiveView(view as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === view
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeView === 'tables' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Tables</h2>
              <Button
                onClick={() => {
                  resetForm();
                  setEditingTable(null);
                  setShowAddModal(true);
                }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Table
              </Button>
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <TableIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No tables configured yet</p>
                <Button
                  onClick={() => {
                    resetForm();
                    setShowAddModal(true);
                  }}
                  variant="outline"
                >
                  Add First Table
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {tables.map(table => (
                  <div key={table.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                            <TableIcon className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">Table {table.tableNumber}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getStatusColor(table.status)}>
                                {table.status}
                              </Badge>
                              <span className="text-sm text-gray-500">
                                {getLocationIcon(table.location)} {table.location}
                              </span>
                              {table.petFriendly && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                  Pet Friendly
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-gray-500">Capacity</p>
                            <p className="font-medium flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {table.capacity} guests
                            </p>
                          </div>
                          {table.currentBookingId && (
                            <div>
                              <p className="text-xs text-gray-500">Current Booking</p>
                              <p className="font-medium text-sm">{table.currentBookingTime}</p>
                            </div>
                          )}
                        </div>

                        {table.description && (
                          <p className="text-sm text-gray-600 mt-2">{table.description}</p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <select
                          value={table.status}
                          onChange={(e) => handleStatusChange(table.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                        >
                          {STATUSES.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(table)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(table.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'bookings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Table Bookings</h2>
            
            {bookings.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No table bookings yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map(booking => (
                  <div key={booking.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{booking.customerName}</h3>
                          <Badge variant="outline" className="text-xs">
                            Table {booking.tableNumber}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{booking.petName}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {booking.guestCount} guests, {booking.petCount} pets
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(booking.scheduledDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {booking.scheduledTime}
                          </span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeView === 'layout' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Table Layout</h2>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="grid grid-cols-4 gap-4">
                {tables.map(table => (
                  <div
                    key={table.id}
                    className={`p-4 rounded-lg border-2 text-center transition-all ${
                      table.status === 'available'
                        ? 'border-green-300 bg-green-50'
                        : table.status === 'occupied'
                        ? 'border-red-300 bg-red-50'
                        : table.status === 'reserved'
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <TableIcon className={`w-8 h-8 mx-auto mb-2 ${
                      table.status === 'available' ? 'text-green-600' :
                      table.status === 'occupied' ? 'text-red-600' :
                      table.status === 'reserved' ? 'text-yellow-600' :
                      'text-gray-600'
                    }`} />
                    <p className="font-semibold text-sm">Table {table.tableNumber}</p>
                    <p className="text-xs text-gray-500">{table.capacity} guests</p>
                    <p className="text-xs text-gray-500">{getLocationIcon(table.location)}</p>
                  </div>
                ))}
              </div>
              
              {tables.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No tables to display</p>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowAddModal(true);
                    }}
                    variant="outline"
                    className="mt-4"
                  >
                    Add Tables
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Table Modal */}
      {showAddModal && (
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingTable ? 'Edit Table' : 'Add Table'}</DialogTitle>
              <DialogDescription>
                Configure table details for your cafe. Tables can be booked by customers.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Table Number *</label>
                  <Input
                    value={formData.tableNumber}
                    onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                    required
                    placeholder="e.g., T1, T2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Capacity *</label>
                  <Input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    required
                    min="1"
                    max="20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Location *</label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>
                      {loc.charAt(0).toUpperCase() + loc.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {STATUSES.map(status => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="petFriendly"
                  checked={formData.petFriendly}
                  onChange={(e) => setFormData({ ...formData, petFriendly: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="petFriendly" className="text-sm">Pet Friendly</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional description..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTable(null);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingTable ? 'Update' : 'Add'} Table
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

