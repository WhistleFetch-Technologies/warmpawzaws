"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Share2, MapPin, Star, Phone, Navigation, Calendar, Clock, Users, ShieldCheck, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PetCafeListingZomatoStyleProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

interface CafeDetails {
  id: string;
  name: string;
  description: string;
  address: string;
  rating: number;
  reviewsCount: number;
  costForTwo: number;
  cuisines: string[];
  photos: string[];
  amenities: string[];
  menu: { category: string; items: { name: string; price: number; desc?: string; isVeg?: boolean }[] }[];
  openHours: string;
  phone: string;
  coordinates: { lat: number; lng: number };
  petPolicy?: string[];
  bookingPolicy?: string[];
}

export function PetCafeListingZomatoStyle(props: PetCafeListingZomatoStyleProps) {
  const cafeId = props.cafeId || props.vendorId || props.preSelectedVendorId || '';
  const phone = props.phone || props.customerPhone || '';
  const [cafe, setCafe] = useState<CafeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Booking state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('');
  const [numberOfGuests, setNumberOfGuests] = useState(2);
  const [numberOfPets, setNumberOfPets] = useState(1);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (cafeId) {
      loadCafeDetails();
    }
  }, [cafeId]);

  useEffect(() => {
    if (showBookingModal && selectedDate && selectedTime) {
      loadAvailableTables();
    }
  }, [showBookingModal, selectedDate, selectedTime, cafeId]);

  const loadCafeDetails = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ vendor?: any; menu?: any[] }>(`/vendor/${cafeId}`);
      
      if (data.vendor) {
        const vendor = data.vendor;
        const menuData = data.menu || [];
        
        const profile: CafeDetails = {
          id: vendor.id,
          name: vendor.business_name || vendor.name,
          description: "A cozy place for you and your pet.",
          address: vendor.location?.address || vendor.address || "Location",
          rating: vendor.rating || 4.5,
          reviewsCount: vendor.reviews_count || 0,
          costForTwo: 500,
          cuisines: ["Cafe", "Snacks"],
          photos: [vendor.profile_image || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80"],
          amenities: ["Wifi", "Pet Friendly", "Outdoor Seating"],
          menu: [
            {
              category: "Menu",
              items: menuData.map((m: any) => ({
                name: m.name || m.item_name,
                price: m.price || m.base_price,
                desc: m.description,
                isVeg: m.is_vegetarian
              }))
            }
          ],
          openHours: "10:00 AM - 10:00 PM",
          phone: vendor.phone,
          coordinates: vendor.location || { lat: 0, lng: 0 },
          petPolicy: [
            "Pets must remain on leash unless in play zone",
            "Up-to-date vaccinations required"
          ]
        };
        
        setCafe(profile);
      }
    } catch (error) {
      console.error('Error loading cafe details:', error);
      toast.error('Failed to load cafe details');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTables = async () => {
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        time: selectedTime,
        guests: numberOfGuests.toString()
      });
      
      const data = await apiClient.get<{ tables?: any[] }>(`/vendor/${cafeId}/cafe/tables?${params.toString()}`);
      const tables = data.tables || [];
      setAvailableTables(tables);
      
      if (tables.length > 0 && !selectedTable) {
        // Auto-select first suitable table
        const suitable = tables.find((t: any) => t.capacity >= numberOfGuests) || tables[0];
        setSelectedTable(suitable);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
      // Mock tables for development
      setAvailableTables([
        { id: 'table1', name: 'Table 1', capacity: 4, location: 'Indoor' },
        { id: 'table2', name: 'Table 2', capacity: 2, location: 'Outdoor' }
      ]);
    }
  };

  const handleBooking = async () => {
    if (!selectedTable || !selectedDate || !selectedTime) {
      toast.error('Please select date, time, and table');
      return;
    }

    try {
      setBookingLoading(true);
      
      const bookingData = {
        vendorId: cafeId,
        serviceType: 'pet_cafe',
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        metadata: {
          tableId: selectedTable.id,
          tableName: selectedTable.name,
          guests: numberOfGuests,
          pets: numberOfPets
        }
      };

      const response = await apiClient.post<any>('/customer/bookings/create', bookingData);
      
      if (response.success || response.bookingId) {
        toast.success('Table reserved successfully!');
        setShowBookingModal(false);
        if (props.onSuccess) {
          props.onSuccess(response.bookingId || response.booking?.id);
        }
      } else {
        throw new Error(response.error || 'Booking failed');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Failed to book table');
    } finally {
      setBookingLoading(false);
    }
  };

  const openDirections = () => {
    if (!cafe) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${cafe.coordinates.lat},${cafe.coordinates.lng}`;
    window.open(url, '_blank');
  };

  // Generate time slots
  const timeSlots = [];
  for (let i = 10; i < 22; i++) {
    timeSlots.push(`${i}:00`);
    timeSlots.push(`${i}:30`);
  }

  // Generate next 30 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      });
    }
    return dates;
  };

  if (loading || !cafe) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
        {/* Hero Header */}
        <div className="relative h-72 w-full overflow-hidden bg-gray-900 group">
          <img 
            src={cafe.photos[0]} 
            alt={cafe.name} 
            className="w-full h-full object-cover opacity-95 transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
            <Button variant="secondary" size="icon" onClick={props.onBack} className="rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-0">
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="icon" onClick={() => setIsFavorite(!isFavorite)} className="rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-0">
                <Heart className={`w-6 h-6 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
              </Button>
              <Button variant="secondary" size="icon" className="rounded-full bg-white/20 backdrop-blur-md hover:bg-white/40 text-white border-0">
                <Share2 className="w-6 h-6" />
              </Button>
            </div>
          </div>
          
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            <span>{cafe.photos.length} Photos</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white -mt-4 relative rounded-t-3xl shadow-xl border-t border-gray-100 p-5 space-y-6">
          {/* Title & Stats */}
          <div>
            <div className="flex justify-between items-start">
              <h1 className="text-2xl font-bold text-gray-900">{cafe.name}</h1>
              <div className="bg-green-600 text-white text-sm font-bold px-2 py-1 rounded-lg flex flex-col items-center leading-none">
                <span className="text-lg flex items-center gap-3.5">{cafe.rating} <Star className="w-3 h-3 fill-white" /></span>
                <span className="text-[10px] font-normal opacity-90">{cafe.reviewsCount} reviews</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">{cafe.cuisines.join(', ')}</p>
            <p className="text-sm text-gray-500">₹{cafe.costForTwo} for two (approx.)</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 h-10" onClick={openDirections}>
              <Navigation className="w-4 h-4 mr-2" /> Direction
            </Button>
            <Button variant="outline" className="border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 h-10">
              <Phone className="w-4 h-4 mr-2" /> Call
            </Button>
          </div>

          {/* Overview Section */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Map Preview */}
              <div className="rounded-xl overflow-hidden border border-gray-200 h-32 relative bg-gray-100" onClick={openDirections}>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-xs font-semibold text-gray-700 flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-red-500" />
                    {cafe.address.substring(0, 30)}...
                  </div>
                </div>
              </div>

              {/* Pet Policy */}
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-yellow-600" /> Pet Policy
                </h3>
                <ul className="space-y-2">
                  {cafe.petPolicy?.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Amenities */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {cafe.amenities.map(a => (
                    <Badge key={a} variant="outline" className="bg-gray-50 border-gray-200 text-gray-600 py-1.5">
                      ✓ {a}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Menu Section */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              {cafe.menu.map((category) => (
                <div key={category.category}>
                  <h3 className="text-lg font-bold text-gray-800 mb-3">{category.category}</h3>
                  <div className="space-y-4">
                    {category.items.map((item) => (
                      <div key={item.name} className="flex justify-between items-start group">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 border flex items-center justify-center p-[2px] ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                              <div className={`w-full h-full rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                            </div>
                            <h4 className="font-semibold text-gray-900">{item.name}</h4>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">₹{item.price}</p>
                          {item.desc && <p className="text-xs text-gray-500 mt-1">{item.desc}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-gray-100 w-full my-4"></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Booking Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t border-gray-200 shadow-[0_-5px_10px_rgba(0,0,0,0.05)] z-20 flex items-center gap-3 max-w-md mx-auto">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase font-semibold">Table Booking</p>
            <p className="text-sm font-medium text-green-600">Available Today</p>
          </div>
          <Button 
            onClick={() => setShowBookingModal(true)}
            className="flex-[2] h-12 text-lg font-bold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl shadow-lg shadow-red-200"
          >
            Book Table
          </Button>
        </div>
      </div>

      {/* Book Table Modal - Polished */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Book a Table</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Select Date</label>
              <div className="grid grid-cols-7 gap-2">
                {generateDates().slice(0, 7).map((dateItem) => (
                  <button
                    key={dateItem.date}
                    onClick={() => setSelectedDate(dateItem.date)}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      selectedDate === dateItem.date
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="text-xs opacity-75">{dateItem.label.split(' ')[0]}</div>
                    <div className="font-bold">{dateItem.label.split(' ')[1] || dateItem.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Select Time</label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === time
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Guest Count */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Number of Guests</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfGuests(Math.max(1, numberOfGuests - 1))}
                  className="rounded-full"
                >
                  -
                </Button>
                <span className="text-xl font-bold w-12 text-center">{numberOfGuests}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfGuests(numberOfGuests + 1)}
                  className="rounded-full"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Pet Count */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">Number of Pets</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPets(Math.max(1, numberOfPets - 1))}
                  className="rounded-full"
                >
                  -
                </Button>
                <span className="text-xl font-bold w-12 text-center">{numberOfPets}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPets(numberOfPets + 1)}
                  className="rounded-full"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Available Tables */}
            {selectedDate && selectedTime && availableTables.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">Select Table</label>
                <div className="space-y-2">
                  {availableTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setSelectedTable(table)}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        selectedTable?.id === table.id
                          ? 'border-red-600 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{table.name || `Table ${table.id}`}</p>
                          <p className="text-sm text-gray-600">Capacity: {table.capacity} guests</p>
                          {table.location && <p className="text-xs text-gray-500">{table.location}</p>}
                        </div>
                        {selectedTable?.id === table.id && (
                          <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Button */}
            <Button
              onClick={handleBooking}
              disabled={bookingLoading || !selectedDate || !selectedTime || !selectedTable}
              className="w-full h-12 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-lg font-bold rounded-xl shadow-lg disabled:opacity-50"
            >
              {bookingLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Booking...
                </span>
              ) : (
                'Confirm Booking'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}