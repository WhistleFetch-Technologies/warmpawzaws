'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Search, Filter, Loader2, Download } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Transaction {
  transactionId: string;
  transactionNumber: string;
  bookingId: string;
  amount: number;
  type: 'payment' | 'refund' | 'payout';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: string;
  customerName: string;
  vendorName: string;
  createdAt: string;
}

interface TransactionStats {
  totalTransactions: number;
  totalAmount: number;
  successfulTransactions: number;
  failedTransactions: number;
  pendingTransactions: number;
}

export function TransactionMonitoring() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats>({
    totalTransactions: 0,
    totalAmount: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    pendingTransactions: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transactionsData, statsData] = await Promise.all([
        apiClient.get<any>('/admin/transactions'),
        apiClient.get<any>('/admin/transactions/stats'),
      ]);

      if (transactionsData.success) setTransactions(transactionsData.transactions || []);
      if (statsData.success) setStats(statsData.stats);
    } catch (error) {
      console.error('Error loading transactions:', error);
      alert('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await apiClient.get<any>('/admin/transactions/export');
      if (data.success && data.exportData) {
        const blob = new Blob([data.exportData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to export transactions');
      }
    } catch (error) {
      console.error('Error exporting transactions:', error);
      alert('An error occurred during export');
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || transaction.type === filterType;
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-0 bg-green-100 rounded-xl">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction Monitoring</h1>
            <p className="text-sm text-gray-600">Monitor all platform transactions</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-3 px-4 py-0 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Total Amount</p>
          <p className="text-2xl font-bold text-gray-900">₹{stats.totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Successful</p>
          <p className="text-2xl font-bold text-green-600">{stats.successfulTransactions}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Failed</p>
          <p className="text-2xl font-bold text-red-600">{stats.failedTransactions}</p>
        </div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-0">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pendingTransactions}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={filterType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value)}
              className="px-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Types</option>
              <option value="payment">Payment</option>
              <option value="refund">Refund</option>
              <option value="payout">Payout</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
              className="px-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Transaction #</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Booking ID</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-0 py-0 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <tr key={transaction.transactionId} className="hover:bg-gray-50">
                <td className="px-0 py-4 font-medium text-gray-900">{transaction.transactionNumber}</td>
                <td className="px-0 py-4 text-sm text-gray-600">{transaction.bookingId}</td>
                <td className="px-0 py-4 text-sm text-gray-900">{transaction.customerName}</td>
                <td className="px-0 py-4 text-sm text-gray-900">{transaction.vendorName}</td>
                <td className="px-0 py-4 font-medium text-gray-900">₹{transaction.amount.toLocaleString()}</td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    transaction.type === 'payment' ? 'bg-blue-100 text-blue-700' :
                    transaction.type === 'refund' ? 'bg-orange-100 text-orange-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {transaction.type.toUpperCase()}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">{transaction.paymentMethod}</td>
                <td className="px-0 py-4">
                  <span className={`px-0 py-0 text-xs font-medium rounded ${
                    transaction.status === 'completed' ? 'bg-green-100 text-green-700' :
                    transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    transaction.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {transaction.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-0 py-4 text-sm text-gray-600">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
