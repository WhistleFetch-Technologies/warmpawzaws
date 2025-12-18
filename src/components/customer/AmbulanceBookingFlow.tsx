import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { MapPin, Clock, Star, Phone, Shield, AlertCircle, FileText, CheckCircle, Truck, Navigation, Activity } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api'; // Assuming standard package or similar mock

// Mock Google Maps wrapper if not installed, effectively a placeholder for the visual
const MapPlaceholder = () => (
    <div className="w-full h-full bg-[#FF8C42] gray-100 flex items-center justify-center relative overflow-hidden rounded-xl">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="z-10 flex flex-col items-center text-gray-400">
            <Navigation className="w-8 h-8 mb-2" />
            <span className="text-xs font-medium">Live Tracking Map</span>
        </div>
        {/* Mock pulsing dot for ambulance */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#FF8C42] red-500 rounded-full animate-ping"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#FF8C42] red-600 rounded-full border-2 border-white shadow-lg"></div>
    </div>
);

interface AmbulanceBookingProps {
  phone: string;
  customerId: string;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function AmbulanceBookingFlow({ phone, customerId, onBack, onSuccess }: AmbulanceBookingProps) {
  const [step, setStep] = useState<'type' | 'location' | 'confirm' | 'tracking'>('type');
  const [loading, setLoading] = useState(false);
  const [ambulanceType, setAmbulanceType] = useState<'basic' | 'icu' | 'oxygen'>('basic');
  const [pickupLocation, setPickupLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [eta, setEta] = useState<string>('15 mins');
  const [assignedDriver, setAssignedDriver] = useState<any>(null);

  // Mock getting current location on mount
  useEffect(() => {
      // Simulate geolocation
      setPickupLocation({
          lat: 28.6139, 
          lng: 77.2090, 
          address: "Current Location (Detected)" 
      });
  }, []);

  const handleBooking = async () => {
      try {
          setLoading(true);
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/integrated-services/ambulance/book`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({
                  customerId,
                  phone,
                  type: ambulanceType,
                  location: pickupLocation,
                  priority: 'emergency' // Default to emergency for ambulance
              })
          });

          if (response.ok) {
              const data = await response.json();
              setBookingId(data.bookingId);
              setAssignedDriver(data.driver); // Mocked driver info
              setEta(data.eta || '12 mins');
              setStep('tracking');
              toast.success("Ambulance dispatched!");
          } else {
              throw new Error("Booking failed");
          }
      } catch (e) {
          console.error(e);
          toast.error("Failed to book ambulance. Please call emergency line.");
      } finally {
          setLoading(false);
      }
  };

  const RenderTypeSelection = () => (
      <div className="space-y-4">
          <div className="bg-[#FF8C42] red-50 border border-red-100 p-4 rounded-lg flex gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                  <h3 className="font-bold text-red-700">Emergency Service</h3>
                  <p className="text-sm text-red-600">For critical situations, please ensure your location is accurate. Call 112 if immediate human medical attention is also needed.</p>
              </div>
          </div>

          <h3 className="font-semibold text-gray-900 mt-4">Select Ambulance Type</h3>
          
          <div 
            onClick={() => setAmbulanceType('basic')}
            className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-start gap-4 ${ambulanceType === 'basic' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-200'}`}
          >
              <div className="w-12 h-12 bg-[#FF8C42] white rounded-full flex items-center justify-center border shadow-sm text-2xl">🚑</div>
              <div className="flex-1">
                  <div className="flex justify-between">
                      <h4 className="font-bold text-gray-900">Basic Life Support</h4>
                      <span className="font-bold text-gray-900">₹1,500</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Non-critical transport. First aid kit, stretcher, and pet restraint system.</p>
              </div>
          </div>

          <div 
            onClick={() => setAmbulanceType('oxygen')}
            className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-start gap-4 ${ambulanceType === 'oxygen' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-200'}`}
          >
              <div className="w-12 h-12 bg-[#FF8C42] white rounded-full flex items-center justify-center border shadow-sm text-2xl">🌬️</div>
              <div className="flex-1">
                  <div className="flex justify-between">
                      <h4 className="font-bold text-gray-900">Oxygen Support</h4>
                      <span className="font-bold text-gray-900">₹2,500</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">For breathing difficulties. Includes O2 cylinder and technician.</p>
              </div>
          </div>

          <div 
            onClick={() => setAmbulanceType('icu')}
            className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-start gap-4 ${ambulanceType === 'icu' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-200'}`}
          >
              <div className="w-12 h-12 bg-[#FF8C42] white rounded-full flex items-center justify-center border shadow-sm text-2xl">🏥</div>
              <div className="flex-1">
                  <div className="flex justify-between">
                      <h4 className="font-bold text-gray-900">ICU / Advanced</h4>
                      <span className="font-bold text-gray-900">₹4,000</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Critical care. Ventilator, cardiac monitor, and vet on board.</p>
              </div>
          </div>

          <Button className="w-full bg-red-600 hover:bg-[#FF8C42] red-700 text-white h-12 mt-4" onClick={() => setStep('location')}>
              Next: Confirm Location
          </Button>
      </div>
  );

  const RenderTracking = () => (
      <div className="h-full flex flex-col">
          {/* Map Area */}
          <div className="flex-1 bg-[#FF8C42] gray-100 relative min-h-[300px] rounded-xl overflow-hidden mb-4">
              <MapPlaceholder />
              <div className="absolute bottom-4 left-4 right-4 bg-[#FF8C42] white p-4 rounded-xl shadow-lg">
                  <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-gray-900">Arriving in {eta}</h4>
                      <Badge className="bg-green-100 text-green-700 hover:bg-[#FF8C42] green-100">On the way</Badge>
                  </div>
                  <div className="w-full bg-[#FF8C42] gray-200 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FF8C42] green-500 h-full w-2/3 animate-pulse"></div>
                  </div>
              </div>
          </div>

          {/* Driver Info */}
          <Card className="p-4 mb-4">
              <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#FF8C42] gray-200 rounded-full flex items-center justify-center">
                      <Shield className="w-6 h-6 text-gray-500" />
                  </div>
                  <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{assignedDriver?.name || "Ramesh Kumar"}</h4>
                      <p className="text-sm text-gray-500">{assignedDriver?.vehicle || "Force Traveller • MH 12 AB 1234"}</p>
                  </div>
                  <a href={`tel:${assignedDriver?.phone || "100"}`} className="w-10 h-10 bg-[#FF8C42] green-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                  </a>
              </div>
          </Card>

          <Button variant="outline" className="w-full border-red-200 text-red-600 hover:bg-[#FF8C42] red-50" onClick={onBack}>
              Return to Home
          </Button>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#FF8C42] white flex flex-col">
      <div className="p-4 border-b sticky top-0 bg-[#FF8C42] white z-10 flex items-center gap-3">
        <button onClick={onBack}><Truck className="w-6 h-6 text-gray-600" /></button>
        <h1 className="text-lg font-bold text-gray-900">Book Ambulance</h1>
      </div>

      <div className="p-4 flex-1">
          {step === 'type' && <RenderTypeSelection />}
          
          {step === 'location' && (
              <div className="space-y-6">
                  <div className="h-64 rounded-xl overflow-hidden border-2 border-gray-200">
                      <MapPlaceholder />
                  </div>
                  <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Pickup Address</label>
                      <div className="flex gap-2">
                          <MapPin className="w-5 h-5 text-red-600 mt-2 flex-shrink-0" />
                          <textarea 
                            className="w-full p-3 border rounded-lg resize-none focus:ring-red-500" 
                            rows={3} 
                            defaultValue={pickupLocation?.address}
                          />
                      </div>
                  </div>
                  <Button 
                    className="w-full bg-red-600 hover:bg-[#FF8C42] red-700 text-white h-12" 
                    onClick={handleBooking}
                    disabled={loading}
                  >
                      {loading ? 'Dispatching...' : 'Confirm Booking'}
                  </Button>
              </div>
          )}

          {step === 'tracking' && <RenderTracking />}
      </div>
    </div>
  );
}
