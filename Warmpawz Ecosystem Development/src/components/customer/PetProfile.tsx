import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, CheckCircle, XCircle, Loader, Package, TrendingUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
      console.log(`🐾 [PET-PROFILE] Loading booking history for pet: ${petId} (${petName})`);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/bookings/pet/${phone}/${petId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [PET-PROFILE] Loaded bookings:', data);

        if (data.success) {
          setBookings(data.bookings || []);
          setStats(data.stats || stats);
        }
      } else {
        console.error('❌ [PET-PROFILE] Failed to load bookings:', response.status);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-[#FF8C42] text-white p-4 shadow-md z-10">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">{petName}'s Profile</h1>
              <p className="text-sm text-white/90">Health & Service History</p>
            </div>
          </div>
        </div>

        {/* Pet Header */}
        <div className="p-6 bg-gradient-to-b from-[#FF8C42]/10 to-transparent">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-full flex items-center justify-center text-4xl">
              {getPetEmoji(petType)}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">{petName}</h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded">{petType}</span>
                {petBreed && <span>• {petBreed}</span>}
              </div>
              {(petAge || petGender) && (
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                  {petAge && <span>{petAge}</span>}
                  {petAge && petGender && <span>•</span>}
                  {petGender && <span>{petGender}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-[#FF8C42]">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-1">Total</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.confirmed}</div>
              <div className="text-xs text-gray-500 mt-1">Upcoming</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-500 mt-1">Done</div>
            </Card>
            <Card className="p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
              <div className="text-xs text-gray-500 mt-1">Active</div>
            </Card>
          </div>
        </div>

        {/* Service History */}
        <div className="px-4 pb-20">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            <h3 className="font-semibold text-gray-900">Service History</h3>
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="w-full grid grid-cols-5 mb-4">
              <TabsTrigger value="all" className="text-xs">All ({stats.total})</TabsTrigger>
              <TabsTrigger value="confirmed" className="text-xs">Upcoming</TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs">Active</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">Done</TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs">Cancelled</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-8 h-8 animate-spin text-[#FF8C42]" />
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No service history for {petName}</p>
                  <p className="text-sm text-gray-400 mt-1">Book your first service to get started!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBookings.map((booking) => (
                    <Card key={booking.id} className="p-4 hover:shadow-md transition-shadow">
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
                          <span>{booking.scheduledTime} ({booking.duration}m)</span>
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
    </div>
  );
}
