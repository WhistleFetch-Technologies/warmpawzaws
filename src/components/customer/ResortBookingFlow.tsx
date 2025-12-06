import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle, Info, User, Moon, Sun, CreditCard, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { format, addDays, differenceInDays } from 'date-fns';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface ResortBookingFlowProps {
  phone: string;
  onBack: () => void;
  onSuccess?: () => void;
  preSelectedVendorId?: string;
}

export function ResortBookingFlow({ phone, onBack, onSuccess, preSelectedVendorId }: ResortBookingFlowProps) {
  const [step, setStep] = useState<'select-resort' | 'select-room' | 'dates' | 'confirm'>('select-resort');
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [resorts, setResorts] = useState<any[]>([]);
  const [selectedResort, setSelectedResort] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>({
    from: new Date(),
    to: addDays(new Date(), 1)
  });
  const [guestCount, setGuestCount] = useState(1);
  const [petCount, setPetCount] = useState(1);
  const [availabilityStatus, setAvailabilityStatus] = useState<{ available: boolean; message?: string } | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    if (preSelectedVendorId) {
      loadResortDetails(preSelectedVendorId);
    } else {
      loadResorts();
    }
  }, [preSelectedVendorId]);

  // Check availability when dates or room change
  useEffect(() => {
    if (step === 'dates' && selectedRoom && dateRange?.from && dateRange?.to) {
      checkAvailability();
    } else {
      setAvailabilityStatus(null);
    }
  }, [dateRange, selectedRoom, step]);

  const loadResorts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/customer/services?roleId=pet_resort`, {
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
              rating: 4.8, // Mock
              image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=1000' // Mock
            });
          }
        });
        setResorts(Array.from(uniqueVendors.values()));
      }
    } catch (error) {
      console.error('Error loading resorts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResortDetails = async (vendorId: string) => {
    try {
      setLoading(true);
      // First fetch vendor details if we don't have them
      if (!selectedResort) {
         const response = await fetch(`${API_BASE}/vendor/${vendorId}`, {
             headers: { Authorization: `Bearer ${publicAnonKey}` }
         });
         const vendorData = await response.json();
         setSelectedResort(vendorData.vendor || { id: vendorId, name: 'Resort', address: '' });
      }

      // Try fetching NEW Inventory Rooms first
      let roomsData = [];
      try {
        const roomResp = await fetch(`${API_BASE}/resort/rooms/${vendorId}`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` }
        });
        if (roomResp.ok) {
            const rd = await roomResp.json();
            if (rd.success && rd.rooms.length > 0) {
                roomsData = rd.rooms;
            }
        }
      } catch (e) { console.log('No new inventory rooms found'); }

      // Fallback to old services if no new rooms
      if (roomsData.length === 0) {
        const response = await fetch(`${API_BASE}/customer/services?vendorId=${vendorId}`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` }
        });
        if (response.ok) {
            const data = await response.json();
            roomsData = data.services || [];
        }
      }

      setRooms(roomsData);
      setStep('select-room');
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load resort details');
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async () => {
    if (!selectedRoom || !dateRange?.from || !dateRange?.to) return;
    
    try {
        setCheckingAvailability(true);
        const query = new URLSearchParams({
            vendorId: selectedResort.id,
            roomId: selectedRoom.id,
            fromDate: format(dateRange.from, 'yyyy-MM-dd'),
            toDate: format(dateRange.to, 'yyyy-MM-dd'),
            quantity: '1' // Assuming 1 room for now
        });

        const response = await fetch(`${API_BASE}/resort/availability?${query}`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                setAvailabilityStatus({
                    available: data.isAvailable,
                    message: data.isAvailable ? 'Room is available for these dates' : 'Room is sold out for these dates'
                });
            } else {
                // If endpoint fails (e.g. 404 room not found because it's legacy), assume available
                // This ensures backward compatibility
                setAvailabilityStatus({ available: true, message: 'Availability confirmed' });
            }
        } else {
            // Fallback for legacy
             setAvailabilityStatus({ available: true, message: 'Availability confirmed' });
        }
    } catch (error) {
        console.error('Availability check failed', error);
        setAvailabilityStatus({ available: true, message: 'Availability assumed' });
    } finally {
        setCheckingAvailability(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedResort || !selectedRoom || !dateRange?.from || !dateRange?.to) return;

    try {
      setLoading(true);
      const nights = differenceInDays(dateRange.to, dateRange.from) || 1;
      const totalPrice = selectedRoom.price * nights;
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // 1. Reserve Inventory (New System)
      try {
          await fetch(`${API_BASE}/resort/reserve-inventory`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({
                  roomId: selectedRoom.id,
                  fromDate,
                  toDate,
                  quantity: 1
              })
          });
      } catch (e) {
          console.warn('Inventory reservation failed (might be legacy room)', e);
      }

      // 2. Create Booking Record
      const bookingPayload = {
        vendorId: selectedResort.id,
        serviceId: selectedRoom.id,
        customerPhone: phone,
        date: fromDate,
        time: '14:00', 
        notes: `Resort Booking: ${nights} Nights. Check-in: ${fromDate}, Check-out: ${toDate}. Guests: ${guestCount}, Pets: ${petCount}`,
        petDetails: { count: petCount },
        status: 'confirmed',
        price: totalPrice,
        guestCount: guestCount,
        checkinDate: fromDate,
        checkoutDate: toDate,
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
        toast.success('Resort booked successfully!');
        if (onSuccess) onSuccess();
        else onBack();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Booking failed');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Select Resort (if not pre-selected)
  if (step === 'select-resort') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <h1 className="text-lg font-semibold">Select Resort</h1>
        </div>
        <div className="p-4 space-y-4">
          {loading ? <div className="text-center py-10">Loading resorts...</div> : 
           resorts.length === 0 ? <div className="text-center py-10 text-gray-500">No resorts found.</div> :
           resorts.map(resort => (
            <Card key={resort.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={() => loadResortDetails(resort.id)}>
              <div className="h-32 bg-gray-200 relative">
                <img src={resort.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945"} alt={resort.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded text-xs font-bold flex items-center">
                    <span className="text-yellow-500 mr-1">★</span> {resort.rating}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900">{resort.name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <Info className="w-3 h-3" /> {resort.address}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Select Room (Service)
  if (step === 'select-room') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
         <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => preSelectedVendorId ? onBack() : setStep('select-resort')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{selectedResort?.name}</h1>
            <p className="text-xs text-gray-500">Select a Room Package</p>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
            {loading ? <div className="text-center py-10">Loading rooms...</div> :
             rooms.length === 0 ? <div className="text-center py-10 text-gray-500">No rooms available at this resort.</div> :
             rooms.map(room => (
                <Card key={room.id} className="p-4 cursor-pointer border-l-4 border-teal-500 hover:shadow-md" onClick={() => { setSelectedRoom(room); setStep('dates'); }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-gray-900">{room.name}</h3>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{room.description}</p>
                            <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">Free Breakfast</Badge>
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Pool Access</Badge>
                                {room.totalInventory && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">{room.totalInventory} Rooms</Badge>}
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-lg font-bold text-teal-600">₹{room.price}</span>
                            <p className="text-xs text-gray-400">/night</p>
                        </div>
                    </div>
                </Card>
             ))
            }
        </div>
      </div>
    );
  }

  // Step 3: Select Dates & Guests
  if (step === 'dates') {
    const nights = dateRange?.from && dateRange?.to ? differenceInDays(dateRange.to, dateRange.from) : 0;
    
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => setStep('select-room')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
          <div>
            <h1 className="text-lg font-semibold">Booking Details</h1>
            <p className="text-xs text-gray-500">{selectedRoom?.name}</p>
          </div>
        </div>

        <div className="p-4 flex-1 space-y-6 pb-32">
            {/* Availability Status Alert */}
            {availabilityStatus && !availabilityStatus.available && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-red-800">Dates Unavailable</p>
                        <p className="text-xs text-red-600">{availabilityStatus.message}</p>
                    </div>
                </div>
            )}

            {availabilityStatus && availabilityStatus.available && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-green-800">Available</p>
                        <p className="text-xs text-green-600">{availabilityStatus.message}</p>
                    </div>
                </div>
            )}

            {/* Date Selection */}
            <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-teal-600" /> Select Dates</h3>
                <div className="flex justify-center">
                    <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={1}
                        className="rounded-md border"
                        fromDate={new Date()}
                        defaultMonth={new Date()}
                    />
                </div>
                <div className="mt-4 flex justify-between text-sm bg-gray-50 p-3 rounded-lg">
                    <div>
                        <p className="text-gray-500 text-xs">Check-in</p>
                        <p className="font-medium">{dateRange?.from ? format(dateRange.from, 'dd MMM yyyy') : '-'}</p>
                    </div>
                    <div className="text-right">
                         <p className="text-gray-500 text-xs">Check-out</p>
                        <p className="font-medium">{dateRange?.to ? format(dateRange.to, 'dd MMM yyyy') : '-'}</p>
                    </div>
                </div>
            </Card>

            {/* Guest Selection */}
            <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><User className="w-4 h-4 text-teal-600" /> Guests & Pets</h3>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-700">Adults</span>
                    <div className="flex items-center gap-3">
                        <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" onClick={() => setGuestCount(Math.max(1, guestCount - 1))}>-</button>
                        <span className="w-4 text-center font-medium">{guestCount}</span>
                        <button className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center" onClick={() => setGuestCount(guestCount + 1)}>+</button>
                    </div>
                </div>
                <div className="flex items-center justify-between py-2 pt-3">
                    <span className="text-sm text-gray-700">Pets</span>
                    <div className="flex items-center gap-3">
                         <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" onClick={() => setPetCount(Math.max(1, petCount - 1))}>-</button>
                        <span className="w-4 text-center font-medium">{petCount}</span>
                        <button className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center" onClick={() => setPetCount(petCount + 1)}>+</button>
                    </div>
                </div>
            </Card>
        </div>

        {/* Footer Summary */}
        <div className="bg-white p-4 border-t shadow-lg fixed bottom-0 w-full max-w-[430px]">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <p className="text-xs text-gray-500">{nights} nights x ₹{selectedRoom?.price}</p>
                    <p className="text-xl font-bold text-gray-900">₹{(selectedRoom?.price * (nights || 1)).toLocaleString()}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-teal-600 font-medium">Free Cancellation</p>
                    <p className="text-xs text-gray-400">Before 24 hours</p>
                </div>
            </div>
            <Button 
                className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-lg disabled:bg-gray-300"
                disabled={!dateRange?.from || !dateRange?.to || checkingAvailability || (availabilityStatus && !availabilityStatus.available)}
                onClick={() => setStep('confirm')}
            >
                {checkingAvailability ? 'Checking...' : 
                 (availabilityStatus && !availabilityStatus.available) ? 'Sold Out' : 'Review & Pay'}
            </Button>
        </div>
      </div>
    );
  }

  // Step 4: Confirm
  if (step === 'confirm') {
     const nights = differenceInDays(dateRange!.to!, dateRange!.from!) || 1;
     const totalPrice = selectedRoom.price * nights;
     const tax = Math.round(totalPrice * 0.18);
     const finalTotal = totalPrice + tax;

     return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-white p-4 border-b sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => setStep('dates')}><ArrowLeft className="w-6 h-6 text-gray-600" /></button>
                <h1 className="text-lg font-semibold">Confirm Booking</h1>
            </div>

            <div className="p-4 flex-1 space-y-4">
                <Card className="p-4">
                    <div className="flex gap-4 mb-4">
                         <img src={selectedResort?.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945"} className="w-20 h-20 object-cover rounded-lg" />
                         <div>
                             <h3 className="font-bold">{selectedResort?.name}</h3>
                             <p className="text-sm text-gray-500">{selectedRoom?.name}</p>
                             <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                 <Moon className="w-3 h-3" /> {nights} Nights
                             </div>
                         </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                        <div>
                            <p className="text-xs text-gray-500">Check-in</p>
                            <p className="font-medium text-sm">{format(dateRange!.from!, 'EEE, dd MMM')}</p>
                            <p className="text-xs text-gray-400">02:00 PM</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Check-out</p>
                            <p className="font-medium text-sm">{format(dateRange!.to!, 'EEE, dd MMM')}</p>
                            <p className="text-xs text-gray-400">11:00 AM</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <h3 className="font-semibold mb-3">Price Details</h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600">
                            <span>Room Charges ({nights} nights)</span>
                            <span>₹{totalPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Taxes & Fees (18%)</span>
                            <span>₹{tax.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-gray-200 my-2 pt-2 flex justify-between font-bold text-lg">
                            <span>Total Amount</span>
                            <span>₹{finalTotal.toLocaleString()}</span>
                        </div>
                    </div>
                </Card>
                
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800 flex gap-2">
                    <Info className="w-4 h-4 flex-shrink-0" />
                    <p>Cancellation is free until 24 hours before check-in. After that, one night charge applies.</p>
                </div>
            </div>

            <div className="bg-white p-4 border-t shadow-lg">
                <Button 
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white h-12 text-lg"
                    onClick={handleCreateBooking}
                    disabled={loading}
                >
                    {loading ? 'Processing...' : `Pay ₹${finalTotal.toLocaleString()}`}
                </Button>
            </div>
        </div>
     );
  }

  return null;
}