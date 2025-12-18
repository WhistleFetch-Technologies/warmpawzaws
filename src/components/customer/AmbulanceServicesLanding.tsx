import { useState } from 'react';
import { ArrowLeft, Siren, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface AmbulanceServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  phone?: string;
}

export function AmbulanceServicesLanding({ onBack, onNavigate, phone }: AmbulanceServicesLandingProps) {
  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50">
      <div className="bg-[#FF8C42] red-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#FF8C42] white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Ambulance</h1>
            <p className="text-white/90 text-sm">Emergency & Transport Services</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-24">
        {/* SOS Button */}
        <Card className="bg-[#FF8C42] red-50 border-red-200 p-6 text-center">
             <div className="w-16 h-16 bg-[#FF8C42] red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Siren className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Medical Emergency?</h2>
            <p className="text-gray-700 mb-6">Get immediate help from nearby pet ambulances.</p>
            <Button 
                className="w-full bg-red-600 hover:bg-[#FF8C42] red-700 text-white h-12 text-lg font-bold shadow-lg shadow-red-200"
                onClick={() => onNavigate('ambulance_sos')}
            >
                EMERGENCY SOS
            </Button>
        </Card>

        <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center hover:bg-[#FF8C42] red-50 cursor-pointer">
                <div className="text-3xl mb-2">📅</div>
                <h3 className="font-bold text-gray-900">Schedule Ride</h3>
                <p className="text-xs text-gray-500">For vet visits</p>
            </Card>
            <Card className="p-4 text-center hover:bg-[#FF8C42] red-50 cursor-pointer">
                <div className="text-3xl mb-2">🏥</div>
                <h3 className="font-bold text-gray-900">Inter-Hospital</h3>
                <p className="text-xs text-gray-500">Transfer patient</p>
            </Card>
        </div>
      </div>
    </div>
  );
}
