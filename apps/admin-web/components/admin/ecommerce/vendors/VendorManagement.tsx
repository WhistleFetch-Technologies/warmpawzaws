'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Store, Search, Filter, ChevronDown, Check, X, AlertCircle,
  Clock, Eye, Edit, Ban, Phone, Mail, MapPin, Star, Package,
  IndianRupee, TrendingUp, MoreVertical
} from 'lucide-react';

interface Vendor {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  role_id: string;
  role_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  gst_number?: string;
  pan_number?: string;
  address?: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  total_products: number;
  total_orders: number;
  total_revenue: number;
  commission_rate: number;
  rating: number;
  created_at: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Pending Approval' },
  approved: { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Approved' },
  rejected: { color: 'text-red-700', bg: 'bg-red-100', label: 'Rejected' },
  suspended: { color: 'text-slate-700', bg: 'bg-slate-100', label: 'Suspended' },
};

export default function VendorManagement() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadVendors();
  }, [filterStatus, filterRole]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterRole) params.append('role', filterRole);
      
      const result = await apiClient.get<any>(`/admin/vendors?${params.toString()}`);
      setVendors((result as any)?.vendors || []);
    } catch (err: any) {
      console.error('Error loading vendors:', err);
      setError(err.message || 'Failed to load vendors');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const updateVendorStatus = async (vendorId: string, status: string) => {
    try {
      setProcessing(true);
      await apiClient.post<any>(`/admin/vendors/${vendorId}/status`, { status });
      await loadVendors();
      if (selectedVendor?.id === vendorId) {
        setSelectedVendor(prev => prev ? { ...prev, status: status as any } : null);
      }
    } catch (err: any) {
      console.error('Error updating vendor status:', err);
      alert('Failed to update vendor status: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const updateCommissionRate = async (vendorId: string, rate: number) => {
    try {
      setProcessing(true);
      await apiClient.post<any>(`/admin/vendors/${vendorId}/commission`, { rate });
      await loadVendors();
    } catch (err: any) {
      console.error('Error updating commission rate:', err);
      alert('Failed to update commission rate: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => 
    vendor.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: vendors.length,
    pending: vendors.filter(v => v.status === 'pending').length,
    approved: vendors.filter(v => v.status === 'approved').length,
    suspended: vendors.filter(v => v.status === 'suspended').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Vendor Management</h1>
        <p className="text-slate-500">Manage marketplace vendors and their approvals</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-500">Total Vendors</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-slate-500">Pending Approval</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
              <p className="text-sm text-slate-500">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
              <p className="text-sm text-slate-500">Suspended</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendors by name, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">All Types</option>
          <option value="pet_products_store">Pet Products Store</option>
          <option value="pet_pharmacy">Pet Pharmacy</option>
          <option value="grooming_salon">Grooming Salon</option>
          <option value="pet_vet">Veterinary Clinic</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-300" />
          <p className="text-slate-600">{error}</p>
          <button onClick={loadVendors} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg">
            Retry
          </button>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Store className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500">No vendors found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600">Vendor</th>
                <th className="text-left p-4 font-semibold text-slate-600">Type</th>
                <th className="text-left p-4 font-semibold text-slate-600">Status</th>
                <th className="text-center p-4 font-semibold text-slate-600">Products</th>
                <th className="text-center p-4 font-semibold text-slate-600">Orders</th>
                <th className="text-right p-4 font-semibold text-slate-600">Revenue</th>
                <th className="text-center p-4 font-semibold text-slate-600">Commission</th>
                <th className="text-center p-4 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map(vendor => {
                const status = statusConfig[vendor.status] || statusConfig.pending;
                return (
                  <tr key={vendor.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center">
                          <Store className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{vendor.business_name}</p>
                          <p className="text-sm text-slate-500">{vendor.contact_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-slate-600">{vendor.role_name || vendor.role_id}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-slate-900 font-medium">{vendor.total_products || 0}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-slate-900 font-medium">{vendor.total_orders || 0}</span>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-slate-900 font-semibold">₹{vendor.total_revenue?.toLocaleString() || 0}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-slate-900 font-medium">{vendor.commission_rate || 10}%</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                        {vendor.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateVendorStatus(vendor.id, 'approved')}
                              disabled={processing}
                              className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                              title="Approve"
                            >
                              <Check className="w-4 h-4 text-emerald-600" />
                            </button>
                            <button
                              onClick={() => updateVendorStatus(vendor.id, 'rejected')}
                              disabled={processing}
                              className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        )}
                        {vendor.status === 'approved' && (
                          <button
                            onClick={() => updateVendorStatus(vendor.id, 'suspended')}
                            disabled={processing}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                            title="Suspend"
                          >
                            <Ban className="w-4 h-4 text-red-600" />
                          </button>
                        )}
                        {vendor.status === 'suspended' && (
                          <button
                            onClick={() => updateVendorStatus(vendor.id, 'approved')}
                            disabled={processing}
                            className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                            title="Reactivate"
                          >
                            <Check className="w-4 h-4 text-emerald-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendor Details Modal */}
      {showDetails && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
          <div className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Vendor Details</h2>
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Business Info */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center">
                  <Store className="w-8 h-8 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-slate-900">{selectedVendor.business_name}</h3>
                  <p className="text-slate-500">{selectedVendor.role_name}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${statusConfig[selectedVendor.status].bg} ${statusConfig[selectedVendor.status].color}`}>
                    {statusConfig[selectedVendor.status].label}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">Email</span>
                  </div>
                  <p className="font-medium text-slate-900">{selectedVendor.email}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">Phone</span>
                  </div>
                  <p className="font-medium text-slate-900">{selectedVendor.phone}</p>
                </div>
              </div>

              {/* Tax Info */}
              {(selectedVendor.gst_number || selectedVendor.pan_number) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedVendor.gst_number && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500 mb-1">GST Number</p>
                      <p className="font-medium text-slate-900">{selectedVendor.gst_number}</p>
                    </div>
                  )}
                  {selectedVendor.pan_number && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500 mb-1">PAN Number</p>
                      <p className="font-medium text-slate-900">{selectedVendor.pan_number}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Performance Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl text-center">
                  <Package className="w-6 h-6 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">{selectedVendor.total_products || 0}</p>
                  <p className="text-sm text-slate-500">Products</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl text-center">
                  <TrendingUp className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">{selectedVendor.total_orders || 0}</p>
                  <p className="text-sm text-slate-500">Orders</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl text-center">
                  <IndianRupee className="w-6 h-6 mx-auto text-orange-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">₹{(selectedVendor.total_revenue || 0).toLocaleString()}</p>
                  <p className="text-sm text-slate-500">Revenue</p>
                </div>
                <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl text-center">
                  <Star className="w-6 h-6 mx-auto text-amber-600 mb-2" />
                  <p className="text-2xl font-bold text-slate-900">{selectedVendor.rating || 0}</p>
                  <p className="text-sm text-slate-500">Rating</p>
                </div>
              </div>

              {/* Commission Rate */}
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-slate-900">Commission Rate</p>
                    <p className="text-sm text-slate-500">Platform commission on each sale</p>
                  </div>
                  <span className="text-2xl font-bold text-orange-600">{selectedVendor.commission_rate || 10}%</span>
                </div>
                <div className="flex gap-2">
                  {[5, 8, 10, 12, 15].map(rate => (
                    <button
                      key={rate}
                      onClick={() => updateCommissionRate(selectedVendor.id, rate)}
                      disabled={processing}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedVendor.commission_rate === rate
                          ? 'bg-orange-500 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                {selectedVendor.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateVendorStatus(selectedVendor.id, 'approved')}
                      disabled={processing}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl"
                    >
                      Approve Vendor
                    </button>
                    <button
                      onClick={() => updateVendorStatus(selectedVendor.id, 'rejected')}
                      disabled={processing}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold"
                    >
                      Reject Vendor
                    </button>
                  </>
                )}
                {selectedVendor.status === 'approved' && (
                  <button
                    onClick={() => updateVendorStatus(selectedVendor.id, 'suspended')}
                    disabled={processing}
                    className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-50"
                  >
                    Suspend Vendor
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
