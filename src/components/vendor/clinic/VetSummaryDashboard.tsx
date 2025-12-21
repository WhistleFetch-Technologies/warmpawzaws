import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Calendar, TrendingUp, Users, FileText, Clock, Activity, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface VetSummaryDashboardProps {
  vendorId: string;
  vendorName: string;
}

interface SummaryStats {
  today: {
    consultations: number;
    prescriptions: number;
    revenue: number;
    avgConsultationTime: number;
  };
  week: {
    consultations: number;
    prescriptions: number;
    revenue: number;
    newPatients: number;
  };
  month: {
    consultations: number;
    prescriptions: number;
    revenue: number;
    repeatPatients: number;
  };
  topConditions: Array<{ condition: string; count: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    petName: string;
    customerName: string;
    time: string;
    summary: string;
  }>;
}

export function VetSummaryDashboard({ vendorId, vendorName }: VetSummaryDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [stats, setStats] = useState<SummaryStats>({
    today: { consultations: 0, prescriptions: 0, revenue: 0, avgConsultationTime: 0 },
    week: { consultations: 0, prescriptions: 0, revenue: 0, newPatients: 0 },
    month: { consultations: 0, prescriptions: 0, revenue: 0, repeatPatients: 0 },
    topConditions: [],
    recentActivity: []
  });

  useEffect(() => {
    loadSummaryData();
  }, [vendorId]);

  const loadSummaryData = async () => {
    try {
      setLoading(true);

      // Load bookings for analysis
      const bookingsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/bookings`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        // ✅ FIX: Handle standardized response format
        // Response format: { success: true, bookings: [...], total: ... }
        const bookings = bookingsData.bookings || bookingsData.data?.bookings || [];

        // Calculate stats
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Today's stats
        const todayBookings = bookings.filter((b: any) => 
          new Date(b.createdAt) >= todayStart
        );

        // Week's stats
        const weekBookings = bookings.filter((b: any) => 
          new Date(b.createdAt) >= weekStart
        );

        // Month's stats
        const monthBookings = bookings.filter((b: any) => 
          new Date(b.createdAt) >= monthStart
        );

        // Count prescriptions (would need actual prescription data)
        const todayCompleted = todayBookings.filter((b: any) => b.status === 'completed').length;
        const weekCompleted = weekBookings.filter((b: any) => b.status === 'completed').length;
        const monthCompleted = monthBookings.filter((b: any) => b.status === 'completed').length;

        // Calculate revenue
        const todayRevenue = todayBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
        const weekRevenue = weekBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
        const monthRevenue = monthBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);

        // Recent activity
        const recentActivity = bookings
          .slice(0, 10)
          .map((b: any) => ({
            id: b.id,
            type: b.serviceType || 'consultation',
            petName: b.petName,
            customerName: b.customerName,
            time: new Date(b.createdAt).toLocaleString(),
            summary: b.serviceName || 'General Consultation'
          }));

        setStats({
          today: {
            consultations: todayBookings.length,
            prescriptions: todayCompleted,
            revenue: todayRevenue,
            avgConsultationTime: 30 // Would calculate from actual data
          },
          week: {
            consultations: weekBookings.length,
            prescriptions: weekCompleted,
            revenue: weekRevenue,
            newPatients: weekBookings.length // Would track unique customers
          },
          month: {
            consultations: monthBookings.length,
            prescriptions: monthCompleted,
            revenue: monthRevenue,
            repeatPatients: 0 // Would calculate from customer history
          },
          topConditions: [
            { condition: 'General Check-up', count: 15 },
            { condition: 'Vaccination', count: 12 },
            { condition: 'Skin Issues', count: 8 },
            { condition: 'Digestive Problems', count: 6 }
          ],
          recentActivity
        });
      }
    } catch (error: any) {
      console.error('Error loading summary data:', error);
      const errorMessage = error?.message || 'Failed to load vet summary data. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStats = () => {
    return stats[selectedPeriod];
  };

  const currentStats = getCurrentStats();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Veterinary Activity Summary</h1>
        <p className="text-gray-600">Comprehensive overview of your clinic's performance</p>
      </div>

      {/* Period Selector */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSelectedPeriod('today')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedPeriod === 'today'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setSelectedPeriod('week')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedPeriod === 'week'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setSelectedPeriod('month')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedPeriod === 'month'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          This Month
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Loading summary...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Consultations</p>
              <p className="text-2xl font-bold text-gray-900">{currentStats.consultations}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Prescriptions</p>
              <p className="text-2xl font-bold text-gray-900">{currentStats.prescriptions}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹{currentStats.revenue.toLocaleString()}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <Activity className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">
                {selectedPeriod === 'today' ? 'Avg Time' : selectedPeriod === 'week' ? 'New Patients' : 'Repeat Patients'}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {selectedPeriod === 'today' 
                  ? `${currentStats.avgConsultationTime} min`
                  : selectedPeriod === 'week'
                  ? currentStats.newPatients
                  : currentStats.repeatPatients}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Conditions */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Common Conditions</h3>
              <div className="space-y-3">
                {stats.topConditions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="text-gray-900">{item.condition}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-600">{item.count} cases</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {stats.recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No recent activity</p>
                  </div>
                ) : (
                  stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{activity.petName}</p>
                        <p className="text-xs text-gray-600">{activity.customerName}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.summary}</p>
                        <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button onClick={loadSummaryData} variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700">
              <FileText className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
