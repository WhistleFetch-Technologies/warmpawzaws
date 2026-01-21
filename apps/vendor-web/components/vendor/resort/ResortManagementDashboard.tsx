'use client';

import { useState, useEffect } from 'react';
import { Plus, Hotel, Bed, Calendar, Users, CheckCircle2, Edit, Trash2, Eye, EyeOff, MapPin, Clock, Shield, Image, Upload, X, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ResortManagementDashboardProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
}

interface Room {
  id?: string;
  number: string;
  type: string;
  capacity: number;
  pricePerNight: number;
  amenities: string[];
  isAvailable: boolean;
  description?: string;
  imageUrl?: string;
}

interface BoardingBooking {
  id: string;
  petName: string;
  customerName: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string;
  status: string;
  totalAmount: number;
}

export function ResortManagementDashboard({ vendorId, vendorData, onBack }: ResortManagementDashboardProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<BoardingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'rooms' | 'bookings' | 'policies' | 'photos'>('overview');
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [newAmenity, setNewAmenity] = useState('');

  const [roomForm, setRoomForm] = useState<Room>({
    number: '',
    type: 'standard',
    capacity: 1,
    pricePerNight: 0,
    amenities: [],
    isAvailable: true,
    description: '',
    imageUrl: '',
  });

  // Policies state
  const [policies, setPolicies] = useState({
    checkInTime: '10:00',
    checkOutTime: '10:00',
    petPolicy: ['Pets must be vaccinated', 'Maximum 2 pets per room', 'Dogs and cats only'],
    houseRules: ['No outside food', 'Advance booking required', 'Valid ID required'],
    cancellationPolicy: {
      freeCancellation: true,
      freeCancellationDays: 3,
      cancellationFee: 500,
      refundPercentage: 80,
    },
    inclusions: ['Daily meals', 'Daily walks', 'Play sessions', '24/7 monitoring'],
    exclusions: ['Medical treatments', 'Special dietary food', 'Premium grooming'],
  });
  const [newPolicyItem, setNewPolicyItem] = useState('');
  const [editingPolicyType, setEditingPolicyType] = useState<string | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadRooms(),
        loadBookings(),
        loadPolicies(),
        loadPhotos(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/policies`);
      if (response.policies) {
        // Extract policies from response - check vendor_policies or metadata.policies
        const vendorPolicies = response.policies.vendorRules || {};
        const metadata = response.vendor?.metadata?.policies || {};
        
        setPolicies({
          checkInTime: metadata.checkInTime || vendorPolicies.check_in_time || '14:00',
          checkOutTime: metadata.checkOutTime || vendorPolicies.check_out_time || '11:00',
          cancellationPolicy: metadata.cancellationPolicy || vendorPolicies.cancellation_policy || '',
          inclusions: metadata.inclusions || (typeof vendorPolicies.inclusions === 'string' ? JSON.parse(vendorPolicies.inclusions || '[]') : vendorPolicies.inclusions) || [],
          exclusions: metadata.exclusions || (typeof vendorPolicies.exclusions === 'string' ? JSON.parse(vendorPolicies.exclusions || '[]') : vendorPolicies.exclusions) || [],
          petPolicy: metadata.petPolicy || vendorPolicies.pet_policy || '',
          houseRules: metadata.houseRules || (typeof vendorPolicies.house_rules === 'string' ? JSON.parse(vendorPolicies.house_rules || '[]') : vendorPolicies.house_rules) || [],
        });
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      // Keep default policies on error
    }
  };

  const loadPhotos = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}`);
      if (response.photos) {
        setPhotos(response.photos);
      } else if (response.vendor?.photos) {
        setPhotos(response.vendor.photos);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
      // Keep empty photos on error
    }
  };

  const loadRooms = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/resort/rooms`);
      setRooms(response.rooms || response || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    }
  };

  const loadBookings = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/bookings?category=boarding`);
      const bookingsList = response.bookings || response || [];
      setBookings(bookingsList);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    }
  };

  const handleSaveRoom = async () => {
    if (!roomForm.number || roomForm.pricePerNight <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      if (editingRoom?.id) {
        await apiClient.put<any>(`/vendor/${vendorId}/resort/rooms/${editingRoom.id}`, roomForm);
        toast.success('Room updated successfully!');
      } else {
        await apiClient.post<any>(`/vendor/${vendorId}/resort/rooms`, roomForm);
        toast.success('Room added successfully!');
      }
      setShowRoomModal(false);
      setEditingRoom(null);
      resetRoomForm();
      loadRooms();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save room');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      await apiClient.delete<any>(`/vendor/${vendorId}/resort/rooms/${roomId}`);
      toast.success('Room deleted successfully!');
      loadRooms();
    } catch (error: any) {
      toast.error('Failed to delete room');
    }
  };

  const resetRoomForm = () => {
    setRoomForm({
      number: '',
      type: 'standard',
      capacity: 1,
      pricePerNight: 0,
      amenities: [],
      isAvailable: true,
      description: '',
      imageUrl: '',
    });
    setNewAmenity('');
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setRoomForm(room);
    setShowRoomModal(true);
  };

  const addAmenity = () => {
    if (newAmenity.trim()) {
      setRoomForm({
        ...roomForm,
        amenities: [...roomForm.amenities, newAmenity.trim()],
      });
      setNewAmenity('');
    }
  };

  const removeAmenity = (index: number) => {
    setRoomForm({
      ...roomForm,
      amenities: roomForm.amenities.filter((_, i) => i !== index),
    });
  };

  const stats = {
    totalRooms: rooms.length,
    availableRooms: rooms.filter(r => r.isAvailable).length,
    occupiedRooms: rooms.length - rooms.filter(r => r.isAvailable).length,
    todayCheckIns: bookings.filter(b => b.checkInDate === new Date().toISOString().split('T')[0]).length,
    todayCheckOuts: bookings.filter(b => b.checkOutDate === new Date().toISOString().split('T')[0]).length,
    activeBookings: bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length,
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pet Resort Management</h1>
            <p className="text-gray-600 mt-1">Manage rooms, bookings, and boarding services</p>
          </div>
          <div className="flex gap-3">
            {onBack && (
              <Button variant="outline" onClick={onBack}>
                ← Back
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRooms}</p>
              </div>
              <Hotel className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available</p>
                <p className="text-2xl font-bold text-green-600">{stats.availableRooms}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Occupied</p>
                <p className="text-2xl font-bold text-orange-600">{stats.occupiedRooms}</p>
              </div>
              <Bed className="w-8 h-8 text-orange-500" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Bookings</p>
                <p className="text-2xl font-bold text-purple-600">{stats.activeBookings}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Hotel },
            { id: 'rooms', label: 'Rooms', icon: Bed },
            { id: 'bookings', label: 'Bookings', icon: Calendar },
            { id: 'policies', label: 'Policies', icon: Shield },
            { id: 'photos', label: 'Photos', icon: Image },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Today's Activity */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Today's Activity</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Check-ins</p>
                      <p className="text-sm text-gray-500">Scheduled for today</p>
                    </div>
                    <span className="text-2xl font-bold text-green-600">{stats.todayCheckIns}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Check-outs</p>
                      <p className="text-sm text-gray-500">Scheduled for today</p>
                    </div>
                    <span className="text-2xl font-bold text-orange-600">{stats.todayCheckOuts}</span>
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Button
                    className="w-full justify-start"
                    onClick={() => { resetRoomForm(); setEditingRoom(null); setShowRoomModal(true); }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Room
                  </Button>
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => setActiveTab('bookings')}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    View All Bookings
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Manage Rooms</h2>
              <Button
                onClick={() => { resetRoomForm(); setEditingRoom(null); setShowRoomModal(true); }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Room
              </Button>
            </div>

            {rooms.length === 0 ? (
              <Card className="p-12 text-center">
                <Bed className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Rooms Added</h3>
                <p className="text-gray-600 mb-4">Add your first room to get started</p>
                <Button onClick={() => { resetRoomForm(); setShowRoomModal(true); }} className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Room
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <Card key={room.id || room.number} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900">Room {room.number}</h3>
                        <p className="text-sm text-gray-500 capitalize">{room.type}</p>
                      </div>
                      {room.isAvailable ? (
                        <Badge className="bg-green-500">Available</Badge>
                      ) : (
                        <Badge variant="outline">Occupied</Badge>
                      )}
                    </div>
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>Capacity: {room.capacity} pet{room.capacity > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>₹{room.pricePerNight}/night</span>
                      </div>
                    </div>
                    {room.amenities && room.amenities.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {room.amenities.slice(0, 3).map((amenity, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">{amenity}</Badge>
                          ))}
                          {room.amenities.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{room.amenities.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRoom(room)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => room.id && handleDeleteRoom(room.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Boarding Bookings</h2>
            {bookings.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings</h3>
                <p className="text-gray-600">Bookings will appear here</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-gray-900">{booking.petName}</h3>
                          <Badge variant="outline">{booking.status || 'pending'}</Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Customer: {booking.customerName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Bed className="w-4 h-4" />
                            <span>Room: {booking.roomNumber}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Check-in: {new Date(booking.checkInDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>Check-out: {new Date(booking.checkOutDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Total: ₹{booking.totalAmount?.toLocaleString() || '0'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Manage Policies</h2>
            
            {/* Check-in/Check-out Times */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Check-in/Check-out Times
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Check-in Time</Label>
                  <Input
                    type="time"
                    value={policies.checkInTime}
                    onChange={(e) => setPolicies({ ...policies, checkInTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Check-out Time</Label>
                  <Input
                    type="time"
                    value={policies.checkOutTime}
                    onChange={(e) => setPolicies({ ...policies, checkOutTime: e.target.value })}
                  />
                </div>
              </div>
            </Card>

            {/* Cancellation Policy */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-500" />
                Cancellation Policy
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={policies.cancellationPolicy.freeCancellation}
                    onChange={(e) => setPolicies({
                      ...policies,
                      cancellationPolicy: {
                        ...policies.cancellationPolicy,
                        freeCancellation: e.target.checked
                      }
                    })}
                    className="w-5 h-5"
                  />
                  <Label>Allow free cancellation</Label>
                </div>
                {policies.cancellationPolicy.freeCancellation && (
                  <div>
                    <Label>Free cancellation days before check-in</Label>
                    <Input
                      type="number"
                      value={policies.cancellationPolicy.freeCancellationDays}
                      onChange={(e) => setPolicies({
                        ...policies,
                        cancellationPolicy: {
                          ...policies.cancellationPolicy,
                          freeCancellationDays: Number(e.target.value)
                        }
                      })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cancellation Fee (₹)</Label>
                    <Input
                      type="number"
                      value={policies.cancellationPolicy.cancellationFee}
                      onChange={(e) => setPolicies({
                        ...policies,
                        cancellationPolicy: {
                          ...policies.cancellationPolicy,
                          cancellationFee: Number(e.target.value)
                        }
                      })}
                    />
                  </div>
                  <div>
                    <Label>Refund Percentage (%)</Label>
                    <Input
                      type="number"
                      value={policies.cancellationPolicy.refundPercentage}
                      onChange={(e) => setPolicies({
                        ...policies,
                        cancellationPolicy: {
                          ...policies.cancellationPolicy,
                          refundPercentage: Number(e.target.value)
                        }
                      })}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Inclusions */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                What's Included
              </h3>
              <div className="space-y-2 mb-4">
                {policies.inclusions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPolicies({
                        ...policies,
                        inclusions: policies.inclusions.filter((_, i) => i !== index)
                      })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add inclusion..."
                  value={editingPolicyType === 'inclusions' ? newPolicyItem : ''}
                  onChange={(e) => { setEditingPolicyType('inclusions'); setNewPolicyItem(e.target.value); }}
                />
                <Button onClick={() => {
                  if (newPolicyItem.trim()) {
                    setPolicies({ ...policies, inclusions: [...policies.inclusions, newPolicyItem.trim()] });
                    setNewPolicyItem('');
                  }
                }}>
                  Add
                </Button>
              </div>
            </Card>

            {/* Exclusions */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" />
                What's Not Included
              </h3>
              <div className="space-y-2 mb-4">
                {policies.exclusions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-red-50 p-2 rounded">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPolicies({
                        ...policies,
                        exclusions: policies.exclusions.filter((_, i) => i !== index)
                      })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add exclusion..."
                  value={editingPolicyType === 'exclusions' ? newPolicyItem : ''}
                  onChange={(e) => { setEditingPolicyType('exclusions'); setNewPolicyItem(e.target.value); }}
                />
                <Button onClick={() => {
                  if (newPolicyItem.trim()) {
                    setPolicies({ ...policies, exclusions: [...policies.exclusions, newPolicyItem.trim()] });
                    setNewPolicyItem('');
                  }
                }}>
                  Add
                </Button>
              </div>
            </Card>

            {/* Pet Policy */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Pet Policy
              </h3>
              <div className="space-y-2 mb-4">
                {policies.petPolicy.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPolicies({
                        ...policies,
                        petPolicy: policies.petPolicy.filter((_, i) => i !== index)
                      })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add pet policy..."
                  value={editingPolicyType === 'petPolicy' ? newPolicyItem : ''}
                  onChange={(e) => { setEditingPolicyType('petPolicy'); setNewPolicyItem(e.target.value); }}
                />
                <Button onClick={() => {
                  if (newPolicyItem.trim()) {
                    setPolicies({ ...policies, petPolicy: [...policies.petPolicy, newPolicyItem.trim()] });
                    setNewPolicyItem('');
                  }
                }}>
                  Add
                </Button>
              </div>
            </Card>

            {/* House Rules */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                House Rules
              </h3>
              <div className="space-y-2 mb-4">
                {policies.houseRules.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm">{item}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPolicies({
                        ...policies,
                        houseRules: policies.houseRules.filter((_, i) => i !== index)
                      })}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add house rule..."
                  value={editingPolicyType === 'houseRules' ? newPolicyItem : ''}
                  onChange={(e) => { setEditingPolicyType('houseRules'); setNewPolicyItem(e.target.value); }}
                />
                <Button onClick={() => {
                  if (newPolicyItem.trim()) {
                    setPolicies({ ...policies, houseRules: [...policies.houseRules, newPolicyItem.trim()] });
                    setNewPolicyItem('');
                  }
                }}>
                  Add
                </Button>
              </div>
            </Card>

            <Button 
              className="w-full bg-orange-500 hover:bg-orange-600"
              onClick={async () => {
                try {
                  await apiClient.put<any>(`/vendor/${vendorId}/policies`, policies);
                  toast.success('Policies saved successfully!');
                } catch (error) {
                  toast.error('Failed to save policies');
                }
              }}
            >
              Save All Policies
            </Button>
          </div>
        )}

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Manage Photos</h2>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Upload className="w-4 h-4 mr-2" />
                Upload Photos
              </Button>
            </div>
            
            <Card className="p-6">
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Resort Photos</h3>
                <p className="text-gray-500 mb-4">Drag and drop photos here, or click to select</p>
                <p className="text-sm text-gray-400">Recommended: 1200x800px, max 5MB per image</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="photo-upload"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      setUploadingPhoto(true);
                      try {
                        const uploadedUrls: string[] = [];
                        for (let i = 0; i < files.length; i++) {
                          const file = files[i];
                          // Get presigned URL
                          const presignedRes = await apiClient.post<any>('/upload/presigned-url', {
                            fileName: `vendor-${vendorId}-${Date.now()}-${file.name}`,
                            fileType: file.type,
                            folder: 'vendor-photos'
                          });
                          
                          if (presignedRes.uploadUrl) {
                            // Upload to S3
                            await fetch(presignedRes.uploadUrl, {
                              method: 'PUT',
                              body: file,
                              headers: { 'Content-Type': file.type }
                            });
                            uploadedUrls.push(presignedRes.fileUrl || presignedRes.downloadUrl);
                          }
                        }
                        
                        // Update photos state and save to backend
                        const newPhotos = [...photos, ...uploadedUrls];
                        setPhotos(newPhotos);
                        
                        // Save photos to vendor profile
                        await apiClient.put<any>(`/vendor/${vendorId}/profile`, { photos: newPhotos });
                        toast.success(`${files.length} photo(s) uploaded successfully!`);
                      } catch (error) {
                        console.error('Photo upload error:', error);
                        toast.error('Failed to upload photos. Please try again.');
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }
                  }}
                />
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  Select Photos
                </Button>
              </div>
            </Card>

            {photos.length === 0 ? (
              <Card className="p-12 text-center">
                <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Photos Yet</h3>
                <p className="text-gray-600">Add photos of your resort to attract customers</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo, index) => (
                  <div key={index} className="relative group aspect-video bg-gray-100 rounded-lg overflow-hidden">
                    <img src={photo} alt={`Resort photo ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Photo Guidelines</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Upload high-quality photos of rooms, facilities, and play areas</li>
                <li>• Include photos of amenities like pools, grooming areas, etc.</li>
                <li>• Show happy pets in your facility (with owner permission)</li>
                <li>• Minimum 5 photos recommended for better visibility</li>
              </ul>
            </div>
          </div>
        )}

        {/* Room Modal */}
        {showRoomModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  {editingRoom ? 'Edit Room' : 'Add New Room'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Label>Room Number *</Label>
                    <Input
                      value={roomForm.number}
                      onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                      placeholder="e.g., R101, R102"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Room Type *</Label>
                      <select
                        value={roomForm.type}
                        onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="standard">Standard</option>
                        <option value="deluxe">Deluxe</option>
                        <option value="suite">Suite</option>
                        <option value="luxury">Luxury</option>
                      </select>
                    </div>
                    <div>
                      <Label>Capacity (pets) *</Label>
                      <Input
                        type="number"
                        value={roomForm.capacity}
                        onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Price per Night (₹) *</Label>
                    <Input
                      type="number"
                      value={roomForm.pricePerNight}
                      onChange={(e) => setRoomForm({ ...roomForm, pricePerNight: Number(e.target.value) })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label>Amenities</Label>
                    <div className="flex gap-2 mb-2">
                      <Input
                        value={newAmenity}
                        onChange={(e) => setNewAmenity(e.target.value)}
                        placeholder="e.g., AC, Play Area"
                        onKeyPress={(e) => e.key === 'Enter' && addAmenity()}
                      />
                      <Button type="button" onClick={addAmenity}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roomForm.amenities.map((amenity, idx) => (
                        <Badge key={idx} className="flex items-center gap-1">
                          {amenity}
                          <button onClick={() => removeAmenity(idx)} className="ml-1">
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={roomForm.description}
                      onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                      placeholder="Room description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Image URL (Optional)</Label>
                    <Input
                      value={roomForm.imageUrl}
                      onChange={(e) => setRoomForm({ ...roomForm, imageUrl: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="roomAvailable"
                      checked={roomForm.isAvailable}
                      onChange={(e) => setRoomForm({ ...roomForm, isAvailable: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <Label htmlFor="roomAvailable">Available for booking</Label>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setShowRoomModal(false); resetRoomForm(); setEditingRoom(null); }}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
                      onClick={handleSaveRoom}
                      disabled={loading}
                    >
                      {editingRoom ? 'Update' : 'Add'} Room
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
