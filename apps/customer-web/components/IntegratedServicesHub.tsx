"use client";

import { useState, useEffect } from 'react';
import { Stethoscope, Scissors, GraduationCap, Heart, Home, ShoppingBag, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

const services = [
  { id: 'vet', name: 'Vet Services', icon: Stethoscope, color: 'bg-blue-100 text-blue-600' },
  { id: 'grooming', name: 'Grooming', icon: Scissors, color: 'bg-purple-100 text-purple-600' },
  { id: 'training', name: 'Training', icon: GraduationCap, color: 'bg-green-100 text-green-600' },
  { id: 'walking', name: 'Walking', icon: Heart, color: 'bg-pink-100 text-pink-600' },
  { id: 'boarding', name: 'Boarding', icon: Home, color: 'bg-amber-100 text-amber-600' },
  { id: 'shop', name: 'Shop', icon: ShoppingBag, color: 'bg-orange-100 text-orange-600' },
];

interface IntegratedServicesHubProps {
  onBack?: () => void;
  onNavigate?: (service: string) => void;
}

export function IntegratedServicesHub({ onBack, onNavigate }: IntegratedServicesHubProps = {}) {
  const [availableServices, setAvailableServices] = useState(services);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const response = await apiClient.get<any>('/services');
      if (response.services) {
        setAvailableServices(response.services);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  return (
    <div className="p-6">
      {onBack && (
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full" aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm font-medium text-gray-600">Back</span>
        </div>
      )}
      <h1 className="text-2xl font-bold mb-4">Integrated Services Hub</h1>
      <p className="text-gray-600 mb-6">Access all pet care services in one place</p>
      
      <div className="grid grid-cols-2 gap-4">
        {availableServices.map((service) => {
          const Icon = service.icon;
          const serviceKey = service.id === 'walking' ? 'walker' : service.id;
          const handleClick = () => onNavigate ? onNavigate(serviceKey) : undefined;
          return (
            <Card
              key={service.id}
              className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={handleClick}
              role={onNavigate ? 'button' : undefined}
            >
              <div className={`w-12 h-12 rounded-lg ${service.color} flex items-center justify-center mb-3`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900">{service.name}</h3>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

