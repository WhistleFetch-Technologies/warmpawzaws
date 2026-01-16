'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { 
  Calendar, 
  DollarSign, 
  MessageSquare, 
  Settings, 
  MapPin, 
  Clock,
  LogOut,
  User,
  Package,
  Navigation,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function StaffDashboardPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingAppointments: 0,
    totalEarnings: 0,
    completedServices: 0,
  });

  useEffect(() => {
    // Check if logged in
    if (typeof window !== 'undefined') {
      const staffSession = localStorage.getItem('staff_session');
      if (!staffSession) {
        router.push('/staff/login');
        return;
      }

      try {
        const staffData = JSON.parse(staffSession);
        setStaff(staffData);
        loadStats(staffData.id);
      } catch (error) {
        console.error('Error parsing staff session:', error);
        router.push('/staff/login');
      }
    }
  }, [router]);

  const loadStats = async (staffId: string) => {
    try {
      // Load today's appointments
      const today = new Date().toISOString().split('T')[0];
      const appointments = await apiClient.get<any>(`/staff/${staffId}/appointments?date=${today}`);
      
      // Load earnings (placeholder - implement earnings endpoint)
      // const earnings = await apiClient.get(`/staff/${staffId}/earnings`);

      setStats({
        todayAppointments: appointments.appointments?.length || 0,
        pendingAppointments: appointments.appointments?.filter((a: any) => a.status === 'pending')?.length || 0,
        totalEarnings: 0, // TODO: Implement earnings endpoint
        completedServices: appointments.appointments?.filter((a: any) => a.status === 'completed')?.length || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('staff_session');
      localStorage.removeItem('staff_id');
      router.push('/staff/login');
      toast.success('Logged out successfully');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!staff) {
    return null;
  }

  const menuItems = [
    {
      title: 'Appointments',
      description: 'View and manage bookings',
      icon: Calendar,
      href: '/staff/appointments',
      color: 'bg-blue-500',
    },
    {
      title: 'Services',
      description: 'Manage your services',
      icon: Package,
      href: '/staff/services',
      color: 'bg-green-500',
    },
    {
      title: 'Schedule',
      description: 'Set your availability',
      icon: Clock,
      href: '/staff/schedule',
      color: 'bg-purple-500',
    },
    {
      title: 'Location',
      description: 'Set your service location',
      icon: MapPin,
      href: '/staff/location',
      color: 'bg-orange-500',
    },
    {
      title: 'Messages',
      description: 'Chat with customers',
      icon: MessageSquare,
      href: '/staff/messages',
      color: 'bg-pink-500',
    },
    {
      title: 'Earnings',
      description: 'View revenue and settlements',
      icon: DollarSign,
      href: '/staff/earnings',
      color: 'bg-yellow-500',
    },
    {
      title: 'Profile',
      description: 'Update your profile',
      icon: User,
      href: '/staff/profile',
      color: 'bg-indigo-500',
    },
    {
      title: 'Settings',
      description: 'Account settings',
      icon: Settings,
      href: '/staff/settings',
      color: 'bg-gray-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {staff.photo ? (
              <img
                src={staff.photo}
                alt={staff.name}
                className="w-12 h-12 rounded-full border-2 border-white"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">Welcome, {staff.name}</h1>
              <p className="text-sm text-white/90">
                {staff.isIndividualProvider ? 'Individual Provider' : staff.vendor?.businessName || 'Staff Member'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayAppointments}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingAppointments}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedServices}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900">₹{stats.totalEarnings.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group"
              >
                <div className={`w-12 h-12 ${item.color} rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-xs text-gray-600">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
