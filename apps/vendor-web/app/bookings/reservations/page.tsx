'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Calendar, Users, Clock } from 'lucide-react';

interface TableReservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  customer_phone: string;
  table_id: string;
  table_number: string;
  reservation_date: string;
  reservation_time: string;
  duration: number;
  guests: number;
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled';
  special_requests?: string;
  created_at: string;
}

export default function TableReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<TableReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'seated' | 'completed'>('all');

  useEffect(() => {
    loadReservations();
  }, [filter]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(
        `/vendor/${vendorId}/cafe/reservations?status=${filter === 'all' ? '' : filter}`
      );
      if (response.success || response.reservations) {
        setReservations(response.reservations || []);
      }
    } catch (error: any) {
      console.error('Error loading reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReservationStatus = async (reservationId: string, newStatus: TableReservation['status']) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.put(`/vendor/${vendorId}/cafe/reservations/${reservationId}/status`, {
        status: newStatus,
      });
      loadReservations();
    } catch (error: any) {
      alert(error.message || 'Failed to update reservation status');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    seated: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">📝 Table Reservations</h1>
              <p className="text-sm text-gray-500">Manage cafe table reservations</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{reservations.length}</div>
            <div className="text-sm text-gray-500">Total Reservations</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-yellow-700">
              {reservations.filter(r => r.status === 'pending').length}
            </div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-blue-700">
              {reservations.filter(r => r.status === 'confirmed').length}
            </div>
            <div className="text-sm text-blue-600">Confirmed</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-700">
              {reservations.filter(r => r.status === 'seated').length}
            </div>
            <div className="text-sm text-green-600">Seated</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['all', 'pending', 'confirmed', 'seated', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition ${
                filter === status
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Reservations List */}
        {reservations.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No reservations</h3>
            <p className="text-gray-500">Table reservations will appear here when customers book tables</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Reservation #{reservation.reservation_number}
                    </h3>
                    <p className="text-sm text-gray-500">{reservation.customer_name} • {reservation.customer_phone}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[reservation.status]}`}>
                    {reservation.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Table & Guests</p>
                      <p className="font-medium text-gray-900">Table {reservation.table_number}</p>
                      <p className="text-sm text-gray-500">{reservation.guests} guests</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p className="font-medium text-gray-900">{reservation.reservation_date}</p>
                      <p className="text-sm text-gray-500">{reservation.reservation_time} ({reservation.duration} mins)</p>
                    </div>
                  </div>
                  {reservation.special_requests && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500 mb-1">Special Requests</p>
                      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg p-2">{reservation.special_requests}</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {reservation.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateReservationStatus(reservation.id, 'confirmed')}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium"
                    >
                      Confirm Reservation
                    </button>
                    <button
                      onClick={() => updateReservationStatus(reservation.id, 'cancelled')}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {reservation.status === 'confirmed' && (
                  <button
                    onClick={() => updateReservationStatus(reservation.id, 'seated')}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
                  >
                    Mark as Seated
                  </button>
                )}
                {reservation.status === 'seated' && (
                  <button
                    onClick={() => updateReservationStatus(reservation.id, 'completed')}
                    className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
                  >
                    Mark as Completed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

