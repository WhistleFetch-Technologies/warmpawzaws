'use client';

/**
 * HomeServiceTrackingManager - Vendor GPS Tracking for Home Services
 * 
 * Features:
 * - Real-time GPS tracking during home service visits
 * - Route recording for walker/sitter sessions
 * - ETA updates for customers
 * - Start/End session with OTP verification
 * - Distance calculation and route map
 * - Session duration tracking
 * - Automatic location updates
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Navigation, MapPin, Clock, Play, Pause, Square, 
  CheckCircle2, AlertTriangle, RefreshCw, Route, Zap, Phone,
  MessageCircle, Camera, Flag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface HomeServiceTrackingManagerProps {
  vendorId: string;
  bookingId: string;
  bookingData?: {
    customerName: string;
    customerPhone: string;
    petName: string;
    serviceName: string;
    serviceType: string; // 'walking' | 'sitting' | 'grooming' | 'veterinary' | 'training'
    address: string;
    latitude?: number;
    longitude?: number;
    scheduledTime: string;
    isWalkerSession: boolean; // Requires route tracking
    isSitterSession: boolean; // Requires start/end OTP
    packageSessionId?: string;
  };
  onBack: () => void;
  onComplete: (result: any) => void;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
}

interface SessionState {
  status: 'pending' | 'traveling' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  startedAt: string | null;
  arrivedAt: string | null;
  sessionStartedAt: string | null; // When actual service started (after start OTP)
  completedAt: string | null;
  
  // Route tracking (for walkers)
  routePoints: LocationPoint[];
  totalDistance: number; // in meters
  
  // ETA
  currentEta: number | null; // minutes
  distanceToDestination: number | null; // in km
}

type TrackingStatus = 'idle' | 'traveling' | 'arrived' | 'session_active' | 'completed';

export function HomeServiceTrackingManager({
  vendorId,
  bookingId,
  bookingData,
  onBack,
  onComplete
}: HomeServiceTrackingManagerProps) {
  // Location tracking
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestLocationRef = useRef<LocationPoint | null>(null);
  const lastLocationUpdateSentRef = useRef<number>(0);
  // ✅ FIX: Reduced throttle to 5s for better real-time tracking updates
  const GPS_THROTTLE_MS = 5000; // Min 5s between server updates (backend recalculates ETA/distance)
  
  // Session state
  const [sessionState, setSessionState] = useState<SessionState>({
    status: 'pending',
    startedAt: null,
    arrivedAt: null,
    sessionStartedAt: null,
    completedAt: null,
    routePoints: [],
    totalDistance: 0,
    currentEta: null,
    distanceToDestination: null
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpType, setOtpType] = useState<'start' | 'end'>('start');
  const [otpInput, setOtpInput] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  
  // Duration timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (sessionState.sessionStartedAt && sessionState.status === 'in_progress') {
      timer = setInterval(() => {
        const start = new Date(sessionState.sessionStartedAt!).getTime();
        const now = Date.now();
        setSessionDuration(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [sessionState.sessionStartedAt, sessionState.status]);

  // Load existing session data
  useEffect(() => {
    loadSessionData();
  }, [bookingId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/bookings/${bookingId}/tracking-session`);
      
      if (response.success && response.session) {
        setSessionState(prev => ({
          ...prev,
          ...response.session,
          routePoints: response.session.routePoints || []
        }));
        
        // If session was in progress, resume tracking
        if (response.session.status === 'traveling' || response.session.status === 'in_progress') {
          startLocationTracking();
        }
      }
    } catch (error) {
      console.log('No existing session, starting fresh');
    } finally {
      setLoading(false);
    }
  };

  // Start GPS tracking
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('GPS not supported on this device');
      return;
    }

    setTrackingActive(true);

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation: LocationPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: position.coords.accuracy
        };
        
        setCurrentLocation(newLocation);
        latestLocationRef.current = newLocation;

        // Add to route if session is active (for walkers)
        if (sessionState.status === 'in_progress' && bookingData?.isWalkerSession) {
          setSessionState(prev => {
            const newPoints = [...prev.routePoints, newLocation];
            const newDistance = calculateTotalDistance(newPoints);
            return {
              ...prev,
              routePoints: newPoints,
              totalDistance: newDistance
            };
          });
        }
        
        // Calculate ETA if traveling
        if (sessionState.status === 'traveling' && bookingData?.latitude && bookingData?.longitude) {
          const distance = calculateDistance(
            newLocation.latitude,
            newLocation.longitude,
            bookingData.latitude,
            bookingData.longitude
          );
          const etaMinutes = Math.ceil(distance / 0.5); // Assume 30 km/h average speed
          
          setSessionState(prev => ({
            ...prev,
            distanceToDestination: distance,
            currentEta: etaMinutes
          }));
        }
      },
      (error) => {
        console.error('GPS error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission required for tracking');
          setTrackingActive(false);
        } else if (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT) {
          toast.error('Location unavailable. Check signal or try again.');
        }
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 5000, 
        timeout: 10000 
      }
    );

    // ✅ FIX: Send location updates every 10s (was 45s) for better real-time tracking
    // Backend will recalculate ETA/distance using Google Maps API
    trackingIntervalRef.current = setInterval(() => {
      const latest = latestLocationRef.current;
      if (latest) sendLocationUpdate(latest);
    }, 10000); // 10 seconds for better real-time updates
  }, [bookingData, sessionState.status]);

  // Stop GPS tracking
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    setTrackingActive(false);
  }, []);

  // ✅ FIX: Send location update to server (throttled: min 5s between sends)
  // Backend will recalculate ETA/distance using Google Maps API, so we don't need to send those
  const sendLocationUpdate = async (location?: LocationPoint | null) => {
    const loc = location ?? latestLocationRef.current ?? currentLocation;
    if (!loc) return;
    const now = Date.now();
    // ✅ FIX: Throttle to prevent too frequent updates
    if (now - lastLocationUpdateSentRef.current < GPS_THROTTLE_MS) return;
    lastLocationUpdateSentRef.current = now;

    try {
      // ✅ FIX: Only send location data - backend will recalculate ETA/distance
      await apiClient.post(`/vendor/bookings/${bookingId}/location-update`, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        // Note: Backend recalculates ETA/distance, so we don't send those
      });
    } catch (error: any) {
      console.error('Failed to send location update:', error);
      lastLocationUpdateSentRef.current = 0; // Allow retry sooner on failure
      const isNetwork = error?.message?.includes('fetch') || error?.code === 'ERR_NETWORK';
      if (isNetwork) {
        toast.error('Connection issue. Location update will retry when back online.');
      }
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 100) / 100;
  };

  // Calculate total distance from route points
  const calculateTotalDistance = (points: LocationPoint[]): number => {
    if (points.length < 2) return 0;
    
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += calculateDistance(
        points[i-1].latitude,
        points[i-1].longitude,
        points[i].latitude,
        points[i].longitude
      );
    }
    return Math.round(total * 1000); // Return in meters
  };

  // Start traveling
  const handleStartTravel = async () => {
    setProcessing(true);
    try {
      startLocationTracking();
      
      await apiClient.post(`/vendor/bookings/${bookingId}/start-travel`, {
        vendorId,
        startLocation: currentLocation
      });
      
      setSessionState(prev => ({
        ...prev,
        status: 'traveling',
        startedAt: new Date().toISOString()
      }));
      
      toast.success('Started! Customer will see your live location.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start');
      stopLocationTracking();
    } finally {
      setProcessing(false);
    }
  };

  // Mark as arrived
  const handleArrived = async () => {
    setProcessing(true);
    try {
      await apiClient.post(`/vendor/bookings/${bookingId}/mark-arrived`, {
        vendorId,
        arrivedAt: new Date().toISOString(),
        location: currentLocation
      });
      
      setSessionState(prev => ({
        ...prev,
        status: 'arrived',
        arrivedAt: new Date().toISOString()
      }));
      
      toast.success('Marked as arrived! Please verify with customer.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark arrived');
    } finally {
      setProcessing(false);
    }
  };

  // Start session (with OTP for walker/sitter)
  const handleStartSession = () => {
    if (bookingData?.isWalkerSession || bookingData?.isSitterSession) {
      setOtpType('start');
      setOtpInput('');
      setShowOtpModal(true);
    } else {
      confirmStartSession();
    }
  };

  const confirmStartSession = async (otp?: string) => {
    setProcessing(true);
    try {
      const response = await apiClient.post<any>(`/vendor/bookings/${bookingId}/start-session`, {
        vendorId,
        startOtp: otp,
        startedAt: new Date().toISOString(),
        location: currentLocation
      });

      if (response.success) {
        setSessionState(prev => ({
          ...prev,
          status: 'in_progress',
          sessionStartedAt: new Date().toISOString(),
          routePoints: bookingData?.isWalkerSession ? [currentLocation!] : []
        }));
        
        setShowOtpModal(false);
        toast.success('Session started!');
        
        // Start route tracking for walkers
        if (bookingData?.isWalkerSession) {
          startLocationTracking();
        }
      } else {
        throw new Error(response.error || 'Invalid OTP');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start session');
    } finally {
      setProcessing(false);
    }
  };

  // End session (with OTP)
  const handleEndSession = () => {
    if (bookingData?.isWalkerSession || bookingData?.isSitterSession) {
      setOtpType('end');
      setOtpInput('');
      setShowOtpModal(true);
    } else {
      confirmEndSession();
    }
  };

  const confirmEndSession = async (otp?: string) => {
    setProcessing(true);
    try {
      stopLocationTracking();
      
      const response = await apiClient.post<any>(`/vendor/bookings/${bookingId}/complete`, {
        vendorId,
        otp: otp || null,
        notes: bookingData?.isWalkerSession
          ? `Route: ${sessionState.totalDistance}m, ${sessionDuration}min`
          : undefined,
      });

      if (response.success) {
        setSessionState(prev => ({
          ...prev,
          status: 'completed',
          completedAt: new Date().toISOString()
        }));
        
        setShowOtpModal(false);
        toast.success('Service completed successfully!');
        
        // Notify parent with results
        onComplete({
          bookingId,
          status: 'completed',
          duration: sessionDuration,
          distance: sessionState.totalDistance,
          routePoints: sessionState.routePoints
        });
      } else {
        throw new Error(response.error || 'Failed to complete');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to complete session');
      // Resume tracking if failed
      if (sessionState.status === 'in_progress' && bookingData?.isWalkerSession) {
        startLocationTracking();
      }
    } finally {
      setProcessing(false);
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  };

  // Get status color and label
  const getStatusInfo = () => {
    switch (sessionState.status) {
      case 'pending':
        return { color: 'bg-gray-100 text-gray-700', label: 'Pending Start', icon: Clock };
      case 'traveling':
        return { color: 'bg-blue-100 text-blue-700', label: 'On the Way', icon: Navigation };
      case 'arrived':
        return { color: 'bg-amber-100 text-amber-700', label: 'Arrived', icon: MapPin };
      case 'in_progress':
        return { color: 'bg-green-100 text-green-700', label: 'In Progress', icon: Play };
      case 'completed':
        return { color: 'bg-purple-100 text-purple-700', label: 'Completed', icon: CheckCircle2 };
      default:
        return { color: 'bg-gray-100 text-gray-700', label: 'Unknown', icon: AlertTriangle };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-green-600 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Home Service</h1>
            <p className="text-sm text-white/80">{bookingData?.serviceName}</p>
          </div>
          <Badge className={statusInfo.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </div>

        {/* Live Tracking Indicator */}
        {trackingActive && (
          <div className="mt-3 flex items-center gap-2 bg-white/20 backdrop-blur rounded-lg px-3 py-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm">Live tracking active</span>
            {currentLocation && (
              <span className="text-xs text-white/70 ml-auto">
                Accuracy: {currentLocation.accuracy?.toFixed(0)}m
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Customer Info Card */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">{bookingData?.customerName}</h3>
              <p className="text-sm text-gray-500">Pet: {bookingData?.petName}</p>
            </div>
            <div className="flex gap-2">
              <a 
                href={`tel:${bookingData?.customerPhone}`}
                className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200"
              >
                <Phone className="w-5 h-5" />
              </a>
              <button className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200">
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <span>{bookingData?.address}</span>
          </div>
        </Card>

        {/* ETA Card - Show when traveling */}
        {sessionState.status === 'traveling' && sessionState.currentEta !== null && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-900">{sessionState.currentEta} min</p>
                  <p className="text-sm text-blue-700">Estimated arrival</p>
                </div>
              </div>
              {sessionState.distanceToDestination !== null && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-blue-900">
                    {sessionState.distanceToDestination.toFixed(1)} km
                  </p>
                  <p className="text-xs text-blue-600">away</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Session Stats - Show during active session */}
        {sessionState.status === 'in_progress' && (
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              Session Stats
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <Clock className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-xl font-bold text-green-900">{formatDuration(sessionDuration)}</p>
                <p className="text-xs text-green-700">Duration</p>
              </div>
              
              {bookingData?.isWalkerSession && (
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <Route className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl font-bold text-blue-900">{formatDistance(sessionState.totalDistance)}</p>
                  <p className="text-xs text-blue-700">Distance</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Route Map Placeholder - Show for walkers */}
        {bookingData?.isWalkerSession && sessionState.routePoints.length > 0 && (
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Route className="w-5 h-5 text-purple-600" />
              Walk Route
            </h3>
            
            {/* Map placeholder - In production, integrate Google Maps */}
            <div className="h-48 bg-gradient-to-br from-green-100 to-blue-100 rounded-xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                {/* Simplified route visualization */}
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <path
                    d={`M ${sessionState.routePoints.map((p, i) => 
                      `${((p.longitude % 1) * 100 + 50) % 100},${((p.latitude % 1) * 100 + 50) % 100}`
                    ).join(' L ')}`}
                    stroke="#22c55e"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
              <div className="text-center z-10">
                <p className="text-gray-600 font-medium">Route Tracking Active</p>
                <p className="text-sm text-gray-500">{sessionState.routePoints.length} points recorded</p>
              </div>
            </div>
          </Card>
        )}

        {/* Completion Summary - Show when completed */}
        {sessionState.status === 'completed' && (
          <Card className="p-4 bg-green-50 border-green-200">
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-green-900 mb-2">Service Completed!</h3>
              
              <div className="grid grid-cols-2 gap-4 mt-4 text-left">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-semibold">{formatDuration(sessionDuration)}</p>
                </div>
                {bookingData?.isWalkerSession && (
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm text-gray-500">Distance</p>
                    <p className="font-semibold">{formatDistance(sessionState.totalDistance)}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pb-6">
          {sessionState.status === 'pending' && (
            <Button
              onClick={handleStartTravel}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 py-6"
            >
              {processing ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5 mr-2" />
              )}
              Start Journey to Customer
            </Button>
          )}

          {sessionState.status === 'traveling' && (
            <Button
              onClick={handleArrived}
              disabled={processing}
              className="w-full bg-amber-500 hover:bg-amber-600 py-6"
            >
              {processing ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Flag className="w-5 h-5 mr-2" />
              )}
              I've Arrived
            </Button>
          )}

          {sessionState.status === 'arrived' && (
            <Button
              onClick={handleStartSession}
              disabled={processing}
              className="w-full bg-green-600 hover:bg-green-700 py-6"
            >
              {processing ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Play className="w-5 h-5 mr-2" />
              )}
              {bookingData?.isWalkerSession || bookingData?.isSitterSession 
                ? 'Start Session (OTP Required)'
                : 'Start Service'}
            </Button>
          )}

          {sessionState.status === 'in_progress' && (
            <Button
              onClick={handleEndSession}
              disabled={processing}
              className="w-full bg-red-500 hover:bg-red-600 py-6"
            >
              {processing ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Square className="w-5 h-5 mr-2" />
              )}
              {bookingData?.isWalkerSession || bookingData?.isSitterSession 
                ? 'End Session (OTP Required)'
                : 'Complete Service'}
            </Button>
          )}

          {sessionState.status === 'completed' && (
            <Button
              onClick={() => onComplete({
                bookingId,
                status: 'completed',
                duration: sessionDuration,
                distance: sessionState.totalDistance
              })}
              className="w-full bg-purple-600 hover:bg-purple-700 py-6"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Back to Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* OTP Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {otpType === 'start' ? 'Start Session' : 'End Session'}
            </h2>
            <p className="text-gray-600 mb-6">
              Enter the OTP provided by {bookingData?.customerName}
            </p>
            
            <Input
              type="text"
              placeholder="Enter 6-digit OTP"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-2xl tracking-widest mb-4"
              maxLength={6}
            />
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowOtpModal(false)}
                className="flex-1"
                disabled={processing}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (otpInput.length === 6) {
                    if (otpType === 'start') {
                      confirmStartSession(otpInput);
                    } else {
                      confirmEndSession(otpInput);
                    }
                  } else {
                    toast.error('Please enter a valid 6-digit OTP');
                  }
                }}
                disabled={otpInput.length !== 4 || processing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomeServiceTrackingManager;
