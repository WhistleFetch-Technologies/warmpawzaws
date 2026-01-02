import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Siren, MapPin, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface AmbulanceSOSProps {
  phone: string;
  onBack: () => void;
}

export function AmbulanceSOS({ phone, onBack }: AmbulanceSOSProps) {
  const [step, setStep] = useState<'alert' | 'locating' | 'contact'>('alert');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<string>('Locating...');
  const [ambulances, setAmbulances] = useState<any[]>([]);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    if (step === 'locating') {
        // Simulate finding location and ambulances
        setTimeout(() => {
            setLocation('Indiranagar, Bangalore');
            findNearbyAmbulances();
        }, 2000);
    }
  }, [step]);

  const findNearbyAmbulances = async () => {
      try {
          const response = await fetch(`${API_BASE}/customer/services?roleId=pet_ambulance`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` }
          });
          if (response.ok) {
            const data = await response.json();
            // ✅ FIX: Handle standardized response format
            // Response format: { success: true, services: [...], total: ... }
            const servicesList = data.services || data.data?.services || [];
            setAmbulances(servicesList);
            setStep('contact');
          } else {
             const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
             console.error('Failed to load ambulances:', errorData);
             // Fallback mock only if no services found
             setAmbulances([]);
             setStep('contact');
          }
      } catch (e: any) {
          console.error('Error finding ambulances:', e);
          const errorMessage = e?.message || 'Network error. Please check your connection.';
          // Don't show error toast - just log and continue
          setAmbulances([]);
          setStep('contact');
      }
  };

  const handleEmergencyCall = (vendorPhone: string) => {
      window.open(`tel:${vendorPhone}`);
  };

  const handleRequestDispatch = async (vendorId: string) => {
      try {
          setLoading(true);
          const bookingPayload = {
            vendorId: vendorId,
            serviceId: 'emergency_dispatch', // Special ID
            customerPhone: phone,
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            notes: `EMERGENCY SOS REQUEST. Location: ${location}`,
            petDetails: { count: 1 },
            status: 'emergency', // Special status
            price: 0 // To be decided
          };
    
          const response = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify(bookingPayload)
          });
    
          if (response.ok) {
            toast.success('Emergency dispatch requested! Ambulance is on the way.');
            onBack();
          } else {
            toast.error('Failed to request dispatch');
          }
      } catch (error) {
          toast.error('Network error');
      } finally {
          setLoading(false);
      }
  };

  if (step === 'alert') {
    return (
      <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="mb-8">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Siren className="w-12 h-12 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Medical Emergency?</h1>
            <p className="text-gray-600 mt-2">Find the nearest pet ambulance immediately.</p>
        </div>

        <Button 
            className="w-full max-w-xs h-16 text-xl bg-red-600 hover:bg-red-700 text-white rounded-full shadow-xl shadow-red-200 animate-bounce"
            onClick={() => setStep('locating')}
        >
            TAP FOR HELP
        </Button>

        <button onClick={onBack} className="mt-8 text-gray-500 underline">Cancel</button>
      </div>
    );
  }

  if (step === 'locating') {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center">
             <div className="w-16 h-16 border-4 border-t-red-500 border-gray-700 rounded-full animate-spin mb-4"></div>
             <h2 className="text-xl font-bold">Locating nearest units...</h2>
             <p className="text-gray-400 mt-2 text-sm">Please enable GPS</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="bg-red-600 text-white p-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
                <button onClick={onBack}><ArrowLeft className="w-6 h-6" /></button>
                <h1 className="font-bold text-lg">Nearby Ambulances</h1>
            </div>
        </div>

        <div className="p-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-3">
                <MapPin className="w-5 h-5 text-red-500" />
                <div>
                    <p className="text-xs text-gray-500">Current Location</p>
                    <p className="font-semibold text-gray-900">{location}</p>
                </div>
            </div>

            <div className="space-y-3">
                {ambulances.map((amb, idx) => (
                    <Card key={idx} className="p-4 border-l-4 border-red-500">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-gray-900">{amb.vendorName || 'Emergency Unit'}</h3>
                                <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {amb.distance || '2km'}</span>
                                    <span className="flex items-center gap-1 font-bold text-green-600"><Clock className="w-3 h-3" /> {amb.eta || '10 mins'}</span>
                                </div>
                            </div>
                            <div className="bg-red-50 p-2 rounded-full">
                                <Siren className="w-6 h-6 text-red-600" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-4">
                             <Button 
                                variant="outline" 
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => handleEmergencyCall(amb.phone || '911')}
                             >
                                 <Phone className="w-4 h-4 mr-2" /> Call
                             </Button>
                             <Button 
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleRequestDispatch(amb.vendorId)}
                                disabled={loading}
                             >
                                 Request Now
                             </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    </div>
  );
}
