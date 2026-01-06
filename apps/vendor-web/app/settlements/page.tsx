'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Settlement {
  id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  commission_rate: number;
  net_amount: number;
  booking_count: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payout_reference?: string;
  payout_date?: string;
  payout_method: 'bank' | 'upi';
  created_at: string;
}

interface SettlementSummary {
  totalEarnings: number;
  totalSettled: number;
  pendingSettlement: number;
  currentPeriodEarnings: number;
  nextSettlementDate: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  
  // Download state
  const [downloading, setDownloading] = useState<string | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [filterStatus, filterYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterYear) params.append('year', filterYear);
      
      // Get vendor ID from localStorage or context
      const vendorId = localStorage.getItem('vendorId') || '';
      
      if (!vendorId) {
        setError('Vendor ID not found. Please login again.');
        setLoading(false);
        return;
      }

      const [settlementsRes, summaryRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/settlements?${params.toString()}`),
        apiClient.get<any>(`/vendor/${vendorId}/settlements?summary=true`),
      ]);
      
      // Handle both new and old response formats
      const settlementsData = settlementsRes.settlements || settlementsRes.data?.settlements || settlementsRes || [];
      const summaryData = summaryRes.summary || summaryRes.data?.summary || summaryRes;
      
      setSettlements(Array.isArray(settlementsData) ? settlementsData : []);
      
      if (summaryData) {
        setSummary({
          totalEarnings: summaryData.total_settled + summaryData.pending_amount + summaryData.processing_amount || 0,
          totalSettled: summaryData.total_settled || 0,
          pendingSettlement: summaryData.pending_amount || 0,
          currentPeriodEarnings: summaryData.processing_amount || 0,
          nextSettlementDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        });
      }
    } catch (err: any) {
      console.error('Error loading settlements:', err);
      setError(err.message || 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleDownloadStatement = async (settlementId: string) => {
    try {
      setDownloading(settlementId);
      
      const response = await apiClient.get<any>(`/vendor/settlements/${settlementId}/statement`);
      
      // Create download link
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${settlementId}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download statement');
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAllStatements = async () => {
    try {
      setDownloading('all');
      
      const response = await apiClient.get<any>(`/vendor/settlements/annual-statement?year=${filterYear}`);
      
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `annual-statement-${filterYear}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download annual statement');
    } finally {
      setDownloading(null);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
            <p className="text-gray-500">Track your payouts and download statements</p>
          </div>
          <button
            onClick={handleDownloadAllStatements}
            disabled={downloading === 'all'}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
          >
            {downloading === 'all' ? '⏳ Downloading...' : '📥 Download Annual Statement'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-gray-500">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">₹{summary.totalEarnings.toLocaleString()}</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-6">
              <p className="text-sm text-green-600">Total Settled</p>
              <p className="text-2xl font-bold text-green-700 mt-1">₹{summary.totalSettled.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 rounded-2xl p-6">
              <p className="text-sm text-yellow-600">Pending Settlement</p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">₹{summary.pendingSettlement.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-6">
              <p className="text-sm text-orange-600">Next Settlement</p>
              <p className="text-lg font-bold text-orange-700 mt-1">{new Date(summary.nextSettlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Settlements List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {settlements.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">💰</div>
              <p className="text-gray-500">No settlements found</p>
            </div>
          ) : (
            <div className="divide-y">
              {settlements.map((settlement) => (
                <div key={settlement.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                        settlement.status === 'completed' ? 'bg-green-100' : 
                        settlement.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {settlement.status === 'completed' ? '✅' : settlement.status === 'pending' ? '⏳' : '💰'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {new Date(settlement.period_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(settlement.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[settlement.status]}`}>
                            {settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{settlement.booking_count} bookings</p>
                        {settlement.payout_reference && (
                          <p className="text-xs text-gray-400 mt-1">Ref: {settlement.payout_reference}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-sm text-gray-500">Gross</p>
                          <p className="font-medium text-gray-700">₹{settlement.gross_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Commission ({settlement.commission_rate}%)</p>
                          <p className="font-medium text-red-600">-₹{settlement.commission_amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Net Payout</p>
                          <p className="text-xl font-bold text-green-600">₹{settlement.net_amount.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {settlement.status === 'completed' && (
                        <button
                          onClick={() => handleDownloadStatement(settlement.id)}
                          disabled={downloading === settlement.id}
                          className="mt-3 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50"
                        >
                          {downloading === settlement.id ? '⏳' : '📄'} Download Statement
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {settlement.payout_date && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-4 text-sm text-gray-500">
                      <span>Paid on {new Date(settlement.payout_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {settlement.payout_method === 'bank' ? '🏦 Bank Transfer' : '📱 UPI'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="text-sm text-blue-700 font-medium">How Settlements Work</p>
              <ul className="text-sm text-blue-600 mt-1 space-y-1">
                <li>• Settlements are calculated every 7 days</li>
                <li>• Platform commission is deducted based on your tier</li>
                <li>• Payouts are processed to your primary bank account or UPI</li>
                <li>• Download statements for tax and accounting purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

