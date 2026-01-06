'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Package {
  id: string;
  name: string;
  description: string;
  service_ids: string[];
  services: Array<{ id: string; name: string; price: number }>;
  total_price: number;
  package_price: number;
  discount_percentage: number;
  validity_days: number;
  max_uses: number;
  is_active: boolean;
  enrollments_count: number;
  created_at: string;
}

interface Enrollment {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  package_id: string;
  package_name: string;
  purchased_at: string;
  expires_at: string;
  uses_remaining: number;
  status: 'active' | 'expired' | 'completed';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableServices, setAvailableServices] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showEnrollmentsModal, setShowEnrollmentsModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    service_ids: [] as string[],
    package_price: 0,
    validity_days: 30,
    max_uses: 1,
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
      
      const [packagesRes, servicesRes] = await Promise.all([
        apiClient.get<any>('/vendor/packages'),
        apiClient.get<any>('/vendor/services'),
      ]);
      
      setPackages(packagesRes.packages || packagesRes || []);
      setAvailableServices(servicesRes.services || servicesRes || []);
    } catch (err: any) {
      console.error('Error loading packages:', err);
      setError(err.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const loadEnrollments = async (packageId: string) => {
    try {
      const response = await apiClient.get<any>(`/vendor/packages/${packageId}/enrollments`).catch(() => null);
      
      if (response?.enrollments) {
        setEnrollments(response.enrollments);
      } else {
        // Mock data
        setEnrollments([
          { id: 'e1', customer_id: 'c1', customer_name: 'Rajesh Kumar', customer_phone: '9876543210', package_id: packageId, package_name: 'Grooming Starter Pack', purchased_at: '2025-12-15', expires_at: '2026-03-15', uses_remaining: 2, status: 'active' },
          { id: 'e2', customer_id: 'c2', customer_name: 'Priya Sharma', customer_phone: '9876543211', package_id: packageId, package_name: 'Grooming Starter Pack', purchased_at: '2025-12-10', expires_at: '2026-03-10', uses_remaining: 0, status: 'completed' },
          { id: 'e3', customer_id: 'c3', customer_name: 'Amit Patel', customer_phone: '9876543212', package_id: packageId, package_name: 'Grooming Starter Pack', purchased_at: '2025-11-20', expires_at: '2026-02-20', uses_remaining: 0, status: 'expired' },
        ]);
      }
      
      setSelectedPackageId(packageId);
      setShowEnrollmentsModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load enrollments');
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCreatePackage = () => {
    setEditingPackage(null);
    setPackageForm({
      name: '',
      description: '',
      service_ids: [],
      package_price: 0,
      validity_days: 30,
      max_uses: 1,
      is_active: true,
    });
    setShowPackageModal(true);
  };

  const handleEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setPackageForm({
      name: pkg.name,
      description: pkg.description,
      service_ids: pkg.service_ids,
      package_price: pkg.package_price,
      validity_days: pkg.validity_days,
      max_uses: pkg.max_uses,
      is_active: pkg.is_active,
    });
    setShowPackageModal(true);
  };

  const handleSavePackage = async () => {
    if (!packageForm.name || packageForm.service_ids.length === 0) {
      setError('Please fill all required fields');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      if (editingPackage) {
        await apiClient.put(`/vendor/packages/${editingPackage.id}`, packageForm);
        setSuccess('Package updated successfully');
      } else {
        await apiClient.post('/vendor/packages', packageForm);
        setSuccess('Package created successfully');
      }
      
      setShowPackageModal(false);
      setEditingPackage(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    
    try {
      await apiClient.delete(`/vendor/packages/${packageId}`);
      setSuccess('Package deleted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete package');
    }
  };

  const toggleService = (serviceId: string) => {
    setPackageForm(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(serviceId)
        ? prev.service_ids.filter(id => id !== serviceId)
        : [...prev.service_ids, serviceId],
    }));
  };

  const calculateDiscount = () => {
    const selectedServices = availableServices.filter(s => packageForm.service_ids.includes(s.id));
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    if (totalPrice === 0) return { total: 0, discount: 0, percentage: 0 };
    const discount = totalPrice - packageForm.package_price;
    const percentage = Math.round((discount / totalPrice) * 100);
    return { total: totalPrice, discount, percentage };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading packages...</p>
        </div>
      </div>
    );
  }

  const discountCalc = calculateDiscount();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Packages</h1>
            <p className="text-gray-500">Create bundled service packages for customers</p>
          </div>
          <button
            onClick={handleCreatePackage}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
          >
            + Create Package
          </button>
        </div>

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

        {/* Packages Grid */}
        {packages.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 mb-4">No packages created yet</p>
            <button
              onClick={handleCreatePackage}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Create Your First Package
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map(pkg => (
              <div key={pkg.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{pkg.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Services included:</span>
                    <span className="font-medium">{pkg.services.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total value:</span>
                    <span className="line-through text-gray-400">₹{pkg.total_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Package price:</span>
                    <span className="font-bold text-orange-600">₹{pkg.package_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-green-600">{pkg.discount_percentage}% OFF</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Validity:</span>
                    <span className="font-medium">{pkg.validity_days} days</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Max uses:</span>
                    <span className="font-medium">{pkg.max_uses}</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Enrollments:</span>
                    <span className="font-semibold text-gray-900">{pkg.enrollments_count}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadEnrollments(pkg.id)}
                      className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                      View Enrollments
                    </button>
                    <button
                      onClick={() => handleEditPackage(pkg)}
                      className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingPackage ? 'Edit Package' : 'Create Package'}
                </h3>
                <button onClick={() => setShowPackageModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  value={packageForm.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPackageForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="e.g., Grooming Starter Pack"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={packageForm.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPackageForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                  placeholder="Describe what's included in this package"
                />
              </div>
              
              {/* Services Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Services *</label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
                  {availableServices.map(service => (
                    <label key={service.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={packageForm.service_ids.includes(service.id)}
                        onChange={() => toggleService(service.id)}
                        className="rounded text-orange-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{service.name}</p>
                        <p className="text-sm text-gray-500">₹{service.price.toLocaleString()}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Pricing */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Service Value:</span>
                  <span className="font-medium">₹{discountCalc.total.toLocaleString()}</span>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Price *</label>
                  <input
                    type="number"
                    value={packageForm.package_price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPackageForm(prev => ({ ...prev, package_price: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  />
                </div>
                {discountCalc.total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className={`font-medium ${discountCalc.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {discountCalc.percentage > 0 ? `${discountCalc.percentage}% OFF` : 'No discount'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validity (days) *</label>
                  <input
                    type="number"
                    value={packageForm.validity_days}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPackageForm(prev => ({ ...prev, validity_days: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses *</label>
                  <input
                    type="number"
                    value={packageForm.max_uses}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPackageForm(prev => ({ ...prev, max_uses: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="1"
                  />
                </div>
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={packageForm.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPackageForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Package is active and available for purchase</span>
              </label>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowPackageModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePackage}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingPackage ? 'Update Package' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrollments Modal */}
      {showEnrollmentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Package Enrollments</h3>
                <button onClick={() => setShowEnrollmentsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6">
              {enrollments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-gray-500">No enrollments yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {enrollments.map(enrollment => (
                    <div key={enrollment.id} className="border rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{enrollment.customer_name}</h4>
                          <p className="text-sm text-gray-500">{enrollment.customer_phone}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          enrollment.status === 'active' ? 'bg-green-100 text-green-700' :
                          enrollment.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {enrollment.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-gray-500">Purchased</p>
                          <p className="font-medium">{new Date(enrollment.purchased_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Expires</p>
                          <p className="font-medium">{new Date(enrollment.expires_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Uses Remaining</p>
                          <p className="font-medium">{enrollment.uses_remaining}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end rounded-b-2xl">
              <button
                onClick={() => setShowEnrollmentsModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

