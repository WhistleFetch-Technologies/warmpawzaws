"use client";

import { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Coffee, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface CafeReservationFlowProps {
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

export function CafeReservationFlow(props: CafeReservationFlowProps) {
  const [cafe, setCafe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    guests: 2,
    petCount: 1,
    specialRequests: '',
  });
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (props.cafeId || props.vendorId) {
      loadCafeDetails();
    } else {
      setLoading(false);
    }
  }, [props.cafeId, props.vendorId]);

  const loadCafeDetails = async () => {
    try {
      setLoading(true);
      const cafeId = props.cafeId || props.vendorId;
      const response = await apiClient.get<any>(`/vendor/${cafeId}`);
      setCafe(response.vendor || response);
    } catch (error: any) {
      console.error('Error loading cafe:', error);
      setCafe({ name: 'Pet Cafe', address: 'City Center' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.time) {
      toast.error('Please select date and time');
      return;
    }

    try {
      setSubmitting(true);
      
      // Get customer ID
      const customerId = localStorage.getItem('warmpawz_customer_id');
      if (!customerId) {
        toast.error('Please login to create reservation');
        return;
      }

      const vendorId = props.cafeId || props.vendorId;
      if (!vendorId) {
        toast.error('Cafe information not available');
        return;
      }

      // Get cafe reservation service
      const servicesResponse = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      const allServices = servicesResponse.services || servicesResponse || [];
      const cafeService = allServices.find((s: any) => 
        s.serviceType === 'cafe' || 
        s.name?.toLowerCase().includes('reservation') ||
        s.service_style === 'cafe'
      ) || allServices[0]; // Fallback to first service
      
      if (!cafeService) {
        // Fallback: create with generic service
        const response = await apiClient.post<any>('/bookings/create', {
          customerId,
          vendorId,
          serviceId: 'cafe-reservation',
          serviceType: 'at_vendor', // Cafe reservations are at vendor
          bookingDate: formData.date,
          bookingTime: formData.time,
          paymentMethod: 'cash', // Default for reservations
          amount: 0, // Cafe reservations may not require upfront payment
          notes: `Reservation for ${formData.guests} guests, ${formData.petCount} pets. ${formData.specialRequests || ''}`,
        });
        const res1 = response as any;
        const bookingId1 = res1?.data?.bookingId ?? res1?.bookingId ?? res1?.booking?.id ?? res1?.id ?? '';
        if (!bookingId1) throw new Error(res1?.error ?? 'Failed to create reservation');
        toast.success('Reservation confirmed!');
        props.onSuccess?.(bookingId1);
        props.onComplete?.();
        return;
      }

      // Use standard booking creation endpoint
      const response = await apiClient.post<any>('/bookings/create', {
        customerId,
        vendorId,
        serviceId: cafeService.id || cafeService.serviceId,
        serviceType: 'at_vendor', // Cafe reservations are at vendor
        bookingDate: formData.date,
        bookingTime: formData.time,
        paymentMethod: 'cash', // Default for reservations
        amount: cafeService.price || 0,
        notes: `Reservation for ${formData.guests} guests, ${formData.petCount} pets. ${formData.specialRequests || ''}`,
      });
      
      const res = response as any;
      const bookingId = res?.data?.bookingId ?? res?.bookingId ?? res?.booking?.id ?? res?.booking?.bookingId ?? res?.id ?? '';
      if (!bookingId) throw new Error(res?.error ?? 'Failed to create reservation');
      toast.success('Reservation confirmed!');
      props.onSuccess?.(bookingId);
      props.onComplete?.();
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast.error(error.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Main Content */}
      <div className="bg-white px-6 pt-8 min-h-[calc(100vh-180px)]">
          <div className="space-y-4">
          {cafe && (
            <Card className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-center gap-3">
                <Coffee className="w-8 h-8 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{cafe.name || 'Pet Cafe'}</h3>
                  {cafe.address && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <MapPin className="w-4 h-4" />
                      {cafe.address}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date *
                </Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Time *
                </Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Number of Guests
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.guests}
                  onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Number of Pets</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={formData.petCount}
                  onChange={(e) => setFormData({ ...formData, petCount: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label className="mb-2 block">Special Requests</Label>
                <textarea
                  value={formData.specialRequests}
                  onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                  placeholder="Any special requirements or requests..."
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                />
              </div>
            </div>
          </Card>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.date || !formData.time}
            className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
          >
            {submitting ? 'Confirming...' : 'Confirm Reservation'}
          </Button>
          </div>
        </div>
    </>
  );
}
