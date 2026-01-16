'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  Package,
  Loader2,
  Download,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface EarningsSummary {
  totalEarnings: number;
  totalRevenue: number;
  totalCommission: number;
  totalGST: number;
  pendingEarnings: number;
  lastSettlement: number;
  lastSettlementDate: string | null;
  thisMonth: number;
  lastMonth: number;
  totalBookings: number;
  completedBookings: number;
  averageBookingValue: number;
}

interface Transaction {
  id: string;
  booking_date: string;
  booking_time?: string;
  total_amount: number;
  status: string;
  service_style?: string;
  service_name: string;
  customer_name?: string;
  pet_name?: string;
  transaction_type: 'booking' | 'settlement';
  description: string;
}

export default function StaffEarningsPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        try {
          const staffData = JSON.parse(staffSession);
          setStaff(staffData);
          loadEarnings(staffData.id);
        } catch (error) {
          console.error('Error parsing staff session:', error);
          router.push('/staff/login');
        }
      } else {
        router.push('/staff/login');
      }
    }
  }, [router, period]);

  const loadEarnings = async (staffId: string) => {
    try {
      setLoading(true);
      
      const [summaryRes, transactionsRes] = await Promise.all([
        apiClient.get<any>(`/staff/${staffId}/earnings?period=${period}`),
        apiClient.get<any>(`/staff/${staffId}/earnings/transactions?period=${period}`),
      ]);

      if (summaryRes.success) {
        setSummary(summaryRes.summary);
      } else {
        throw new Error(summaryRes.error || 'Failed to load earnings');
      }

      if (transactionsRes.success) {
        setTransactions(transactionsRes.transactions || []);
      }
    } catch (error: any) {
      console.error('[EARNINGS] Error:', error);
      toast.error(error.message || 'Failed to load earnings');
      setSummary({
        totalEarnings: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalGST: 0,
        pendingEarnings: 0,
        lastSettlement: 0,
        lastSettlementDate: null,
        thisMonth: 0,
        lastMonth: 0,
        totalBookings: 0,
        completedBookings: 0,
        averageBookingValue: 0,
      });
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'booking': return '📅';
      case 'settlement': return '💸';
      default: return '💵';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'booking': return 'text-green-600';
      case 'settlement': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#FF8C42] mx-auto mb-4" />
          <p className="text-gray-600">Loading earnings...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Failed to load earnings</p>
        </div>
      </div>
    );
  }

  const monthChange = summary.lastMonth > 0 
    ? ((summary.thisMonth - summary.lastMonth) / summary.lastMonth * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => router.push('/staff/dashboard')}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">My Earnings</h1>
              <p className="text-sm text-gray-600">Revenue, settlements, and transactions</p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="px-4 pb-4">
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('week')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  period === 'week' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                This Week
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  period === 'month' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setPeriod('year')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  period === 'year' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                This Year
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Earnings */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Earnings</p>
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ₹{summary.totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              After commission & GST
            </p>
          </div>

          {/* Pending Earnings */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Pending</p>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ₹{summary.pendingEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Awaiting settlement
            </p>
          </div>

          {/* This Month */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">This Month</p>
              {parseFloat(monthChange) >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ₹{summary.thisMonth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className={`text-xs mt-1 ${parseFloat(monthChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(monthChange) >= 0 ? '+' : ''}{monthChange}% vs last month
            </p>
          </div>

          {/* Total Bookings */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Completed</p>
              <Package className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{summary.completedBookings}</p>
            <p className="text-xs text-gray-500 mt-1">
              Avg: ₹{summary.averageBookingValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="p-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Earnings Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-medium">₹{summary.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Platform Commission (15%)</span>
                <span>-₹{summary.totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>GST on Commission (18%)</span>
                <span>-₹{summary.totalGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span className="text-gray-900">Your Earnings</span>
                <span className="text-green-600">₹{summary.totalEarnings.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Last Settlement */}
        {summary.lastSettlement > 0 && (
          <div className="p-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Last Settlement</p>
                  <p className="text-lg font-bold text-blue-900">
                    ₹{summary.lastSettlement.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  {summary.lastSettlementDate && (
                    <p className="text-xs text-blue-600 mt-1">
                      {formatDate(summary.lastSettlementDate)}
                    </p>
                  )}
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="p-4">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Transactions</h3>
              <p className="text-xs text-gray-500 mt-1">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} in this {period}
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No transactions found</p>
                </div>
              ) : (
                transactions.map((transaction) => (
                  <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="text-2xl">{getTransactionIcon(transaction.transaction_type)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900">{transaction.description}</p>
                            <Badge variant="outline" className="text-xs">
                              {transaction.transaction_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(transaction.booking_date)}
                            </span>
                            {transaction.booking_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(transaction.booking_time)}
                              </span>
                            )}
                            {transaction.service_style && (
                              <Badge variant="outline" className="text-xs">
                                {transaction.service_style}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.transaction_type === 'settlement' ? '+' : ''}
                          ₹{transaction.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {transaction.status === 'completed' ? 'Completed' : transaction.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
