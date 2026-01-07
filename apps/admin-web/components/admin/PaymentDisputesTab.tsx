'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, Loader2 } from 'lucide-react';
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
            onChange={(e) => setSearchTerm(e.target.value)}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
