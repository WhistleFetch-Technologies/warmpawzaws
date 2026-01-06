'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface Region {
  id: string;
  name: string;
  code: string;
  country: string;
  state?: string;
  city?: string;
  timezone: string;
  currency: string;
  is_active: boolean;
  service_radius_km: number;
  vendor_count: number;
  customer_count: number;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    country: 'India',
    state: '',
    city: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    service_radius_km: 10,
    is_active: true,
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<any>('/admin/regions');
      setRegions(response.regions || response || []);
    } catch (err: any) {
      console.error('Error loading regions:', err);
      setError(err.message || 'Failed to load regions');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCreate = () => {
    setEditingRegion(null);
    setFormData({
      name: '',
      code: '',
      country: 'India',
      state: '',
      city: '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      service_radius_km: 10,
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (region: Region) => {
    setEditingRegion(region);
    setFormData({
      name: region.name,
      code: region.code,
      country: region.country,
      state: region.state || '',
      city: region.city || '',
      timezone: region.timezone,
      currency: region.currency,
      service_radius_km: region.service_radius_km,
      is_active: region.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      setError('Please fill all required fields');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      if (editingRegion) {
        await apiClient.put(`/admin/regions/${editingRegion.id}`, formData);
        setSuccess('Region updated successfully');
      } else {
        await apiClient.post('/admin/regions', formData);
        setSuccess('Region created successfully');
      }
      
      setShowModal(false);
      setEditingRegion(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save region');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (regionId: string) => {
    if (!confirm('Are you sure you want to delete this region?')) return;
    
    try {
      await apiClient.delete(`/admin/regions/${regionId}`);
      setSuccess('Region deleted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete region');
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading regions...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Region Management</h1>
              <p className="text-gray-500">Manage service regions and coverage areas</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              + Add Region
            </button>
          </div>
        </header>

        <main className="p-8">
          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}

          {/* Regions Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Service Radius</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Vendors</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Customers</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {regions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">🌍</div>
                      <p>No regions configured</p>
                    </td>
                  </tr>
                ) : (
                  regions.map(region => (
                    <tr key={region.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{region.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-gray-600">{region.code}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {region.city && `${region.city}, `}
                        {region.state && `${region.state}, `}
                        {region.country}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{region.service_radius_km} km</td>
                      <td className="px-6 py-4 text-sm font-medium">{region.vendor_count}</td>
                      <td className="px-6 py-4 text-sm font-medium">{region.customer_count}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          region.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {region.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(region)}
                            className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(region.id)}
                            className="text-red-500 hover:text-red-600 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Region Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingRegion ? 'Edit Region' : 'Create Region'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., Bangalore"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none font-mono"
                    placeholder="BLR"
                    maxLength={3}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="AED">AED (د.إ)</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Radius (km)</label>
                <input
                  type="number"
                  value={formData.service_radius_km}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, service_radius_km: Number(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  min="1"
                />
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Region is active</span>
              </label>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingRegion ? 'Update Region' : 'Create Region'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

