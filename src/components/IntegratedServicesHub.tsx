import React, { useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Ambulance, 
  Pill, 
  Activity, 
  ChevronRight, 
  Phone, 
  Clock, 
  MapPin, 
  Stethoscope,
  ShoppingBag
} from 'lucide-react';
import { AmbulanceBookingFlow } from './customer/AmbulanceBookingFlow';
import { MedicineDeliveryOrdering } from './customer/MedicineDeliveryOrdering';
import { DiagnosticsBooking } from './customer/DiagnosticsBooking';

interface IntegratedServicesHubProps {
  onNavigate?: (route: string) => void;
  customerId: string;
  petId: string;
}

export function IntegratedServicesHub({ onNavigate, customerId, petId }: IntegratedServicesHubProps) {
  const [activeService, setActiveService] = useState<'ambulance' | 'medicine' | 'diagnostics' | null>(null);

  if (activeService === 'ambulance') {
    return <AmbulanceBookingFlow 
        customerId={customerId}
        phone={customerId}
        onBack={() => setActiveService(null)} 
        onSuccess={() => setActiveService(null)} 
    />;
  }

  if (activeService === 'medicine') {
    return <MedicineDeliveryOrdering 
        customerId={customerId}
        onBack={() => setActiveService(null)} 
        onSuccess={() => setActiveService(null)} 
    />;
  }

  if (activeService === 'diagnostics') {
    return <DiagnosticsBooking 
        customerId={customerId}
        petId={petId}
        onBack={() => setActiveService(null)} 
        onSuccess={() => setActiveService(null)} 
    />;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Healthcare Services</h2>
      </div>

      {/* Emergency Ambulance Card */}
      <Card 
        className="overflow-hidden border-l-4 border-l-red-500 shadow-md cursor-pointer group"
        onClick={() => setActiveService('ambulance')}
      >
        <div className="bg-gradient-to-r from-red-50 to-white p-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Ambulance className="w-6 h-6 text-red-600 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900">Emergency Ambulance</h3>
                <p className="text-sm text-gray-600 mt-1">24/7 Rapid Response • GPS Tracking</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">
                    <Clock className="w-3 h-3 mr-1" /> Arrives in ~15 mins
                  </Badge>
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Pharmacy Card */}
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-all border-l-4 border-l-teal-500"
          onClick={() => setActiveService('medicine')}
        >
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mb-3">
            <ShoppingBag className="w-5 h-5 text-teal-600" />
          </div>
          <h3 className="font-bold text-gray-900">Pharmacy</h3>
          <p className="text-xs text-gray-500 mt-1 mb-2">Order medicines & essentials</p>
          <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200">
            <Clock className="w-3 h-3 mr-1" /> 60 min delivery
          </Badge>
        </Card>

        {/* Diagnostics Card */}
        <Card 
          className="p-4 cursor-pointer hover:shadow-md transition-all border-l-4 border-l-blue-500"
          onClick={() => setActiveService('diagnostics')}
        >
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-gray-900">Diagnostics</h3>
          <p className="text-xs text-gray-500 mt-1 mb-2">Home collection available</p>
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
            <Home className="w-3 h-3 mr-1" /> Home Sample
          </Badge>
        </Card>
      </div>

      {/* Independent Vendors Section */}
      <div className="mt-6">
        <h3 className="font-semibold text-gray-900 mb-3">Nearby Independent Services</h3>
        <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-white border rounded-xl">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Stethoscope className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-sm">City Vet Lab</h4>
                    <p className="text-xs text-gray-500">Diagnostics • 2.5 km</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveService('diagnostics')}>Book</Button>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white border rounded-xl">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Pill className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-sm">PetCare Pharmacy</h4>
                    <p className="text-xs text-gray-500">Medicine • 1.2 km</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setActiveService('medicine')}>Order</Button>
            </div>
        </div>
      </div>
    </div>
  );
}
