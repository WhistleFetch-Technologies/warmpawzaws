'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, Search, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface RateChange {
  changeId: string;
  serviceId: string;
  serviceName: string;
  vendorId: string;
  vendorName: string;
  oldRate: number;
  newRate: number;
  changePercentage: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
}

export function RateChangesTab() {
  const [loading, setLoading] = useState(true);
  const [rateChanges, setRateChanges] = useState<RateChange[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRateChanges();
  }, []);

  const loadRateChanges = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/finance/rate-changes');
      setRateChanges(data.rateChanges || []);
    } catch (error) {
      console.error('Error loading rate changes:', error);
      alert('Failed to load rate changes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (changeId: string) => {
    try {
      const data = await apiClient.post<any>(`/admin/finance/rate-changes/${changeId}/approve`, {});
      if (data.success) {
        alert('Rate change approved');
        loadRateChanges();
      } else {
        alert(data.error || 'Failed to approve rate change');
      }
    } catch (error) {
      console.error('Error approving rate change:', error);
      alert('An error occurred');
    }
  };

  const handleReject = async (changeId: string) => {
    try {
      const data = await apiClient.post<any>(`/admin/finance/rate-changes/${changeId}/reject`, {});
      if (data.success) {
        alert('Rate change rejected');
        loadRateChanges();
      } else {
        alert(data.error || 'Failed to reject rate change');
      }
    } catch (error) {
      console.error('Error rejecting rate change:', error);
      alert('An error occurred');
    }
  };

  const filteredRateChanges = rateChanges.filter(change =>
    change.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    change.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Search rate changes..."
            className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Old Rate</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">New Rate</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-0 py-0 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRateChanges.map((change) => (
              <tr key={change.changeId} className="hover:bg-gray-50">
                <td className="px-0 py-4 font-medium text-gray-900">{change.serviceName}</td>
                <td className="px-0 py-4 text-sm text-gray-600">{change.vendorName}</td>
                <td className="px-0 py-4 text-sm text-gray-900">₹{change.oldRate.toLocaleString()}</td>
                <td className="px-0 py-4 text-sm text-gray-900">₹{change.newRate.toLocaleString()}</td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    change.changePercentage > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {change.changePercentage > 0 ? '+' : ''}{change.changePercentage.toFixed(1)}%
                  </span>
                </td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    change.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    change.status === 'approved' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {change.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">
                  {new Date(change.requestedAt).toLocaleDateString()}
                </td>
                <td className="px-0 py-4 text-right">
                  {change.status === 'pending' && (
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleApprove(change.changeId)}
                        className="px-0 py-0 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(change.changeId)}
                        className="px-0 py-0 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
