'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit2, Trash2, Loader2, Save, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ReschedulingPolicy {
  policyId: string;
  policyName: string;
  serviceCategory: string;
  allowRescheduling: boolean;
  maxReschedulesAllowed: number;
  minHoursBeforeBooking: number;
  rescheduleWindowHours: number;
  chargeRescheduleFee: boolean;
  rescheduleFeeAmount?: number;
  rescheduleFeeType?: 'fixed' | 'percentage';
  refundOnReschedule: boolean;
  refundPercentage?: number;
  isActive: boolean;
  createdAt: string;
}

const SERVICE_CATEGORIES = [
  'Veterinary',
  'Grooming',
  'Training',
  'Walking',
  'Boarding',
  'Pet Cafe',
  'Insurance',
  'Pharmacy',
  'Adoption',
  'Sunset Services',
];

export function ReschedulingPolicyManager() {
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<ReschedulingPolicy[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<ReschedulingPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    policyName: '',
    serviceCategory: 'Veterinary',
    allowRescheduling: true,
    maxReschedulesAllowed: 2,
    minHoursBeforeBooking: 24,
    rescheduleWindowHours: 48,
    chargeRescheduleFee: false,
    rescheduleFeeAmount: 0,
    rescheduleFeeType: 'fixed' as 'fixed' | 'percentage',
    refundOnReschedule: true,
    refundPercentage: 100,
    isActive: true,
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/rescheduling-policies');
      setPolicies(data.policies || []);
    } catch (error) {
      console.error('Error loading policies:', error);
      alert('Failed to load rescheduling policies');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (policy?: ReschedulingPolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        policyName: policy.policyName,
        serviceCategory: policy.serviceCategory,
        allowRescheduling: policy.allowRescheduling,
        maxReschedulesAllowed: policy.maxReschedulesAllowed,
        minHoursBeforeBooking: policy.minHoursBeforeBooking,
        rescheduleWindowHours: policy.rescheduleWindowHours,
        chargeRescheduleFee: policy.chargeRescheduleFee,
        rescheduleFeeAmount: policy.rescheduleFeeAmount || 0,
        rescheduleFeeType: policy.rescheduleFeeType || 'fixed',
        refundOnReschedule: policy.refundOnReschedule,
        refundPercentage: policy.refundPercentage || 100,
        isActive: policy.isActive,
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        policyName: '',
        serviceCategory: 'Veterinary',
        allowRescheduling: true,
        maxReschedulesAllowed: 2,
        minHoursBeforeBooking: 24,
        rescheduleWindowHours: 48,
        chargeRescheduleFee: false,
        rescheduleFeeAmount: 0,
        rescheduleFeeType: 'fixed',
        refundOnReschedule: true,
        refundPercentage: 100,
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.policyName) {
      alert('Policy name is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        policyName: formData.policyName,
        serviceCategory: formData.serviceCategory,
        allowRescheduling: formData.allowRescheduling,
        maxReschedulesAllowed: formData.maxReschedulesAllowed,
        minHoursBeforeBooking: formData.minHoursBeforeBooking,
        rescheduleWindowHours: formData.rescheduleWindowHours,
        chargeRescheduleFee: formData.chargeRescheduleFee,
        rescheduleFeeAmount: formData.chargeRescheduleFee ? formData.rescheduleFeeAmount : undefined,
        rescheduleFeeType: formData.chargeRescheduleFee ? formData.rescheduleFeeType : undefined,
        refundOnReschedule: formData.refundOnReschedule,
        refundPercentage: formData.refundOnReschedule ? formData.refundPercentage : undefined,
        isActive: formData.isActive,
      };

      if (editingPolicy) {
        const data = await apiClient.put<any>(`/admin/rescheduling-policies/${editingPolicy.policyId}`, payload);
        if (data.success) {
          alert('Policy updated successfully');
          setShowModal(false);
          loadPolicies();
        } else {
          alert(data.error || 'Failed to update policy');
        }
      } else {
        const data = await apiClient.post<any>('/admin/rescheduling-policies', payload);
        if (data.success) {
          alert('Policy created successfully');
          setShowModal(false);
          loadPolicies();
        } else {
          alert(data.error || 'Failed to create policy');
        }
      }
    } catch (error) {
      console.error('Error saving policy:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm('Are you sure you want to delete this policy?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/rescheduling-policies/${policyId}`);
      if (data.success) {
        alert('Policy deleted successfully');
        loadPolicies();
      } else {
        alert(data.error || 'Failed to delete policy');
      }
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert('An error occurred while deleting');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0">
          <div className="p-0 bg-teal-100 rounded-xl">
            <Calendar className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rescheduling Policy Manager</h1>
            <p className="text-sm text-gray-600">Configure booking rescheduling rules</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-0 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Add Policy
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {policies.map((policy) => (
          <div key={policy.policyId} className="bg-white rounded-xl border-2 border-gray-200 p-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-0 mb-0">
                  <h3 className="font-semibold text-gray-900">{policy.policyName}</h3>
                  <span className="px-0 py-0 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                    {policy.serviceCategory}
                  </span>
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    policy.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {policy.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0">
                <button
                  onClick={() => handleOpenModal(policy)}
                  className="p-0 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => handleDelete(policy.policyId)}
                  className="p-0 hover:bg-red-100 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-0 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-0">Rescheduling</p>
                <p className="font-semibold text-gray-900">
                  {policy.allowRescheduling ? 'Allowed' : 'Not Allowed'}
                </p>
              </div>
              <div className="p-0 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-0">Max Reschedules</p>
                <p className="font-semibold text-gray-900">{policy.maxReschedulesAllowed}</p>
              </div>
              <div className="p-0 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-0">Min Hours Before</p>
                <p className="font-semibold text-gray-900">{policy.minHoursBeforeBooking}h</p>
              </div>
              <div className="p-0 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-0">Reschedule Window</p>
                <p className="font-semibold text-gray-900">{policy.rescheduleWindowHours}h</p>
              </div>
              <div className="p-0 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-0">Reschedule Fee</p>
                <p className="font-semibold text-gray-900">
                  {policy.chargeRescheduleFee
                    ? `${policy.rescheduleFeeType === 'percentage' ? '' : '₹'}${policy.rescheduleFeeAmount}${policy.rescheduleFeeType === 'percentage' ? '%' : ''}`
                    : 'Free'}
                </p>
              </div>
              <div className="p-0 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-0">Refund</p>
                <p className="font-semibold text-gray-900">
                  {policy.refundOnReschedule ? `${policy.refundPercentage}%` : 'No Refund'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPolicy ? 'Edit Policy' : 'Add Policy'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-0 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Policy Name *</label>
                  <input
                    type="text"
                    value={formData.policyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, policyName: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Standard Veterinary Policy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Service Category</label>
                  <select
                    value={formData.serviceCategory}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceCategory: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {SERVICE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-0">
                  <input
                    type="checkbox"
                    checked={formData.allowRescheduling}
                    onChange={(e) => setFormData(prev => ({ ...prev, allowRescheduling: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Allow Rescheduling</span>
                </label>
              </div>

              {formData.allowRescheduling && (
                <>
                  <div className="border-t pt-4">
                    <h3 className="font-medium text-gray-900 mb-0">Rescheduling Rules</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-0">Max Reschedules</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.maxReschedulesAllowed}
                          onChange={(e) => setFormData(prev => ({ ...prev, maxReschedulesAllowed: parseInt(e.target.value) }))}
                          className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-0">Min Hours Before</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.minHoursBeforeBooking}
                          onChange={(e) => setFormData(prev => ({ ...prev, minHoursBeforeBooking: parseInt(e.target.value) }))}
                          className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-0">Reschedule Window (Hours)</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.rescheduleWindowHours}
                          onChange={(e) => setFormData(prev => ({ ...prev, rescheduleWindowHours: parseInt(e.target.value) }))}
                          className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="mb-0">
                      <label className="flex items-center gap-0">
                        <input
                          type="checkbox"
                          checked={formData.chargeRescheduleFee}
                          onChange={(e) => setFormData(prev => ({ ...prev, chargeRescheduleFee: e.target.checked }))}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Charge Rescheduling Fee</span>
                      </label>
                    </div>
                    {formData.chargeRescheduleFee && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-0">Fee Amount</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.rescheduleFeeAmount}
                            onChange={(e) => setFormData(prev => ({ ...prev, rescheduleFeeAmount: parseFloat(e.target.value) }))}
                            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-0">Fee Type</label>
                          <select
                            value={formData.rescheduleFeeType}
                            onChange={(e) => setFormData(prev => ({ ...prev, rescheduleFeeType: e.target.value as 'fixed' | 'percentage' }))}
                            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                          >
                            <option value="fixed">Fixed Amount (₹)</option>
                            <option value="percentage">Percentage (%)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="mb-0">
                      <label className="flex items-center gap-0">
                        <input
                          type="checkbox"
                          checked={formData.refundOnReschedule}
                          onChange={(e) => setFormData(prev => ({ ...prev, refundOnReschedule: e.target.checked }))}
                          className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Refund on Reschedule</span>
                      </label>
                    </div>
                    {formData.refundOnReschedule && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-0">Refund Percentage (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.refundPercentage}
                          onChange={(e) => setFormData(prev => ({ ...prev, refundPercentage: parseInt(e.target.value) }))}
                          className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="border-t pt-4">
                <label className="flex items-center gap-0">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Policy</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingPolicy ? 'Update' : 'Create'} Policy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
