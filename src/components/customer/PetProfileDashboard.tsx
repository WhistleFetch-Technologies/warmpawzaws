import { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, TrendingUp, Clock, Filter, Search, Package } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
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
  onBack: () => void;
}

export function PetProfileDashboard({ phone, petData, onBack }: PetProfileDashboardProps) {
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

  const loadPetBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter bookings for this specific pet
        const petBookings = (result.bookings || []).filter((b: Booking) => b.petId === petData.id);
        // Sort by date (most recent first)
        const sortedBookings = petBookings.sort((a: Booking, b: Booking) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setBookings(sortedBookings);
      }
    } catch (error) {
      console.error('Error loading pet bookings:', error);
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
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-8 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold">{petData.name}'s Service History</h1>
            <p className="text-white/90 text-sm">{petData.breed}</p>
          </div>
          {petData.photo && (
            <img 
              src={petData.photo} 
              alt={petData.name}
              className="w-12 h-12 rounded-full border-2 border-white object-cover"
            />
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{bookings.length}</p>
            <p className="text-xs text-white/90 mt-1">Total</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{activeBookings.length}</p>
            <p className="text-xs text-white/90 mt-1">Active</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{completedBookings.length}</p>
            <p className="text-xs text-white/90 mt-1">Done</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-white">{totalSessions}</p>
            <p className="text-xs text-white/90 mt-1">Sessions</p>
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
            className="w-full pl-10 pr-4 py-3 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-white/50"
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
      <div className="fixed bottom-0 left-0 right-0 bg-white px-6 py-4 max-w-[430px] mx-auto">
        <div className="flex justify-center">
          <div className="w-32 h-1 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
