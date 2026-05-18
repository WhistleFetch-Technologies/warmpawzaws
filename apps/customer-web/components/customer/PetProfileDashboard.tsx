'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Clock, Filter, Search, Package, ArrowLeft, Home } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { isPetBookingsUnavailable } from '@/lib/pet-route-errors';
import { BookingDetailModal } from './BookingDetailModal';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  photo?: string;
}

interface Booking {
  id: string;
  serviceType: string;
  serviceName?: string;
  petId: string;
  petName: string;
  vendorName: string;
  startDate: string;
  endDate?: string;
  totalSessions: number;
  completedSessions: number;
  status: 'confirmed' | 'active' | 'completed' | 'cancelled';
  price: number;
  requiresOTP?: boolean;
  completionOTP?: string;
  createdAt: string;
}

interface PetProfileDashboardProps {
  phone: string;
  petData: Pet;
  /** Return to view/edit pet screen */
  onBack: () => void;
  /** Optional: jump to app home / main menu */
  onBackToHome?: () => void;
}

export function PetProfileDashboard({ phone, petData, onBack, onBackToHome }: PetProfileDashboardProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<{ bookingId: string; petId: string } | null>(null);

  useEffect(() => {
    loadPetBookings();
  }, [phone, petData.id]);

  useEffect(() => {
    filterBookings();
  }, [bookings, selectedFilter, searchQuery]);

  const normalizeStatus = (status: unknown): Booking['status'] => {
    const s = String(status || '').toLowerCase();
    if (s === 'completed' || s === 'partially_completed') return 'completed';
    if (s === 'cancelled' || s === 'no_show') return 'cancelled';
    if (s === 'confirmed' || s === 'scheduled' || s === 'in_progress' || s === 'active') return 'active';
    return 'active';
  };

  const toTitle = (value: string): string =>
    value
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

  const deriveServiceLabel = (raw: any): string => {
    const explicitName = String(raw?.serviceName ?? raw?.service_name ?? '').trim();
    if (explicitName) return explicitName;

    const type = String(raw?.serviceType ?? raw?.service_type ?? '').trim();
    if (!type) return 'Service';
    const normalized = toTitle(type);
    return /\bservice\b/i.test(normalized) ? normalized : `${normalized} Service`;
  };

  const mapBooking = (raw: any): Booking => {
    const schedule = raw?.scheduledDate ?? raw?.scheduled_date ?? raw?.bookingDate ?? raw?.booking_date ?? raw?.createdAt ?? raw?.created_at ?? '';
    const priceRaw = raw?.price ?? raw?.total_amount ?? raw?.totalAmount ?? raw?.base_price ?? 0;
    const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw)) || 0;

    return {
      id: String(raw?.id ?? ''),
      serviceType: String(raw?.serviceType ?? raw?.service_type ?? raw?.serviceStyle ?? raw?.service_style ?? 'service'),
      serviceName: deriveServiceLabel(raw),
      petId: String(raw?.petId ?? raw?.pet_id ?? ''),
      petName: String(raw?.petName ?? raw?.pet_name ?? petData.name ?? ''),
      vendorName: String(raw?.vendorName ?? raw?.vendor_name ?? ''),
      startDate: String(schedule || ''),
      endDate: raw?.endDate ?? raw?.end_date,
      totalSessions: Number(raw?.totalSessions ?? raw?.total_sessions ?? 1),
      completedSessions: Number(raw?.completedSessions ?? raw?.completed_sessions ?? 0),
      status: normalizeStatus(raw?.status),
      price,
      requiresOTP: raw?.requiresOTP ?? raw?.requires_otp,
      completionOTP: raw?.completionOTP ?? raw?.completion_otp ?? raw?.otp_code,
      createdAt: String((raw?.createdAt ?? raw?.created_at ?? schedule) || ''),
    };
  };

  const extractRows = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.bookings)) return payload.bookings;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  };

  const loadPetBookings = async () => {
    const pathSeg =
      (typeof window !== 'undefined' ? getResolvedCustomerId() : null) ?? phone;

    try {
      setLoading(true);
      let rows: any[] = [];

      try {
        const data = (await apiClient.get(
          `/customer/${pathSeg}/pets/${petData.id}/bookings`
        )) as any;
        rows = extractRows(data);
      } catch (primaryError) {
        if (isPetBookingsUnavailable(primaryError)) {
          setBookings([]);
          return;
        }
        console.warn('Pet-profile primary bookings route failed, trying fallback:', primaryError);
        try {
          const fallback = (await apiClient.get(
            `/customer/bookings?phone=${encodeURIComponent(phone)}&petId=${encodeURIComponent(petData.id)}`
          )) as any;
          rows = extractRows(fallback);
        } catch (fallbackError) {
          if (isPetBookingsUnavailable(fallbackError)) {
            setBookings([]);
            return;
          }
          throw fallbackError;
        }
      }

      const mapped = rows.map(mapBooking);
      const targetPetId = String(petData.id);
      const petBookings = mapped.filter((b) => !b.petId || b.petId === targetPetId);
      const source = petBookings.length > 0 ? petBookings : mapped;
      const sortedBookings = [...source].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setBookings(sortedBookings);
    } catch (error) {
      console.error('Error loading pet bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const filterBookings = () => {
    let filtered = bookings;

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(b => b.status === selectedFilter);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(b =>
        b.serviceType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.serviceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredBookings(filtered);
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'walker': return '🐕';
      case 'grooming': return '✂️';
      case 'vet': return '⚕️';
      case 'boarding': return '🏠';
      default: return '📦';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const activeBookings = bookings.filter(b => b.status === 'active');
  const completedBookings = bookings.filter(b => b.status === 'completed');
  const totalSpent = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.price, 0);
  const totalSessions = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + b.completedSessions, 0);

  return (
    <>
      <header className="sticky top-0 z-20 cw-header-safe-top cw-header-safe-x pb-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="grid grid-cols-3 items-center gap-1 max-w-customer mx-auto">
          <div className="flex justify-start min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 rounded-lg px-2 py-2 text-gray-800 hover:bg-gray-100 active:bg-gray-200"
              aria-label="Back to pet profile"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium truncate">Pet</span>
            </button>
          </div>
          <div className="min-w-0 text-center px-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{petData.name}</p>
            <p className="text-xs text-gray-500">Bookings</p>
          </div>
          <div className="flex justify-end min-w-0">
            {onBackToHome ? (
              <button
                type="button"
                onClick={onBackToHome}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-[#FF8C42] hover:bg-orange-50 active:bg-orange-100"
                aria-label="Back to home"
              >
                <Home className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium truncate">Home</span>
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-6 pt-4 pb-4 bg-white">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-600">{bookings.length}</p>
            <p className="text-xs text-orange-700 mt-1">Total</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-600">{activeBookings.length}</p>
            <p className="text-xs text-orange-700 mt-1">Active</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-600">{completedBookings.length}</p>
            <p className="text-xs text-orange-700 mt-1">Done</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
            <p className="text-2xl font-bold text-orange-600">{totalSessions}</p>
            <p className="text-xs text-orange-700 mt-1">Sessions</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search services or vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-t-[32px] -mt-6 px-6 py-6 min-h-screen">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide -mx-2 px-2">
          {(['all', 'active', 'completed', 'cancelled'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedFilter === filter
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter === 'all' ? 'All Bookings' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              {filter !== 'all' && (
                <span className="ml-2 text-xs">
                  ({bookings.filter(b => b.status === filter).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Total Spent Card */}
        {completedBookings.length > 0 && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Total Amount Spent</p>
                <p className="text-3xl font-bold text-green-800">₹{totalSpent.toLocaleString()}</p>
              </div>
              <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
            </div>
            <p className="text-xs text-green-600 mt-3">
              From {completedBookings.length} completed booking{completedBookings.length > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Bookings List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              {searchQuery || selectedFilter !== 'all' ? (
                <Filter className="w-10 h-10 text-gray-400" />
              ) : (
                <Package className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <h3 className="text-gray-800 font-semibold mb-2">
              {searchQuery || selectedFilter !== 'all' ? 'No Matching Bookings' : 'No Bookings Yet'}
            </h3>
            <p className="text-gray-600 text-sm">
              {searchQuery || selectedFilter !== 'all' 
                ? 'Try adjusting your filters'
                : `Book services for ${petData.name}`}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">
                {selectedFilter === 'all' ? 'All Bookings' : 
                 `${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Bookings`}
              </h3>
              <span className="text-sm text-gray-600">{filteredBookings.length} booking{filteredBookings.length > 1 ? 's' : ''}</span>
            </div>

            {filteredBookings.map((booking) => (
              <button
                key={booking.id}
                onClick={() => setSelectedBooking({ bookingId: booking.id, petId: petData.id })}
                className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left"
              >
                <div className="flex gap-4">
                  {/* Service Icon */}
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {getServiceIcon(booking.serviceType)}
                  </div>

                  {/* Booking Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-800 mb-1">
                          {booking.serviceName || 
                           (booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1) + ' Service')}
                        </h4>
                        <p className="text-sm text-gray-600">{booking.vendorName}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>

                    {/* OTP Badge for Active/Confirmed Bookings */}
                    {booking.requiresOTP && booking.completionOTP && 
                     booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <div className="mb-3 p-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-orange-700">🔐 OTP:</span>
                          <span className="text-xl font-bold text-orange-600 tracking-widest font-mono">
                            {booking.completionOTP}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Progress Bar for Active Bookings */}
                    {booking.status === 'active' && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>{booking.completedSessions} of {booking.totalSessions} sessions</span>
                          <span>{Math.round((booking.completedSessions / booking.totalSessions) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                            style={{ width: `${(booking.completedSessions / booking.totalSessions) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex items-center gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(booking.startDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                      {booking.endDate && (
                        <>
                          <span>→</span>
                          <span className="flex items-center gap-1">
                            {new Date(booking.endDate).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-semibold text-[#FF8C42]">₹{booking.price}</span>
                    </div>

                    {/* Booking Date */}
                    <div className="mt-2 text-xs text-gray-500">
                      Booked on {new Date(booking.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          bookingId={selectedBooking.bookingId}
          petId={selectedBooking.petId}
          phone={phone}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {/* Home Indicator */}
      <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-4 max-w-customer mx-auto">
        <div className="flex justify-center">
          <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </>
  );
}
