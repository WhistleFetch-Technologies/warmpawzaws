'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard, Search, Download, CheckCircle, Clock, AlertCircle,
  DollarSign, TrendingUp, Store, Calendar, Eye, Send, RefreshCcw,
  FileText, Banknote, ArrowRight
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const SETTLEMENT_STATUSES = [
  { id: 'all', label: 'All Settlements' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
];

export function SettlementsDashboard() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [selectedStatus, dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load settlements
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      params.append('period', dateRange);
      
      const [settlementsData, analyticsData] = await Promise.all([
        apiClient.get<any>(`/settlements?${params.toString()}`).catch(() => ({ settlements: [] })),
        apiClient.get<any>('/admin/settlements/analytics').catch(() => ({}))
      ]);
      
      setSettlements((settlementsData as any)?.settlements || []);
      setAnalytics(analyticsData || {});
    } catch (error) {
      console.error('Error loading settlements:', error);
    } finally {
      setLoading(false);
    }
  };

  const processSettlement = async (settlementId: string) => {
    if (!confirm('Are you sure you want to process this settlement?')) return;
    
    try {
      await apiClient.post(`/settlements/${settlementId}/process`, {});
      loadData();
    } catch (error) {
      console.error('Error processing settlement:', error);
      alert('Failed to process settlement');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-700',
      'processing': 'bg-blue-100 text-blue-700',
      'completed': 'bg-emerald-100 text-emerald-700',
      'failed': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <RefreshCcw className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const statusCounts = SETTLEMENT_STATUSES.reduce((acc, status) => {
    acc[status.id] = status.id === 'all' 
      ? settlements.length 
      : settlements.filter(s => s.status === status.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settlements & Payouts</h1>
          <p className="text-slate-500 mt-1">Manage vendor settlements and payouts</p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-medium shadow-lg shadow-orange-500/25">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Total Settled</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">₹{(analytics?.totalSettled || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Pending Amount</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">₹{(analytics?.pendingAmount || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Commission Earned</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">₹{(analytics?.commissionEarned || 0).toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 shadow-lg">
              <Store className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-slate-500">Active Vendors</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">{analytics?.activeVendors || 0}</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {SETTLEMENT_STATUSES.map(status => (
          <button
            key={status.id}
            onClick={() => setSelectedStatus(status.id)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
              selectedStatus === status.id
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {status.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              selectedStatus === status.id ? 'bg-white/20' : 'bg-slate-100'
            }`}>
              {statusCounts[status.id] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading settlements...</p>
          </div>
        ) : settlements.length === 0 ? (
          <div className="p-12 text-center">
            <CreditCard className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No settlements found</p>
            <p className="text-sm text-slate-400 mt-1">Settlements will appear here after orders are delivered</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Settlement ID</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Vendor</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Period</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Gross</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Commission</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Net Payout</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {settlements.map(settlement => (
                <tr key={settlement.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-mono font-medium text-slate-900">#{(settlement.id || '').slice(-8)}</p>
                    <p className="text-xs text-slate-500">{settlement.booking_count || 0} orders</p>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-100 rounded-full flex items-center justify-center">
                        <Store className="w-4 h-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{settlement.vendor_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{settlement.vendor_phone || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600">
                    {settlement.period_start ? (
                      <>
                        {new Date(settlement.period_start).toLocaleDateString()} - {new Date(settlement.period_end).toLocaleDateString()}
                      </>
                    ) : (
                      new Date(settlement.created_at).toLocaleDateString()
                    )}
                  </td>
                  <td className="p-4 text-right font-medium text-slate-900">
                    ₹{(settlement.gross_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-right text-orange-600 font-medium">
                    ₹{(settlement.commission_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-bold text-emerald-600">
                    ₹{(settlement.net_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(settlement.status)}`}>
                      {getStatusIcon(settlement.status)}
                      {settlement.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setSelectedSettlement(settlement)}
                        className="p-2 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {settlement.status === 'pending' && (
                        <button 
                          onClick={() => processSettlement(settlement.id)}
                          className="p-2 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-lg transition-colors"
                          title="Process Payout"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* GST Summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          GST & Tax Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Taxable Value</p>
            <p className="text-2xl font-bold mt-1">₹{(analytics?.totalTaxableValue || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">CGST (9%)</p>
            <p className="text-2xl font-bold mt-1">₹{(analytics?.cgst || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">SGST (9%)</p>
            <p className="text-2xl font-bold mt-1">₹{(analytics?.sgst || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total GST Collected</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">₹{(analytics?.totalGST || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Settlement Detail Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Settlement Details</h2>
                <p className="text-sm text-slate-500 mt-1">#{(selectedSettlement.id || '').slice(-8)}</p>
              </div>
              <button 
                onClick={() => setSelectedSettlement(null)}
                className="p-2 hover:bg-slate-100 rounded-xl"
              >
                <AlertCircle className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Vendor Info */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
                  <Store className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedSettlement.vendor_name}</p>
                  <p className="text-sm text-slate-500">{selectedSettlement.vendor_phone}</p>
                </div>
                <span className={`ml-auto px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedSettlement.status)}`}>
                  {selectedSettlement.status}
                </span>
              </div>

              {/* Financial Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900">Financial Breakdown</h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  <div className="flex justify-between p-4">
                    <span className="text-slate-600">Gross Amount</span>
                    <span className="font-bold text-slate-900">₹{(selectedSettlement.gross_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-slate-600">Platform Commission (15%)</span>
                    <span className="font-medium text-orange-600">-₹{(selectedSettlement.commission_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-4">
                    <span className="text-slate-600">GST on Commission</span>
                    <span className="font-medium text-slate-600">-₹{(selectedSettlement.gst_on_commission || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-4 bg-emerald-50">
                    <span className="font-semibold text-emerald-900">Net Payout</span>
                    <span className="text-xl font-bold text-emerald-600">₹{(selectedSettlement.net_amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payout Details */}
              {selectedSettlement.payout_reference && (
                <div className="p-4 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Banknote className="w-4 h-4" /> Payout Details
                  </h4>
                  <p className="text-sm text-blue-700">Reference: {selectedSettlement.payout_reference}</p>
                  <p className="text-sm text-blue-700">Paid on: {new Date(selectedSettlement.payout_date).toLocaleDateString()}</p>
                </div>
              )}

              {/* Actions */}
              {selectedSettlement.status === 'pending' && (
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedSettlement(null)}
                    className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      processSettlement(selectedSettlement.id);
                      setSelectedSettlement(null);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Process Payout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
