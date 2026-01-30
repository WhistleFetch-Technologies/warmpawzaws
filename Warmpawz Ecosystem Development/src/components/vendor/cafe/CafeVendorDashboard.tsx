import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Users, Clock, CheckCircle, XCircle, AlertCircle, Coffee } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface CafeVendorDashboardProps {
  vendorId: string;
}

interface Booking {
  id: string;
  customerName: string;
  petName?: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  numberOfPax?: number;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  specialInstructions?: string;
  customerPhone: string;
}

export function CafeVendorDashboard({ vendorId }: CafeVendorDashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0,
    upcoming: 0,
    totalPax: 0,
    revenue: 0
  });

  useEffect(() => {
    loadBookings();
  }, [vendorId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/bookings/vendor/${vendorId}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        const bookingsList = data.bookings || [];
        setBookings(bookingsList);

        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const todayBookings = bookingsList.filter((b: Booking) => b.bookingDate === today);
        const upcomingBookings = bookingsList.filter((b: Booking) => 
          b.bookingDate > today && (b.status === 'confirmed' || b.status === 'pending')
        );
        const totalPax = bookingsList
          .filter((b: Booking) => b.bookingDate === today)
          .reduce((sum: number, b: Booking) => sum + (b.numberOfPax || 1), 0);
        const revenue = bookingsList
          .filter((b: Booking) => b.status === 'completed')
          .reduce((sum: number, b: Booking) => sum + b.price, 0);

        setStats({
          today: todayBookings.length,
          upcoming: upcomingBookings.length,
          totalPax,
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
        `${getApiBaseUrl()}/bookings/${bookingId}/status`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
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

  const todayBookings = bookings.filter(b => b.bookingDate === new Date().toISOString().split('T')[0]);
  const upcomingBookings = bookings.filter(b => b.bookingDate > new Date().toISOString().split('T')[0]);

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
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coffee className="w-8 h-8 text-[#FF8C42]" />
            <div>
              <h1 className="text-xl text-gray-900">Pet Cafe Dashboard</h1>
              <p className="text-sm text-gray-600">Manage reservations & bookings</p>
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
                <p className="text-sm text-gray-600">Today's Bookings</p>
                <p className="text-3xl text-gray-900 mt-1">{stats.today}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Guests</p>
                <p className="text-3xl text-gray-900 mt-1">{stats.totalPax}</p>
              </div>
              <Users className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Upcoming</p>
                <p className="text-3xl text-gray-900 mt-1">{stats.upcoming}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl text-gray-900 mt-1">₹{stats.revenue.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Today's Bookings */}
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg text-gray-900">Today's Reservations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {todayBookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Coffee className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No reservations for today</p>
              </div>
            ) : (
              todayBookings.map((booking) => (
                <div key={booking.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base text-gray-900">{booking.customerName}</h3>
                        <Badge className={`${getStatusColor(booking.status)} text-xs`}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{booking.serviceName}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {booking.bookingTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {booking.numberOfPax || 1} pax
                        </span>
                        {booking.petName && (
                          <span>🐾 {booking.petName}</span>
                        )}
                      </div>
                      {booking.specialInstructions && (
                        <p className="text-sm text-gray-500 mt-2 italic">
                          Note: {booking.specialInstructions}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      {booking.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                            className="border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Decline
                          </Button>
                        </>
                      )}
                      {booking.status === 'confirmed' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusUpdate(booking.id, 'in_progress')}
                          className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                        >
                          Check In
                        </Button>
                      )}
                      {booking.status === 'in_progress' && (
                        <Button
                          size="sm"
                          onClick={() => handleStatusUpdate(booking.id, 'completed')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg text-gray-900">Upcoming Reservations</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {upcomingBookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No upcoming reservations</p>
              </div>
            ) : (
              upcomingBookings.slice(0, 10).map((booking) => (
                <div key={booking.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base text-gray-900">{booking.customerName}</h3>
                        <Badge className={`${getStatusColor(booking.status)} text-xs`}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{booking.serviceName}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{new Date(booking.bookingDate).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {booking.bookingTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {booking.numberOfPax || 1} pax
                        </span>
                      </div>
                    </div>
                    <p className="text-base text-gray-900">₹{booking.price}</p>
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
