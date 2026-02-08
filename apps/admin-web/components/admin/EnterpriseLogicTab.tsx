'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2, Save, X, Users, IndianRupee } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface EnterpriseClient {
  clientId: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'trial';
  plan: 'basic' | 'premium' | 'enterprise';
  employeeCount: number;
  monthlyBudget: number;
  discountRate: number;
  features: string[];
  startDate: string;
  renewalDate: string;
  totalSpent: number;
  activeBookings: number;
}

const ENTERPRISE_FEATURES = [
  'Dedicated Account Manager',
  'Priority Support',
  'Custom Pricing',
  'Bulk Booking',
  'Advanced Analytics',
  'API Access',
  'White Label',
  'Custom Integrations',
  'SLA Guarantee',
  'Training & Onboarding',
];

const PLANS = [
  { id: 'basic', name: 'Basic', color: 'bg-blue-100 text-blue-700' },
  { id: 'premium', name: 'Premium', color: 'bg-purple-100 text-purple-700' },
  { id: 'enterprise', name: 'Enterprise', color: 'bg-orange-100 text-orange-700' },
];

export function EnterpriseLogicTab() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<EnterpriseClient[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<EnterpriseClient | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    plan: 'basic' as EnterpriseClient['plan'],
    employeeCount: 0,
    monthlyBudget: 0,
    discountRate: 0,
    features: [] as string[],
    status: 'active' as EnterpriseClient['status'],
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/enterprise/clients');
      setClients(data.clients || []);
    } catch (error) {
      console.error('Error loading enterprise clients:', error);
      alert('Failed to load enterprise clients');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (client?: EnterpriseClient) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        plan: client.plan,
        employeeCount: client.employeeCount,
        monthlyBudget: client.monthlyBudget,
        discountRate: client.discountRate,
        features: client.features,
        status: client.status,
      });
    } else {
      setEditingClient(null);
      setFormData({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        plan: 'basic',
        employeeCount: 0,
        monthlyBudget: 0,
        discountRate: 0,
        features: [],
        status: 'active',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.companyName || !formData.email) {
      alert('Company name and email are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        companyName: formData.companyName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        plan: formData.plan,
        employeeCount: formData.employeeCount,
        monthlyBudget: formData.monthlyBudget,
        discountRate: formData.discountRate,
        features: formData.features,
        status: formData.status,
      };

      if (editingClient) {
        const data = await apiClient.put<any>(`/admin/enterprise/clients/${editingClient.clientId}`, payload);
        if (data.success) {
          alert('Client updated successfully');
          setShowModal(false);
          loadClients();
        } else {
          alert(data.error || 'Failed to update client');
        }
      } else {
        const data = await apiClient.post<any>('/admin/enterprise/clients', payload);
        if (data.success) {
          alert('Client created successfully');
          setShowModal(false);
          loadClients();
        } else {
          alert(data.error || 'Failed to create client');
        }
      }
    } catch (error) {
      console.error('Error saving client:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this enterprise client?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/enterprise/clients/${clientId}`);
      if (data.success) {
        alert('Client deleted successfully');
        loadClients();
      } else {
        alert(data.error || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('An error occurred while deleting');
    }
  };

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const getStatusColor = (status: EnterpriseClient['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'inactive':
        return 'bg-gray-100 text-gray-700';
      case 'trial':
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getPlanConfig = (plan: EnterpriseClient['plan']) => {
    return PLANS.find(p => p.id === plan);
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
        <div className="flex items-center gap-3">
          <div className="p-0 bg-orange-100 rounded-xl">
            <Building2 className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Enterprise Clients</h2>
            <p className="text-sm text-gray-600">Manage corporate accounts and B2B clients</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-3 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {clients.map((client) => {
          const planConfig = getPlanConfig(client.plan);
          return (
            <div key={client.clientId} className="bg-white rounded-xl border-2 border-gray-200 p-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="p-0 bg-gradient-to-br from-orange-400 to-pink-400 rounded-xl">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-0">
                      <h3 className="font-semibold text-gray-900 text-lg">{client.companyName}</h3>
                      <span className={`px-0 py-0 text-xs font-medium rounded ${planConfig?.color}`}>
                        {planConfig?.name}
                      </span>
                      <span className={`px-0 py-0 text-xs font-medium rounded ${getStatusColor(client.status)}`}>
                        {client.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{client.contactPerson} • {client.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleOpenModal(client)}
                    className="p-0 hover:bg-gray-100 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.clientId)}
                    className="p-0 hover:bg-red-100 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="p-0 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-0">
                    <Users className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-600">Employees</p>
                  </div>
                  <p className="font-semibold text-gray-900">{client.employeeCount}</p>
                </div>
                <div className="p-0 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-0">
                    <IndianRupee className="w-4 h-4 text-gray-400" />
                    <p className="text-xs text-gray-600">Monthly Budget</p>
                  </div>
                  <p className="font-semibold text-gray-900">₹{client.monthlyBudget.toLocaleString()}</p>
                </div>
                <div className="p-0 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-0">Discount</p>
                  <p className="font-semibold text-gray-900">{client.discountRate}%</p>
                </div>
                <div className="p-0 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-0">Total Spent</p>
                  <p className="font-semibold text-gray-900">₹{client.totalSpent.toLocaleString()}</p>
                </div>
                <div className="p-0 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-0">Active Bookings</p>
                  <p className="font-semibold text-gray-900">{client.activeBookings}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {client.features.map(feature => (
                  <span key={feature} className="px-0 py-0 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                    {feature}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                <span>Started: {new Date(client.startDate).toLocaleDateString()}</span>
                <span>Renewal: {new Date(client.renewalDate).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingClient ? 'Edit Client' : 'Add Client'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-0">Company Name *</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Tech Corp Inc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="contact@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                    placeholder="+91-XXXXXXXXXX"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Plan</label>
                  <select
                    value={formData.plan}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, plan: e.target.value as any }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {PLANS.map(plan => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Employee Count</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.employeeCount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, employeeCount: parseInt(e.target.value) }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Monthly Budget (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.monthlyBudget}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, monthlyBudget: parseInt(e.target.value) }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Discount Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.discountRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, discountRate: parseFloat(e.target.value) }))}
                    className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Features</label>
                <div className="grid grid-cols-2 gap-3">
                  {ENTERPRISE_FEATURES.map(feature => (
                    <label
                      key={feature}
                      className="flex items-center gap-3 p-0 border-2 border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.features.includes(feature)}
                        onChange={() => toggleFeature(feature)}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingClient ? 'Update' : 'Create'} Client
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
