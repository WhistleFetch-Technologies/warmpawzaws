import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Calendar, Clock, Users, ChevronRight, AlertCircle, Coffee, ArrowLeft, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface PetCafeTableBookingProps {
  vendorId: string;
  vendorName?: string;
  onBack: () => void;
  onBookingComplete: (bookingId: string) => void;
}

export function PetCafeTableBooking({ vendorId, vendorName, onBack, onBookingComplete }: PetCafeTableBookingProps) {
  const [step, setStep] = useState<'date' | 'table' | 'confirm'>('date');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [guests, setGuests] = useState(2);
  const [pets, setPets] = useState(1);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cafeConfig, setCafeConfig] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCafeConfig();
  }, [vendorId]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      loadAvailableTables();
    }
  }, [selectedDate, selectedTime, vendorId]);

  const loadCafeConfig = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/cafe-config`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setCafeConfig(data.config);
      }
    } catch (error) {
      console.error('Error loading cafe config:', error);
    }
  };

  const loadAvailableTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/cafe-available-tables?date=${selectedDate}&time=${selectedTime}&guests=${guests}&pets=${pets}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAvailableTables(data.tables || []);
      }
    } catch (error) {
      console.error('Error loading tables:', error);
      toast.error('Failed to load available tables');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedTable) return;

    try {
      setLoading(true);
      
      // 1. Validate Slot first
      const validateRes = await fetch(
        `${API_BASE}/bookings/validate-slot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            vendorId,
            date: selectedDate,
            time: selectedTime,
            serviceType: 'pet_cafe',
            tableId: selectedTable.id
          })
        }
      );

      const validation = await validateRes.json();
      if (!validation.valid) {
        toast.error(validation.message || 'Slot no longer available');
        setLoading(false);
        return;
      }

      // 2. Create Booking
      const bookingRes = await fetch(
        `${API_BASE}/bookings/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            vendorId,
            serviceType: 'pet_cafe',
            scheduledDate: selectedDate,
            scheduledTime: selectedTime,
            metadata: {
              tableId: selectedTable.id,
              tableName: selectedTable.name,
              guests,
              pets
            }
          })
        }
      );

      const bookingData = await bookingRes.json();
      
      if (bookingRes.ok && bookingData.success) {
        toast.success('Table booked successfully!');
        onBookingComplete(bookingData.booking.id);
      } else {
        throw new Error(bookingData.error || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Failed to book table');
    } finally {
      setLoading(false);
    }
  };

  // Generate time slots (e.g., every 30 mins)
  const timeSlots = [];
  for (let i = 10; i < 22; i++) {
    timeSlots.push(`${i}:00`);
    timeSlots.push(`${i}:30`);
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="bg-white px-6 pt-8 pb-4 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold flex-1">{vendorName || 'Reserve Table'}</h1>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between px-4">
          <div className={`flex flex-col items-center ${step === 'date' ? 'text-amber-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${step === 'date' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100'}`}>1</div>
            <span className="text-xs">Date & Time</span>
          </div>
          <div className="h-[1px] bg-gray-200 flex-1 mx-2" />
          <div className={`flex flex-col items-center ${step === 'table' ? 'text-amber-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${step === 'table' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100'}`}>2</div>
            <span className="text-xs">Select Table</span>
          </div>
          <div className="h-[1px] bg-gray-200 flex-1 mx-2" />
          <div className={`flex flex-col items-center ${step === 'confirm' ? 'text-amber-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${step === 'confirm' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100'}`}>3</div>
            <span className="text-xs">Confirm</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {step === 'date' && (
          <>
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === time
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-amber-300'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Guests & Pets */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
                <div className="flex items-center border border-gray-300 rounded-xl bg-white">
                  <button 
                    onClick={() => setGuests(Math.max(1, guests - 1))}
                    className="p-3 text-gray-500 hover:text-amber-600"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-medium">{guests}</span>
                  <button 
                    onClick={() => setGuests(Math.min(10, guests + 1))}
                    className="p-3 text-gray-500 hover:text-amber-600"
                  >
                    +
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pets</label>
                <div className="flex items-center border border-gray-300 rounded-xl bg-white">
                  <button 
                    onClick={() => setPets(Math.max(0, pets - 1))}
                    className="p-3 text-gray-500 hover:text-amber-600"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-medium">{pets}</span>
                  <button 
                    onClick={() => setPets(Math.min(5, pets + 1))}
                    className="p-3 text-gray-500 hover:text-amber-600"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                if (selectedDate && selectedTime) {
                  setStep('table');
                  loadAvailableTables();
                } else {
                  toast.error('Please select date and time');
                }
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-lg mt-4"
            >
              Find Tables
            </Button>
          </>
        )}

        {step === 'table' && (
          <>
            <h3 className="font-semibold text-lg mb-2">Available Tables</h3>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
              </div>
            ) : availableTables.length === 0 ? (
              <div className="text-center py-12 bg-gray-100 rounded-xl">
                <Coffee className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">No tables available for this time.</p>
                <Button variant="link" onClick={() => setStep('date')} className="text-amber-600">
                  Change Time
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableTables.map((table: any) => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className={`p-4 rounded-xl border-2 transition-all text-left relative overflow-hidden ${
                      selectedTable?.id === table.id
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-amber-200'
                    }`}
                  >
                    <div className="font-bold text-gray-900">{table.name}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Users className="w-3 h-3" />
                      {table.capacity} Seats
                    </div>
                    {table.isWindowSeat && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">Window View</Badge>
                    )}
                    
                    {selectedTable?.id === table.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <Button
              onClick={() => {
                if (selectedTable) setStep('confirm');
                else toast.error('Please select a table');
              }}
              disabled={!selectedTable}
              className="w-full bg-amber-600 hover:bg-amber-700 h-12 text-lg mt-4"
            >
              Continue
            </Button>
          </>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <Card className="p-5 border-amber-200 bg-amber-50">
              <h3 className="font-bold text-lg text-amber-900 mb-4">Booking Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Date</span>
                  <span className="font-medium">{new Date(selectedDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Table</span>
                  <span className="font-medium">{selectedTable?.name} ({selectedTable?.capacity} seats)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Guests</span>
                  <span className="font-medium">{guests} Humans, {pets} Pets</span>
                </div>
              </div>
            </Card>

            <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Cancellation Policy</p>
                <p>Free cancellation up to 2 hours before booking. No-show fees may apply.</p>
              </div>
            </div>

            <Button
              onClick={handleBooking}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg shadow-lg shadow-green-200"
            >
              {loading ? 'Confirming...' : 'Confirm Booking'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
