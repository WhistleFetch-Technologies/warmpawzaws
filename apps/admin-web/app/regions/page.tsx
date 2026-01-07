'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useApiData, useCrud, useFormModal, useNotifications } from '@/hooks';
import { validateRequired } from '@/lib/utils';

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

interface RegionFormData {
  name: string;
  code: string;
  country: string;
  state: string;
  city: string;
  timezone: string;
  currency: string;
  service_radius_km: number;
  is_active: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RegionsPage() {
  // Reusable hooks for data management
  const { data: regions, loading, error: dataError, refetch } = useApiData<Region>({
    endpoint: '/admin/regions',
    dataKey: 'regions',
  });

  const notifications = useNotifications({ autoClearSuccess: true });
  const { error: crudError, success: crudSuccess, saving, deleting, create, update, remove } = useCrud<Region, RegionFormData>({
    endpoint: '/admin/regions',
    onSuccess: (message) => {
      notifications.setSuccess(message);
      refetch();
    },
    onError: (err) => {
      notifications.setError(err.message || 'Operation failed');
    },
  });

  const modal = useFormModal<RegionFormData, Region>({
    initialFormData: {
      name: '',
      code: '',
      country: 'India',
      state: '',
      city: '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      service_radius_km: 10,
      is_active: true,
    },
    getDefaultFormData: () => ({
      name: '',
      code: '',
      country: 'India',
      state: '',
      city: '',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      service_radius_km: 10,
      is_active: true,
    }),
    mapItemToFormData: (region) => ({
      name: region.name,
      code: region.code,
      country: region.country,
      state: region.state || '',
      city: region.city || '',
      timezone: region.timezone,
      currency: region.currency,
      service_radius_km: region.service_radius_km,
      is_active: region.is_active,
    }),
  });

  // Combine errors and success messages
  const error = dataError || crudError || notifications.error;
  const success = crudSuccess || notifications.success;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSave = async () => {
    // Validate required fields
    const validation = validateRequired(modal.formData, ['name', 'code']);
    if (!validation.isValid) {
      notifications.setError(Object.values(validation.errors)[0]);
      return;
    }

    if (modal.editingItem) {
      await update(modal.editingItem.id, modal.formData);
    } else {
      await create(modal.formData);
    }

    if (!crudError) {
      modal.closeModal();
    }
  };

  const handleDelete = async (region: Region) => {
    await remove(region);
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
              onClick={modal.openCreate}
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
              <button onClick={notifications.clearError} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={notifications.clearSuccess} className="text-green-400 hover:text-green-600">✕</button>
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
                            onClick={() => modal.openEdit(region)}
                            className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(region)}
                            disabled={deleting}
                            className="text-red-500 hover:text-red-600 text-sm font-medium disabled:opacity-50"
                          >
                            {deleting ? 'Deleting...' : 'Delete'}
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
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {modal.editingItem ? 'Edit Region' : 'Create Region'}
                </h3>
                <button onClick={modal.closeModal} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region Name *</label>
                  <input
                    type="text"
                    value={modal.formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., Bangalore"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Region Code *</label>
                  <input
                    type="text"
                    value={modal.formData.code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
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
                  value={modal.formData.country}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={modal.formData.state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={modal.formData.city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                  <select
                    value={modal.formData.timezone}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => modal.setFormData(prev => ({ ...prev, timezone: e.target.value }))}
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
                    value={modal.formData.currency}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => modal.setFormData(prev => ({ ...prev, currency: e.target.value }))}
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
                  value={modal.formData.service_radius_km}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, service_radius_km: Number(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  min="1"
                />
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modal.formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Region is active</span>
              </label>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={modal.closeModal}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : modal.editingItem ? 'Update Region' : 'Create Region'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

