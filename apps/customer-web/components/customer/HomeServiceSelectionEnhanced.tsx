"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Home, Stethoscope, Scissors, GraduationCap, Heart, Brain, Moon, TestTube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface HomeServiceSelectionEnhancedProps {
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

const homeServices = [
  { id: 'vet', name: 'Vet Consultation', icon: Stethoscope, color: 'bg-blue-100 text-blue-600', desc: 'Home vet visits', price: '₹500+' },
  { id: 'grooming', name: 'Grooming', icon: Scissors, color: 'bg-purple-100 text-purple-600', desc: 'At-home grooming', price: '₹399+' },
  { id: 'training', name: 'Training', icon: GraduationCap, color: 'bg-green-100 text-green-600', desc: 'Pet training sessions', price: '₹499+' },
  { id: 'walking', name: 'Dog Walking', icon: Heart, color: 'bg-pink-100 text-pink-600', desc: 'Professional walkers', price: '₹150+' },
  { id: 'behaviourist', name: 'Behaviourist', icon: Brain, color: 'bg-amber-100 text-amber-600', desc: 'Behavior assessment', price: '₹799+' },
  { id: 'sitting', name: 'Pet Sitting', icon: Moon, color: 'bg-indigo-100 text-indigo-600', desc: 'In-home pet sitting', price: '₹299+' },
  { id: 'diagnostics', name: 'Home Sample', icon: TestTube, color: 'bg-teal-100 text-teal-600', desc: 'Lab sample collection', price: '₹199+' },
];

export function HomeServiceSelectionEnhanced(props: HomeServiceSelectionEnhancedProps) {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const phone = props.customerPhone || props.phone;

  useEffect(() => {
    if (phone) {
      loadServices();
    } else {
      setLoading(false);
    }
  }, [phone]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/customer/${phone}/home-services`);
      setServices(response.services || response || homeServices);
    } catch (error: any) {
      console.error('Error loading services:', error);
      setServices(homeServices);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === 'sitting') {
      props.onNavigate?.('pet-sitter');
      return;
    }
    props.onNavigate?.('create-booking', { serviceType: serviceId, homeService: true });
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Home Services</h1>
          </div>
          <Card className="p-6 text-center">
            <p className="text-gray-600">Please login to book home services</p>
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
            <h1 className="text-xl font-semibold">Home Services</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center gap-3">
              <Home className="w-8 h-8 text-blue-600" />
              <div>
                <h3 className="font-semibold text-gray-900">Services at Your Doorstep</h3>
                <p className="text-sm text-gray-600">Professional pet care services at home</p>
              </div>
            </div>
          </Card>

          {loading ? (
            <Card className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#FF8C42] border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading services...</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {homeServices.map((service) => {
                const Icon = service.icon;
                return (
                  <Card
                    key={service.id}
                    onClick={() => handleServiceSelect(service.id)}
                    className="p-4 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-[#FF8C42]"
                  >
                    <div className={`w-12 h-12 rounded-xl ${service.color} flex items-center justify-center mb-3`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{service.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">{service.desc}</p>
                    <p className="text-xs font-semibold text-[#FF8C42]">{service.price}</p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
