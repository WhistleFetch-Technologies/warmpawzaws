import { useState, useEffect } from 'react';
import { 
  Video, Clock, Star, CheckCircle, Loader, Phone, MessageSquare,
  Award, Calendar, ChevronLeft, ChevronRight, AlertCircle, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface InstantTeleBookingFlowProps {
  serviceId: string;
  serviceName: string;
  basePrice: number;
  roleName?: string; // e.g. "Doctor", "Vet", "Trainer", "Insurance Agent"
  onPaymentComplete: (bookingId: string) => void;
  onBack: () => void;
}

interface AvailableDoctor {
  id: string;
  fullName: string;
  role: string; // Dynamic role from backend
  specialization: string;
  photo?: string;
  rating: number;
  reviewCount: number;
  experience: number;
  languages: string[];
  nextAvailable: string; // "now" or time
  isOnline: boolean;
  responseTime: string; // "< 2 min"
}

type BookingState = 'awaiting_payment' | 'awaiting_assignment' | 'assigned' | 'session_started' | 'completed';

export function InstantTeleBookingFlow({ 
  serviceId, 
  serviceName, 
  basePrice,
  roleName = 'Doctor',
  onPaymentComplete,
  onBack 
}: InstantTeleBookingFlowProps) {
  const [candidateDoctors, setCandidateDoctors] = useState<AvailableDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingState, setBookingState] = useState<BookingState>('awaiting_payment');
  const [assignedDoctor, setAssignedDoctor] = useState<AvailableDoctor | null>(null);
  const [bookingId, setBookingId] = useState<string>('');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [sessionUrl, setSessionUrl] = useState<string>('');

  // Scroll state for horizontal scroller
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    loadCandidateDoctors();
  }, [serviceId]);

  // TASK 2: Load available doctors for instant tele
  const loadCandidateDoctors = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/tele/instant-available-doctors?serviceId=${serviceId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCandidateDoctors(data.doctors || []);
      } else {
        toast.error('Failed to load available doctors');
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      toast.error('Error loading available doctors');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment
  const handlePayment = async () => {
    try {
      setProcessingPayment(true);

      // Create instant tele booking (without assigned doctor yet)
      const bookingRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/instant-tele`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            serviceId,
            serviceName,
            candidateDoctorIds: candidateDoctors.map(d => d.id),
            amount: basePrice
          })
        }
      );

      if (!bookingRes.ok) {
        throw new Error('Failed to create booking');
      }

      const bookingData = await bookingRes.json();
      setBookingId(bookingData.bookingId);

      // Simulate payment processing (replace with actual payment gateway)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Process payment
      const paymentRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/payments/process-instant-tele`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId: bookingData.bookingId,
            amount: basePrice,
            paymentMethod: 'razorpay' // Replace with actual payment method
          })
        }
      );

      if (paymentRes.ok) {
        toast.success('Payment successful! Assigning doctor...');
        
        // TASK 2: Change state to awaiting assignment
        setBookingState('awaiting_assignment');
        
        // Start polling for doctor assignment
        pollForDoctorAssignment(bookingData.bookingId);
      } else {
        throw new Error('Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  // TASK 2: Poll for doctor assignment after payment
  const pollForDoctorAssignment = async (bookingId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${bookingId}/status`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'assigned' && data.assignedDoctor) {
            clearInterval(pollInterval);
            setAssignedDoctor(data.assignedDoctor);
            setBookingState('assigned');
            toast.success(`Dr. ${data.assignedDoctor.fullName} has been assigned!`);
            
            // Notify doctor is ready
            setTimeout(() => {
              setSessionUrl(data.sessionUrl);
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  };

  // Handle session start
  const handleStartSession = () => {
    setBookingState('session_started');
    
    // Open video call in new window or navigate
    if (sessionUrl) {
      window.open(sessionUrl, '_blank');
    }
    
    onPaymentComplete(bookingId);
  };

  // TASK 2: Horizontal scroll handlers
  const handleScroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('doctor-scroller');
    if (!container) return;

    const scrollAmount = 300;
    const newPosition = direction === 'left' 
      ? scrollPosition - scrollAmount 
      : scrollPosition + scrollAmount;

    container.scrollTo({ left: newPosition, behavior: 'smooth' });
    setScrollPosition(newPosition);

    // Update scroll button states
    setTimeout(() => {
      setCanScrollLeft(newPosition > 0);
      setCanScrollRight(newPosition < container.scrollWidth - container.clientWidth);
    }, 300);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-[#FF8C42]" />
      </div>
    );
  }

  const getPrefix = (role: string = '') => {
    const r = role.toLowerCase();
    if (r.includes('doctor') || r.includes('vet')) return 'Dr.';
    return '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            ← Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Instant {roleName} Consultation</h1>
          <p className="text-gray-600 mt-1">{serviceName}</p>
        </div>

        {/* TASK 2: Lifecycle State Indicator */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            {/* Awaiting Payment */}
            <div className={`flex items-center gap-2 ${bookingState === 'awaiting_payment' ? 'text-[#FF8C42]' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                bookingState === 'awaiting_payment' ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                {bookingState !== 'awaiting_payment' ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">1</span>
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Payment</span>
            </div>

            <div className="flex-1 h-1 bg-gray-200 mx-2">
              <div 
                className="h-full bg-[#FF8C42] transition-all duration-500"
                style={{ 
                  width: bookingState === 'awaiting_payment' ? '0%' : '100%' 
                }}
              />
            </div>

            {/* Awaiting Assignment */}
            <div className={`flex items-center gap-2 ${
              bookingState === 'awaiting_assignment' ? 'text-[#FF8C42]' : 
              bookingState === 'awaiting_payment' ? 'text-gray-400' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                bookingState === 'awaiting_assignment' ? 'bg-orange-100' : 
                bookingState === 'assigned' || bookingState === 'session_started' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {bookingState === 'assigned' || bookingState === 'session_started' || bookingState === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : bookingState === 'awaiting_assignment' ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <span className="text-sm font-bold">2</span>
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Assigning</span>
            </div>

            <div className="flex-1 h-1 bg-gray-200 mx-2">
              <div 
                className="h-full bg-[#FF8C42] transition-all duration-500"
                style={{ 
                  width: bookingState === 'assigned' || bookingState === 'session_started' ? '100%' : '0%' 
                }}
              />
            </div>

            {/* Session Started */}
            <div className={`flex items-center gap-2 ${
              bookingState === 'session_started' ? 'text-green-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                bookingState === 'session_started' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                {bookingState === 'session_started' ? (
                  <Video className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">3</span>
                )}
              </div>
              <span className="text-sm font-medium hidden sm:inline">Consultation</span>
            </div>
          </div>
        </Card>

        {/* TASK 2: Awaiting Payment - Show Doctor Scroller */}
        {bookingState === 'awaiting_payment' && (
          <div className="space-y-6">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-1">How Instant Tele Works</h3>
                  <p className="text-sm text-blue-800">
                    After payment, a {roleName.toLowerCase()} from the list below will be assigned to you within 2 minutes based on availability. You'll be notified immediately when your {roleName.toLowerCase()} is ready.
                  </p>
                </div>
              </div>
            </Card>

            {/* TASK 2: Horizontal Doctor Scroller */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  Available {roleName}s ({candidateDoctors.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScroll('left')}
                    disabled={!canScrollLeft}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleScroll('right')}
                    disabled={!canScrollRight}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div
                id="doctor-scroller"
                className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {candidateDoctors.map((doctor) => (
                  <Card
                    key={doctor.id}
                    className="flex-shrink-0 w-64 p-4 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        {doctor.photo ? (
                          <img src={doctor.photo} alt={doctor.fullName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-2xl font-bold text-gray-500">
                            {doctor.fullName.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">
                          {getPrefix(roleName)} {doctor.fullName}
                        </h4>
                        <p className="text-xs text-gray-600 truncate">
                          {doctor.specialization}
                        </p>
                        {doctor.isOnline && (
                          <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                            Online Now
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium">{doctor.rating.toFixed(1)}</span>
                        <span className="text-gray-500">({doctor.reviewCount} reviews)</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Award className="w-3 h-3" />
                        <span>{doctor.experience} years experience</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-3 h-3" />
                        <span>Response: {doctor.responseTime}</span>
                      </div>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {doctor.languages.map((lang) => (
                          <Badge key={lang} variant="outline" className="text-xs">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Payment Summary */}
            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Consultation Fee</span>
                  <span className="font-medium">₹{basePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Platform Fee</span>
                  <span className="font-medium">₹0</span>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Total Amount</span>
                  <span className="font-bold text-lg">₹{basePrice}</span>
                </div>
              </div>

              <Button
                onClick={handlePayment}
                disabled={processingPayment}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                {processingPayment ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>Pay ₹{basePrice} & Get Assigned</>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center mt-3">
                By proceeding, you agree to our Terms & Conditions
              </p>
            </Card>
          </div>
        )}

        {/* TASK 2: Awaiting Assignment State */}
        {bookingState === 'awaiting_assignment' && (
          <Card className="p-8 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader className="w-10 h-10 text-[#FF8C42] animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Assigning Your {roleName}...</h3>
            <p className="text-gray-600 mb-6">
              We're connecting you with the best available {roleName.toLowerCase()}. This usually takes less than 2 minutes.
            </p>
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Expected wait time: < 2 minutes</span>
              </div>
            </div>
          </Card>
        )}

        {/* TASK 2: Assigned State */}
        {bookingState === 'assigned' && assignedDoctor && (
          <div className="space-y-6">
            <Card className="p-6 bg-green-50 border-green-200">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                  {assignedDoctor.photo ? (
                    <img src={assignedDoctor.photo} alt={assignedDoctor.fullName} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-gray-500">
                      {assignedDoctor.fullName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {getPrefix(roleName)} {assignedDoctor.fullName}
                      </h3>
                      <p className="text-gray-700">{assignedDoctor.specialization}</p>
                    </div>
                    <Badge className="bg-green-600">Assigned</Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-700 mt-3">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span>{assignedDoctor.rating.toFixed(1)} ({assignedDoctor.reviewCount} reviews)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      <span>{assignedDoctor.experience} years exp.</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Ready to Start Consultation</h3>
              <p className="text-gray-600 mb-6">
                {getPrefix(roleName)} {assignedDoctor.fullName} is ready to see you now. Click below to start your video consultation.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={handleStartSession}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Video className="w-4 h-4 mr-2" />
                  Start Video Consultation
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="w-full">
                    <Phone className="w-4 h-4 mr-2" />
                    Call {roleName}
                  </Button>
                  <Button variant="outline" className="w-full">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Important</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>Ensure you have a stable internet connection</li>
                    <li>Allow camera and microphone access</li>
                    <li>Have your pet's medical history ready if available</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Session Started State */}
        {bookingState === 'session_started' && (
          <Card className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Session Active</h3>
            <p className="text-gray-600 mb-6">
              Your consultation with {getPrefix(roleName)} {assignedDoctor?.fullName} is now in progress.
            </p>
            <Button
              onClick={() => window.open(sessionUrl, '_blank')}
              className="bg-green-600 hover:bg-green-700"
            >
              <Video className="w-4 h-4 mr-2" />
              Rejoin Session
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
