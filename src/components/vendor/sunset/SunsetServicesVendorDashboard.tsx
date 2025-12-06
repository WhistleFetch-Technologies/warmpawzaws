import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Heart, Clock, CheckCircle, Phone, MapPin } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface SunsetServicesVendorDashboardProps {
  vendorId: string;
}

interface Booking {
  id: string;
  customerName: string;
  petName?: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  specialInstructions?: string;
  customerPhone: string;
  customerAddress: string;
}

export function SunsetServicesVendorDashboard({ vendorId }: SunsetServicesVendorDashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    scheduled: 0,
    completed: 0,
    revenue: 0
  });

  useEffect(() => {
    loadBookings();
  }, [vendorId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/vendor/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const bookingsList = data.bookings || [];
        setBookings(bookingsList);

        // Calculate stats
        const pending = bookingsList.filter((b: Booking) => b.status === 'pending').length;
        const scheduled = bookingsList.filter((b: Booking) => b.status === 'confirmed').length;
        const completed = bookingsList.filter((b: Booking) => b.status === 'completed').length;
        const revenue = bookingsList
          .filter((b: Booking) => b.status === 'completed')
          .reduce((sum: number, b: Booking) => sum + b.price, 0);

        setStats({
          pending,
          scheduled,
          completed,
          revenue
        });
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${bookingId}/status`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: newStatus,
            updatedBy: vendorId,
            note: `Status updated to ${newStatus}`
          })
        }
      );

      if (response.ok) {
        loadBookings();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const scheduledBookings = bookings.filter(b => b.status === 'confirmed');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 px-6 py-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8" />
            <div>
              <h1 className="text-xl">Pet Sunset Services</h1>
              <p className="text-sm text-purple-200">Compassionate care in difficult times</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Requests</p>
                <p className="text-3xl text-gray-900 mt-1">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduled Services</p>
                <p className="text-3xl text-gray-900 mt-1">{stats.scheduled}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl text-gray-900 mt-1">{stats.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl text-gray-900 mt-1">₹{stats.revenue.toLocaleString()}</p>
              </div>
              <Heart className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Pending Requests - Urgent attention needed */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h2 className="text-lg text-gray-900">Pending Requests - Urgent Attention Needed</h2>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {pendingBookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Heart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No pending requests</p>
              </div>
            ) : (
              pendingBookings.map((booking) => (
                <div key={booking.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base text-gray-900">{booking.customerName}</h3>
                        <Badge className={`${getStatusColor(booking.status)} text-xs`}>
                          {booking.status}
                        </Badge>
                      </div>
                      {booking.petName && (
                        <p className="text-sm text-purple-600 mb-1">🐾 {booking.petName}</p>
                      )}
                      <p className="text-sm text-gray-600 mb-2">{booking.serviceName}</p>
                      <div className="flex flex-col gap-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {booking.customerPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {booking.customerAddress}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(booking.bookingDate).toLocaleDateString()} at {booking.bookingTime}
                        </span>
                      </div>
                      {booking.specialInstructions && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Special Instructions:</strong> {booking.specialInstructions}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Accept & Schedule
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Unable to Service
                      </Button>
                      <a href={`tel:${booking.customerPhone}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scheduled Services */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg text-gray-900">Scheduled Services</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {scheduledBookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No scheduled services</p>
              </div>
            ) : (
              scheduledBookings.map((booking) => (
                <div key={booking.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base text-gray-900">{booking.customerName}</h3>
                        <Badge className={`${getStatusColor(booking.status)} text-xs`}>
                          {booking.status}
                        </Badge>
                      </div>
                      {booking.petName && (
                        <p className="text-sm text-purple-600 mb-1">🐾 {booking.petName}</p>
                      )}
                      <p className="text-sm text-gray-600 mb-1">{booking.serviceName}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(booking.bookingDate).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {booking.bookingTime}
                        </span>
                        <span>₹{booking.price}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleStatusUpdate(booking.id, 'in_progress')}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        Start Service
                      </Button>
                      <a href={`tel:${booking.customerPhone}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                        >
                          <Phone className="w-4 h-4 mr-1" />
                          Call
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
