'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, User, ChevronRight, Filter } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface AppointmentsListProps {
  customerId: string;
  onBack: () => void;
  onSelectAppointment: (appointmentId: string) => void;
}

export function AppointmentsList({
  customerId,
  onBack,
  onSelectAppointment
}: AppointmentsListProps) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  useEffect(() => {
    loadAppointments();
  }, [customerId, filter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ appointments: any[] }>(`/appointment/customer/${customerId}?status=${filter}`);
      if (response.appointments) {
        setAppointments(response.appointments);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${period}`;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Confirmed' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;

    return (
      <span className={`px-2 py-1 rounded-full text-xs ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary-dark text-white px-6 pt-8 pb-6 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div>
          <h1 className="text-2xl text-white mb-1">My Appointments</h1>
          <p className="text-sm text-white/80">View and manage your bookings</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Filter Tabs */}
        <div className="bg-white rounded-xl p-2 shadow-sm flex gap-2 overflow-x-auto scrollbar-hide">
          {[
            { value: 'all', label: 'All' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' }
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                filter === tab.value
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading appointments...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && appointments.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-900 mb-1">No appointments found</p>
            <p className="text-sm text-gray-500">
              {filter === 'all' ? 'Book your first service to get started' :
               filter === 'upcoming' ? 'No upcoming appointments' :
               filter === 'completed' ? 'No completed appointments yet' :
               'No cancelled appointments'}
            </p>
          </div>
        )}

        {/* Appointments List */}
        {!loading && appointments.length > 0 && (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <button
                key={appointment.id}
                onClick={() => onSelectAppointment(appointment.id)}
                className="w-full bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-primary transition-all text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{appointment.serviceName}</h3>
                    <p className="text-sm text-gray-600">{appointment.vendorName}</p>
                  </div>
                  {getStatusBadge(appointment.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(appointment.scheduledDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(appointment.scheduledTime)}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">₹{appointment.amount || 0}</span>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

