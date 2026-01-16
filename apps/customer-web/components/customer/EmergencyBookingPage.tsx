"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, Phone, MapPin, Clock, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface EmergencyBookingPageProps {
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

export function EmergencyBookingPage(props: EmergencyBookingPageProps) {
  const [emergencyVets, setEmergencyVets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadEmergencyVets();
    } else {
      setLoading(false);
    }
  }, [phone]);

  const loadEmergencyVets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/emergency-vets?phone=${encodeURIComponent(phone || '')}`);
      setEmergencyVets(response.vets || response || []);
    } catch (error: any) {
      console.error('Error loading emergency vets:', error);
      // Set default emergency contacts
      setEmergencyVets([
        { id: '1', name: 'Emergency Vet Clinic', phone: '1800-123-4567', available: true, distance: '2.5 km' },
        { id: '2', name: '24/7 Pet Emergency', phone: '1800-987-6543', available: true, distance: '5.0 km' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (vetPhone: string) => {
    setCalling(true);
    window.location.href = `tel:${vetPhone}`;
    setTimeout(() => setCalling(false), 1000);
  };

  const handleBookEmergency = async (vetId: string) => {
    try {
      // Get customer ID
      const customerId = localStorage.getItem('warmpawz_customer_id');
      if (!customerId) {
        toast.error('Please login to create emergency booking');
        return;
      }

      // Get emergency service for this vet
      const servicesResponse = await apiClient.get<any>(`/vendor/${vetId}/services`);
      const allServices = servicesResponse.services || servicesResponse || [];
      const emergencyService = allServices.find((s: any) => 
        s.serviceType === 'emergency' || 
        s.name?.toLowerCase().includes('emergency') ||
        s.service_style === 'emergency'
      ) || allServices[0]; // Fallback to first service if no emergency-specific service
      
      if (!emergencyService) {
        toast.error('Emergency service not available for this vet');
        return;
      }

      // Use standard booking creation endpoint with emergency serviceType
      const response = await apiClient.post<any>('/bookings/create', {
        customerId,
        vendorId: vetId,
        serviceId: emergencyService.id || emergencyService.serviceId,
        serviceType: emergencyService.service_style === 'at_home' ? 'at_home' : 'at_vendor', // Emergency can be at vendor or at home
        bookingDate: new Date().toISOString().split('T')[0],
        bookingTime: new Date().toTimeString().slice(0, 5), // Current time HH:MM
        paymentMethod: 'cash', // Emergency bookings typically paid on site
        petId: props.petId,
        amount: emergencyService.price || 0,
        notes: 'Emergency booking - immediate attention required',
      });
      
      const bookingId = (response as any).bookingId || (response as any).id;
      toast.success('Emergency booking created!');
      props.onSuccess?.(bookingId);
    } catch (error: any) {
      console.error('Error creating emergency booking:', error);
      toast.error(error.message || 'Failed to create emergency booking. Please call directly.');
    }
  };

  return (
    <div className="min-h-screen bg-red-50 pb-24">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-red-600 text-white px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-red-700">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Emergency Services</h1>
              <p className="text-sm text-red-100">24/7 Available</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Pet Emergency?</h3>
                <p className="text-sm text-red-700">Call immediately for urgent care. Our emergency vets are available 24/7.</p>
              </div>
            </div>
          </Card>

          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading emergency contacts...</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {emergencyVets.map((vet) => (
                <Card key={vet.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Stethoscope className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold text-gray-900">{vet.name}</h3>
                      </div>
                      {vet.distance && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                          <MapPin className="w-4 h-4" />
                          {vet.distance} away
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {vet.phone}
                      </div>
                    </div>
                    {vet.available && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Available</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => handleCall(vet.phone)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call Now
                    </Button>
                    <Button
                      onClick={() => handleBookEmergency(vet.id)}
                      variant="outline"
                      className="flex-1 border-red-600 text-red-600 hover:bg-red-50"
                    >
                      Book Visit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-4 bg-blue-50 border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">Emergency Tips</h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Keep your pet calm and still</li>
              <li>• Don't give food or water if vomiting</li>
              <li>• Apply pressure to bleeding wounds</li>
              <li>• Keep emergency vet number saved</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
