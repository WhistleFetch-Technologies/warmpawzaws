'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, CheckCircle, XCircle, Loader, Package, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface PetProfileProps {
  phone: string;
  petId: string;
  petName: string;
  petType: string;
  petBreed?: string;
  petAge?: string;
  petGender?: string;
  petImage?: string;
  onBack: () => void;
}

interface Booking {
  id: string;
  serviceName: string;
  vendorName: string;
  vendorType: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  serviceStyle: string;
  createdAt: string;
  duration: number;
}

interface BookingStats {
  total: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export function PetProfile({ 
  phone, 
  petId, 
  petName, 
  petType, 
  petBreed, 
  petAge, 
  petGender,
  petImage,
  onBack 
}: PetProfileProps) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<BookingStats>({
    total: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
  });
  const [selectedTab, setSelectedTab] = useState('all');

  useEffect(() => {
    loadPetBookingHistory();
  }, [phone, petId]);

  const loadPetBookingHistory = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ success: boolean; bookings: Booking[]; stats: BookingStats }>(
        `/customer/bookings/pet/${phone}/${petId}`
      );

      if (response.success) {
        setBookings(response.bookings || []);
        setStats(response.stats || stats);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700' },
    };

    const config = statusConfig[status] || statusConfig.confirmed;
    return (
      <span className={`px-0.5 py-0 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const getServiceStyleBadge = (style: string) => {
    const styleConfig: Record<string, { label: string; className: string }> = {
      at_center: { label: 'At Center', className: 'bg-purple-100 text-purple-700' },
      at_home: { label: 'Home Visit', className: 'bg-orange-100 text-orange-700' },
      tele: { label: 'Tele Consult', className: 'bg-blue-100 text-blue-700' },
    };

    const config = styleConfig[style] || { label: style, className: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`px-0.5 py-0 rounded-full text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getFilteredBookings = () => {
    if (selectedTab === 'all') return bookings;
    return bookings.filter(b => b.status === selectedTab);
  };

  const filteredBookings = getFilteredBookings();

  const getPetEmoji = (type: string) => {
    const petType = type?.toLowerCase() || 'pet';
    if (petType.includes('dog')) return '🐕';
    if (petType.includes('cat')) return '🐈';
    if (petType.includes('bird')) return '🐦';
    if (petType.includes('rabbit')) return '🐰';
    if (petType.includes('hamster')) return '🐹';
    return '🐾';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-primary text-white p-4 shadow-md z-10">
          <div className="flex items-center gap-0">
            <button 
              onClick={onBack} 
              className="p-0 hover:bg-white/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">{petName}'s Profile</h1>
              <p className="text-sm text-white/90">Health & Service History</p>
            </div>
          </div>
        </div>

        {/* Pet Header */}
        <div className="p-0 bg-gradient-to-b from-primary/10 to-transparent">
          <div className="flex items-center gap-4 mb-0">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-full flex items-center justify-center text-4xl">
              {getPetEmoji(petType)}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">{petName}</h2>
              <div className="flex items-center gap-0 mt-0 text-sm text-gray-600">
                <span className="px-0 py-0.5 bg-orange-100 text-orange-700 rounded">{petType}</span>
                {petBreed && <span>• {petBreed}</span>}
              </div>
              {(petAge || petGender) && (
                <div className="flex items-center gap-0 mt-0 text-sm text-gray-500">
                  {petAge && <span>{petAge}</span>}
                  {petAge && petGender && <span>•</span>}
                  {petGender && <span>{petGender}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-0">
            <div className="bg-white rounded-xl p-0 text-center shadow-sm">
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-0">Total</div>
            </div>
            <div className="bg-white rounded-xl p-0 text-center shadow-sm">
              <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
              <div className="text-xs text-gray-500 mt-0">Upcoming</div>
            </div>
            <div className="bg-white rounded-xl p-0 text-center shadow-sm">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-500 mt-0">Done</div>
            </div>
            <div className="bg-white rounded-xl p-0 text-center shadow-sm">
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
              <div className="text-xs text-gray-500 mt-0">Active</div>
            </div>
          </div>
        </div>

        {/* Service History */}
        <div className="px-4 pb-20">
          <div className="flex items-center gap-0 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-gray-900">Service History</h3>
          </div>

          {/* Tabs */}
          <div className="mb-4">
            <div className="flex gap-0 overflow-x-auto scrollbar-hide">
              {(['all', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`px-0 py-0 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    selectedTab === tab
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'in_progress' ? 'Active' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab !== 'all' && (
                    <span className="ml-0">
                      ({(() => {
                        if (tab === 'in_progress') return stats.inProgress || 0;
                        if (tab === 'confirmed') return stats.confirmed || 0;
                        if (tab === 'completed') return stats.completed || 0;
                        if (tab === 'cancelled') return stats.cancelled || 0;
                        return 0;
                      })()})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Bookings List */}
          {loading ? (
            <div className="flex items-center justify-center py-0">
              <Loader className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-02">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-0" />
              <p className="text-gray-500">No service history for {petName}</p>
              <p className="text-sm text-gray-400 mt-0">Book your first service to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => (
                <div key={booking.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-0">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{booking.serviceName || 'Service'}</h3>
                      <p className="text-sm text-gray-500">{booking.vendorName}</p>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>

                  {/* Service Type */}
                  <div className="flex items-center gap-0 mb-0">
                    {getServiceStyleBadge(booking.serviceStyle)}
                    <span className="px-0 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{booking.vendorType}</span>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-0 mb-0 text-sm">
                    <div className="flex items-center gap-0 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(booking.scheduledDate)}</span>
                    </div>
                    <div className="flex items-center gap-0 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{booking.scheduledTime} ({booking.duration}m)</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="pt-0 border-t flex items-center justify-between">
                    <span className="text-sm text-gray-500">ID: {booking.id.slice(0, 8)}...</span>
                    <span className="font-semibold text-primary">₹{booking.price}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

