/**
 * VENDOR OCCUPANCY TRACKING
 * 
 * Tracks room occupancy for boarding/resort with:
 * - Real-time occupancy status
 * - Booking calendar
 * - Availability management
 * - Check-in/check-out tracking
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar,
  Home,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface VendorOccupancyTrackingProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface Room {
  id: string;
  name: string;
  totalUnits: number;
  capacity: number;
  petTypes: string[];
  dayPrice: number;
  nightPrice: number;
}

interface Occupancy {
  roomId: string;
  roomName: string;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  reservedUnits: number;
  occupancyRate: number;
  currentBookings: Booking[];
}

interface Booking {
  id: string;
  bookingId: string;
  roomId: string;
  roomName: string;
  customerName: string;
  petName: string;
  checkInDate: string;
  checkOutDate: string;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  guestCount: number;
  petCount: number;
}

export function VendorOccupancyTracking({ 
  vendorId, 
  vendorData, 
  onBack 
}: VendorOccupancyTrackingProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [occupancy, setOccupancy] = useState<Occupancy[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'overview' | 'calendar' | 'rooms'>('overview');

  useEffect(() => {
    fetchData();
  }, [vendorId, selectedDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch rooms
      const roomsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/rooms`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (roomsResponse.ok) {
        const data = await roomsResponse.json();
        setRooms(data.rooms || data.data?.rooms || []);
      }

      // Fetch occupancy data
      await fetchOccupancy();
      
      // Fetch bookings for selected date
      await fetchBookings();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load occupancy data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupancy = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/boarding/occupancy?date=${selectedDate}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setOccupancy(data.occupancy || data.data?.occupancy || []);
      }
    } catch (error) {
      console.error('Error fetching occupancy:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/bookings?serviceType=boarding&date=${selectedDate}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || data.data?.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'bg-red-100 text-red-700 border-red-200';
    if (rate >= 70) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (rate >= 50) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-green-100 text-green-700 border-green-200';
      case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'checked_out': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const totalUnits = occupancy.reduce((sum, occ) => sum + occ.totalUnits, 0);
  const totalOccupied = occupancy.reduce((sum, occ) => sum + occ.occupiedUnits, 0);
  const totalAvailable = occupancy.reduce((sum, occ) => sum + occ.availableUnits, 0);
  const totalReserved = occupancy.reduce((sum, occ) => sum + occ.reservedUnits, 0);
  const overallOccupancyRate = totalUnits > 0 ? (totalOccupied / totalUnits) * 100 : 0;

  if (loading && occupancy.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading occupancy data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Occupancy Tracking</h1>
            <p className="text-xs text-gray-500">
              {totalOccupied}/{totalUnits} occupied ({overallOccupancyRate.toFixed(1)}%)
            </p>
          </div>
        </div>

        {/* Date Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">View Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['overview', 'calendar', 'rooms'].map(view => (
            <button
              key={view}
              onClick={() => setViewMode(view as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === view
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'overview' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="w-5 h-5 text-blue-600" />
                  <p className="text-sm text-gray-500">Total Units</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-red-600" />
                  <p className="text-sm text-gray-500">Occupied</p>
                </div>
                <p className="text-2xl font-bold text-red-600">{totalOccupied}</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-gray-500">Available</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{totalAvailable}</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm text-gray-500">Reserved</p>
                </div>
                <p className="text-2xl font-bold text-yellow-600">{totalReserved}</p>
              </div>
            </div>

            {/* Occupancy Rate */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Overall Occupancy Rate
                </h2>
                <Badge className={getOccupancyColor(overallOccupancyRate)}>
                  {overallOccupancyRate.toFixed(1)}%
                </Badge>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full transition-all ${
                    overallOccupancyRate >= 90 ? 'bg-red-600' :
                    overallOccupancyRate >= 70 ? 'bg-yellow-600' :
                    overallOccupancyRate >= 50 ? 'bg-blue-600' :
                    'bg-green-600'
                  }`}
                  style={{ width: `${overallOccupancyRate}%` }}
                />
              </div>
            </div>

            {/* Room-wise Occupancy */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Room-wise Occupancy</h2>
              
              {occupancy.length === 0 ? (
                <div className="text-center py-12">
                  <Home className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No occupancy data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {occupancy.map(occ => (
                    <div key={occ.roomId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{occ.roomName}</h3>
                          <p className="text-sm text-gray-500">
                            {occ.occupiedUnits} occupied • {occ.availableUnits} available • {occ.reservedUnits} reserved
                          </p>
                        </div>
                        <Badge className={getOccupancyColor(occ.occupancyRate)}>
                          {occ.occupancyRate.toFixed(1)}%
                        </Badge>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full ${
                            occ.occupancyRate >= 90 ? 'bg-red-600' :
                            occ.occupancyRate >= 70 ? 'bg-yellow-600' :
                            occ.occupancyRate >= 50 ? 'bg-blue-600' :
                            'bg-green-600'
                          }`}
                          style={{ width: `${occ.occupancyRate}%` }}
                        />
                      </div>

                      {occ.currentBookings.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Current Bookings:</p>
                          <div className="space-y-1">
                            {occ.currentBookings.slice(0, 3).map(booking => (
                              <div key={booking.id} className="flex items-center justify-between text-xs">
                                <span className="text-gray-700">{booking.customerName} - {booking.petName}</span>
                                <Badge className={getStatusColor(booking.status)}>
                                  {booking.status}
                                </Badge>
                              </div>
                            ))}
                            {occ.currentBookings.length > 3 && (
                              <p className="text-xs text-gray-500">
                                +{occ.currentBookings.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Booking Calendar</h2>
            
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="space-y-3">
                {bookings.map(booking => (
                  <div key={booking.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{booking.customerName}</h3>
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{booking.petName} - {booking.roomName}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Check-in: {new Date(booking.checkInDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Check-out: {new Date(booking.checkOutDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {bookings.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No bookings for selected date</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'rooms' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Room Details</h2>
            
            <div className="grid gap-4">
              {rooms.map(room => {
                const roomOccupancy = occupancy.find(occ => occ.roomId === room.id);
                
                return (
                  <div key={room.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{room.name}</h3>
                        <p className="text-sm text-gray-500">
                          {room.totalUnits} units • Capacity: {room.capacity} pets
                        </p>
                        
                        {roomOccupancy && (
                          <div className="mt-3">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-red-600">
                                {roomOccupancy.occupiedUnits} occupied
                              </span>
                              <span className="text-green-600">
                                {roomOccupancy.availableUnits} available
                              </span>
                              <span className="text-yellow-600">
                                {roomOccupancy.reservedUnits} reserved
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div
                                className={`h-2 rounded-full ${
                                  roomOccupancy.occupancyRate >= 90 ? 'bg-red-600' :
                                  roomOccupancy.occupancyRate >= 70 ? 'bg-yellow-600' :
                                  roomOccupancy.occupancyRate >= 50 ? 'bg-blue-600' :
                                  'bg-green-600'
                                }`}
                                style={{ width: `${roomOccupancy.occupancyRate}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm font-medium">₹{room.dayPrice}/day</p>
                        <p className="text-xs text-gray-500">₹{room.nightPrice}/night</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

