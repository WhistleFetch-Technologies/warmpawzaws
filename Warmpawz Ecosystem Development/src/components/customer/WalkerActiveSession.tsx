import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Clock, Navigation, Phone, MessageCircle, Star, Camera, Play, Pause, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { WalkerSessionSummary } from './WalkerSessionSummary';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface BookingDetails {
  petId: string;
  petName: string;
  duration: '30' | '60' | 'custom';
  customDuration?: number;
  schedule: 'morning' | 'evening' | 'anytime';
  frequency: 'single' | 'weekly' | 'monthly';
  sessionsPerDay?: number;
}

interface SessionData {
  status: 'pending' | 'started' | 'completed';
  startTime?: Date;
  endTime?: Date;
  duration: number;
  distance: number;
  walkerLocation: {
    lat: number;
    lng: number;
  };
  route: Array<{ lat: number; lng: number; timestamp: Date }>;
}

export function WalkerActiveSession({
  bookingId,
  sessionId,
  bookingDetails,
  phone,
  onBack,
  onBackToHome
}: {
  bookingId: string;
  sessionId?: string;
  bookingDetails: BookingDetails;
  phone: string;
  onBack: () => void;
  onBackToHome?: () => void;
}) {
  const [sessionData, setSessionData] = useState<SessionData>({
    status: 'pending',
    duration: 0,
    distance: 0,
    walkerLocation: { lat: 12.9716, lng: 77.5946 },
    route: []
  });
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (sessionData.status === 'started') {
      // Simulate GPS tracking
      const interval = setInterval(() => {
        setSessionData(prev => {
          const newLat = prev.walkerLocation.lat + (Math.random() - 0.5) * 0.001;
          const newLng = prev.walkerLocation.lng + (Math.random() - 0.5) * 0.001;
          
          // Calculate distance increment (rough calculation)
          const distanceIncrement = Math.random() * 0.05; // km
          
          return {
            ...prev,
            duration: prev.duration + 1,
            distance: prev.distance + distanceIncrement,
            walkerLocation: { lat: newLat, lng: newLng },
            route: [
              ...prev.route,
              { lat: newLat, lng: newLng, timestamp: new Date() }
            ]
          };
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [sessionData.status]);

  const handleStartSession = () => {
    setShowOtpInput(true);
  };

  const handleVerifyOtp = async () => {
    setVerifying(true);
    setOtpError('');

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/session/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            bookingId,
            sessionId,
            otp
          })
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSessionData(prev => ({
            ...prev,
            status: 'started',
            startTime: new Date()
          }));
          setShowOtpInput(false);
          setOtp('');
        } else {
          setOtpError(result.error || 'Invalid OTP. Please try again.');
        }
      } else {
        const error = await response.json();
        setOtpError(error.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setOtpError('An error occurred. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleEndSession = () => {
    setShowOtpInput(false);
    // Directly complete the session
    handleCompleteSession();
  };

  const handleCompleteSession = async () => {
    setVerifying(true);

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/session/${sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            distance: sessionData.distance,
            duration: Math.floor(sessionData.duration / 60), // Convert to minutes
            route: sessionData.route,
            feedback: ''
          })
        }
      );

      if (response.ok) {
        setSessionData(prev => ({
          ...prev,
          status: 'completed',
          endTime: new Date()
        }));
        setTimeout(() => {
          setShowSummary(true);
        }, 1000);
      } else {
        console.error('Error completing session');
      }
    } catch (error) {
      console.error('Session completion error:', error);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyEndOtp = async () => {
    // Not used anymore - we directly complete session
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (showSummary) {
    return (
      <WalkerSessionSummary
        sessionData={{
          ...sessionData,
          bookingId,
          petName: bookingDetails.petName
        }}
        onBack={onBackToHome || onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Map Header */}
      <div className="relative h-[400px] bg-gradient-to-br from-green-200 to-blue-200">
        {/* Simulated Map with Walker Location */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="w-full h-full bg-[url('https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/77.5946,12.9716,13,0/400x400?access_token=pk.example')] bg-cover bg-center opacity-50"></div>
          
          {/* Walker Marker */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse">
            <div className="w-16 h-16 bg-[#FF8C42] rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
              <Navigation className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Route Trail */}
          {sessionData.route.length > 0 && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              <polyline
                points={sessionData.route.map((_, i) => {
                  const x = 200 + i * 2;
                  const y = 200 + Math.sin(i / 10) * 50;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="#FF8C42"
                strokeWidth="3"
                strokeDasharray="5,5"
              />
            </svg>
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="absolute top-12 left-6 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg z-10"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>

        {/* Status Badge */}
        <div className="absolute top-12 right-6 z-10">
          <div className={`px-4 py-2 rounded-full text-sm font-semibold shadow-lg ${
            sessionData.status === 'started' 
              ? 'bg-green-500 text-white animate-pulse'
              : sessionData.status === 'completed'
              ? 'bg-blue-500 text-white'
              : 'bg-yellow-500 text-white'
          }`}>
            {sessionData.status === 'started' ? '🏃 Walking...' : 
             sessionData.status === 'completed' ? '✓ Completed' : 
             '⏳ Waiting to Start'}
          </div>
        </div>
      </div>

      {/* Session Details Card */}
      <div className="px-6 -mt-16 pb-6">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Walker Info */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
                <span className="text-3xl">👨</span>
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-800">Rajesh Kumar</h2>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-semibold">4.9</span>
                  </div>
                  <span className="text-xs text-gray-500">• Walking {bookingDetails.petName}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-green-600" />
                </button>
                <button className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Live Stats */}
          <div className="p-6 bg-gradient-to-br from-orange-50 to-pink-50">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <Clock className="w-6 h-6 text-[#FF8C42]" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{formatDuration(sessionData.duration)}</p>
                <p className="text-xs text-gray-600">Duration</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <MapPin className="w-6 h-6 text-[#FF8C42]" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{sessionData.distance.toFixed(2)}</p>
                <p className="text-xs text-gray-600">Distance (km)</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <Navigation className="w-6 h-6 text-[#FF8C42]" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{sessionData.route.length}</p>
                <p className="text-xs text-gray-600">Checkpoints</p>
              </div>
            </div>
          </div>

          {/* OTP Section */}
          {showOtpInput && (
            <div className="p-6 border-t border-gray-200 bg-blue-50">
              <h3 className="font-semibold text-gray-800 mb-3 text-center">
                Enter OTP to Start Session
              </h3>
              <div className="bg-orange-100 rounded-lg p-3 mb-4 text-center">
                <p className="text-sm text-orange-800">
                  📱 The walker has the OTP to start the session
                </p>
                <p className="text-xs text-orange-700 mt-1">Enter the 6-digit OTP provided by the walker</p>
              </div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-center text-2xl font-bold tracking-widest mb-3 focus:border-[#FF8C42] focus:outline-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowOtpInput(false);
                    setOtp('');
                    setOtpError('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyOtp}
                  disabled={otp.length !== 6 || verifying}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white font-semibold disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
              {otpError && (
                <p className="text-sm text-red-500 mt-2 text-center">{otpError}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!showOtpInput && (
            <div className="p-6">
              {sessionData.status === 'pending' && (
                <Button
                  onClick={handleStartSession}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-6 rounded-xl font-semibold"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Walk Session
                </Button>
              )}
              
              {sessionData.status === 'started' && (
                <Button
                  onClick={handleEndSession}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-6 rounded-xl font-semibold"
                >
                  <Pause className="w-5 h-5 mr-2" />
                  End Walk Session
                </Button>
              )}

              {sessionData.status === 'completed' && (
                <Button
                  onClick={() => setShowSummary(true)}
                  className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  View Walk Summary
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Live Updates */}
        {sessionData.status === 'started' && (
          <div className="mt-6 space-y-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
              <Camera className="w-5 h-5 text-[#FF8C42] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Photo Update</p>
                <p className="text-xs text-gray-600">Walker will share photos during the walk</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800">GPS Tracking Active</p>
                <p className="text-xs text-gray-600">Real-time location updates every 10 seconds</p>
              </div>
            </div>
          </div>
        )}

        {/* Booking Info */}
        {bookingDetails.frequency !== 'single' && (
          <div className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">
            <h3 className="font-semibold text-gray-800 mb-3">Package Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Package Type</span>
                <span className="font-semibold text-gray-800 capitalize">{bookingDetails.frequency}</span>
              </div>
              {bookingDetails.frequency === 'monthly' && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Sessions per day</span>
                  <span className="font-semibold text-gray-800">{bookingDetails.sessionsPerDay}x</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Remaining Sessions</span>
                <span className="font-semibold text-[#FF8C42]">
                  {bookingDetails.frequency === 'weekly' ? '6' : '29'} left
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}