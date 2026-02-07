import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  Calendar,
  DollarSign,
  Clock,
  Star,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';

interface StaffAnalyticsProps {
  staff: any;
  onBack: () => void;
}

export function StaffAnalytics({ staff, onBack }: StaffAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadAnalytics();
  }, [period, staff.id]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/analytics?period=${period}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto pb-20">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl text-white">Analytics</h1>
            <p className="text-sm text-white/90">{staff.fullName}</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors ${
                period === p
                  ? 'bg-white text-[#FF8C42]'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#FF8C42]" />
              <span className="text-xs text-gray-600">Total</span>
            </div>
            <p className="text-gray-900">{analytics?.totalAppointments || 0}</p>
            <p className="text-xs text-gray-500">Appointments</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">Completed</span>
            </div>
            <p className="text-gray-900">{analytics?.completedAppointments || 0}</p>
            <p className="text-xs text-gray-500">Appointments</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">Earnings</span>
            </div>
            <p className="text-gray-900">₹{(analytics?.totalEarnings || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total revenue</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">Success Rate</span>
            </div>
            <p className="text-gray-900">{analytics?.completionRate || 0}%</p>
            <p className="text-xs text-gray-500">Completion</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-600">Rating</span>
            </div>
            <p className="text-gray-900">{(analytics?.averageRating || 0).toFixed(1)}</p>
            <p className="text-xs text-gray-500">Average rating</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-600">Upcoming</span>
            </div>
            <p className="text-gray-900">{analytics?.upcoming || 0}</p>
            <p className="text-xs text-gray-500">Appointments</p>
          </div>
        </div>

        {/* Additional Stats */}
        {analytics?.cancelled > 0 && (
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-700">Cancelled</span>
              </div>
              <span className="text-lg text-gray-900">{analytics.cancelled}</span>
            </div>
          </div>
        )}

        {/* Performance Message */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
          <h3 className="text-sm text-gray-900 mb-2">Performance Summary</h3>
          <p className="text-xs text-gray-600">
            {analytics?.completionRate >= 90
              ? '🎉 Excellent performance! Keep up the great work!'
              : analytics?.completionRate >= 75
              ? '👍 Good job! You\'re doing well.'
              : '💪 Keep improving! Focus on completing appointments.'}
          </p>
        </div>
      </div>
    </div>
  );
}