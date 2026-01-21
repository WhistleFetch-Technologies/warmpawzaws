"use client";

/**
 * ResortDetailMakeMyTrip - MakeMyTrip-style Resort/Boarding Detail Page
 * 
 * Features:
 * - Photo gallery carousel
 * - Room types with photos and details
 * - Inclusions/exclusions lists
 * - Cancellation policy
 * - Check-in/check-out times
 * - Amenities & facilities
 * - Reviews section
 * - Booking flow integration
 */

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, Heart, Share2, MapPin, Star, Phone, Navigation, Calendar, Clock, 
  Users, ShieldCheck, Image as ImageIcon, X, Check, AlertCircle, ChevronLeft, 
  ChevronRight, Wifi, Car, Coffee, Utensils, Wind, Tv, Bath, Dog, Cat,
  Info, CreditCard, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ResortDetailMakeMyTripProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  resortId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
}

interface Room {
  id: string;
  name: string;
  type: string;
  description: string;
  capacity: number;
  pricePerNight: number;
  photos: string[];
  amenities: string[];
  available: boolean;
  bedType?: string;
  size?: string;
}

interface ResortDetails {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  rating: number;
  reviewsCount: number;
  photos: string[];
  rooms: Room[];
  amenities: string[];
  facilities: string[];
  checkInTime: string;
  checkOutTime: string;
  petPolicy: string[];
  cancellationPolicy: {
    freeCancellation: boolean;
    freeCancellationDays: number;
    cancellationFee: number;
    refundPercentage: number;
  };
  inclusions: string[];
  exclusions: string[];
  houseRules: string[];
  coordinates: { lat: number; lng: number };
  phone: string;
}

const AMENITY_ICONS: Record<string, any> = {
  'wifi': Wifi,
  'parking': Car,
  'cafe': Coffee,
  'restaurant': Utensils,
  'ac': Wind,
  'tv': Tv,
  'bath': Bath,
  'pet_friendly': Dog,
};

export function ResortDetailMakeMyTrip(props: ResortDetailMakeMyTripProps) {
  const resortId = props.resortId || props.vendorId || '';
  const phone = props.phone || props.customerPhone || '';
  const [resort, setResort] = useState<ResortDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'rooms' | 'policies' | 'reviews'>('overview');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Booking state
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [numberOfPets, setNumberOfPets] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    if (resortId) {
      loadResortDetails();
      loadReviews();
    }
  }, [resortId]);

  const loadReviews = async () => {
    try {
      setReviewsLoading(true);
      const data = await apiClient.get<any>(`/reviews/vendor/${resortId}`);
      const reviewsList = data.reviews || data || [];
      setReviews(Array.isArray(reviewsList) ? reviewsList : []);
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadResortDetails = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/vendor/${resortId}`);
      const roomsData = await apiClient.get<any>(`/vendor/${resortId}/resort/rooms`).catch(() => ({ rooms: [] }));
      
      if (data.vendor || data) {
        const vendor = data.vendor || data;
        
        const profile: ResortDetails = {
          id: vendor.id,
          name: vendor.business_name || vendor.name || 'Pet Resort',
          description: vendor.description || "A luxurious pet boarding facility with 24/7 care and modern amenities.",
          address: vendor.location?.address || vendor.address || "Location",
          city: vendor.city || "City",
          rating: vendor.rating || 4.8,
          reviewsCount: vendor.reviews_count || 0,
          photos: vendor.photos || [
            "https://images.unsplash.com/photo-1587300003388-59208cc962cb?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
            "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
            "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80",
          ],
          rooms: (roomsData.rooms || []).map((r: any) => ({
            id: r.id,
            name: r.room_number || r.name || `Room ${r.id}`,
            type: r.room_type || r.type || 'standard',
            description: r.description || 'Comfortable room for your pet',
            capacity: r.capacity || 1,
            pricePerNight: r.price_per_night || r.pricePerNight || 1000,
            photos: r.photos || [],
            amenities: r.amenities || ['AC', 'CCTV', 'Play Area'],
            available: r.is_available !== false,
            bedType: r.bed_type || 'Single Pet Bed',
            size: r.size || '8x8 ft',
          })),
          amenities: vendor.amenities || ['24/7 CCTV', 'AC Rooms', 'Play Area', 'Grooming', 'Vet On-Call'],
          facilities: ['Swimming Pool', 'Spa', 'Training Ground', 'Pet Park'],
          checkInTime: vendor.check_in_time || '10:00 AM',
          checkOutTime: vendor.check_out_time || '10:00 AM',
          petPolicy: vendor.pet_policy || [
            'Pets must be vaccinated (proof required)',
            'Dogs and cats accepted',
            'Aggressive pets not allowed',
            'Maximum 2 pets per room',
          ],
          cancellationPolicy: vendor.cancellation_policy || {
            freeCancellation: true,
            freeCancellationDays: 3,
            cancellationFee: 500,
            refundPercentage: 80,
          },
          inclusions: vendor.inclusions || [
            'Daily meals (breakfast, lunch, dinner)',
            'Daily walks (2 times)',
            'Play sessions',
            '24/7 monitoring',
            'Photo/video updates',
            'Basic grooming',
          ],
          exclusions: vendor.exclusions || [
            'Special dietary food',
            'Medical treatments',
            'Premium grooming services',
            'Transport to/from resort',
          ],
          houseRules: vendor.house_rules || [
            'Check-in between 10 AM - 6 PM',
            'Advance booking required',
            'Pet health certificate required',
            'No outside food allowed',
          ],
          coordinates: vendor.location || { lat: 0, lng: 0 },
          phone: vendor.phone || '',
        };
        
        // Add default rooms if none exist
        if (profile.rooms.length === 0) {
          profile.rooms = [
            {
              id: 'standard',
              name: 'Standard Room',
              type: 'standard',
              description: 'Comfortable room with basic amenities for your pet',
              capacity: 1,
              pricePerNight: 800,
              photos: [],
              amenities: ['AC', 'CCTV', 'Daily Cleaning'],
              available: true,
              bedType: 'Single Pet Bed',
              size: '6x6 ft',
            },
            {
              id: 'deluxe',
              name: 'Deluxe Room',
              type: 'deluxe',
              description: 'Spacious room with premium amenities and play area',
              capacity: 2,
              pricePerNight: 1500,
              photos: [],
              amenities: ['AC', 'CCTV', 'Play Area', 'TV', 'Premium Bedding'],
              available: true,
              bedType: 'Double Pet Bed',
              size: '10x10 ft',
            },
            {
              id: 'suite',
              name: 'Royal Suite',
              type: 'suite',
              description: 'Luxury suite with private play area and premium care',
              capacity: 2,
              pricePerNight: 2500,
              photos: [],
              amenities: ['AC', 'CCTV', 'Private Play Area', 'TV', 'Spa Access', 'Personal Caretaker'],
              available: true,
              bedType: 'King Pet Bed',
              size: '15x15 ft',
            },
          ];
        }
        
        setResort(profile);
      }
    } catch (error) {
      console.error('Error loading resort details:', error);
      toast.error('Failed to load resort details');
    } finally {
      setLoading(false);
    }
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const calculateTotal = () => {
    if (!selectedRoom) return 0;
    const nights = calculateNights();
    return selectedRoom.pricePerNight * nights * numberOfPets;
  };

  const handleBooking = async () => {
    if (!selectedRoom || !checkInDate || !checkOutDate) {
      toast.error('Please select room and dates');
      return;
    }

    if (calculateNights() <= 0) {
      toast.error('Check-out must be after check-in');
      return;
    }

    try {
      setBookingLoading(true);
      
      // Navigate to booking flow
      if (props.onNavigate) {
        props.onNavigate('boarding_booking', {
          vendorId: resortId,
          roomId: selectedRoom.id,
          roomName: selectedRoom.name,
          roomType: selectedRoom.type,
          pricePerNight: selectedRoom.pricePerNight,
          checkInDate,
          checkOutDate,
          numberOfPets,
          totalAmount: calculateTotal(),
        });
      }
      
      setShowBookingModal(false);
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Failed to proceed with booking');
    } finally {
      setBookingLoading(false);
    }
  };

  const openDirections = () => {
    if (!resort) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${resort.coordinates.lat},${resort.coordinates.lng}`;
    window.open(url, '_blank');
  };

  // Generate dates for next 60 days
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  if (loading || !resort) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
        {/* Photo Gallery Header */}
        <div className="relative h-72 w-full overflow-hidden bg-gray-900">
          <img 
            src={resort.photos[0]} 
            alt={resort.name} 
            className="w-full h-full object-cover opacity-95"
            onClick={() => setShowGallery(true)}
          />
          
          {/* Navigation */}
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
          
          {/* Photo count badge */}
          <button 
            onClick={() => setShowGallery(true)}
            className="absolute bottom-4 right-4 bg-black/60 backdrop-blur text-white text-xs px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-black/80 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            <span>View all {resort.photos.length} photos</span>
          </button>
          
          {/* Rating Badge */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="bg-green-600 text-white text-sm font-bold px-2 py-1 rounded flex items-center gap-1">
                {resort.rating} <Star className="w-3 h-3 fill-white" />
              </div>
              <span className="text-xs text-gray-600">{resort.reviewsCount} reviews</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white -mt-4 relative rounded-t-3xl shadow-xl border-t border-gray-100">
          {/* Resort Info */}
          <div className="p-5 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-gray-900">{resort.name}</h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {resort.address}
            </p>
            
            {/* Quick Info */}
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-green-600" />
                <span>Check-in: {resort.checkInTime}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4 text-red-600" />
                <span>Check-out: {resort.checkOutTime}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 px-4">
            {(['overview', 'rooms', 'policies', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium capitalize transition-colors relative ${
                  activeTab === tab 
                    ? 'text-blue-600' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <>
                {/* Description */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">About</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{resort.description}</p>
                </div>

                {/* Inclusions */}
                <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" /> What's Included
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {resort.inclusions.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Exclusions */}
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" /> Not Included
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {resort.exclusions.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {resort.amenities.map((a) => (
                      <Badge key={a} variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 py-1.5 px-3">
                        ✓ {a}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Map */}
                <div 
                  className="rounded-xl overflow-hidden border border-gray-200 h-32 relative bg-gray-100 cursor-pointer" 
                  onClick={openDirections}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm text-sm font-medium text-gray-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      <span>Get Directions</span>
                      <Navigation className="w-4 h-4 text-blue-500" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Rooms Tab */}
            {activeTab === 'rooms' && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">Select Room Type</h3>
                
                {resort.rooms.map((room) => (
                  <Card 
                    key={room.id} 
                    className={`overflow-hidden transition-all cursor-pointer ${
                      selectedRoom?.id === room.id 
                        ? 'ring-2 ring-blue-500 shadow-lg' 
                        : 'hover:shadow-md'
                    }`}
                    onClick={() => setSelectedRoom(room)}
                  >
                    {/* Room Image */}
                    <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 relative">
                      {room.photos.length > 0 ? (
                        <img src={room.photos[0]} alt={room.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center text-gray-400">
                            <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                            <span className="text-sm">No photo</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Room Type Badge */}
                      <Badge className={`absolute top-3 left-3 ${
                        room.type === 'suite' ? 'bg-purple-600' :
                        room.type === 'deluxe' ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        {room.type.charAt(0).toUpperCase() + room.type.slice(1)}
                      </Badge>
                      
                      {!room.available && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white font-bold">Sold Out</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Room Info */}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-gray-900">{room.name}</h4>
                          <p className="text-xs text-gray-500">{room.size} • {room.bedType}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">₹{room.pricePerNight}</div>
                          <div className="text-xs text-gray-500">per night</div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{room.description}</p>
                      
                      {/* Room Amenities */}
                      <div className="flex flex-wrap gap-1">
                        {room.amenities.slice(0, 4).map((a) => (
                          <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {a}
                          </span>
                        ))}
                        {room.amenities.length > 4 && (
                          <span className="text-xs text-blue-600 px-2 py-1">
                            +{room.amenities.length - 4} more
                          </span>
                        )}
                      </div>
                      
                      {/* Capacity */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                        <Dog className="w-4 h-4" />
                        <span>Max {room.capacity} pet{room.capacity > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
              <div className="space-y-6">
                {/* Cancellation Policy */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-yellow-600" /> Cancellation Policy
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    {resort.cancellationPolicy.freeCancellation ? (
                      <p className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-500 mt-0.5" />
                        Free cancellation up to {resort.cancellationPolicy.freeCancellationDays} days before check-in
                      </p>
                    ) : (
                      <p className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5" />
                        No free cancellation available
                      </p>
                    )}
                    <p className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                      Cancellation fee: ₹{resort.cancellationPolicy.cancellationFee}
                    </p>
                    <p className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                      Refund: {resort.cancellationPolicy.refundPercentage}% of booking amount
                    </p>
                  </div>
                </div>

                {/* Pet Policy */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" /> Pet Policy
                  </h3>
                  <ul className="space-y-2">
                    {resort.petPolicy.map((policy, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                        {policy}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* House Rules */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-gray-600" /> House Rules
                  </h3>
                  <ul className="space-y-2">
                    {resort.houseRules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">Guest Reviews</h3>
                  <div className="flex items-center gap-2">
                    <div className="bg-green-600 text-white text-lg font-bold px-3 py-1 rounded-lg flex items-center gap-1">
                      {resort.rating} <Star className="w-4 h-4 fill-white" />
                    </div>
                    <span className="text-sm text-gray-500">({resort.reviewsCount})</span>
                  </div>
                </div>
                
                {reviewsLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p>Loading reviews...</p>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No reviews yet</p>
                    <p className="text-sm">Be the first to review!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.slice(0, 5).map((review: any, index: number) => (
                      <div key={review.id || index} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {(review.customer_name || review.customerName || 'User').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-gray-800">
                                {review.customer_name || review.customerName || 'Pet Parent'}
                              </p>
                              <div className="bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                {review.rating || 5} <Star className="w-3 h-3 fill-white" />
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">{review.comment || review.review_text || 'Great experience!'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {reviews.length > 5 && (
                      <button className="w-full py-2 text-blue-600 font-medium text-sm">
                        View all {reviews.length} reviews
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Booking Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-5px_15px_rgba(0,0,0,0.1)] z-20 max-w-md mx-auto">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {selectedRoom ? (
                <>
                  <p className="text-xs text-gray-500">{selectedRoom.name}</p>
                  <p className="text-lg font-bold text-blue-600">₹{selectedRoom.pricePerNight}/night</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">Starting from</p>
                  <p className="text-lg font-bold text-blue-600">
                    ₹{Math.min(...resort.rooms.map(r => r.pricePerNight))}/night
                  </p>
                </>
              )}
            </div>
            <Button 
              onClick={() => setShowBookingModal(true)}
              className="flex-1 h-12 text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl shadow-lg"
            >
              Book Now
            </Button>
          </div>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-full w-full h-full max-h-full p-0 bg-black">
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowGallery(false)}
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            >
              <X className="w-6 h-6" />
            </Button>
            
            <img 
              src={resort.photos[galleryIndex]} 
              alt={`Photo ${galleryIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {/* Navigation arrows */}
            {resort.photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setGalleryIndex((prev) => (prev - 1 + resort.photos.length) % resort.photos.length)}
                  className="absolute left-4 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setGalleryIndex((prev) => (prev + 1) % resort.photos.length)}
                  className="absolute right-4 text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>
              </>
            )}
            
            {/* Photo counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full text-sm">
              {galleryIndex + 1} / {resort.photos.length}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Modal */}
      <Dialog open={showBookingModal} onOpenChange={setShowBookingModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Book Your Stay</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Date Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Check-in</label>
                <input
                  type="date"
                  value={checkInDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Check-out</label>
                <input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Room Selection Summary */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Selected Room</label>
              {selectedRoom ? (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{selectedRoom.name}</p>
                      <p className="text-xs text-gray-500">{selectedRoom.type} • {selectedRoom.size}</p>
                    </div>
                    <p className="font-bold text-blue-600">₹{selectedRoom.pricePerNight}/night</p>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    setShowBookingModal(false);
                    setActiveTab('rooms');
                  }}
                  className="w-full border border-dashed border-gray-300 rounded-lg p-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  Select a room type →
                </button>
              )}
            </div>

            {/* Number of Pets */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Number of Pets</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPets(Math.max(1, numberOfPets - 1))}
                  disabled={numberOfPets <= 1}
                >
                  -
                </Button>
                <span className="text-xl font-bold w-12 text-center">{numberOfPets}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNumberOfPets(Math.min(selectedRoom?.capacity || 5, numberOfPets + 1))}
                  disabled={numberOfPets >= (selectedRoom?.capacity || 5)}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Price Summary */}
            {selectedRoom && calculateNights() > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">₹{selectedRoom.pricePerNight} × {calculateNights()} night{calculateNights() > 1 ? 's' : ''}</span>
                  <span className="text-gray-900">₹{selectedRoom.pricePerNight * calculateNights()}</span>
                </div>
                {numberOfPets > 1 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Additional pet ({numberOfPets - 1})</span>
                    <span className="text-gray-900">₹{selectedRoom.pricePerNight * calculateNights() * (numberOfPets - 1)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span className="text-blue-600">₹{calculateTotal()}</span>
                </div>
              </div>
            )}

            {/* Cancellation Info */}
            {resort.cancellationPolicy.freeCancellation && (
              <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg">
                <Check className="w-4 h-4 mt-0.5" />
                <span>Free cancellation until {resort.cancellationPolicy.freeCancellationDays} days before check-in</span>
              </div>
            )}

            {/* Book Button */}
            <Button 
              onClick={handleBooking}
              disabled={!selectedRoom || !checkInDate || !checkOutDate || bookingLoading}
              className="w-full h-12 text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl"
            >
              {bookingLoading ? 'Processing...' : `Book for ₹${calculateTotal() || '--'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
