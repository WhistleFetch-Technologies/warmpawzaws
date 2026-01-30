import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Calendar,
  Clock,
  TrendingUp,
  Settings,
  BarChart3,
  Bell,
  User,
  LogOut,
  Briefcase,
  DollarSign
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'sonner';
import { StaffScheduleManagement } from '../vendor/StaffScheduleManagement'; // ✅ Self-service schedule management
import { StaffAnalytics } from './StaffAnalytics'; // ✅ Staff analytics view
import { StaffServiceManagement } from './StaffServiceManagement'; // ✅ Staff service management
import { LocationScheduleManager } from './LocationScheduleManager'; // ✅ Location & availability window management
import { ServiceStyleManager } from './ServiceStyleManager'; // ✅ Service style management (at_home, at_center, tele)

interface StaffDashboardProps {
  staff: any;
  onLogout: () => void;
}

export function StaffDashboard({ staff, onLogout }: StaffDashboardProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'appointments' | 'analytics' | 'services' | 'schedule' | 'availability' | 'styles'>('appointments');

  useEffect(() => {
    loadData();
  }, [staff.id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load appointments (all statuses)
      const appointmentsRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/appointments`,
        {
          headers: getAuthHeaders()
        }
      );

      if (appointmentsRes.ok) {
        const data = await appointmentsRes.json();
        console.log(`✅ Loaded ${data.appointments?.length || 0} appointments for staff`);
        setAppointments(data.appointments || []);
      } else {
        console.error('❌ Failed to load appointments:', await appointmentsRes.text());
      }

      // Load analytics
      const analyticsRes = await fetch(
        `${getApiBaseUrl()}/staff/${staff.id}/analytics?period=month`,
        {
          headers: getAuthHeaders()
        }
      );

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      }

    } catch (error) {
      console.error('Error loading staff data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (roleType: string) => {
    switch (roleType) {
      case 'vet':
      case 'clinic_doctor':
        return 'Veterinarian';
      case 'groomer':
        return 'Groomer';
      case 'trainer':
        return 'Trainer';
      default:
        return 'Staff';
    }
  };

  const getRoleColor = (roleType: string) => {
    // Always use orange brand color for consistency
    return 'bg-gradient-to-br from-[#FF8C42] to-[#FF7425]';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto pb-20">
      {/* Render Analytics View */}
      {activeView === 'analytics' && (
        <StaffAnalytics 
          staff={staff}
          onBack={() => setActiveView('appointments')}
        />
      )}

      {/* Render Services View */}
      {activeView === 'services' && (
        <StaffServiceManagement
          staff={staff}
          onBack={() => setActiveView('appointments')}
        />
      )}

      {/* Render Schedule View */}
      {activeView === 'schedule' && (
        <StaffScheduleManagement
          staffId={staff.id}
          staffName={staff.fullName}
          vendorId={staff.vendorId}
          onClose={() => setActiveView('appointments')}
        />
      )}

      {/* Render Availability View */}
      {activeView === 'availability' && (
        <LocationScheduleManager
          staff={staff}
          onBack={() => setActiveView('appointments')}
        />
      )}

      {/* Render Service Styles View */}
      {activeView === 'styles' && (
        <ServiceStyleManager
          staff={staff}
          onBack={() => setActiveView('appointments')}
        />
      )}

      {/* Appointments View (Default) */}
      {activeView === 'appointments' && (
        <>
          {/* Header */}
          <div className={`${getRoleColor(staff.roleType)} text-white p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {staff.photo ? (
                  <img
                    src={staff.photo}
                    alt={staff.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="text-white">{staff.fullName}</h2>
                  <p className="text-sm text-white/90">{getRoleLabel(staff.roleType)}</p>
                </div>
              </div>
              <Button
                onClick={onLogout}
                variant="ghost"
                className="text-white hover:bg-white/20"
                size="sm"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick Action: Service Styles */}
            <button
              onClick={() => setActiveView('styles')}
              className="w-full bg-white/20 hover:bg-white/30 text-white rounded-lg px-4 py-2 flex items-center justify-between transition-colors"
            >
              <span className="text-sm">Service Styles (Home/Center/Tele)</span>
              <Settings className="w-4 h-4" />
            </button>

            {/* Specializations */}
            {staff.specializations && staff.specializations.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {staff.specializations.map((spec: string, index: number) => (
                  <Badge key={index} variant="secondary" className="bg-white/20 text-white border-0">
                    {spec}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Stats Cards */}
          {analytics && (
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border-2 border-[#FF8C42]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-xs text-gray-600">This Month</span>
                </div>
                <p className="text-gray-900">{analytics.totalAppointments}</p>
                <p className="text-xs text-gray-500">Appointments</p>
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-[#FF8C42]">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-xs text-gray-600">Earnings</span>
                </div>
                <p className="text-gray-900">₹{analytics.totalEarnings.toLocaleString()}</p>
                <p className="text-xs text-gray-500">This month</p>
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-[#FF8C42]">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-xs text-gray-600">Completion</span>
                </div>
                <p className="text-gray-900">{analytics.completionRate}%</p>
                <p className="text-xs text-gray-500">Success rate</p>
              </div>

              <div className="bg-white rounded-xl p-4 border-2 border-[#FF8C42]">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-xs text-gray-600">Upcoming</span>
                </div>
                <p className="text-gray-900">{analytics.upcoming}</p>
                <p className="text-xs text-gray-500">Appointments</p>
              </div>
            </div>
          )}

          {/* Today's Appointments */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-gray-900">Today's Appointments</h3>
              <Badge variant="secondary">{appointments.length}</Badge>
            </div>

            {appointments.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border-2 border-[#FF8C42]">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">No appointments today</p>
                <p className="text-sm text-gray-500">Enjoy your day!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="bg-white rounded-xl p-4 border-2 border-[#FF8C42]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{appointment.time || 'Not set'}</span>
                      </div>
                      <Badge variant="secondary" className="bg-green-50 text-green-700">
                        {appointment.status}
                      </Badge>
                    </div>

                    <h4 className="text-gray-900 mb-1">{appointment.customerName}</h4>
                    <div className="text-sm text-gray-600">
                      {appointment.petName} • {appointment.petType}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {appointment.serviceName}
                    </div>

                    {appointment.price && (
                      <div className="text-sm text-[#FF8C42] mt-2">
                        ₹{appointment.price.toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Navigation */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 mx-auto max-w-[430px]">
            <div className="grid grid-cols-5 gap-1 p-2">
              <button
                onClick={() => setActiveView('appointments')}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                  activeView === 'appointments' ? 'bg-orange-50 text-[#FF8C42]' : 'text-gray-600'
                }`}
              >
                <Calendar className="w-5 h-5" />
                <span className="text-xs">Appointments</span>
              </button>

              <button
                onClick={() => setActiveView('analytics')}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                  activeView === 'analytics' ? 'bg-orange-50 text-[#FF8C42]' : 'text-gray-600'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span className="text-xs">Analytics</span>
              </button>

              <button
                onClick={() => setActiveView('services')}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                  activeView === 'services' ? 'bg-orange-50 text-[#FF8C42]' : 'text-gray-600'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span className="text-xs">Services</span>
              </button>

              <button
                onClick={() => setActiveView('schedule')}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                  activeView === 'schedule' ? 'bg-orange-50 text-[#FF8C42]' : 'text-gray-600'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="text-xs">Schedule</span>
              </button>

              <button
                onClick={() => setActiveView('availability')}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                  activeView === 'availability' ? 'bg-orange-50 text-[#FF8C42]' : 'text-gray-600'
                }`}
              >
                <Bell className="w-5 h-5" />
                <span className="text-xs">Availability</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}