'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { apiClient } from '@/lib/api-client';

interface Seller {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string;
  email: string;
  city: string;
  seller_status: 'not_applied' | 'pending' | 'approved' | 'rejected';
  role_name?: string;
  created_at: string;
  seller_approved_at?: string;
  seller_rejection_reason?: string;
}

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadSellers();
  }, [filter]);

  const loadSellers = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await apiClient.get<any>(`/admin/vendors/sellers${params}`);
      if (response.success) {
        setSellers(response.sellers || []);
      }
    } catch (err) {
      console.error('Error loading sellers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveSeller = async (vendorId: string) => {
    if (!confirm('Are you sure you want to approve this seller?')) {
      return;
    }

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/approve-seller`, {});
      alert('Seller approved successfully!');
      loadSellers();
      setSelectedSeller(null);
    } catch (err: any) {
      console.error('Error approving seller:', err);
      alert(err.message || 'Failed to approve seller');
    }
  };

  const handleRejectSeller = async (vendorId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    if (!confirm('Are you sure you want to reject this seller?')) {
      return;
    }

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/reject-seller`, { reason: rejectReason });
      alert('Seller rejected');
      loadSellers();
      setSelectedSeller(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('Error rejecting seller:', err);
      alert(err.message || 'Failed to reject seller');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredSellers = sellers.filter(s => 
    s.business_name.toLowerCase().includes(search.toLowerCase()) ||
    s.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  );

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                {/* ✅ FIX: Match wireframe - text-2xl font-bold text-gray-900 */}
                <h1 className="text-2xl font-bold text-gray-900">Seller Approval</h1>
                <p className="text-sm text-gray-500 mt-1">Manage e-commerce product seller approvals</p>
              </div>
              <input
                type="search"
                placeholder="Search sellers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </header>

        {/* Main Content - Match wireframe: max-w-7xl mx-auto p-6 or p-8 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'All', value: sellers.length, filter: 'all' as const, color: 'bg-gray-100' },
          { label: 'Pending', value: sellers.filter(s => s.seller_status === 'pending').length, filter: 'pending' as const, color: 'bg-yellow-100' },
          { label: 'Approved', value: sellers.filter(s => s.seller_status === 'approved').length, filter: 'approved' as const, color: 'bg-green-100' },
          { label: 'Rejected', value: sellers.filter(s => s.seller_status === 'rejected').length, filter: 'rejected' as const, color: 'bg-red-100' },
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
                <th className="text-left p-4 font-medium text-gray-600">Seller Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Role</th>
                <th className="text-left p-4 font-medium text-gray-600">Joined</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSellers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No sellers found
                  </td>
                </tr>
              ) : (
                filteredSellers.map((seller) => (
                  <tr key={seller.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-900">{seller.business_name}</p>
                        <p className="text-sm text-gray-500">{seller.owner_name}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-gray-900">{seller.phone}</p>
                      <p className="text-sm text-gray-500">{seller.email}</p>
                    </td>
                    <td className="p-4 text-gray-600">{seller.city}</td>
                    <td className="p-4">
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(seller.seller_status)}`}>
                        {seller.seller_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-blue-600">{seller.role_name || 'N/A'}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(seller.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      {seller.seller_status === 'pending' && (
                        <button
                          onClick={() => setSelectedSeller(seller)}
                          className="px-4 py-2 text-sm bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        >
                          Review
                        </button>
                      )}
                      {seller.seller_status === 'approved' && seller.seller_approved_at && (
                        <span className="text-xs text-gray-500">
                          Approved {new Date(seller.seller_approved_at).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Seller Detail Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Seller Application Review</h2>
              <button 
                onClick={() => {
                  setSelectedSeller(null);
                  setRejectReason('');
                }} 
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="text-sm text-gray-500">Business Name</label>
                <p className="font-medium">{selectedSeller.business_name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Owner Name</label>
                <p className="font-medium">{selectedSeller.owner_name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <p className="font-medium">{selectedSeller.phone}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Email</label>
                <p className="font-medium">{selectedSeller.email}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">City</label>
                <p className="font-medium">{selectedSeller.city}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Role</label>
                <p className="font-medium">{selectedSeller.role_name || 'N/A'}</p>
              </div>
            </div>

            {selectedSeller.seller_status === 'pending' && (
              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4">Take Action</h3>
                <div className="space-y-4">
                  <div>
                    <button
                      onClick={() => handleApproveSeller(selectedSeller.id)}
                      className="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition"
                    >
                      ✓ Approve Seller
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                      placeholder="Please provide a reason for rejection..."
                    />
                    <button
                      onClick={() => handleRejectSeller(selectedSeller.id)}
                      disabled={!rejectReason.trim()}
                      className="mt-2 w-full px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✕ Reject Seller
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedSeller.seller_status === 'rejected' && selectedSeller.seller_rejection_reason && (
              <div className="border-t pt-6">
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-700 mb-2">Rejection Reason:</p>
                  <p className="text-sm text-red-600">{selectedSeller.seller_rejection_reason}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
              <button
                onClick={() => {
                  setSelectedSeller(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}

