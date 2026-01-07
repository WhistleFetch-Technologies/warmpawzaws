'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Vendor {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  tier: string;
  created_at: string;
  role_name?: string;
}

export function AdminVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  useEffect(() => {
    loadVendors();
  }, [filter]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await apiClient.get<any>(`/admin/vendors${params}`);
      if (response.success) {
        setVendors(response.vendors || []);
      }
    } catch (err) {
      console.error('Error loading vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (vendorId: string) => {
    try {
      await apiClient.post(`/admin/vendors/${vendorId}/approve`, {});
      loadVendors();
      setSelectedVendor(null);
    } catch (err) {
      console.error('Error approving vendor:', err);
      alert('Failed to approve vendor');
    }
  };

  const handleReject = async (vendorId: string, reason: string) => {
    try {
      await apiClient.post(`/admin/vendors/${vendorId}/reject`, { reason });
      loadVendors();
      setSelectedVendor(null);
    } catch (err) {
      console.error('Error rejecting vendor:', err);
      alert('Failed to reject vendor');
    }
  };

  const handleRequestChanges = async (vendorId: string, comment: string) => {
    try {
      await apiClient.post(`/admin/vendors/${vendorId}/request-changes`, { comment });
      loadVendors();
      setSelectedVendor(null);
    } catch (err) {
      console.error('Error requesting changes:', err);
      alert('Failed to request changes');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'active': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'suspended': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Platinum': return 'bg-purple-100 text-purple-700';
      case 'Gold': return 'bg-yellow-100 text-yellow-700';
      case 'Silver': return 'bg-gray-200 text-gray-700';
      default: return 'bg-orange-100 text-orange-700';
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.business_name.toLowerCase().includes(search.toLowerCase()) ||
    v.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    v.phone.includes(search)
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1>
        <div className="flex gap-3">
          <input
            type="search"
            placeholder="Search vendors..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="px-4 py-2 border rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'All', value: vendors.length, filter: 'all', color: 'bg-gray-100' },
          { label: 'Pending', value: vendors.filter(v => (v.status as any) === 'pending').length, filter: 'pending', color: 'bg-yellow-100' },
          { label: 'Approved', value: vendors.filter(v => v.status === 'approved' || v.status === 'active').length, filter: 'approved', color: 'bg-green-100' },
          { label: 'Rejected', value: vendors.filter(v => v.status === 'rejected').length, filter: 'rejected', color: 'bg-red-100' },
          { label: 'Suspended', value: vendors.filter(v => v.status === 'suspended').length, filter: 'suspended', color: 'bg-gray-200' },
        ].map((stat) => (
          <button
            key={stat.filter}
            onClick={() => setFilter(stat.filter)}
            className={`p-4 rounded-xl text-left transition ${
              filter === stat.filter ? 'ring-2 ring-blue-500' : ''
            } ${stat.color}`}
          >
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Business</th>
                <th className="text-left p-4 font-medium text-gray-600">Contact</th>
                <th className="text-left p-4 font-medium text-gray-600">Location</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Tier</th>
                <th className="text-left p-4 font-medium text-gray-600">Joined</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredVendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-gray-900">{vendor.business_name}</p>
                      <p className="text-sm text-gray-500">{vendor.owner_name}</p>
                      {vendor.role_name && (
                        <span className="text-xs text-blue-600">{vendor.role_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-900">{vendor.phone}</p>
                    <p className="text-sm text-gray-500">{vendor.email}</p>
                  </td>
                  <td className="p-4 text-gray-600">{vendor.city}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(vendor.status)}`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getTierColor(vendor.tier)}`}>
                      {vendor.tier || 'Bronze'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(vendor.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedVendor(vendor)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendor Detail Modal */}
      {selectedVendor && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onRequestChanges={handleRequestChanges}
        />
      )}
    </div>
  );
}

function VendorDetailModal({
  vendor,
  onClose,
  onApprove,
  onReject,
  onRequestChanges,
}: {
  vendor: Vendor;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRequestChanges: (id: string, comment: string) => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | 'changes' | null>(null);
  const [comment, setComment] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Vendor Application Review</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-500">Business Name</label>
            <p className="font-medium">{vendor.business_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Owner Name</label>
            <p className="font-medium">{vendor.owner_name}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Phone</label>
            <p className="font-medium">{vendor.phone}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Email</label>
            <p className="font-medium">{vendor.email}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">City</label>
            <p className="font-medium">{vendor.city}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Status</label>
            <p className="font-medium">{vendor.status}</p>
          </div>
        </div>

        {(vendor.status as any) === 'pending' && (
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Take Action</h3>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setAction('approve')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  action === 'approve' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'
                }`}
              >
                ✓ Approve
              </button>
              <button
                onClick={() => setAction('changes')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  action === 'changes' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                ⟳ Request Changes
              </button>
              <button
                onClick={() => setAction('reject')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  action === 'reject' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                }`}
              >
                ✕ Reject
              </button>
            </div>

            {action === 'approve' && (
              <div className="space-y-4">
                <p className="text-gray-600">Are you sure you want to approve this vendor?</p>
                <button
                  onClick={() => onApprove(vendor.id)}
                  className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Confirm Approval
                </button>
              </div>
            )}

            {(action === 'changes' || action === 'reject') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {action === 'changes' ? 'What changes are needed?' : 'Rejection Reason'}
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={action === 'changes' ? 'Please provide details about required changes...' : 'Please provide a reason for rejection...'}
                    required
                  />
                </div>
                <button
                  onClick={() => {
                    if (!comment.trim()) {
                      alert('Please provide a comment');
                      return;
                    }
                    if (action === 'changes') {
                      onRequestChanges(vendor.id, comment);
                    } else {
                      onReject(vendor.id, comment);
                    }
                  }}
                  className={`w-full py-2 rounded-lg ${
                    action === 'changes' 
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {action === 'changes' ? 'Send Change Request' : 'Confirm Rejection'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

