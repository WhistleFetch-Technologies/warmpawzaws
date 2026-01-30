'use client';

import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Filter,
  Search,
  Calendar,
  TrendingUp,
  AlertCircle,
  Eye,
  FileText,
  X,
} from 'lucide-react';
import { Card, Badge, Button, Input } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Payout {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  amount: number;
  commission: number;
  tds: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  period: string;
  bookingsCount: number;
  ordersCount: number;
  createdAt: string;
  processedAt?: string;
  bankAccount?: {
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
    verified: boolean;
  };
  rejectionReason?: string;
}

export function PayoutManagement() {
  const [loading, setLoading] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filteredPayouts, setFilteredPayouts] = useState<Payout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    pendingAmount: 0,
    processingAmount: 0,
    completedAmount: 0,
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0,
  });

  useEffect(() => {
    loadPayouts();
    loadStats();
  }, []);

  useEffect(() => {
    filterPayouts();
  }, [searchQuery, statusFilter, payouts]);

  const loadPayouts = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/payouts');
      const raw = (data as any)?.data?.payouts ?? (data as any)?.payouts;
      setPayouts(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error('Error loading payouts:', error);
      toast.error('Failed to load payouts');
      setPayouts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiClient.get<any>('/admin/payouts/stats');
      const statsData = (data as any)?.data?.stats ?? (data as any)?.stats ?? {};
      setStats({
        pendingAmount: Number(statsData.pendingAmount) || 0,
        processingAmount: Number(statsData.processingAmount) || 0,
        completedAmount: Number(statsData.completedAmount) || 0,
        pendingCount: Number(statsData.pendingCount) || 0,
        processingCount: Number(statsData.processingCount) || 0,
        completedCount: Number(statsData.completedCount) || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      // Keep existing stats on error so UI doesn't break
    }
  };

  const filterPayouts = () => {
    const list = Array.isArray(payouts) ? payouts : [];
    let filtered = list;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p?.vendorName ?? '').toLowerCase().includes(q) ||
          (p?.vendorPhone ?? '').includes(searchQuery)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p && (p.status ?? (p as any).payout_status) === statusFilter);
    }

    setFilteredPayouts(filtered);
  };

  const handleProcessPayout = async (payoutId: string) => {
    try {
      await apiClient.post(`/admin/payouts/${payoutId}/process`);
      toast.success('Payout processed successfully');
      loadPayouts();
      loadStats();
    } catch (error) {
      toast.error('Failed to process payout');
    }
  };

  const handleRejectPayout = async (payoutId: string, reason: string) => {
    try {
      await apiClient.post(`/admin/payouts/${payoutId}/reject`, { reason });
      toast.success('Payout rejected');
      loadPayouts();
      loadStats();
    } catch (error) {
      toast.error('Failed to reject payout');
    }
  };

  const exportPayouts = () => {
    const list = Array.isArray(filteredPayouts) ? filteredPayouts : [];
    const csv = [
      ['Payout ID', 'Vendor', 'Amount', 'Status', 'Period'],
      ...list.map((p) => [
        p?.id ?? '',
        p?.vendorName ?? (p as any)?.vendor_name ?? '',
        p?.netAmount ?? (p as any)?.net_amount ?? p?.amount ?? 0,
        p?.status ?? (p as any)?.payout_status ?? '',
        p?.period ?? '',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-black text-xl font-semibold">Payout Management</h2>
          <p className="text-gray-500 text-sm mt-1">
            Manage vendor payouts and transactions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={exportPayouts} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Pending Payouts</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{stats.pendingAmount.toLocaleString()}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-xs text-gray-500">{stats.pendingCount} payouts</p>
          </Card>
        </Card>
        <Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{stats.processingAmount.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500">{stats.processingCount} payouts</p>
          </Card>
        </Card>
        <Card>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{stats.completedAmount.toLocaleString()}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-gray-500">{stats.completedCount} payouts</p>
          </Card>
        </Card>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by vendor name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Gross Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Commission
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Net Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
                  </td>
                </tr>
              ) : (Array.isArray(filteredPayouts) ? filteredPayouts : []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No payouts found</p>
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredPayouts) ? filteredPayouts : []).map((payout) => {
                  if (!payout) return null;
                  const status = payout.status ?? (payout as any).payout_status ?? 'pending';
                  return (
                  <tr key={payout.id ?? (payout as any).payout_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{payout.vendorName ?? (payout as any).vendor_name ?? '-'}</p>
                        <p className="text-sm text-gray-500">{payout.vendorPhone ?? (payout as any).vendor_phone ?? '-'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{payout.period ?? (payout as any).period ?? '-'}</td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      ₹{(payout.amount ?? (payout as any).amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      ₹{(payout.commission ?? (payout as any).commission ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                      ₹{(payout.netAmount ?? (payout as any).net_amount ?? payout.amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge
                        variant={
                          status === 'completed'
                            ? 'default'
                            : status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          onClick={() => {
                            setSelectedPayout(payout);
                            setShowDetails(true);
                          }}
                          variant="ghost"
                          size="sm"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {status === 'pending' && (
                          <Button
                            onClick={() => handleProcessPayout(payout.id)}
                            size="sm"
                            className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
                          >
                            Process
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ); })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout Details Modal */}
      {showDetails && selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-xl font-bold text-gray-900">Payout Details</h3>
              <button
                onClick={() => {
                  setShowDetails(false);
                  setSelectedPayout(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Vendor Name</p>
                  <p className="font-semibold">{selectedPayout.vendorName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-semibold">{selectedPayout.vendorPhone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Period</p>
                  <p className="font-semibold">{selectedPayout.period}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge
                    variant={
                      selectedPayout.status === 'completed'
                        ? 'default'
                        : selectedPayout.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {selectedPayout.status}
                  </Badge>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-semibold mb-3">Amount Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Amount</span>
                    <span className="font-semibold">₹{selectedPayout.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Commission</span>
                    <span className="text-red-600">
                      -₹{selectedPayout.commission.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">TDS</span>
                    <span className="text-red-600">-₹{selectedPayout.tds.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold">Net Amount</span>
                    <span className="font-bold text-lg text-green-600">
                      ₹{selectedPayout.netAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              {selectedPayout.bankAccount && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold mb-3">Bank Account</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Holder</span>
                      <span className="font-semibold">
                        {selectedPayout.bankAccount.accountHolder}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Number</span>
                      <span className="font-semibold">
                        {selectedPayout.bankAccount.accountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">IFSC</span>
                      <span className="font-semibold">{selectedPayout.bankAccount.ifsc}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Verified</span>
                      <Badge variant={selectedPayout.bankAccount.verified ? 'default' : 'outline'}>
                        {selectedPayout.bankAccount.verified ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 bg-gray-50">
              <Button onClick={() => {
                setShowDetails(false);
                setSelectedPayout(null);
              }} variant="outline">
                Close
              </Button>
              {selectedPayout.status === 'pending' && (
                <Button
                  onClick={() => handleProcessPayout(selectedPayout.id)}
                  className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
                >
                  Process Payout
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
