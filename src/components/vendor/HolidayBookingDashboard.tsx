import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

/**
 * 📅 HOLIDAY BOOKING VENDOR DASHBOARD
 * Phase 7B: Rule 13 - Manage holiday package bookings
 */

export default function HolidayBookingDashboard({ vendorId }: { vendorId: string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, [vendorId]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/holiday-bookings`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      const data = await response.json();
      if (data.success) setBookings(data.data.bookings || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId: string, status: string, paymentStatus?: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/holiday-packages/bookings/${bookingId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ status, paymentStatus }),
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchBookings();
        if (selectedBooking?.bookingId === bookingId) {
          setSelectedBooking(data.data.booking);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-gray-900 mb-2">Holiday Bookings</h1>
          <p className="text-gray-600">Manage your holiday package bookings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-8 h-8 text-orange-500" />
              <span className="text-gray-600">Total Bookings</span>
            </div>
            <p className="text-3xl text-gray-900">{bookings.length}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <span className="text-gray-600">Confirmed</span>
            </div>
            <p className="text-3xl text-gray-900">
              {bookings.filter((b) => b.status === 'confirmed').length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-8 h-8 text-blue-500" />
              <span className="text-gray-600">In Progress</span>
            </div>
            <p className="text-3xl text-gray-900">
              {bookings.filter((b) => b.status === 'in_progress').length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-8 h-8 text-purple-500" />
              <span className="text-gray-600">Revenue</span>
            </div>
            <p className="text-3xl text-gray-900">
              ₹{bookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Booking ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Travelers
                  </th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bookings.map((booking) => (
                  <tr key={booking.bookingId} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      #{booking.bookingId.slice(-8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>
                        <p>{new Date(booking.selectedStartDate).toLocaleDateString()}</p>
                        <p className="text-xs">to {new Date(booking.selectedEndDate).toLocaleDateString()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span>
                          {booking.travelers.adults}A, {booking.travelers.children}C, {booking.travelers.pets.length}P
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ₹{booking.pricing.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs ${
                        booking.paymentStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        className="text-orange-500 hover:text-orange-600 text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bookings.length === 0 && (
            <div className="p-12 text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No bookings yet</p>
            </div>
          )}
        </div>

        {/* Booking Details Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-gray-900 mb-2">Booking Details</h2>
                  <p className="text-gray-600">#{selectedBooking.bookingId}</p>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Start Date</p>
                    <p className="text-gray-900">
                      {new Date(selectedBooking.selectedStartDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">End Date</p>
                    <p className="text-gray-900">
                      {new Date(selectedBooking.selectedEndDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Travelers</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-xs text-gray-600">Adults</p>
                        <p className="text-gray-900">{selectedBooking.travelers.adults}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Children</p>
                        <p className="text-gray-900">{selectedBooking.travelers.children}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Pets</p>
                        <p className="text-gray-900">{selectedBooking.travelers.pets.length}</p>
                      </div>
                    </div>
                    {selectedBooking.travelers.pets.map((pet: any, idx: number) => (
                      <div key={idx} className="text-sm text-gray-600">
                        {pet.petName} ({pet.breed})
                      </div>
                    ))}
                  </div>
                </div>

                {selectedBooking.specialRequests && (
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Special Requests</p>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-gray-900">{selectedBooking.specialRequests}</p>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600 mb-2">Pricing</p>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-gray-600">
                        <span>Base Price</span>
                        <span>₹{selectedBooking.pricing.basePrice}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Pet Charges</span>
                        <span>₹{selectedBooking.pricing.petCharges}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Adult Charges</span>
                        <span>₹{selectedBooking.pricing.adultCharges}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Child Charges</span>
                        <span>₹{selectedBooking.pricing.childCharges}</span>
                      </div>
                      <div className="border-t border-orange-200 pt-2 flex justify-between text-gray-900">
                        <span>Total</span>
                        <span className="text-xl">₹{selectedBooking.pricing.totalAmount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  {selectedBooking.status === 'pending' && (
                    <button
                      onClick={() => updateBookingStatus(selectedBooking.bookingId, 'confirmed', 'paid')}
                      className="flex-1 bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
                    >
                      Confirm Booking
                    </button>
                  )}
                  {selectedBooking.status === 'confirmed' && (
                    <button
                      onClick={() => updateBookingStatus(selectedBooking.bookingId, 'in_progress')}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                    >
                      Mark In Progress
                    </button>
                  )}
                  {selectedBooking.status === 'in_progress' && (
                    <button
                      onClick={() => updateBookingStatus(selectedBooking.bookingId, 'completed')}
                      className="flex-1 bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600"
                    >
                      Mark Completed
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
