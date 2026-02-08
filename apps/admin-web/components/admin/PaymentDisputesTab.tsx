'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, Loader2, CheckCircle, XCircle, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PaymentDispute {
  disputeId: string;
  disputeNumber: string;
  bookingId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'rejected';
  raisedBy: string;
  raisedAt: string;
  resolvedAt?: string;
}

export function PaymentDisputesTab() {
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispute, setSelectedDispute] = useState<PaymentDispute | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/finance/disputes');
      setDisputes(data.disputes || []);
    } catch (error) {
      console.error('Error loading disputes:', error);
      alert('Failed to load payment disputes');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (disputeId: string, resolution: 'resolved' | 'rejected') => {
    if (!resolutionNote.trim()) {
      alert('Please provide a resolution note');
      return;
    }
    
    try {
      setResolving(true);
      await apiClient.put(`/admin/payment-disputes/${disputeId}/resolve`, {
        resolutionNote: resolutionNote,
        status: resolution,
      });
      await loadDisputes();
      setSelectedDispute(null);
      setResolutionNote('');
      alert(`Dispute ${resolution === 'resolved' ? 'resolved' : 'rejected'} successfully`);
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert('Failed to resolve dispute');
    } finally {
      setResolving(false);
    }
  };

  const filteredDisputes = disputes.filter(dispute =>
    dispute.disputeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dispute.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dispute.raisedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            placeholder="Search disputes..."
            className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Dispute #</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Booking ID</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Raised By</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredDisputes.map((dispute) => (
              <tr key={dispute.disputeId} className="hover:bg-gray-50">
                <td className="px-0 py-4 font-medium text-gray-900">{dispute.disputeNumber}</td>
                <td className="px-0 py-4 text-sm text-gray-600">{dispute.bookingId}</td>
                <td className="px-0 py-4 font-medium text-gray-900">₹{dispute.amount.toLocaleString()}</td>
                <td className="px-0 py-4 text-sm text-gray-600">{dispute.reason}</td>
                <td className="px-0 py-4 text-sm text-gray-900">{dispute.raisedBy}</td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    dispute.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    dispute.status === 'investigating' ? 'bg-blue-100 text-blue-700' :
                    dispute.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {dispute.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">
                  {new Date(dispute.raisedAt).toLocaleDateString()}
                </td>
                <td className="px-0 py-4">
                  {dispute.status === 'pending' || dispute.status === 'investigating' ? (
                    <button
                      onClick={() => setSelectedDispute(dispute)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Resolve
                    </button>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dispute Resolution Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Resolve Dispute</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Dispute #:</strong> {selectedDispute.disputeNumber}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Booking ID:</strong> {selectedDispute.bookingId}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Amount:</strong> ₹{selectedDispute.amount.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Reason:</strong> {selectedDispute.reason}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Note *
                </label>
                <textarea
                  value={resolutionNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResolutionNote(e.target.value)}
                  placeholder="Enter resolution details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={4}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleResolveDispute(selectedDispute.disputeId, 'resolved')}
                  disabled={resolving || !resolutionNote.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {resolving ? 'Resolving...' : 'Resolve'}
                </button>
                <button
                  onClick={() => handleResolveDispute(selectedDispute.disputeId, 'rejected')}
                  disabled={resolving || !resolutionNote.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  {resolving ? 'Rejecting...' : 'Reject'}
                </button>
                <button
                  onClick={() => {
                    setSelectedDispute(null);
                    setResolutionNote('');
                  }}
                  disabled={resolving}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
