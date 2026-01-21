"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Dog, Home, CheckCircle2, Tag, Sparkles, Bed, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ResortBoardingBookingEnhancedProps {
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

export function ResortBoardingBookingEnhanced(props: ResortBoardingBookingEnhancedProps) {
  const [pets, setPets] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [promotionCode, setPromotionCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [appliedPromotion, setAppliedPromotion] = useState<any>(null);
  const [formData, setFormData] = useState({
    petId: props.petId || '',
    checkInDate: '',
    checkOutDate: '',
    roomId: '',
    specialInstructions: '',
  });
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      Promise.all([loadPets(), loadRooms()]).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [phone]);
  
  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate) {
      loadRooms();
    }
  }, [formData.checkInDate, formData.checkOutDate]);

  const loadPets = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/pets/${phone}`);
      setPets(response.pets || response || []);
      if (props.petId && (response.pets || response).length > 0) {
        setFormData(prev => ({ ...prev, petId: props.petId || '' }));
      }
    } catch (error: any) {
      console.error('Error loading pets:', error);
      toast.error('Failed to load pets');
    }
  };
  
  const loadRooms = async () => {
    try {
      const vendorId = props.vendorId || props.preSelectedVendorId;
      if (!vendorId) return;
      
      const response = await apiClient.get<any>(`/vendor/${vendorId}/resort/rooms`);
      const allRooms = response.rooms || response || [];
      setRooms(allRooms.filter((r: any) => r.is_available !== false || r.isAvailable !== false));
    } catch (error: any) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    }
  };

  const applyPromotion = async () => {
    if (!promotionCode.trim()) {
      toast.error('Please enter a promotion code');
      return;
    }
    
    try {
      setApplyingPromo(true);
      const response = await apiClient.get<any>(`/promotions/validate?code=${promotionCode}`);
      if (response.valid && response.promotion) {
        setAppliedPromotion(response.promotion);
        toast.success('Promotion applied!');
      } else {
        toast.error(response.message || 'Invalid promotion code');
        setAppliedPromotion(null);
      }
    } catch (error: any) {
      toast.error('Failed to apply promotion code');
      setAppliedPromotion(null);
    } finally {
      setApplyingPromo(false);
    }
  };

  const calculateTotal = () => {
    const selectedRoom = rooms.find(r => r.id === formData.roomId || r.id === parseInt(formData.roomId));
    if (!selectedRoom || !formData.checkInDate || !formData.checkOutDate) return 0;
    
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    const durationDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const nightlyRate = selectedRoom.price_per_night || selectedRoom.pricePerNight || 0;
    const baseAmount = nightlyRate * durationDays;
    
    if (appliedPromotion) {
      const discount = appliedPromotion.discount_type === 'percentage' 
        ? (baseAmount * appliedPromotion.discount_value / 100)
        : appliedPromotion.discount_value || 0;
      return Math.max(0, baseAmount - discount);
    }
    
    return baseAmount;
  };

  const handleSubmit = async () => {
    if (!formData.petId) {
      toast.error('Please select a pet');
      return;
    }
    if (!formData.checkInDate || !formData.checkOutDate) {
      toast.error('Please select check-in and check-out dates');
      return;
    }
    if (!formData.roomId && rooms.length > 0) {
      toast.error('Please select a room type');
      return;
    }

    try {
      setSubmitting(true);
      
      const customerId = localStorage.getItem('warmpawz_customer_id');
      if (!customerId) {
        toast.error('Please login to create booking');
        return;
      }

      const vendorId = props.vendorId || props.preSelectedVendorId;
      if (!vendorId) {
        toast.error('Vendor information not available');
        return;
      }

      const servicesResponse = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      const allServices = servicesResponse.services || servicesResponse || [];
      const boardingService = allServices.find((s: any) => 
        s.serviceType === 'boarding' || 
        s.name?.toLowerCase().includes('boarding') ||
        s.service_style === 'boarding'
      ) || allServices[0];
      
      if (!boardingService) {
        toast.error('Boarding service not available for this vendor');
        return;
      }

      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      const durationDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = calculateTotal();

      const response = await apiClient.post<any>('/bookings/create', {
        customerId,
        vendorId,
        serviceId: boardingService.id || boardingService.serviceId,
        serviceType: 'at_vendor',
        bookingDate: formData.checkInDate,
        bookingTime: '10:00',
        paymentMethod: 'cash',
        petId: formData.petId,
        roomId: formData.roomId || undefined,
        promotionId: appliedPromotion?.id || undefined,
        amount: totalAmount,
        notes: `Boarding from ${formData.checkInDate} to ${formData.checkOutDate} (${durationDays} days). Room: ${formData.roomId}. ${formData.specialInstructions || ''}`,
      });
      
      const bookingId = (response as any).bookingId || (response as any).id;
      toast.success('Boarding booking confirmed!');
      props.onSuccess?.(bookingId);
      props.onComplete?.();
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Resort & Boarding</h1>
          </div>
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to book boarding services</p>
          </Card>
        </div>
      </div>
    );
  }

  const selectedRoom = rooms.find(r => r.id === formData.roomId || r.id === parseInt(formData.roomId));
  const checkIn = formData.checkInDate ? new Date(formData.checkInDate) : null;
  const checkOut = formData.checkOutDate ? new Date(formData.checkOutDate) : null;
  const durationDays = checkIn && checkOut ? Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const selectedPet = pets.find(p => p.id === formData.petId || p.id === parseInt(formData.petId));
  const baseAmount = selectedRoom && durationDays > 0 
    ? (selectedRoom.price_per_night || selectedRoom.pricePerNight || 0) * durationDays 
    : 0;
  const discount = appliedPromotion 
    ? (appliedPromotion.discount_type === 'percentage' 
      ? (baseAmount * appliedPromotion.discount_value / 100)
      : appliedPromotion.discount_value || 0)
    : 0;
  const totalAmount = calculateTotal();

  if (showReview) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
        {/* ✅ FIX: Review Header with Orange Gradient Theme */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 pt-8 pb-6 relative">
          <button 
            onClick={() => setShowReview(false)}
            className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Review Booking</h1>
              <p className="text-white/80 text-sm">Confirm your reservation</p>
            </div>
          </div>
          
          {/* Curved bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white" 
               style={{
                 borderTopLeftRadius: '50% 100%',
                 borderTopRightRadius: '50% 100%',
               }}
          />
        </div>
        
        <div className="bg-white min-h-screen -mt-2">

          <div className="p-4 space-y-4">
            <Card className="p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Booking Summary</h2>
              
              {selectedRoom && (
                <div className="space-y-3 pb-4 border-b">
                  <div className="flex items-center gap-3">
                    <Bed className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="font-medium capitalize">{selectedRoom.room_type || selectedRoom.roomType || 'Standard'}</p>
                    </div>
                  </div>
                  {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                    <div className="ml-8">
                      <p className="text-xs text-gray-500 mb-1">Amenities:</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedRoom.amenities.map((amenity: string, idx: number) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{amenity}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {checkIn && checkOut && (
                <div className="flex items-center gap-3 py-4 border-b">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Check-in / Check-out</p>
                    <p className="font-medium">
                      {checkIn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {checkOut.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-xs text-gray-500">{durationDays} {durationDays === 1 ? 'night' : 'nights'}</p>
                  </div>
                </div>
              )}

              {selectedPet && (
                <div className="flex items-center gap-3 py-4 border-b">
                  <User className="w-5 h-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Pet</p>
                    <p className="font-medium">{selectedPet.name} ({selectedPet.breed || 'Pet'})</p>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-5 h-5 text-orange-600" />
                  <Label className="text-sm font-medium">Promotion Code</Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter code"
                    value={promotionCode}
                    onChange={(e) => setPromotionCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={applyPromotion}
                    disabled={applyingPromo || !promotionCode.trim()}
                    variant="outline"
                  >
                    {applyingPromo ? '...' : 'Apply'}
                  </Button>
                </div>
                {appliedPromotion && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    ✓ {appliedPromotion.name} applied ({appliedPromotion.discount_type === 'percentage' ? `${appliedPromotion.discount_value}%` : `₹${appliedPromotion.discount_value}`} off)
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">Price Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nightly Rate × {durationDays} {durationDays === 1 ? 'night' : 'nights'}</span>
                  <span>₹{baseAmount}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({appliedPromotion?.name})</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-orange-600">₹{totalAmount}</span>
                </div>
              </div>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
            >
              {submitting ? 'Confirming Booking...' : `Confirm & Pay ₹${totalAmount}`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* ✅ FIX: Header with Orange Gradient Theme Matching BoardingServiceRouter */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 pt-8 pb-6 relative">
        <button 
          onClick={props.onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Resort & Boarding</h1>
            <p className="text-white/80 text-sm">Premium pet stay</p>
          </div>
        </div>
        
        {/* Curved bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>
      
      <div className="bg-white min-h-screen -mt-2">

        <div className="p-4 space-y-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
            <div className="flex items-center gap-3">
              <Home className="w-8 h-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Premium Pet Boarding</h3>
                <p className="text-sm text-gray-600">Safe and comfortable stay for your pet</p>
              </div>
            </div>
          </Card>

          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Check-in Date *
                    </Label>
                    <Input
                      type="date"
                      value={formData.checkInDate}
                      onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Check-out Date *
                    </Label>
                    <Input
                      type="date"
                      value={formData.checkOutDate}
                      onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                      min={formData.checkInDate || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </Card>

              {rooms.length > 0 && (
                <Card className="p-4">
                  <Label className="mb-3 block flex items-center gap-2">
                    <Bed className="w-4 h-4" />
                    Select Room Type *
                  </Label>
                  <div className="space-y-2">
                    {rooms.map((room) => {
                      const isSelected = formData.roomId === room.id || formData.roomId === String(room.id);
                      const nightlyRate = room.price_per_night || room.pricePerNight || 0;
                      return (
                        <button
                          key={room.id}
                          onClick={() => setFormData({ ...formData, roomId: String(room.id) })}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 bg-white hover:border-blue-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 capitalize mb-1">
                                {room.room_type || room.roomType || 'Standard Room'}
                              </h3>
                              {room.amenities && room.amenities.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {room.amenities.slice(0, 3).map((amenity: string, idx: number) => (
                                    <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                      {amenity}
                                    </span>
                                  ))}
                                  {room.amenities.length > 3 && (
                                    <span className="text-xs text-gray-500">+{room.amenities.length - 3} more</span>
                                  )}
                                </div>
                              )}
                              {room.capacity && (
                                <p className="text-xs text-gray-500 mt-1">Capacity: {room.capacity} {room.capacity === 1 ? 'pet' : 'pets'}</p>
                              )}
                            </div>
                            <div className="ml-4 text-right">
                              <p className="font-bold text-blue-600">₹{nightlyRate}</p>
                              <p className="text-xs text-gray-500">per night</p>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-5 h-5 text-blue-500 mt-2" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <Label className="mb-2 block">Select Pet *</Label>
                <select
                  value={formData.petId}
                  onChange={(e) => setFormData({ ...formData, petId: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                >
                  <option value="">Choose a pet</option>
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} ({pet.breed || 'Pet'})
                    </option>
                  ))}
                </select>
              </Card>

              <Card className="p-4">
                <Label className="mb-2 block">Special Instructions</Label>
                <textarea
                  value={formData.specialInstructions}
                  onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                  placeholder="Any special care instructions, dietary requirements, or notes..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                />
              </Card>

              {selectedRoom && formData.checkInDate && formData.checkOutDate && (
                <Card className="p-4 bg-orange-50 border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Estimated Total</p>
                      <p className="text-2xl font-bold text-orange-600">₹{calculateTotal()}</p>
                      <p className="text-xs text-gray-500">
                        ₹{selectedRoom.price_per_night || selectedRoom.pricePerNight || 0} × {durationDays} {durationDays === 1 ? 'night' : 'nights'}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => {
                    if (!formData.petId) {
                      toast.error('Please select a pet');
                      return;
                    }
                    if (!formData.checkInDate || !formData.checkOutDate) {
                      toast.error('Please select check-in and check-out dates');
                      return;
                    }
                    if (!formData.roomId && rooms.length > 0) {
                      toast.error('Please select a room type');
                      return;
                    }
                    setShowReview(true);
                  }}
                  disabled={!formData.petId || !formData.checkInDate || !formData.checkOutDate || (rooms.length > 0 && !formData.roomId)}
                  className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
                >
                  Review Booking
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
