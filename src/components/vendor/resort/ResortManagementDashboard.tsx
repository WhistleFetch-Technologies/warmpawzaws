import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BedDouble,
  Plus,
  Edit2,
  Trash2,
  Users,
  DollarSign,
  Calendar,
  Star,
  Wind,
  Thermometer,
  Camera,
  Utensils
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface ResortManagementDashboardProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface ResortRoom {
  id: string;
  roomNumber: string;
  roomType: 'standard' | 'deluxe' | 'suite' | 'villa';
  capacity: number; // number of pets
  size: 'small' | 'medium' | 'large' | 'xlarge'; // pet size compatibility
  amenities: string[];
  pricePerNight: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentGuests?: {
    petId: string;
    petName: string;
    checkIn: string;
    checkOut: string;
    ownerName: string;
  }[];
  features: {
    ac: boolean;
    heating: boolean;
    camera: boolean;
    playArea: boolean;
    privateGarden: boolean;
  };
  images: string[];
}

interface BookingSlot {
  date: string;
  roomId: string;
  status: 'available' | 'booked';
  price: number;
}

type ActiveTab = 'rooms' | 'bookings' | 'amenities';

export function ResortManagementDashboard({
  vendorId,
  vendorData,
  onBack
}: ResortManagementDashboardProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [rooms, setRooms] = useState<ResortRoom[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);

  useEffect(() => {
    loadResortData();
  }, [vendorId]);

  const loadResortData = async () => {
    try {
      setLoading(true);

      // Load resort rooms
      const roomsRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/resort-rooms`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (roomsRes.ok) {
        const data = await roomsRes.json();
        setRooms(data.rooms || []);
      }

      // Load bookings
      const bookingsRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/resort-bookings`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        setBookings(data.bookings || []);
      }

    } catch (error) {
      console.error('Error loading resort data:', error);
      toast.error('Failed to load resort data');
    } finally {
      setLoading(false);
    }
  };

  const getRoomTypeColor = (type: string) => {
    switch (type) {
      case 'standard': return 'bg-blue-100 text-blue-700';
      case 'deluxe': return 'bg-purple-100 text-purple-700';
      case 'suite': return 'bg-pink-100 text-pink-700';
      case 'villa': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700';
      case 'occupied': return 'bg-red-100 text-red-700';
      case 'maintenance': return 'bg-orange-100 text-orange-700';
      case 'reserved': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const renderRoomsTab = () => (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Resort Rooms</h2>
          <p className="text-sm text-gray-600">Manage your resort accommodations</p>
        </div>
        <Button
          onClick={() => setShowAddRoomModal(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Room
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Total Rooms</div>
          <div className="text-2xl font-bold text-gray-900">{rooms.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Available</div>
          <div className="text-2xl font-bold text-green-600">
            {rooms.filter(r => r.status === 'available').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Occupied</div>
          <div className="text-2xl font-bold text-red-600">
            {rooms.filter(r => r.status === 'occupied').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600 mb-1">Maintenance</div>
          <div className="text-2xl font-bold text-orange-600">
            {rooms.filter(r => r.status === 'maintenance').length}
          </div>
        </Card>
      </div>

      {/* Rooms List */}
      {rooms.length === 0 ? (
        <Card className="p-8 text-center">
          <BedDouble className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Rooms Added</h3>
          <p className="text-sm text-gray-600 mb-4">
            Add resort rooms to start accepting bookings
          </p>
          <Button onClick={() => setShowAddRoomModal(true)}>
            Add Your First Room
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <Card key={room.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BedDouble className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">
                      Room {room.roomNumber}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getRoomTypeColor(room.roomType)}>
                        {room.roomType.toUpperCase()}
                      </Badge>
                      <Badge className={getStatusColor(room.status)}>
                        {room.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Room Details */}
              <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4" />
                  Capacity: {room.capacity} pets
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  ₹{room.pricePerNight}/night
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2 mb-3">
                {room.features.ac && (
                  <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                    <Wind className="w-3 h-3" /> AC
                  </div>
                )}
                {room.features.heating && (
                  <div className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded">
                    <Thermometer className="w-3 h-3" /> Heating
                  </div>
                )}
                {room.features.camera && (
                  <div className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
                    <Camera className="w-3 h-3" /> Camera
                  </div>
                )}
                {room.features.privateGarden && (
                  <div className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                    🌳 Garden
                  </div>
                )}
              </div>

              {/* Amenities */}
              {room.amenities.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1">Amenities:</div>
                  <div className="flex flex-wrap gap-1">
                    {room.amenities.map((amenity, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Guests */}
              {room.status === 'occupied' && room.currentGuests && room.currentGuests.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-2">Current Guests:</div>
                  {room.currentGuests.map((guest, idx) => (
                    <div key={idx} className="text-xs text-gray-600 mb-1">
                      <span className="font-medium">{guest.petName}</span> ({guest.ownerName})
                      <div className="text-gray-500">
                        {new Date(guest.checkIn).toLocaleDateString()} - {new Date(guest.checkOut).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit2 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Calendar className="w-3 h-3 mr-1" />
                  View Calendar
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderBookingsTab = () => (
    <div className="p-4">
      <h2 className="font-semibold text-gray-900 mb-4">Upcoming Bookings</h2>
      {bookings.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">No Bookings Yet</h3>
          <p className="text-sm text-gray-600">
            Bookings will appear here once customers make reservations
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Card key={booking.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{booking.petName}</h3>
                <Badge>{booking.status}</Badge>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Owner: {booking.ownerName}</div>
                <div>Room: {booking.roomNumber}</div>
                <div>Check-in: {new Date(booking.checkIn).toLocaleDateString()}</div>
                <div>Check-out: {new Date(booking.checkOut).toLocaleDateString()}</div>
                <div className="font-semibold text-gray-900">Total: ₹{booking.totalPrice}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAmenitiesTab = () => (
    <div className="p-4">
      <h2 className="font-semibold text-gray-900 mb-4">Resort Amenities</h2>
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Utensils className="w-5 h-5 text-teal-600" />
              <div>
                <div className="font-medium">Premium Meals</div>
                <div className="text-xs text-gray-600">3 meals per day</div>
              </div>
            </div>
            <Button variant="outline" size="sm">Configure</Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-teal-600" />
              <div>
                <div className="font-medium">Spa Services</div>
                <div className="text-xs text-gray-600">Optional add-on</div>
              </div>
            </div>
            <Button variant="outline" size="sm">Configure</Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Camera className="w-5 h-5 text-teal-600" />
              <div>
                <div className="font-medium">Live Monitoring</div>
                <div className="text-xs text-gray-600">24/7 camera access</div>
              </div>
            </div>
            <Button variant="outline" size="sm">Configure</Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold">Pet Resort Management</h1>
              <p className="text-sm opacity-90">{vendorData?.businessName}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'rooms'
                  ? 'bg-white text-teal-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Rooms
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'bookings'
                  ? 'bg-white text-teal-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveTab('amenities')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'amenities'
                  ? 'bg-white text-teal-600'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Amenities
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'rooms' && renderRoomsTab()}
            {activeTab === 'bookings' && renderBookingsTab()}
            {activeTab === 'amenities' && renderAmenitiesTab()}
          </>
        )}
      </div>
    </div>
  );
}
