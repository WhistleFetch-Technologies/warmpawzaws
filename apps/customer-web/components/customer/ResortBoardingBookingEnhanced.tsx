"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Dog, Home, CheckCircle2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    petId: props.petId || '',
    checkInDate: '',
    checkOutDate: '',
    specialInstructions: '',
  });
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadPets();
    } else {
      setLoading(false);
    }
  }, [phone]);

  const loadPets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/pets/${phone}`);
      setPets(response.pets || response || []);
      if (props.petId && (response.pets || response).length > 0) {
        setFormData(prev => ({ ...prev, petId: props.petId || '' }));
      }
    } catch (error: any) {
      console.error('Error loading pets:', error);
      toast.error('Failed to load pets');
    } finally {
      setLoading(false);
    }
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

    try {
      setSubmitting(true);
      
      // Get customer ID
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

      // Get boarding service for this vendor
      const servicesResponse = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      const allServices = servicesResponse.services || servicesResponse || [];
      const boardingService = allServices.find((s: any) => 
        s.serviceType === 'boarding' || 
        s.name?.toLowerCase().includes('boarding') ||
        s.service_style === 'boarding'
      ) || allServices[0]; // Fallback to first service
      
      if (!boardingService) {
        toast.error('Boarding service not available for this vendor');
        return;
      }

      // Calculate duration in days
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      const durationDays = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = (boardingService.price || 0) * durationDays;

      // Use standard booking creation endpoint
      const response = await apiClient.post<any>('/bookings/create', {
        customerId,
        vendorId,
        serviceId: boardingService.id || boardingService.serviceId,
        serviceType: 'at_vendor', // Boarding is at vendor
        bookingDate: formData.checkInDate,
        bookingTime: '10:00', // Default check-in time
        paymentMethod: 'cash', // Default payment method
        petId: formData.petId,
        amount: totalAmount,
        notes: `Boarding from ${formData.checkInDate} to ${formData.checkOutDate} (${durationDays} days). ${formData.specialInstructions || ''}`,
      });
      
      const bookingId = (response as any).bookingId || (response as any).id;
      toast.success('Boarding booking request submitted!');
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Resort & Boarding</h1>
          </div>
        </div>

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

              <div className="space-y-3">
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.petId || !formData.checkInDate || !formData.checkOutDate}
                  className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
                >
                  {submitting ? 'Submitting...' : 'Book Boarding'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
