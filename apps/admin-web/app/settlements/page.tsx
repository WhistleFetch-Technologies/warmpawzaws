'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface Settlement {
  id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_phone: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  net_amount: number;
  booking_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payout_reference?: string;
  payout_date?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

interface SettlementSummary {
  totalPending: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  pendingAmount: number;
  completedAmount: number;
}

interface SettlementDetail {
  settlement: Settlement;
  bookings: Array<{
    id: string;
    booking_date: string;
    service_name: string;
    total_amount: number;
    commission: number;
    net_amount: number;
  }>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<string>('30d');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<SettlementDetail | null>(null);
  const [processing, setProcessing] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [filterStatus, filterDateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterDateRange) params.append('period', filterDateRange);
      
      const [settlementsRes, summaryRes] = await Promise.all([
        apiClient.get<any>(`/settlements?${params.toString()}`),
        apiClient.get<any>('/settlements/summary'),
      ]);
      
      setSettlements(settlementsRes.settlements || settlementsRes || []);
      setSummary(summaryRes.summary || summaryRes);
    } catch (err: any) {
      console.error('Error loading settlements:', err);
      setError(err.message || 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  const loadSettlementDetail = async (settlementId: string) => {
    try {
      const response = await apiClient.get<any>(`/settlements/${settlementId}`);
      setSelectedSettlement(response);
      setShowDetailModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load settlement details');
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleProcessSelected = async () => {
    if (selectedIds.length === 0) {
      setError('Please select settlements to process');
      return;
    }
    
    if (!confirm(`Process ${selectedIds.length} settlement(s)?`)) return;
    
    try {
      setProcessing(true);
      setError(null);
      
      await apiClient.post('/settlements/process', { settlementIds: selectedIds });
      
      setSuccess(`Successfully queued ${selectedIds.length} settlement(s) for processing`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to process settlements');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessSingle = async (settlementId: string) => {
    if (!confirm('Process this settlement?')) return;
    
    try {
      setProcessing(true);
      await apiClient.post('/settlements/process', { settlementIds: [settlementId] });
      setSuccess('Settlement queued for processing');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to process settlement');
    } finally {
      setProcessing(false);
    }
  };

  const handleRunAutoSettlement = async () => {
    if (!confirm('Run automatic daily settlement calculation?')) return;
    
    try {
      setProcessing(true);
      await apiClient.post('/settlements/auto-process', {});
      setSuccess('Auto-settlement process started');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to run auto-settlement');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryFailed = async (settlementId: string) => {
    try {
      setProcessing(true);
      await apiClient.post(`/settlements/${settlementId}/retry`, {});
      setSuccess('Settlement retry initiated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to retry settlement');
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSettlements.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSettlements.filter(s => s.status === 'pending').map(s => s.id));
    }
  };

  // ============================================================================
  // FILTER LOGIC
  // ============================================================================

  const filteredSettlements = settlements.filter(settlement => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        settlement.vendor_name?.toLowerCase().includes(search) ||
        settlement.vendor_phone?.includes(search) ||
        settlement.payout_reference?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settlements...</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Page toolbar: keep short — AdminLayout already provides the sticky app header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Settlements</h1>
              <p className="text-xs text-gray-500 sm:text-sm">Vendor payouts</p>
            </div>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={handleRunAutoSettlement}
                disabled={processing}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 sm:px-4 sm:py-2"
              >
                ⚡ Run daily
              </button>
              <button
                onClick={handleProcessSelected}
                disabled={processing || selectedIds.length === 0}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-50 sm:px-4 sm:py-2"
              >
                {processing ? 'Processing...' : `Process (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content - Match wireframe: max-w-7xl mx-auto p-6 or p-8 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
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

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-5 gap-6 mb-8">
            <div className="bg-yellow-50 rounded-2xl p-6">
              <div className="text-3xl mb-2">⏳</div>
              <p className="text-3xl font-bold text-yellow-600">{summary.totalPending}</p>
              <p className="text-sm text-yellow-600">Pending</p>
              <p className="text-xs text-yellow-500 mt-1">₹{summary.pendingAmount?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-blue-50 rounded-2xl p-6">
              <div className="text-3xl mb-2">🔄</div>
              <p className="text-3xl font-bold text-blue-600">{summary.totalProcessing}</p>
              <p className="text-sm text-blue-600">Processing</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-6">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-3xl font-bold text-green-600">{summary.totalCompleted}</p>
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-xs text-green-500 mt-1">₹{summary.completedAmount?.toLocaleString() || 0}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-6">
              <div className="text-3xl mb-2">❌</div>
              <p className="text-3xl font-bold text-red-600">{summary.totalFailed}</p>
              <p className="text-sm text-red-600">Failed</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-2">💰</div>
              <p className="text-3xl font-bold text-gray-900">{settlements.length}</p>
              <p className="text-sm text-gray-500">Total Settlements</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search by vendor name, phone, or reference..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterDateRange}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Settlements Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredSettlements.filter(s => s.status === 'pending').length && selectedIds.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Bookings</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Net Payout</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    <p>No settlements found</p>
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((settlement) => (
                  <tr key={settlement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {settlement.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(settlement.id)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, settlement.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== settlement.id));
                            }
                          }}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{settlement.vendor_name}</p>
                        <p className="text-sm text-gray-500">{settlement.vendor_phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>
                        <p>{new Date(settlement.period_start).toLocaleDateString()}</p>
                        <p className="text-gray-400">to {new Date(settlement.period_end).toLocaleDateString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{settlement.booking_count}</td>
                    <td className="px-6 py-4 text-sm">₹{settlement.gross_amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-red-600">-₹{settlement.commission_amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">₹{settlement.net_amount?.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[settlement.status]}`}>
                        {settlement.status}
                      </span>
                      {settlement.payout_reference && (
                        <p className="text-xs text-gray-400 mt-1">{settlement.payout_reference}</p>
                      )}
                      {settlement.failure_reason && (
                        <p className="text-xs text-red-500 mt-1">{settlement.failure_reason}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadSettlementDetail(settlement.id)}
                          className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                        >
                          View
                        </button>
                        {settlement.status === 'pending' && (
                          <button
                            onClick={() => handleProcessSingle(settlement.id)}
                            disabled={processing}
                            className="text-green-500 hover:text-green-600 text-sm font-medium disabled:opacity-50"
                          >
                            Process
                          </button>
                        )}
                        {settlement.status === 'failed' && (
                          <button
                            onClick={() => handleRetryFailed(settlement.id)}
                            disabled={processing}
                            className="text-blue-500 hover:text-blue-600 text-sm font-medium disabled:opacity-50"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </div>
        </main>

      {/* Detail Modal */}
      {showDetailModal && selectedSettlement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Settlement Details</h3>
                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Settlement Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-semibold text-gray-900">{selectedSettlement.settlement.vendor_name}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Period</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedSettlement.settlement.period_start).toLocaleDateString()} - {new Date(selectedSettlement.settlement.period_end).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedSettlement.settlement.status]}`}>
                    {selectedSettlement.settlement.status}
                  </span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-orange-50 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-orange-600">Gross Amount</p>
                    <p className="text-2xl font-bold text-orange-700">₹{selectedSettlement.settlement.gross_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-orange-600">Commission</p>
                    <p className="text-2xl font-bold text-red-600">-₹{selectedSettlement.settlement.commission_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-orange-600">Net Payout</p>
                    <p className="text-2xl font-bold text-green-600">₹{selectedSettlement.settlement.net_amount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-orange-600">Bookings</p>
                    <p className="text-2xl font-bold text-orange-700">{selectedSettlement.settlement.booking_count}</p>
                  </div>
                </div>
              </div>

              {/* Bookings Breakdown */}
              <h4 className="font-semibold text-gray-900 mb-3">Included Bookings</h4>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedSettlement.bookings?.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-4 py-3 text-sm">{new Date(booking.booking_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm">{booking.service_name}</td>
                        <td className="px-4 py-3 text-sm">₹{booking.total_amount?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-red-600">-₹{booking.commission?.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600">₹{booking.net_amount?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payout Info */}
              {selectedSettlement.settlement.payout_reference && (
                <div className="mt-6 p-4 bg-green-50 rounded-xl">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Payout Reference:</span> {selectedSettlement.settlement.payout_reference}
                  </p>
                  {selectedSettlement.settlement.payout_date && (
                    <p className="text-sm text-green-700 mt-1">
                      <span className="font-medium">Payout Date:</span> {new Date(selectedSettlement.settlement.payout_date).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

