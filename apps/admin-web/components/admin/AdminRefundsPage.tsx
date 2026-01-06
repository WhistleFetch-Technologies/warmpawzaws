'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface RefundRequest {
  id: string;
  booking_id?: string;
  order_id?: string;
  customer_name: string;
  customer_phone: string;
  payment_id: string;
  amount: number;
  reason: string;
  status: string;
  type: 'booking' | 'order';
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  refund_id?: string;
  admin_notes?: string;
}

interface RefundStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAmount: number;
  pendingAmount: number;
}

export function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [stats, setStats] = useState<RefundStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const [refundsRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/admin/refunds${params}`),
        apiClient.get<any>('/admin/refunds/stats'),
      ]);
      if (refundsRes.success) setRefunds(refundsRes.refunds || []);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error('Error loading refunds:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRefund = async (refundId: string, notes: string) => {
    setProcessing(true);
    try {
      const res = await apiClient.post<any>(`/admin/refunds/${refundId}/approve`, { notes });
      if (res.success) {
        alert(`Refund processed! Refund ID: ${res.refund_id}`);
        loadData();
        setSelectedRefund(null);
      }
    } catch (err: any) {
      console.error('Error approving refund:', err);
      alert(err.message || 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRefund = async (refundId: string, reason: string) => {
    setProcessing(true);
    try {
      await apiClient.post(`/admin/refunds/${refundId}/reject`, { reason });
      alert('Refund request rejected');
      loadData();
      setSelectedRefund(null);
    } catch (err: any) {
      console.error('Error rejecting refund:', err);
      alert(err.message || 'Failed to reject refund');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'processed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Refund Management</h1>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Requests</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            <p className="text-xs text-gray-400">₹{stats.pendingAmount?.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Approved</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Rejected</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Refunded</p>
            <p className="text-2xl font-bold text-blue-600">₹{stats.totalAmount?.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex bg-white rounded-lg p-1 shadow-sm mb-6 w-fit">
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'processing', label: 'Processing' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === tab.id ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
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
                <th className="text-left p-4 font-medium text-gray-600">Request ID</th>
                <th className="text-left p-4 font-medium text-gray-600">Customer</th>
                <th className="text-left p-4 font-medium text-gray-600">Type</th>
                <th className="text-left p-4 font-medium text-gray-600">Reason</th>
                <th className="text-right p-4 font-medium text-gray-600">Amount</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {refunds.map((refund) => (
                <tr key={refund.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <span className="font-mono text-sm text-gray-900">
                      {refund.id.slice(0, 8)}...
                    </span>
                    <p className="text-xs text-gray-400">{new Date(refund.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{refund.customer_name}</p>
                    <p className="text-sm text-gray-500">{refund.customer_phone}</p>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      refund.type === 'booking' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {refund.type === 'booking' ? '📅 Booking' : '📦 Order'}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="text-sm text-gray-600 max-w-xs truncate">{refund.reason}</p>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-900">
                    ₹{refund.amount.toLocaleString()}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(refund.status)}`}>
                      {refund.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelectedRefund(refund)}
                      className="px-3 py-1 bg-blue-100 text-blue-600 text-sm rounded-lg hover:bg-blue-200"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {refunds.length === 0 && (
            <div className="text-center py-12">
              <span className="text-5xl">💰</span>
              <p className="mt-4 text-gray-500">No refund requests found</p>
            </div>
          )}
        </div>
      )}

      {/* Refund Detail Modal */}
      {selectedRefund && (
        <RefundDetailModal
          refund={selectedRefund}
          onClose={() => setSelectedRefund(null)}
          onApprove={handleApproveRefund}
          onReject={handleRejectRefund}
          processing={processing}
        />
      )}
    </div>
  );
}

function RefundDetailModal({
  refund,
  onClose,
  onApprove,
  onReject,
  processing,
}: {
  refund: RefundRequest;
  onClose: () => void;
  onApprove: (id: string, notes: string) => void;
  onReject: (id: string, reason: string) => void;
  processing: boolean;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Refund Request Review</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-gray-500">Request ID</label>
            <p className="font-mono text-sm">{refund.id}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Payment ID</label>
            <p className="font-mono text-sm">{refund.payment_id}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Customer</label>
            <p className="font-medium">{refund.customer_name}</p>
            <p className="text-sm text-gray-500">{refund.customer_phone}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Amount</label>
            <p className="text-2xl font-bold text-red-600">₹{refund.amount.toLocaleString()}</p>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-gray-500">Reason for Refund</label>
            <p className="text-gray-900 p-3 bg-gray-50 rounded-lg">{refund.reason}</p>
          </div>
          {refund.booking_id && (
            <div>
              <label className="text-sm text-gray-500">Booking ID</label>
              <p className="font-mono text-sm">{refund.booking_id}</p>
            </div>
          )}
          {refund.order_id && (
            <div>
              <label className="text-sm text-gray-500">Order ID</label>
              <p className="font-mono text-sm">{refund.order_id}</p>
            </div>
          )}
        </div>

        {(refund.status as any) === 'pending' && (
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Take Action</h3>
            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setAction('approve')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  action === 'approve' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'
                }`}
              >
                ✓ Approve Refund
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

            {action && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {action === 'approve' ? 'Admin Notes (optional)' : 'Rejection Reason'}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={action === 'approve' ? 'Optional notes...' : 'Please provide a reason...'}
                    required={action === 'reject'}
                  />
                </div>
                <button
                  onClick={() => {
                    if (action === 'reject' && !notes.trim()) {
                      alert('Please provide a rejection reason');
                      return;
                    }
                    if (action === 'approve') {
                      onApprove(refund.id, notes);
                    } else {
                      onReject(refund.id, notes);
                    }
                  }}
                  disabled={processing}
                  className={`w-full py-2 rounded-lg font-medium disabled:opacity-50 ${
                    action === 'approve'
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  {processing ? 'Processing...' : action === 'approve' ? 'Process Refund' : 'Confirm Rejection'}
                </button>
              </div>
            )}
          </div>
        )}

        {(refund.status as any) !== 'pending' && (
          <div className={`p-4 rounded-lg ${
            refund.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <p className="font-medium">
              {refund.status === 'approved' ? '✓ Refund Processed' : '✕ Refund Rejected'}
            </p>
            {refund.refund_id && (
              <p className="text-sm text-gray-600 mt-1">Refund ID: {refund.refund_id}</p>
            )}
            {refund.admin_notes && (
              <p className="text-sm text-gray-600 mt-1">Notes: {refund.admin_notes}</p>
            )}
            {refund.processed_at && (
              <p className="text-xs text-gray-400 mt-2">
                Processed on {new Date(refund.processed_at).toLocaleString()}
              </p>
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

