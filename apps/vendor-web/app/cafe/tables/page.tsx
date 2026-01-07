'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, Edit2, Trash2, Users } from 'lucide-react';

interface CafeTable {
  id: string;
  table_number: string;
  capacity: number;
  location: string;
  status: 'available' | 'occupied' | 'reserved' | 'maintenance';
  current_reservation?: {
    customer_name: string;
    reservation_time: string;
    duration: number;
  };
}

export default function CafeTablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTable, setEditingTable] = useState<CafeTable | null>(null);
  const [formData, setFormData] = useState({
    table_number: '',
    capacity: '2',
    location: 'indoor',
  });

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(`/vendor/${vendorId}/cafe/tables`);
      if (response.success || response.tables) {
        setTables(response.tables || []);
      }
    } catch (error: any) {
      console.error('Error loading tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      if (editingTable) {
        await apiClient.put(`/vendor/${vendorId}/cafe/tables/${editingTable.id}`, formData);
      } else {
        await apiClient.post(`/vendor/${vendorId}/cafe/tables`, formData);
      }
      setShowAddModal(false);
      setEditingTable(null);
      resetForm();
      loadTables();
    } catch (error: any) {
      alert(error.message || 'Failed to save table');
    }
  };

  const handleDelete = async (tableId: string) => {
    if (!confirm('Are you sure you want to delete this table?')) return;
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.delete(`/vendor/${vendorId}/cafe/tables/${tableId}`);
      loadTables();
    } catch (error: any) {
      alert(error.message || 'Failed to delete table');
    }
  };

  const resetForm = () => {
    setFormData({
      table_number: '',
      capacity: '2',
      location: 'indoor',
    });
  };

  const openEditModal = (table: CafeTable) => {
    setEditingTable(table);
    setFormData({
      table_number: table.table_number,
      capacity: table.capacity.toString(),
      location: table.location,
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">🪑 Table Management</h1>
                <p className="text-sm text-gray-500">Manage your cafe tables and seating</p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingTable(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Plus className="w-5 h-5" />
              Add Table
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{tables.length}</div>
            <div className="text-sm text-gray-500">Total Tables</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-700">
              {tables.filter(t => t.status === 'available').length}
            </div>
            <div className="text-sm text-green-600">Available</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-700">
              {tables.filter(t => t.status === 'occupied').length}
            </div>
            <div className="text-sm text-blue-600">Occupied</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-700">
              {tables.filter(t => t.status === 'reserved').length}
            </div>
            <div className="text-sm text-yellow-600">Reserved</div>
          </div>
        </div>

        {/* Tables Grid */}
        {tables.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🪑</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tables yet</h3>
            <p className="text-gray-500 mb-4">Add your first table to start managing reservations</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Add First Table
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`bg-white rounded-xl p-6 shadow-sm border-2 transition ${
                  table.status === 'available'
                    ? 'border-green-200'
                    : table.status === 'occupied'
                    ? 'border-blue-200'
                    : table.status === 'reserved'
                    ? 'border-yellow-200'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Table {table.table_number}</h3>
                    <p className="text-sm text-gray-500 capitalize">{table.location}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      table.status === 'available'
                        ? 'bg-green-100 text-green-700'
                        : table.status === 'occupied'
                        ? 'bg-blue-100 text-blue-700'
                        : table.status === 'reserved'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {table.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-600 mb-4">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Capacity: {table.capacity} guests</span>
                </div>

                {table.current_reservation && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium text-gray-900">
                      {table.current_reservation.customer_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {table.current_reservation.reservation_time} ({table.current_reservation.duration} mins)
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(table)}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(table.id)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingTable ? 'Edit Table' : 'Add New Table'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Table Number
                </label>
                <input
                  type="text"
                  value={formData.table_number}
                  onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., T-01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Capacity
                </label>
                <select
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {[2, 4, 6, 8, 10].map((num) => (
                    <option key={num} value={num.toString()}>
                      {num} guests
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <select
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="terrace">Terrace</option>
                  <option value="private">Private Room</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingTable(null);
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
                {editingTable ? 'Update' : 'Add'} Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

