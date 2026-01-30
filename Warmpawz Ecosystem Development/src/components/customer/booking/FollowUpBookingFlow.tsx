import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { 
  ArrowLeft, 
  Calendar, 
  MessageCircle, 
  Stethoscope, 
  Tag, 
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CalendarSlotPicker } from './CalendarSlotPicker';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface FollowUpBookingFlowProps {
  phone: string;
  originalBookingId: string;
  vendorId: string;
  vendorName: string;
  petId: string;
  petName: string;
  onBack: () => void;
  onComplete: (bookingId: string) => void;
}

export function FollowUpBookingFlow({
  phone,
  originalBookingId,
  vendorId,
  vendorName,
  petId,
  petName,
  onBack,
  onComplete
}: FollowUpBookingFlowProps) {
  const [step, setStep] = useState<'type' | 'schedule' | 'confirm'>('type');
  const [followupType, setFollowupType] = useState<'chat' | 'at_center' | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);
  const [originalBooking, setOriginalBooking] = useState<any>(null);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    checkEligibility();
    loadOriginalBooking();
  }, [originalBookingId]);

  const checkEligibility = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/followup/check/${originalBookingId}`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [FOLLOWUP] Eligibility:', data);
        setEligibility(data);
      }
    } catch (error) {
      console.error('❌ [FOLLOWUP] Error checking eligibility:', error);
    }
  };

  const loadOriginalBooking = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/bookings/${phone.replace(/[^0-9]/g, '')}`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const booking = data.bookings?.find((b: any) => b.id === originalBookingId);
        if (booking) {
          setOriginalBooking(booking);
        }
      }
    } catch (error) {
      console.error('❌ [FOLLOWUP] Error loading booking:', error);
    }
  };

  const handleTypeSelection = (type: 'chat' | 'at_center') => {
    setFollowupType(type);
    setStep('schedule');
  };

  const handleSlotSelected = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };

  const handleConfirm = async () => {
    if (!followupType || !selectedDate || !selectedTime) return;

    try {
      setLoading(true);
      
      console.log('📝 [FOLLOWUP] Creating follow-up booking...');
      
      const response = await fetch(
        `${API_BASE}/followup/create`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            originalBookingId,
            customerPhone: phone,
            vendorId,
            vendorPhone: originalBooking?.vendorPhone,
            serviceId: originalBooking?.serviceId,
            selectedDate,
            selectedTime,
            petId,
            address: originalBooking?.address,
            serviceStyle: followupType === 'chat' ? 'tele' : 'at_center'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [FOLLOWUP] Booking created:', data);
        onComplete(data.bookingId);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create follow-up booking');
      }
    } catch (error) {
      console.error('❌ [FOLLOWUP] Error:', error);
      alert('Failed to create follow-up booking');
    } finally {
      setLoading(false);
    }
  };

  if (!eligibility) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Checking eligibility...</p>
        </div>
      </div>
    );
  }

  if (!eligibility.eligible) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen p-4">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-600 mb-6">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>

          <Card className="p-6 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Follow-up Not Available</h2>
            <p className="text-gray-600">{eligibility.reason}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-4 pt-8 pb-6">
          <button onClick={onBack} className="flex items-center gap-2 mb-4">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <h1 className="text-2xl font-bold mb-2">Follow-up Consultation</h1>
          <p className="text-white/80 text-sm">
            For {petName} with {vendorName}
          </p>
        </div>

        {/* Eligibility Badge */}
        <div className="p-4 bg-green-50 border-b border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                Follow-up Available ({eligibility.daysRemaining} days remaining)
              </p>
              <p className="text-xs text-green-700">
                Completed {eligibility.completedDaysAgo} days ago
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {step === 'type' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Choose Follow-up Type</h3>
              
              {/* Chat Follow-up */}
              <Card
                onClick={() => handleTypeSelection('chat')}
                className="p-4 cursor-pointer hover:shadow-md transition-all border-2 border-gray-200 hover:border-[#FF8C42]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">Chat Consultation</h4>
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        <Tag className="w-3 h-3 mr-1" />
                        FREE
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Quick questions via chat. Prescription updates available.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Response within 2 hours</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* At-Center Follow-up */}
              <Card
                onClick={() => handleTypeSelection('at_center')}
                className="p-4 cursor-pointer hover:shadow-md transition-all border-2 border-gray-200 hover:border-[#FF8C42]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="w-6 h-6 text-[#FF8C42]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">Clinic Visit</h4>
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                        <Tag className="w-3 h-3 mr-1" />
                        30% OFF
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      Full physical examination at the clinic.
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Book appointment slot</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {step === 'schedule' && followupType && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep('type');
                    setFollowupType(null);
                    setSelectedDate('');
                    setSelectedTime('');
                  }}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Change Type
                </Button>
                <Badge className={followupType === 'chat' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                  {followupType === 'chat' ? 'Chat Consultation' : 'Clinic Visit'}
                </Badge>
              </div>

              <CalendarSlotPicker
                vendorId={vendorId}
                onSlotSelected={handleSlotSelected}
                serviceStyle={followupType === 'chat' ? 'tele' : 'at_center'}
              />

              {selectedDate && selectedTime && (
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7029] h-12"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Booking...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5 mr-2" />
                      Confirm Follow-up
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
