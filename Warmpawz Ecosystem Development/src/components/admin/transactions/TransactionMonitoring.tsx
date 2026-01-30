/**
 * Transaction Monitoring Dashboard
 * Scalable transaction management for millions of transactions
 */

import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { 
  CreditCard, Search, Filter, TrendingUp, AlertCircle, CheckCircle,
  XCircle, Clock, ArrowLeft, Download, RefreshCw, DollarSign, Activity
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

const API_BASE = getApiBaseUrl();

interface TransactionStats {
  totalTransactions: number;
  totalVolume: number;
  successRate: number;
  avgTransactionValue: number;
  pendingCount: number;
  failedCount: number;
  refundCount: number;
}

interface Transaction {
  id: string;
  type: 'booking' | 'order' | 'subscription';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  customer: string;
  vendor: string;
  createdAt: string;
  razorpayId?: string;
  gateway: string;
}

interface TransactionMonitoringProps {
  onBack: () => void;
}

export function TransactionMonitoring({ onBack }: TransactionMonitoringProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 50;

  useEffect(() => {
    loadTransactionData();
  }, [dateRange, statusFilter, currentPage]);

  const loadTransactionData = async () => {
    setLoading(true);
    try {
      // Load stats
      const statsRes = await fetch(
        `${API_BASE}/admin/transactions/stats?range=${dateRange}`,
        { headers: getAuthHeaders()}
      );
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // Load transactions (paginated)
      const txnRes = await fetch(
        `${API_BASE}/admin/transactions?page=${currentPage}&perPage=${perPage}&status=${statusFilter}&range=${dateRange}`,
        { headers: getAuthHeaders()}
      );
      if (txnRes.ok) {
        const txnData = await txnRes.json();
        setTransactions(txnData.transactions || []);
        setTotalPages(txnData.totalPages || 1);
      }
    } catch (err) {
      console.error('Error loading transaction data:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportTransactions = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/admin/transactions/export?range=${dateRange}&status=${statusFilter}`,
        { headers: getAuthHeaders()}
      );
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transactions-${dateRange}-${Date.now()}.csv`;
        link.click();
        console.log('✅ Transactions exported');
      } else {
        alert('Failed to export transactions');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export transactions');
    }
  };

  const retryFailedTransaction = async (txnId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/admin/transactions/${txnId}/retry`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );
      
      if (response.ok) {
        alert('Transaction retry initiated');
        loadTransactionData();
      } else {
        alert('Failed to retry transaction');
      }
    } catch (err) {
      console.error('Retry error:', err);
      alert('Failed to retry transaction');
    }
  };

  const filteredTransactions = transactions.filter(txn => {
    if (!searchQuery) return true;
    return (
      txn.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.razorpayId?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Transaction Monitoring</h1>
                <p className="text-sm text-gray-500">Real-time transaction analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadTransactionData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={exportTransactions} className="bg-[#FF8C42] hover:bg-[#ff7a28]">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CreditCard className="w-8 h-8 text-blue-600" />
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold">{stats?.totalTransactions.toLocaleString() || 0}</h3>
            <p className="text-sm text-gray-600">Total Transactions</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold">₹{((stats?.totalVolume || 0) / 1000).toFixed(0)}K</h3>
            <p className="text-sm text-gray-600">Total Volume</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold">{stats?.successRate.toFixed(1) || 0}%</h3>
            <p className="text-sm text-gray-600">Success Rate</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-2xl font-bold">₹{stats?.avgTransactionValue.toLocaleString() || 0}</h3>
            <p className="text-sm text-gray-600">Avg Transaction</p>
          </Card>
        </div>

        {/* Alerts */}
        {stats && (stats.failedCount > 10 || stats.pendingCount > 50) && (
          <div className="mb-6">
            <Card className="p-4 border-yellow-300 bg-yellow-50">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-800">Attention Required</p>
                  <p className="text-sm text-yellow-700">
                    {stats.failedCount} failed transactions and {stats.pendingCount} pending transactions require review.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('failed')}>
                  Review
                </Button>
              </div>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="failed">
              Failed ({stats?.failedCount || 0})
            </TabsTrigger>
            <TabsTrigger value="refunds">
              Refunds ({stats?.refundCount || 0})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Status Breakdown</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Completed</span>
                    </div>
                    <span className="font-semibold">
                      {stats?.totalTransactions && stats?.failedCount && stats?.pendingCount 
                        ? (stats.totalTransactions - stats.failedCount - stats.pendingCount).toLocaleString()
                        : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-600" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="font-semibold">{stats?.pendingCount.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm">Failed</span>
                    </div>
                    <span className="font-semibold">{stats?.failedCount.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Refunded</span>
                    </div>
                    <span className="font-semibold">{stats?.refundCount.toLocaleString() || 0}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 md:col-span-2">
                <h3 className="font-semibold mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map(txn => (
                    <div key={txn.id} className="flex items-center justify-between pb-3 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          txn.status === 'completed' ? 'bg-green-600' :
                          txn.status === 'pending' ? 'bg-yellow-600' :
                          txn.status === 'failed' ? 'bg-red-600' : 'bg-blue-600'
                        }`} />
                        <div>
                          <p className="font-medium text-sm">{txn.customer}</p>
                          <p className="text-xs text-gray-600">{txn.id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">₹{txn.amount.toLocaleString()}</p>
                        <p className="text-xs text-gray-600">{new Date(txn.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {/* Search & Filters */}
            <Card className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, customer, vendor, or Razorpay ID..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {/* Transactions Table */}
            <Card className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Transaction ID</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Customer</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Vendor</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map(txn => (
                      <tr key={txn.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-mono">{txn.id.substring(0, 12)}...</p>
                            {txn.razorpayId && (
                              <p className="text-xs text-gray-500">{txn.razorpayId}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs bg-gray-100 rounded capitalize">
                            {txn.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{txn.customer}</td>
                        <td className="px-4 py-3 text-sm">{txn.vendor}</td>
                        <td className="px-4 py-3 font-semibold">₹{txn.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${
                            txn.status === 'completed' ? 'bg-green-100 text-green-800' :
                            txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            txn.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(txn.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {txn.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryFailedTransaction(txn.id)}
                            >
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Failed Tab */}
          <TabsContent value="failed" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Failed Transactions</h3>
              <p className="text-sm text-gray-600 mb-4">
                Review and retry failed transactions. Failed transactions may be due to insufficient funds, 
                card errors, or gateway issues.
              </p>
              {/* Filtered failed transactions */}
              <div className="space-y-3">
                {transactions.filter(t => t.status === 'failed').map(txn => (
                  <div key={txn.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{txn.customer}</p>
                      <p className="text-sm text-gray-600">{txn.id}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold">₹{txn.amount.toLocaleString()}</p>
                      <Button
                        size="sm"
                        onClick={() => retryFailedTransaction(txn.id)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Refunds Tab */}
          <TabsContent value="refunds" className="space-y-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Refunded Transactions</h3>
              <p className="text-sm text-gray-600 mb-4">
                View all refunded transactions and their reconciliation status.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
