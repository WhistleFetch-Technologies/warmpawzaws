import { useState, useEffect } from 'react';
import { 
  MapPin, Navigation, Clock, Play, Square, CheckCircle, Lock,
  AlertCircle, Upload, Camera, MessageSquare, Phone, Shield
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface OTPSessionManagerProps {
  booking: any;
  onSessionComplete: () => void;
}

type SessionState = 'pending' | 'otp_verify_start' | 'active' | 'otp_verify_end' | 'completed';

interface SessionData {
  bookingId: string;
  sessionNumber: number; // For multi-session packages
  totalSessions: number;
  otp: string; // Current session OTP
  otpGeneratedAt: string;
  otpExpiresAt: string;
  state: SessionState;
  startTime?: string;
  endTime?: string;
  routeTracking?: {
    enabled: boolean;
    currentLocation?: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: string;
    };
    routePoints: Array<{
      latitude: number;
      longitude: number;
      timestamp: string;
    }>;
    distance: number; // in km
    eta?: string; // Estimated arrival time
  };
  photos: Array<{
    url: string;
    timestamp: string;
    type: 'start' | 'progress' | 'end';
  }>;
}

export function OTPSessionManager({ booking, onSessionComplete }: OTPSessionManagerProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [otpInput, setOtpInput] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'end'>('start');
  
  // GPS tracking
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<any>(null);
  const [customerETA, setCustomerETA] = useState<string | null>(null);

  const isMultiSession = booking.packageType === 'multi_session';

  useEffect(() => {
    loadSessionData();
  }, [booking.id]);

  useEffect(() => {
    // Enable GPS for home services
    if (booking.serviceStyle === 'at_home' && sessionData?.state === 'active') {
      enableGPSTracking();
    }

    return () => {
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [sessionData?.state]);

  // TASK 2: Load session data and OTP
  const loadSessionData = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${getApiBaseUrl()}/bookings/${booking.id}/session`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessionData(data.session);
      } else {
        toast.error('Failed to load session data');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('Error loading session');
    } finally {
      setLoading(false);
    }
  };

  // TASK 2: Generate new OTP for session start
  const generateOTP = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/bookings/${booking.id}/generate-otp`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionNumber: sessionData?.sessionNumber || 1,
            action: otpAction
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSessionData(prev => prev ? {
          ...prev,
          otp: data.otp,
          otpGeneratedAt: data.generatedAt,
          otpExpiresAt: data.expiresAt
        } : null);
        
        toast.success(`OTP sent to customer: ${data.otp}`);
      } else {
        toast.error('Failed to generate OTP');
      }
    } catch (error) {
      console.error('Error generating OTP:', error);
      toast.error('Error generating OTP');
    }
  };

  // TASK 2: Verify OTP and start/end session
  const verifyOTPAndProceed = async () => {
    if (!otpInput || otpInput.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    try {
      setVerifyingOtp(true);

      const response = await fetch(
        `${getApiBaseUrl()}/bookings/${booking.id}/verify-otp`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            otp: otpInput,
            action: otpAction,
            sessionNumber: sessionData?.sessionNumber
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        if (otpAction === 'start') {
          // Start session
          setSessionData(prev => prev ? {
            ...prev,
            state: 'active',
            startTime: new Date().toISOString()
          } : null);
          
          toast.success('Session started! GPS tracking enabled.');
          
          // Enable GPS tracking
          if (booking.serviceStyle === 'at_home') {
            enableGPSTracking();
          }
        } else {
          // End session
          setSessionData(prev => prev ? {
            ...prev,
            state: 'completed',
            endTime: new Date().toISOString()
          } : null);
          
          toast.success('Session completed successfully!');
          
          // Stop GPS tracking
          if (trackingInterval) {
            clearInterval(trackingInterval);
            setGpsEnabled(false);
          }
          
          // Upload session data to S3
          await uploadSessionToS3();
        }

        setShowOtpDialog(false);
        setOtpInput('');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      toast.error('Error verifying OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // TASK 2: Enable GPS tracking and route logging
  const enableGPSTracking = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsEnabled(true);
        updateLocation(position.coords);
        
        // Start tracking interval (every 10 seconds)
        const interval = setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            (pos) => updateLocation(pos.coords),
            (err) => console.error('GPS error:', err)
          );
        }, 10000);
        
        setTrackingInterval(interval);
      },
      (error) => {
        console.error('GPS permission denied:', error);
        toast.error('Please enable location permissions');
      }
    );
  };

  // Update location and calculate ETA
  const updateLocation = async (coords: GeolocationCoordinates) => {
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp: new Date().toISOString()
    };

    // Update local state
    setSessionData(prev => {
      if (!prev) return null;
      
      const newRoutePoints = [
        ...(prev.routeTracking?.routePoints || []),
        {
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: locationData.timestamp
        }
      ];

      // Calculate distance
      const distance = calculateTotalDistance(newRoutePoints);

      return {
        ...prev,
        routeTracking: {
          enabled: true,
          currentLocation: locationData,
          routePoints: newRoutePoints,
          distance,
          eta: customerETA || undefined
        }
      };
    });

    // Send to server for real-time updates
    try {
      await fetch(
        `${getApiBaseUrl()}/bookings/${booking.id}/update-location`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            location: locationData,
            sessionNumber: sessionData?.sessionNumber
          })
        }
      );

      // Calculate ETA if customer location is available
      if (booking.customerLocation) {
        const eta = await calculateETA(
          coords.latitude,
          coords.longitude,
          booking.customerLocation.latitude,
          booking.customerLocation.longitude
        );
        setCustomerETA(eta);
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  // Calculate total distance from route points
  const calculateTotalDistance = (points: Array<{latitude: number, longitude: number}>): number => {
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += calculateDistance(
        points[i - 1].latitude,
        points[i - 1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return total;
  };

  // Haversine distance calculation
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  // Calculate ETA
  const calculateETA = async (
    fromLat: number, 
    fromLng: number, 
    toLat: number, 
    toLng: number
  ): Promise<string> => {
    const distance = calculateDistance(fromLat, fromLng, toLat, toLng);
    const averageSpeed = 30; // km/h (walking/driving average)
    const timeInHours = distance / averageSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);
    
    return `${timeInMinutes} min`;
  };

  // TASK 2: Upload session data to S3 and pet profile
  const uploadSessionToS3 = async () => {
    try {
      const sessionLog = {
        bookingId: booking.id,
        sessionNumber: sessionData?.sessionNumber,
        startTime: sessionData?.startTime,
        endTime: sessionData?.endTime,
        duration: calculateDuration(),
        routeTracking: sessionData?.routeTracking,
        photos: sessionData?.photos,
        uploadedAt: new Date().toISOString()
      };

      // Upload to S3
      const response = await fetch(
        `${getApiBaseUrl()}/sessions/upload-to-s3`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionLog,
            petId: booking.petId
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Session uploaded to S3:', data.s3Url);
        
        // Update pet profile with session record
        await updatePetProfile(data.s3Url);
      }
    } catch (error) {
      console.error('Error uploading session:', error);
    }
  };

  // Update pet profile with session record
  const updatePetProfile = async (s3Url: string) => {
    try {
      await fetch(
        `${getApiBaseUrl()}/pets/${booking.petId}/add-session`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bookingId: booking.id,
            sessionNumber: sessionData?.sessionNumber,
            serviceType: booking.serviceName,
            sessionDate: sessionData?.startTime,
            duration: calculateDuration(),
            s3LogUrl: s3Url,
            staffId: booking.assignedStaffId,
            notes: `${booking.serviceName} session completed`
          })
        }
      );
    } catch (error) {
      console.error('Error updating pet profile:', error);
    }
  };

  const calculateDuration = (): number => {
    if (!sessionData?.startTime || !sessionData?.endTime) return 0;
    
    const start = new Date(sessionData.startTime).getTime();
    const end = new Date(sessionData.endTime).getTime();
    return Math.round((end - start) / 60000); // minutes
  };

  // Handle start service
  const handleStartService = () => {
    setOtpAction('start');
    generateOTP();
    setShowOtpDialog(true);
  };

  // Handle end service
  const handleEndService = () => {
    setOtpAction('end');
    generateOTP();
    setShowOtpDialog(true);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading session...</div>;
  }

  if (!sessionData) {
    return <div className="p-8 text-center">No session data available</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Session Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{booking.serviceName}</h2>
            <p className="text-gray-600 mt-1">
              {isMultiSession 
                ? `Session ${sessionData.sessionNumber} of ${sessionData.totalSessions}`
                : 'Single Session'}
            </p>
          </div>
          
          <Badge className={`
            ${sessionData.state === 'pending' && 'bg-gray-100 text-gray-800'}
            ${sessionData.state === 'active' && 'bg-green-100 text-green-800'}
            ${sessionData.state === 'completed' && 'bg-blue-100 text-blue-800'}
          `}>
            {sessionData.state === 'pending' && 'Pending'}
            {sessionData.state === 'active' && 'In Progress'}
            {sessionData.state === 'completed' && 'Completed'}
          </Badge>
        </div>

        {/* Customer Details */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Customer:</span>
            <span className="font-medium">{booking.customerName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Pet:</span>
            <span className="font-medium">{booking.petName}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">{booking.customerAddress}</span>
          </div>
        </div>
      </Card>

      {/* GPS Tracking Status (for home services) */}
      {booking.serviceStyle === 'at_home' && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600" />
            GPS Route Tracking
          </h3>

          {sessionData.state === 'active' && gpsEnabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <div className="font-medium text-green-900">GPS Tracking Active</div>
                  <div className="text-sm text-green-700">
                    Location updates every 10 seconds
                  </div>
                </div>
              </div>

              {sessionData.routeTracking && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-600 mb-1">Distance Covered</div>
                    <div className="font-bold text-lg">
                      {sessionData.routeTracking.distance.toFixed(2)} km
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-600 mb-1">Route Points</div>
                    <div className="font-bold text-lg">
                      {sessionData.routeTracking.routePoints.length}
                    </div>
                  </div>

                  {customerETA && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-blue-700 mb-1">ETA to Customer</div>
                      <div className="font-bold text-lg text-blue-900">
                        {customerETA}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sessionData.routeTracking?.currentLocation && (
                <div className="text-xs text-gray-500">
                  Last updated: {new Date(sessionData.routeTracking.currentLocation.timestamp).toLocaleTimeString()}
                  <br />
                  Accuracy: {sessionData.routeTracking.currentLocation.accuracy.toFixed(0)}m
                </div>
              )}
            </div>
          ) : sessionData.state === 'pending' ? (
            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              GPS tracking will start automatically when you begin the service
            </div>
          ) : (
            <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              GPS tracking not active
            </div>
          )}
        </Card>
      )}

      {/* Session Actions */}
      {sessionData.state === 'pending' && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Start Service</h3>
          <p className="text-sm text-gray-600 mb-4">
            To begin the service, you need to verify the OTP with the customer. 
            Click the button below to generate and send the OTP.
          </p>
          <Button 
            onClick={handleStartService}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Play className="w-4 h-4 mr-2" />
            Start Service (OTP Required)
          </Button>
        </Card>
      )}

      {sessionData.state === 'active' && (
        <Card className="p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Active Session</h3>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-medium text-green-900">Session In Progress</div>
                <div className="text-sm text-green-700">
                  Started at {sessionData.startTime ? new Date(sessionData.startTime).toLocaleTimeString() : ''}
                </div>
              </div>
            </div>

            <Button 
              onClick={handleEndService}
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50"
            >
              <Square className="w-4 h-4 mr-2" />
              End Service (OTP Required)
            </Button>
          </div>
        </Card>
      )}

      {sessionData.state === 'completed' && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Session Completed</h3>
              <p className="text-sm text-green-700">
                Duration: {calculateDuration()} minutes
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* OTP Verification Dialog */}
      <Dialog open={showOtpDialog} onOpenChange={setShowOtpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {otpAction === 'start' ? 'Start Service - OTP Verification' : 'End Service - OTP Verification'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 text-sm text-blue-800">
                  <p className="font-medium mb-1">OTP sent to customer</p>
                  <p>Ask the customer for the 6-digit OTP they received via SMS/App notification.</p>
                  {sessionData.otp && (
                    <p className="mt-2 font-mono text-lg font-bold text-blue-900">
                      OTP: {sessionData.otp}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label>Enter OTP</Label>
              <Input
                type="text"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest mt-1"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowOtpDialog(false);
                setOtpInput('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={verifyOTPAndProceed}
              disabled={verifyingOtp || otpInput.length !== 6}
              className="bg-green-600 hover:bg-green-700"
            >
              {verifyingOtp ? 'Verifying...' : 'Verify & Proceed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
