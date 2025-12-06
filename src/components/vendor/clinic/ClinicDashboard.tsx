import { useState, useEffect } from 'react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { 
  Users, 
  Calendar, 
  TrendingUp,
  Plus,
  Search,
  Filter,
  Bell,
  UserPlus,
  Stethoscope,
  Clock,
  DollarSign,
  Star,
  Settings
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { DoctorManagement } from './DoctorManagement';

interface ClinicDashboardProps {
  clinicId: string;
  clinicData: any;
  onNavigateToDoctorManagement?: () => void;
  onNavigateToSettings?: () => void;
}

interface AppointmentItem {
  id: string;
  bookingId: string;
  date: string;
  time: string;
  customerName: string;
  petName: string;
  petType: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string[];
  serviceName: string;
  consultationType: string;
  status: string;
  customerAtLobby?: boolean;
}

export function ClinicDashboard({ 
  clinicId, 
  clinicData,
  onNavigateToDoctorManagement,
  onNavigateToSettings
}: ClinicDashboardProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalDoctors: 0,
    todayAppointments: 0,
    activeAppointments: 0,
    monthlyRevenue: 0,
    rating: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDoctorManagement, setShowDoctorManagement] = useState(false);

  useEffect(() => {
    fetchClinicData();
  }, [clinicId]);

  const fetchClinicData = async () => {
    try {
      setLoading(true);

      // Fetch clinic details and doctors
      const clinicResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/clinic/${clinicId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (clinicResponse.ok) {
        const clinicData = await clinicResponse.json();
        setDoctors(clinicData.doctors || []);
        setStats(prev => ({
          ...prev,
          totalDoctors: clinicData.totalDoctors || 0,
          rating: clinicData.clinic.rating || 0
        }));
      }

      // Fetch appointments
      await fetchAppointments();

    } catch (error) {
      console.error('[CLINIC DASHBOARD] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const appointmentsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/clinic/${clinicId}/appointments?status=${statusFilter}&date=${activeTab === 'today' ? today : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (appointmentsResponse.ok) {
        const data = await appointmentsResponse.json();
        setAppointments(data.appointments || []);
        
        // Update stats
        const todayAppointments = data.appointments.filter((a: any) => a.date === today);
        const activeAppointments = data.appointments.filter((a: any) => 
          a.status === 'confirmed' || a.status === 'in_progress'
        );
        
        setStats(prev => ({
          ...prev,
          todayAppointments: todayAppointments.length,
          activeAppointments: activeAppointments.length
        }));
      }
    } catch (error) {
      console.error('[CLINIC DASHBOARD] Error fetching appointments:', error);
    }
  };

  const notifyDoctorAtLobby = async (appointment: AppointmentItem) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/clinic/${clinicId}/notify-doctor`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            doctorId: appointment.doctorId,
            bookingId: appointment.bookingId,
            customerName: appointment.customerName
          })
        }
      );

      if (response.ok) {
        alert(`Dr. ${appointment.doctorName} has been notified that ${appointment.customerName} is at the lobby.`);
        fetchAppointments(); // Refresh to update lobby status
      } else {
        throw new Error('Failed to notify doctor');
      }
    } catch (error) {
      console.error('[NOTIFY DOCTOR] Error:', error);
      alert('Failed to notify doctor. Please try again.');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; text: string }> = {
      confirmed: { color: 'bg-blue-100 text-blue-800', text: 'Confirmed' },
      in_progress: { color: 'bg-yellow-100 text-yellow-800', text: 'In Progress' },
      completed: { color: 'bg-green-100 text-green-800', text: 'Completed' },
      cancelled: { color: 'bg-red-100 text-red-800', text: 'Cancelled' }
    };

    const variant = variants[status] || variants.confirmed;
    
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${variant.color}`}>
        {variant.text}
      </span>
    );
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        appointment.customerName.toLowerCase().includes(query) ||
        appointment.petName.toLowerCase().includes(query) ||
        appointment.doctorName.toLowerCase().includes(query) ||
        appointment.serviceName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clinic dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" style={{ maxWidth: '430px', margin: '0 auto' }}>
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{clinicData.businessName}</h1>
            <p className="text-sm opacity-90">Clinic Management</p>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalDoctors}</p>
            <p className="text-xs opacity-90">Doctors</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <Calendar className="w-5 h-5 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.todayAppointments}</p>
            <p className="text-xs opacity-90">Today</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.activeAppointments}</p>
            <p className="text-xs opacity-90">Active</p>
          </div>
        </div>
      </div>

      {/* Doctor Management Button */}
      <div className="p-4">
        <button
          onClick={() => setShowDoctorManagement(true)}
          className="w-full bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex items-center justify-between hover:bg-[#FF8C42] hover:text-white transition-colors"
        >
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6" />
            <div className="text-left">
              <p className="font-semibold">Manage Doctors</p>
              <p className="text-sm opacity-75">Add, edit, or remove doctors</p>
            </div>
          </div>
          <span className="text-2xl">→</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-xl p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'today'
                ? 'bg-[#FF8C42] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'upcoming'
                ? 'bg-[#FF8C42] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-[#FF8C42] text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="px-4 mb-4">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search appointments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {['all', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status as any);
                fetchAppointments();
              }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#FF8C42]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Appointments List */}
      <div className="px-4 space-y-3">
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No appointments found</p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'today' ? 'No appointments scheduled for today' : 'No appointments in this category'}
            </p>
          </div>
        ) : (
          filteredAppointments.map((appointment) => (
            <div key={appointment.id} className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#FF8C42] transition-colors">
              {/* Header Row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{appointment.customerName}</h3>
                    {appointment.customerAtLobby && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full flex items-center gap-1">
                        <Bell className="w-3 h-3" />
                        At Lobby
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {appointment.petName} ({appointment.petType})
                  </p>
                </div>
                {getStatusBadge(appointment.status)}
              </div>

              {/* Doctor Info */}
              <div className="bg-orange-50 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope className="w-4 h-4 text-[#FF8C42]" />
                  <p className="font-medium text-gray-900">Dr. {appointment.doctorName}</p>
                </div>
                {appointment.doctorSpecialization && appointment.doctorSpecialization.length > 0 && (
                  <p className="text-xs text-gray-600 ml-6">
                    {appointment.doctorSpecialization.join(', ')}
                  </p>
                )}
              </div>

              {/* Appointment Details */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Date & Time</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(appointment.date).toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'short' 
                    })}
                  </p>
                  <p className="text-sm text-gray-600">{appointment.time}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Service</p>
                  <p className="text-sm font-medium text-gray-900">{appointment.serviceName}</p>
                  <p className="text-xs text-gray-600 capitalize">{appointment.consultationType.replace('_', ' ')}</p>
                </div>
              </div>

              {/* Action Buttons */}
              {appointment.status === 'confirmed' && !appointment.customerAtLobby && (
                <button
                  onClick={() => notifyDoctorAtLobby(appointment)}
                  className="w-full bg-[#FF8C42] text-white rounded-lg py-2.5 font-medium flex items-center justify-center gap-2 hover:bg-[#FF7A29] transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  Notify Doctor - Customer at Lobby
                </button>
              )}

              {appointment.customerAtLobby && appointment.status === 'confirmed' && (
                <div className="w-full bg-yellow-100 text-yellow-800 rounded-lg py-2.5 px-3 text-center text-sm font-medium">
                  ✓ Doctor has been notified
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Bottom Navigation Hint */}
      <div className="h-20"></div>

      {/* Doctor Management Screen */}
      {showDoctorManagement && (
        <div className="fixed inset-0 z-50 bg-white">
          <DoctorManagement
            clinicId={clinicId}
            clinicData={clinicData}
            onBack={() => {
              setShowDoctorManagement(false);
              fetchClinicData(); // Refresh stats after managing doctors
            }}
          />
        </div>
      )}
    </div>
  );
}