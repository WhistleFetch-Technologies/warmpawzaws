'use client';
export const dynamic = 'force-dynamic';

import React from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useApiData, useCrud, useFormModal, useNotifications } from '@/hooks';
import { validateRequired } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface Tier {
  id: string;
  name: string;
  display_name: string;
  level: number;
  commission_rate: number;
  min_bookings: number;
  min_revenue: number;
  benefits: string[];
  requirements: string[];
  is_active: boolean;
  vendor_count: number;
  created_at: string;
}

interface TierFormData {
  name: string;
  display_name: string;
  level: number;
  commission_rate: number;
  min_bookings: number;
  min_revenue: number;
  benefits: string[];
  requirements: string[];
  is_active: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TiersPage() {
  const availableBenefits = [
    'Lower commission rate',
    'Priority support',
    'Featured listing',
    'Advanced analytics',
    'Custom branding',
    'API access',
    'Early access to features',
    'Dedicated account manager',
  ];

  // Reusable hooks
  const { data: tiers, loading, error: dataError, refetch } = useApiData<Tier>({
    endpoint: '/admin/tiers',
    dataKey: 'tiers',
  });

  const notifications = useNotifications({ autoClearSuccess: true });
  
  const { saving, error: crudError, success: crudSuccess, create, update } = useCrud<Tier, TierFormData>({
    endpoint: '/admin/tiers',
    onSuccess: (message) => {
      notifications.setSuccess(message);
      refetch();
    },
    onError: (err) => {
      notifications.setError(err.message || 'Operation failed');
    },
  });

  const modal = useFormModal<TierFormData, Tier>({
    initialFormData: {
      name: '',
      display_name: '',
      level: 1,
      commission_rate: 10,
      min_bookings: 0,
      min_revenue: 0,
      benefits: [],
      requirements: [],
      is_active: true,
    },
    getDefaultFormData: () => ({
      name: '',
      display_name: '',
      level: tiers.length + 1,
      commission_rate: 10,
      min_bookings: 0,
      min_revenue: 0,
      benefits: [],
      requirements: [],
      is_active: true,
    }),
    mapItemToFormData: (tier) => ({
      name: tier.name,
      display_name: tier.display_name,
      level: tier.level,
      commission_rate: tier.commission_rate,
      min_bookings: tier.min_bookings,
      min_revenue: tier.min_revenue,
      benefits: tier.benefits,
      requirements: tier.requirements,
      is_active: tier.is_active,
    }),
  });

  // Combine errors and success messages
  const error = dataError || crudError || notifications.error;
  const success = crudSuccess || notifications.success;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSave = async () => {
    const validation = validateRequired(modal.formData, ['name', 'display_name']);
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

  const toggleBenefit = (benefit: string) => {
    modal.setFormData(prev => ({
      ...prev,
      benefits: prev.benefits.includes(benefit)
        ? prev.benefits.filter(b => b !== benefit)
        : [...prev.benefits, benefit],
    }));
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
            <p className="mt-4 text-gray-600">Loading tiers...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const tierColors: Record<string, string> = {
    bronze: 'bg-amber-100 text-amber-700',
    silver: 'bg-gray-100 text-gray-700',
    gold: 'bg-yellow-100 text-yellow-700',
    platinum: 'bg-purple-100 text-purple-700',
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tier System Configuration</h1>
              <p className="text-gray-500">Manage vendor tier levels and benefits</p>
            </div>
            <button
              onClick={modal.openCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              + Add Tier
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

          {/* Tiers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tiers.map(tier => (
              <div key={tier.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                <div className="text-center mb-4">
                  <div className={`w-16 h-16 rounded-full ${tierColors[tier.name] || 'bg-gray-100'} flex items-center justify-center mx-auto mb-3`}>
                    <span className="text-2xl">
                      {tier.name === 'bronze' ? '🥉' :
                       tier.name === 'silver' ? '🥈' :
                       tier.name === 'gold' ? '🥇' : '💎'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{tier.display_name}</h3>
                  <p className="text-2xl font-bold text-orange-500 mt-2">{tier.commission_rate}%</p>
                  <p className="text-sm text-gray-500">Commission Rate</p>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Min Bookings:</span>
                    <span className="font-medium">{tier.min_bookings}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Min Revenue:</span>
                    <span className="font-medium">₹{tier.min_revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Vendors:</span>
                    <span className="font-medium">{tier.vendor_count}</span>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-2">Benefits:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {tier.benefits.slice(0, 3).map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-1">
                        <span className="text-green-500">✓</span> {benefit}
                      </li>
                    ))}
                    {tier.benefits.length > 3 && (
                      <li className="text-gray-400">+{tier.benefits.length - 3} more</li>
                    )}
                  </ul>
                </div>
                
                <button
                  onClick={() => modal.openEdit(tier)}
                  className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition"
                >
                  Edit Tier
                </button>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Tier Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {modal.editingItem ? 'Edit Tier' : 'Create Tier'}
                </h3>
                <button onClick={modal.closeModal} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tier Name (ID) *</label>
                  <input
                    type="text"
                    value={modal.formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase() }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={modal.formData.display_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., Gold"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level *</label>
                  <input
                    type="number"
                    value={modal.formData.level}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, level: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%) *</label>
                  <input
                    type="number"
                    value={modal.formData.commission_rate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Bookings</label>
                  <input
                    type="number"
                    value={modal.formData.min_bookings}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, min_bookings: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="0"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Revenue (₹)</label>
                <input
                  type="number"
                  value={modal.formData.min_revenue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, min_revenue: Number(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  min="0"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Benefits</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
                  {availableBenefits.map(benefit => (
                    <label key={benefit} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modal.formData.benefits.includes(benefit)}
                        onChange={() => toggleBenefit(benefit)}
                        className="rounded text-orange-500"
                      />
                      <span className="text-sm text-gray-700">{benefit}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={modal.formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Tier is active</span>
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
                {saving ? 'Saving...' : modal.editingItem ? 'Update Tier' : 'Create Tier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

