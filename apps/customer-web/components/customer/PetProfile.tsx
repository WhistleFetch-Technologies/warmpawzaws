'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Loader, Package, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import {
  resolveCustomerBookingDisplayName,
  shouldHideWarmpawzAppointmentDuration,
} from '@/lib/warmpawz-appointments-customer';

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
  commerceMode?: string;
  commerce_mode?: string;
  serviceId?: string;
  service_id?: string;
  bookingMode?: string;
  booking_mode?: string;
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
      console.log(`🐾 [PET-PROFILE] Loading booking history for pet: ${petId} (${petName})`);
      let data: any;
      try {
        data = (await apiClient.get(`/customer/${phone}/pets/${petId}/bookings`)) as any;
      } catch (primaryError) {
        console.warn('🐾 [PET-PROFILE] Primary pet-bookings endpoint failed, trying fallback:', primaryError);
        data = (await apiClient.get(
          `/customer/bookings?phone=${encodeURIComponent(phone)}&petId=${encodeURIComponent(petId)}`
        )) as any;
      }

      console.log('✅ [PET-PROFILE] Loaded bookings:', data);

      if (data && data.success) {
        const rows = (data.bookings || []).map((raw: Record<string, unknown>) => ({
          ...(raw as unknown as Booking),
          serviceName: resolveCustomerBookingDisplayName(raw, String(raw.serviceName ?? 'Service')),
        }));
        setBookings(rows);
        setStats(data.stats || stats);
      } else {
        console.error('❌ [PET-PROFILE] Failed to load bookings:', data?.error);
      }
    } catch (error) {
      console.error('❌ [PET-PROFILE] Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-700' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getServiceStyleBadge = (style: string) => {
    const styleConfig = {
      at_center: { label: 'At Center', className: 'bg-purple-100 text-purple-700' },
      at_home: { label: 'Home Visit', className: 'bg-orange-100 text-orange-700' },
      tele: { label: 'Tele Consult', className: 'bg-blue-100 text-blue-700' },
    };

    const config = styleConfig[style as keyof typeof styleConfig] || { label: style, className: 'bg-gray-100 text-gray-700' };
    return (
      <Badge className={config.className} variant="outline">
        {config.label}
      </Badge>
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

  const photoUrl = petImage?.trim();

  return (
    <div className="pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
      <div className="bg-gradient-to-b from-[#FF8C42]/12 to-transparent px-4 pb-5 pt-3">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-[5.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF8C42] to-[#FF7029] shadow-md ring-2 ring-white">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-4xl" aria-hidden>
                {getPetEmoji(petType)}
              </span>
            )}
          </div>
          <div className="w-full min-w-0 text-center">
            <h2 className="text-[22px] font-bold leading-tight tracking-tight text-gray-900">{petName}</h2>
            <p className="mt-2 text-[15px] text-gray-600">
              <span className="font-medium text-[#FF8C42]">{petType || 'Pet'}</span>
              {petBreed ? (
                <>
                  <span className="text-gray-300"> · </span>
                  <span>{petBreed}</span>
                </>
              ) : null}
            </p>
            {(petAge || petGender) && (
              <p className="mt-1.5 text-[13px] text-gray-500">
                {petAge && <span>{petAge}</span>}
                {petAge && petGender && <span className="text-gray-300"> · </span>}
                {petGender && <span className="capitalize">{petGender}</span>}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Card className="rounded-2xl border-gray-100/80 p-3.5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <div className="text-2xl font-bold tabular-nums text-[#FF8C42]">{stats.total}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Total</div>
          </Card>
          <Card className="rounded-2xl border-gray-100/80 p-3.5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <div className="text-2xl font-bold tabular-nums text-blue-600">{stats.confirmed}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Upcoming</div>
          </Card>
          <Card className="rounded-2xl border-gray-100/80 p-3.5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <div className="text-2xl font-bold tabular-nums text-green-600">{stats.completed}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Done</div>
          </Card>
          <Card className="rounded-2xl border-gray-100/80 p-3.5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <div className="text-2xl font-bold tabular-nums text-amber-500">{stats.inProgress}</div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Active</div>
          </Card>
        </div>
      </div>

      <div className="px-4 pt-1">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 shrink-0 text-[#FF8C42]" aria-hidden />
          <h3 className="text-base font-bold text-gray-900">Service History</h3>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <div className="-mx-4 mb-3 overflow-x-auto px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex h-auto min-h-10 w-max flex-nowrap items-stretch gap-1 rounded-xl bg-gray-100/90 p-1">
              <TabsTrigger
                value="all"
                className="shrink-0 flex-none rounded-lg px-3 py-2 text-xs data-[state=active]:shadow-sm"
              >
                All ({stats.total})
              </TabsTrigger>
              <TabsTrigger
                value="confirmed"
                className="shrink-0 flex-none rounded-lg px-3 py-2 text-xs data-[state=active]:shadow-sm"
              >
                Upcoming
              </TabsTrigger>
              <TabsTrigger
                value="in_progress"
                className="shrink-0 flex-none rounded-lg px-3 py-2 text-xs data-[state=active]:shadow-sm"
              >
                Active
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="shrink-0 flex-none rounded-lg px-3 py-2 text-xs data-[state=active]:shadow-sm"
              >
                Done
              </TabsTrigger>
              <TabsTrigger
                value="cancelled"
                className="shrink-0 flex-none rounded-lg px-3 py-2 text-xs data-[state=active]:shadow-sm"
              >
                Cancelled
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={selectedTab} className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-8 w-8 animate-spin text-[#FF8C42]" />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white/60 py-12 text-center">
                <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" aria-hidden />
                <p className="font-medium text-gray-600">No service history for {petName}</p>
                <p className="mt-1 text-sm text-gray-400">Book your first service to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBookings.map((booking) => (
                  <Card
                    key={booking.id}
                    className="rounded-2xl border-gray-100/80 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-md"
                  >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{booking.serviceName || 'Service'}</h3>
                          <p className="text-sm text-gray-500">{booking.vendorName}</p>
                        </div>
                        {getStatusBadge(booking.status)}
                      </div>

                      {/* Service Type */}
                      <div className="flex items-center gap-2 mb-3">
                        {getServiceStyleBadge(booking.serviceStyle)}
                        <Badge variant="outline" className="text-xs">{booking.vendorType}</Badge>
                      </div>

                      {/* Date & Time */}
                      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(booking.scheduledDate)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>
                            {shouldHideWarmpawzAppointmentDuration(
                              booking as unknown as Record<string, unknown>,
                            )
                              ? booking.scheduledTime
                              : `${booking.scheduledTime} (${booking.duration}m)`}
                          </span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="pt-3 border-t flex items-center justify-between">
                        <span className="text-sm text-gray-500">ID: {booking.id}</span>
                        <span className="font-semibold text-[#FF8C42]">₹{booking.price}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
