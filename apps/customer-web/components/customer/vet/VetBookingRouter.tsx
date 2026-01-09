"use client";

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VetBookingRouterProps {
  phone: string;
  doctorId?: string;
  doctor?: any;
  selectedService?: string;
  serviceType?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

export function VetBookingRouter({ phone, doctorId, doctor, selectedService, serviceType, onBack, onNavigate, onViewBooking }: VetBookingRouterProps) {
  // Placeholder component - to be implemented with full vet booking router
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Vet Booking Router</h1>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-600 text-center">
            Vet booking router coming soon
          </p>
        </div>
      </div>
    </div>
  );
}

