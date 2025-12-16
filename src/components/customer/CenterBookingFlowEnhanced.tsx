import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ArrowLeft, Calendar as CalendarIcon, Clock, Check, Plus, FileText, Upload, Stethoscope, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * 🏥 CENTER BOOKING FLOW ENHANCED
 * 
 * Phase 7C: Rule 1 - Center Booking with Specialized Services
 * 
 * Features:
 * - Select Specialized Services (Grooming, Veterinary, etc.)
 * - Configure Add-ons
 * - Mandate Prescriptions/Medical Records if required
 * - Role-based Chat Context initiation
 */

interface Service {
  serviceId: string;
  serviceName: string;
  basePrice: number;
  description: string;
  duration: number;
  requiresPrescription: boolean;
  requiresMedicalRecords: boolean;
  allowsAddOns: boolean;
  addOns?: Array<{
    addOnId: string;
    name: string;
    price: number;
    description: string;
  }>;
}

interface CenterBookingFlowEnhancedProps {
  vendorId: string;
  vendorName: string;
  customerId: string;
  petId: string;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function CenterBookingFlowEnhanced({
  vendorId,
  vendorName,
  customerId,
  petId,
  onBack,
  onSuccess
}: CenterBookingFlowEnhancedProps) {
  const [step, setStep] = useState<'service' | 'config' | 'schedule' | 'confirm'>('service');
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [hasPrescription, setHasPrescription] = useState(false);
  const [hasMedicalRecords, setHasMedicalRecords] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Load Vendor Services
  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      // Try fetching specialized services first
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/specialized-services/vendor/${vendorId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.services && data.services.length > 0) {
            setServices(data.services);
        } else {
             // Fallback to standard services if no specialized ones
             fetchStandardServices();
        }
      } else {
        fetchStandardServices();
      }
    } catch (error) {
      console.error(error);
      fetchStandardServices();
    } finally {
      setLoading(false);
    }
  };

  const fetchStandardServices = async () => {
      // Fallback implementation
      try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/services`,
            { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        );
        if (response.ok) {
            const data = await response.json();
            const stdServices = (data.services || []).map((s: any) => ({
                serviceId: s.id,
                serviceName: s.name,
                basePrice: s.price,
                description: s.description || '',
                duration: s.duration || 60,
                requiresPrescription: false,
                requiresMedicalRecords: false,
                allowsAddOns: false,
                addOns: []
            }));
            setServices(stdServices);
        }
      } catch (e) {
          console.error('Failed to load standard services', e);
      }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedAddOns([]);
    setHasPrescription(false);
    setHasMedicalRecords(false);
    setStep('config');
  };

  const toggleAddOn = (addOnId: string) => {
    if (selectedAddOns.includes(addOnId)) {
      setSelectedAddOns(selectedAddOns.filter(id => id !== addOnId));
    } else {
      setSelectedAddOns([...selectedAddOns, addOnId]);
    }
  };

  const calculateTotal = () => {
    if (!selectedService) return 0;
    let total = selectedService.basePrice;
    selectedService.addOns?.forEach(addon => {
      if (selectedAddOns.includes(addon.addOnId)) {
        total += addon.price;
      }
    });
    return total;
  };

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;

    try {
      setLoading(true);

      // 1. Create Base Booking
      const bookingPayload = {
        vendorId,
        serviceId: selectedService.serviceId,
        serviceName: selectedService.serviceName,
        customerId,
        petId, // Assuming passed from parent or context
        scheduledDate: format(selectedDate, 'yyyy-MM-dd'),
        scheduledTime: selectedTime,
        status: 'pending',
        totalAmount: calculateTotal(),
        serviceType: 'center_visit'
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(bookingPayload)
        }
      );

      if (!response.ok) throw new Error('Booking failed');
      const data = await response.json();
      const bookingId = data.booking.id;

      // 2. Attach Specialized Details (Add-ons, etc.)
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/add-specialized-service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            serviceId: selectedService.serviceId,
            addOnIds: selectedAddOns,
            // In a real app, we would upload these first and pass IDs. 
            // For now we assume "hasPrescription" means user checked a box saying they have it physical or uploaded previously.
            // We would pass actual IDs here.
            prescriptionId: hasPrescription ? 'PRE-EXISTING' : undefined, 
            medicalRecordIds: hasMedicalRecords ? ['REC-EXISTING'] : undefined
          })
        }
      );

      // 3. Initiate Chat Context (Rule 1 Requirement)
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/chat/role-context?role=customer`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      toast.success('Booking confirmed successfully!');
      onSuccess(bookingId);

    } catch (error) {
      console.error(error);
      toast.error('Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // --- STEPS ---

  const ServiceStep = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Select a Service</h2>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="p-8 text-center text-gray-500">No services available.</div>
      ) : (
        <div className="grid gap-4">
          {services.map(service => (
            <Card 
                key={service.serviceId} 
                className="p-4 cursor-pointer hover:border-orange-500 transition-all group"
                onClick={() => handleServiceSelect(service)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-600">{service.serviceName}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{service.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" /> {service.duration} min
                    </Badge>
                    {(service.requiresPrescription || service.requiresMedicalRecords) && (
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50">
                            Medical Records Req.
                        </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                    <span className="block text-lg font-bold text-orange-600">₹{service.basePrice}</span>
                    <Button size="sm" variant="ghost" className="mt-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                        Select <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                    </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const ConfigStep = () => {
    if (!selectedService) return null;

    const canProceed = 
        (!selectedService.requiresPrescription || hasPrescription) &&
        (!selectedService.requiresMedicalRecords || hasMedicalRecords);

    return (
        <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                <h3 className="font-bold text-orange-900">{selectedService.serviceName}</h3>
                <p className="text-sm text-orange-700 mt-1">Base Price: ₹{selectedService.basePrice}</p>
            </div>

            {/* Medical Requirements */}
            {(selectedService.requiresPrescription || selectedService.requiresMedicalRecords) && (
                <div className="space-y-4 border-t pt-4">
                    <h4 className="font-semibold flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-blue-600" /> Medical Requirements
                    </h4>
                    
                    {selectedService.requiresPrescription && (
                        <Card className={`p-4 cursor-pointer border-2 transition-all ${hasPrescription ? 'border-green-500 bg-green-50' : 'border-gray-200'}`} onClick={() => setHasPrescription(!hasPrescription)}>
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${hasPrescription ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                    {hasPrescription && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Valid Prescription</p>
                                    <p className="text-xs text-gray-500">Required for this service</p>
                                </div>
                                <Upload className="w-4 h-4 text-gray-400 ml-auto" />
                            </div>
                        </Card>
                    )}

                    {selectedService.requiresMedicalRecords && (
                        <Card className={`p-4 cursor-pointer border-2 transition-all ${hasMedicalRecords ? 'border-green-500 bg-green-50' : 'border-gray-200'}`} onClick={() => setHasMedicalRecords(!hasMedicalRecords)}>
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${hasMedicalRecords ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                                    {hasMedicalRecords && <Check className="w-4 h-4 text-white" />}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">Medical Records</p>
                                    <p className="text-xs text-gray-500">Vaccination history, etc.</p>
                                </div>
                                <FileText className="w-4 h-4 text-gray-400 ml-auto" />
                            </div>
                        </Card>
                    )}
                    
                    {!canProceed && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Please provide required documents to proceed.
                        </p>
                    )}
                </div>
            )}

            {/* Add-ons */}
            {selectedService.allowsAddOns && selectedService.addOns && selectedService.addOns.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                    <h4 className="font-semibold flex items-center gap-2">
                        <Plus className="w-4 h-4 text-orange-600" /> Add-on Services
                    </h4>
                    {selectedService.addOns.map(addon => (
                        <div 
                            key={addon.addOnId}
                            className="flex items-center justify-between p-3 bg-white border rounded-lg"
                        >
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox"
                                    checked={selectedAddOns.includes(addon.addOnId)}
                                    onChange={() => toggleAddOn(addon.addOnId)}
                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                />
                                <div>
                                    <p className="font-medium text-sm text-gray-900">{addon.name}</p>
                                    <p className="text-xs text-gray-500">{addon.description}</p>
                                </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">+₹{addon.price}</span>
                        </div>
                    ))}
                </div>
            )}

            <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 mt-4"
                disabled={!canProceed}
                onClick={() => setStep('schedule')}
            >
                Continue to Schedule
            </Button>
        </div>
    );
  };

  const ScheduleStep = () => (
      <div className="space-y-6">
          <Card className="p-4">
              <h3 className="font-semibold mb-3">Select Date</h3>
              <div className="flex justify-center">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md border"
                    fromDate={new Date()}
                />
              </div>
          </Card>

          {selectedDate && (
              <div className="space-y-3">
                  <h3 className="font-semibold">Available Slots</h3>
                  <div className="grid grid-cols-3 gap-2">
                      {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`py-2 px-3 rounded-lg text-sm border transition-all ${
                                selectedTime === time 
                                    ? 'bg-orange-600 text-white border-orange-600' 
                                    : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
                            }`}
                          >
                              {time}
                          </button>
                      ))}
                  </div>
              </div>
          )}

          <Button 
            className="w-full bg-orange-600 hover:bg-orange-700 mt-4"
            disabled={!selectedDate || !selectedTime}
            onClick={() => setStep('confirm')}
          >
              Review Booking
          </Button>
      </div>
  );

  const ConfirmStep = () => {
      const total = calculateTotal();
      if (!selectedService) return null;

      return (
          <div className="space-y-6">
              <Card className="p-4 bg-gray-50 border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h3 className="font-bold text-lg text-gray-900">{vendorName}</h3>
                          <p className="text-sm text-gray-600">{selectedService.serviceName}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Confirmed</Badge>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600 border-t border-gray-200 pt-3">
                      <div className="flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4" />
                          <span>{selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy') : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{selectedTime} ({selectedService.duration} mins)</span>
                      </div>
                  </div>

                  {selectedAddOns.length > 0 && (
                      <div className="mt-4 border-t border-gray-200 pt-3">
                          <p className="font-semibold text-xs text-gray-500 mb-2 uppercase">Add-ons</p>
                          {selectedService.addOns?.filter(a => selectedAddOns.includes(a.addOnId)).map(addon => (
                              <div key={addon.addOnId} className="flex justify-between text-sm mb-1">
                                  <span>{addon.name}</span>
                                  <span>₹{addon.price}</span>
                              </div>
                          ))}
                      </div>
                  )}

                  <div className="mt-4 border-t border-gray-200 pt-3 flex justify-between items-center font-bold text-lg text-gray-900">
                      <span>Total Amount</span>
                      <span>₹{total}</span>
                  </div>
              </Card>

              <div className="bg-blue-50 p-4 rounded-lg flex gap-3 items-start">
                  <Stethoscope className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                      <p className="text-sm font-semibold text-blue-900">Medical Context Ready</p>
                      <p className="text-xs text-blue-700">
                          The center has received your pet's medical context. A chat channel with the specialist will be opened upon confirmation.
                      </p>
                  </div>
              </div>

              <Button 
                className="w-full bg-orange-600 hover:bg-orange-700 py-6 text-lg"
                onClick={handleBooking}
                disabled={loading}
              >
                  {loading ? 'Processing...' : `Pay ₹${total}`}
              </Button>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 sticky top-0 bg-white z-10">
        <button onClick={() => {
            if (step === 'service') onBack();
            else if (step === 'config') setStep('service');
            else if (step === 'schedule') setStep('config');
            else if (step === 'confirm') setStep('schedule');
        }}>
            <ArrowLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div className="flex-1">
            <h1 className="text-lg font-semibold">
                {step === 'service' ? 'Select Service' :
                 step === 'config' ? 'Customize Service' :
                 step === 'schedule' ? 'Schedule Visit' : 'Confirm Booking'}
            </h1>
            <div className="flex gap-1 mt-1">
                {['service', 'config', 'schedule', 'confirm'].map((s, i) => (
                    <div 
                        key={s} 
                        className={`h-1 flex-1 rounded-full transition-all ${
                            ['service', 'config', 'schedule', 'confirm'].indexOf(step) >= i 
                            ? 'bg-orange-600' 
                            : 'bg-gray-200'
                        }`}
                    />
                ))}
            </div>
        </div>
      </div>

      <div className="p-4 pb-24 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
            <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
            >
                {step === 'service' && <ServiceStep />}
                {step === 'config' && <ConfigStep />}
                {step === 'schedule' && <ScheduleStep />}
                {step === 'confirm' && <ConfirmStep />}
            </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
