import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Dog, 
  Brain, 
  ShieldCheck, 
  Activity, 
  Scissors, 
  CreditCard,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { InstantStaffList } from './InstantStaffList';
import { VideoCallRoom } from './VideoCallRoom';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

const BASE_URL = `${getApiBaseUrl()}`;

interface TeleConsultationFlowProps {
  customerId: string;
  petId: string;
  petName: string;
  onBack: () => void;
}

const ROLES = [
  { id: 'veterinarian', name: 'Veterinarian', icon: Stethoscope, color: 'text-blue-600', bg: 'bg-blue-100' },
  { id: 'nutritionist', name: 'Nutritionist', icon: Activity, color: 'text-green-600', bg: 'bg-green-100' },
  { id: 'trainer', name: 'Pet Trainer', icon: Brain, color: 'text-purple-600', bg: 'bg-purple-100' },
  { id: 'behaviorist', name: 'Behaviorist', icon: Dog, color: 'text-orange-600', bg: 'bg-orange-100' },
  { id: 'insurance-advisor', name: 'Insurance Advisor', icon: ShieldCheck, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  { id: 'groomer', name: 'Grooming Expert', icon: Scissors, color: 'text-pink-600', bg: 'bg-pink-100' }
];

export function TeleConsultationFlow({
  customerId,
  petId,
  petName,
  onBack
}: TeleConsultationFlowProps) {
  const [step, setStep] = useState<'role-selection' | 'staff-selection' | 'payment' | 'assignment' | 'session'>('role-selection');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [consultationFee, setConsultationFee] = useState<number>(0);
  const [booking, setBooking] = useState<any>(null);
  const [teleSessionId, setTeleSessionId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Step 1: Handle Role Selection
  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setStep('staff-selection');
  };

  // Step 2: Handle Staff Selection / Proceed to Payment
  const handleProceedToPayment = async (fee: number) => {
    setConsultationFee(fee);
    setIsProcessing(true);

    try {
      // Create initial booking
      const response = await fetch(`${BASE_URL}/tele-services/instant/create-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          customerId,
          petId,
          petName,
          roleId: selectedRole,
          consultationFee: fee
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking);
        setStep('payment');
      } else {
        toast.error('Failed to initialize booking');
      }
    } catch (error) {
      console.error('Booking init error:', error);
      toast.error('Connection error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 3: Handle Payment Success
  const handlePaymentSuccess = async () => {
    setIsProcessing(true);
    try {
      // Simulate payment ID
      const paymentId = `PAY-${Date.now()}`;
      
      const response = await fetch(`${BASE_URL}/tele-services/instant/assign-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          bookingId: booking.bookingId,
          paymentId,
          razorpayPaymentId: paymentId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBooking(data.booking);
        setStep('assignment'); // Go to assignment/waiting screen
      } else {
        toast.error('Assignment failed');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error('Failed to assign staff');
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Video Call Session
  const handleStartSession = async () => {
    if (!booking) return;
    
    setIsProcessing(true);
    try {
      // Create tele session
      const response = await fetch(`${BASE_URL}/booking/${booking.bookingId}/start-video-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          customerId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTeleSessionId(data.teleSession.id);
        setStep('session');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to start video call');
      }
    } catch (error) {
      console.error('Start session error:', error);
      toast.error('Connection error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 4: Assignment / Waiting Logic (Polling)
  useEffect(() => {
    if (step === 'assignment' && booking) {
      let pollInterval: NodeJS.Timeout;

      const checkStatus = async () => {
        try {
          const response = await fetch(`${BASE_URL}/tele-services/booking/${booking.bookingId}`, {
            headers: getAuthHeaders()
          });
          
          if (response.ok) {
            const data = await response.json();
            const updatedBooking = data.booking;
            setBooking(updatedBooking);

            if (updatedBooking.status === 'assigned') {
               // Staff assigned!
               toast.success('Staff assigned!');
               clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      };

      // Poll every 3 seconds
      pollInterval = setInterval(checkStatus, 3000);
      
      // Immediate check
      checkStatus();

      return () => clearInterval(pollInterval);
    }
  }, [step, booking?.bookingId]);

  // Render Steps
  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header Navigation */}
      {step !== 'session' && (
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold">Instant Tele-Consultation</h1>
        </div>
      )}

      {/* STEP 1: ROLE SELECTION */}
      {step === 'role-selection' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id)}
              className="flex items-center gap-4 p-6 bg-white border-2 border-gray-100 rounded-xl hover:border-orange-500 hover:shadow-md transition-all text-left"
            >
              <div className={`p-3 rounded-full ${role.bg} ${role.color}`}>
                <role.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{role.name}</h3>
                <p className="text-sm text-gray-500">Connect in &lt; 2 mins</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 2: STAFF SELECTION (Uses InstantStaffList) */}
      {step === 'staff-selection' && (
        <InstantStaffList
          roleId={selectedRole}
          onStaffView={(staff) => console.log('View staff', staff)}
          onProceedToPayment={handleProceedToPayment}
        />
      )}

      {/* STEP 3: PAYMENT SIMULATION */}
      {step === 'payment' && (
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
            <CreditCard className="w-8 h-8 text-orange-600" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-2">Confirm Payment</h2>
            <p className="text-gray-600">Consultation Fee</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">₹{consultationFee}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Patient</span>
              <span className="font-medium">{petName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service</span>
              <span className="font-medium">Instant Tele-Consultation</span>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-lg bg-green-600 hover:bg-green-700"
            onClick={handlePaymentSuccess}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : 'Pay Now'}
          </Button>
          
          <p className="text-xs text-gray-400">
            Secure payment powered by Razorpay
          </p>
        </div>
      )}

      {/* STEP 4: ASSIGNMENT / WAITING */}
      {step === 'assignment' && (
        <div className="bg-white p-12 rounded-xl shadow-lg text-center max-w-lg mx-auto">
           {booking?.status === 'assigned' ? (
               <div className="space-y-4 animate-in fade-in zoom-in">
                   <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                       <CheckCircle className="w-10 h-10 text-green-600" />
                   </div>
                   <h2 className="text-2xl font-bold">Staff Assigned!</h2>
                   <p className="text-gray-600">
                       You are being connected to <strong>{booking.staffName}</strong>
                   </p>
                   <Button onClick={handleStartSession} className="w-full" disabled={isProcessing}>
                       {isProcessing ? <Loader2 className="animate-spin mr-2" /> : 'Join Call Now'}
                   </Button>
               </div>
           ) : (
               <div className="space-y-6">
                   <div className="relative">
                       <div className="w-24 h-24 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto" />
                       <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
                           {booking?.queuePosition || 1}
                       </div>
                   </div>
                   
                   <div>
                       <h2 className="text-2xl font-bold mb-2">Finding best expert...</h2>
                       <p className="text-gray-500">
                           {booking?.queuePosition 
                             ? `You are #${booking.queuePosition} in queue` 
                             : 'Matching your profile with available staff'}
                       </p>
                   </div>
                   
                   <div className="bg-blue-50 p-4 rounded-lg text-blue-700 text-sm">
                       <p>Please do not close this window. We usually connect within 30 seconds.</p>
                   </div>
               </div>
           )}
        </div>
      )}

      {/* STEP 5: VIDEO SESSION */}
      {step === 'session' && booking && (
        <VideoCallRoom
          sessionId={teleSessionId || booking.bookingId} // Fallback to bookingId if needed, but session Id preferred
          token={teleSessionId || booking.bookingId}
          staffName={booking.staffName || 'Consultant'}
          userName="You"
          onEndCall={onBack}
        />
      )}
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={className}
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    )
}
