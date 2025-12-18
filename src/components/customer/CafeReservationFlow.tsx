import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, Users, Coffee, CheckCircle, Info, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { format, addDays } from 'date-fns';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
// Brand color: #FF8C42

interface CafeReservationFlowProps {
  phone: string;
  onBack: () => void;
  preSelectedVendorId?: string;
}

export function CafeReservationFlow({ phone, onBack, preSelectedVendorId }: CafeReservationFlowProps) {
  const [step, setStep] = useState<'select-cafe' | 'details' | 'confirm'>('select-cafe');
  const [loading, setLoading] = useState(false);
  const [cafes, setCafes] = useState<any[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<any>(null);
  const [tables, setTables] = useState<any[]>([]); // Tables are generic services
  const [selectedTable, setSelectedTable] = useState<any>(null);
  
  // Reservation Details
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>('19:00');
  const [guestCount, setGuestCount] = useState(2);
  const [petCount, setPetCount] = useState(1);
  const [specialRequest, setSpecialRequest] = useState('');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    if (preSelectedVendorId) {
      loadCafeDetails(preSelectedVendorId);
    } else {
      loadCafes();
    }
  }, [preSelectedVendorId]);

  const loadCafes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/customer/services?roleId=pet_cafe`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Extract unique vendors
        const uniqueVendors = new Map();
        (data.services || []).forEach((s: any) => {
          if (!uniqueVendors.has(s.vendorId)) {
            uniqueVendors.set(s.vendorId, {
              id: s.vendorId,
              name: s.vendorName,
              address: s.vendorLocation?.address || 'Location unavailable',
              rating: 4.5, // Mock
              image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000' // Mock
            });
          }
        });
        setCafes(Array.from(uniqueVendors.values()));
      }
    } catch (error) {
      console.error('Error loading cafes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCafeDetails = async (vendorId: string) => {
    try {
      setLoading(true);
      // First fetch generic services which act as "Tables" or "Packages"
      const response = await fetch(`${API_BASE}/customer/services?vendorId=${vendorId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTables(data.services || []);
        
        // Set basic cafe info if not already set
        if (!selectedCafe && data.services && data.services.length > 0) {
             const first = data.services[0];
             setSelectedCafe({
                id: first.vendorId,
                name: first.vendorName,
                address: first.vendorLocation?.address || 'Cafe Location',
                rating: 4.5,
                image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=1000'
             });
        }
        setStep('details');
      }
    } catch (error) {
      console.error('Error loading cafe details:', error);
      toast.error('Failed to load cafe details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReservation = async () => {
    if (!selectedCafe || !selectedTable) return;

    try {
      setLoading(true);
      
      // Construct booking payload
      const bookingPayload = {
        vendorId: selectedCafe.id,
        serviceId: selectedTable.id, // Using the generic service ID as table ID
        customerPhone: phone,
        date: date,
        time: time,
        notes: `Cafe Reservation: ${guestCount} Pax, ${petCount} Pets. Note: ${specialRequest}`,
        petDetails: { count: petCount },
        status: 'pending', // Cafe needs to confirm
        price: selectedTable.price || 0 // Reservation fee or package price
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
        toast.success('Table reservation requested!');
        onBack(); // Or navigate to success screen
      } else {
        const error = await response.json();
        toast.error(error.error || 'Reservation failed');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      toast.error('Failed to create reservation');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Select Cafe
  if (step === 'select-cafe') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <h1 className="text-lg font-semibold">Select Pet Cafe</h1>
        </div>
        <div className="p-4 space-y-4">
          {loading ? <div className="text-center py-10">Loading cafes...</div> : 
           cafes.length === 0 ? <div className="text-center py-10 text-gray-500">No pet cafes found.</div> :
           cafes.map(cafe => (
            <Card key={cafe.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => { setSelectedCafe(cafe); loadCafeDetails(cafe.id); }}>
              <div className="h-32 bg-gray-200 relative">
                <img src={cafe.image} alt={cafe.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                    <span className="text-yellow-500 mr-1">★</span> {cafe.rating}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900">{cafe.name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" /> {cafe.address}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Reservation Details
  if (step === 'details') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => preSelectedVendorId ? onBack() : setStep('select-cafe')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{selectedCafe?.name}</h1>
            <p className="text-xs text-gray-500">Table Reservation</p>
          </div>
        </div>

        <div className="p-4 flex-1 space-y-6 overflow-y-auto">
            {/* Select Table Type */}
            <div>
                <h3 className="font-semibold mb-3 text-sm text-gray-700">Select Table / Package</h3>
                <div className="space-y-3">
                    {tables.length === 0 ? <p className="text-sm text-gray-500">No table packages available.</p> :
                     tables.map(table => (
                        <div 
                            key={table.id} 
                            onClick={() => setSelectedTable(table)}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedTable?.id === table.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}
                        >
                            <div className="flex justify-between">
                                <span className="font-bold text-gray-900">{table.name}</span>
                                <span className="text-orange-600 font-bold">₹{table.price}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{table.description}</p>
                        </div>
                     ))
                    }
                </div>
            </div>

            {/* Date & Time */}
            <Card className="p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-orange-600" /> Date & Time</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="text-xs">Date</Label>
                        <Input 
                            type="date" 
                            value={date}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            onChange={(e) => setDate(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <Label className="text-xs">Time</Label>
                        <Input 
                            type="time" 
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                </div>
            </Card>

            {/* Guests */}
            <Card className="p-4 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-orange-600" /> Guests & Pets</h3>
                
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <span className="text-sm text-gray-700">People (Pax)</span>
                    <div className="flex items-center gap-3">
                        <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" onClick={() => setGuestCount(Math.max(1, guestCount - 1))}>-</button>
                        <span className="font-medium w-4 text-center">{guestCount}</span>
                        <button className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center" onClick={() => setGuestCount(guestCount + 1)}>+</button>
                    </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-gray-700">Pets</span>
                    <div className="flex items-center gap-3">
                        <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" onClick={() => setPetCount(Math.max(1, petCount - 1))}>-</button>
                        <span className="font-medium w-4 text-center">{petCount}</span>
                        <button className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center" onClick={() => setPetCount(petCount + 1)}>+</button>
                    </div>
                </div>
            </Card>

            {/* Special Request */}
            <div className="space-y-2">
                <Label className="text-sm">Special Requests (Optional)</Label>
                <Input 
                    placeholder="e.g., High chair needed, Pet birthday..."
                    value={specialRequest}
                    onChange={(e) => setSpecialRequest(e.target.value)}
                />
            </div>
        </div>

        <div className="bg-white p-4 border-t shadow-lg">
            <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg"
                disabled={!selectedTable || !date || !time}
                onClick={() => setStep('confirm')}
            >
                Review Reservation
            </Button>
        </div>
      </div>
    );
  }

  // Step 3: Confirm
  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
            <button onClick={() => setStep('details')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
            <h1 className="text-lg font-semibold">Confirm Reservation</h1>
        </div>

        <div className="p-4 flex-1 space-y-4">
            <Card className="p-4">
                <div className="flex gap-4 mb-4">
                     <img src={selectedCafe?.image} className="w-20 h-20 object-cover rounded-lg" />
                     <div>
                         <h3 className="font-bold">{selectedCafe?.name}</h3>
                         <p className="text-sm text-gray-500">{selectedTable?.name}</p>
                         <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                             <Coffee className="w-3 h-3" /> Table for {guestCount}
                         </div>
                     </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                    <div>
                        <p className="text-xs text-gray-500">Date</p>
                        <p className="font-medium text-sm">{format(new Date(date), 'EEE, dd MMM')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-500">Time</p>
                        <p className="font-medium text-sm">{time}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Guests</p>
                        <p className="font-medium text-sm">{guestCount} Adults, {petCount} Pets</p>
                    </div>
                </div>
                
                {specialRequest && (
                    <div className="mt-3 bg-gray-50 p-2 rounded text-xs text-gray-600 italic">
                        Note: {specialRequest}
                    </div>
                )}
            </Card>

            <Card className="p-4">
                <h3 className="font-semibold mb-3">Payment Details</h3>
                <div className="flex justify-between text-gray-600 text-sm">
                    <span>Reservation Fee / Package</span>
                    <span>₹{selectedTable?.price}</span>
                </div>
                <div className="border-t border-gray-200 my-2 pt-2 flex justify-between font-bold text-lg">
                    <span>Total Pay</span>
                    <span>₹{selectedTable?.price}</span>
                </div>
            </Card>
            
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs text-blue-800 flex gap-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <p>The cafe will confirm your table shortly after booking. Cancellation fee applies if cancelled within 2 hours.</p>
            </div>
        </div>

        <div className="bg-white p-4 border-t shadow-lg">
            <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg"
                onClick={handleCreateReservation}
                disabled={loading}
            >
                {loading ? 'Processing...' : `Confirm & Pay ₹${selectedTable?.price}`}
            </Button>
        </div>
      </div>
    );
  }

  return null;
}
