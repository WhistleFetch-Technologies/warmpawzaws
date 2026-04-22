'use client';

/**
 * HomeServiceTrackingManager — vendor live session UI (universal vendor shell).
 *
 * Walk runtime: Stack A — Home service GPS only (`gps_tracking_sessions` +
 * `POST /vendor/bookings/:id/location-update` → `gps_location_history`).
 * Customer apps read via `GET /tracking/booking/:bookingId`.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Navigation,
  MapPin,
  Clock,
  Play,
  Square,
  CheckCircle2,
  RefreshCw,
  Route,
  Zap,
  Phone,
  MessageCircle,
  Flag,
  Footprints,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/components/ui/utils';
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
  const [lastGpsSyncAt, setLastGpsSyncAt] = useState<string | null>(null);
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
      });
      setLastGpsSyncAt(new Date().toISOString());
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
        otp,
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

  const phaseLabels = bookingData?.isWalkerSession
    ? ['En route', 'Arrived', 'Walking', 'Done']
    : ['En route', 'Arrived', 'In service', 'Done'];

  const focusStep =
    sessionState.status === 'traveling'
      ? 0
      : sessionState.status === 'arrived'
        ? 1
        : sessionState.status === 'in_progress'
          ? 2
          : sessionState.status === 'completed'
            ? 3
            : 0;

  const stepVisual = (i: number): 'done' | 'current' | 'next' | 'upcoming' => {
    if (sessionState.status === 'completed') return 'done';
    if (sessionState.status === 'pending') {
      if (i === 0) return 'next';
      return 'upcoming';
    }
    if (i < focusStep) return 'done';
    if (i === focusStep) return 'current';
    return 'upcoming';
  };

  const primaryBtn =
    'w-full rounded-xl py-6 text-base font-semibold text-white shadow-sm bg-[#FF8C42] hover:bg-[#FF7A2E] disabled:opacity-60';

  if (loading) {
    return (
      <div className="vendor-app-column flex min-h-screen flex-col items-center justify-center bg-[#FFF5F1]">
        <RefreshCw className="h-10 w-10 animate-spin text-[#FF8C42]" aria-hidden />
        <p className="mt-3 text-sm font-medium text-gray-600">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="vendor-root-scroll vendor-app-column flex min-h-screen flex-col bg-[#FFF5F1] overscroll-y-contain">
      {/* Universal vendor hero (matches onboarding-style shell) */}
      <div className="relative shrink-0 px-6 pb-6 pt-8 text-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-6 top-8 rounded-full bg-white/70 p-2 shadow-sm transition-colors hover:bg-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#FF8C42] shadow-lg shadow-orange-200/60">
          {bookingData?.isWalkerSession ? (
            <Footprints className="h-10 w-10 text-white" aria-hidden />
          ) : (
            <MapPin className="h-10 w-10 text-white" aria-hidden />
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {bookingData?.isWalkerSession ? 'Walk session' : 'Home visit'}
        </h1>
        <p className="mt-1 text-sm font-medium text-gray-500">{bookingData?.serviceName}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {bookingData?.petName} · {bookingData?.customerName}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-t-[40px] bg-white px-5 pb-8 pt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
        {/* Phase strip — maps session to Stack A lifecycle */}
        <div className="mb-5 grid grid-cols-4 gap-1.5">
          {phaseLabels.map((label, i) => {
            const v = stepVisual(i);
            return (
              <div
                key={label}
                className={cn(
                  'flex flex-col items-center rounded-xl border px-1 py-2 text-center transition-colors',
                  v === 'done' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  v === 'current' && 'border-[#FF8C42] bg-orange-50 text-gray-900 shadow-sm',
                  v === 'next' && 'border-dashed border-[#FF8C42]/60 bg-white text-gray-800',
                  v === 'upcoming' && 'border-gray-100 bg-gray-50 text-gray-400'
                )}
              >
                <span className="mb-0.5 flex h-5 w-5 items-center justify-center">
                  {v === 'done' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : v === 'current' ? (
                    <span className="h-2 w-2 rounded-full bg-[#FF8C42]" />
                  ) : null}
                </span>
                <span className="text-[10px] font-semibold leading-tight">{label}</span>
              </div>
            );
          })}
        </div>

        {/* GPS + customer-visible live map (Stack A) */}
        <Card className="mb-4 border-orange-100 bg-orange-50/50 p-3 shadow-none">
          <div className="flex items-start gap-2">
            <div
              className={cn(
                'mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full',
                trackingActive ? 'animate-pulse bg-emerald-500' : 'bg-gray-300'
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Live location (customer map)</p>
              <p className="text-xs text-gray-600">
                {trackingActive
                  ? 'GPS on — your position syncs for the pet parent.'
                  : 'GPS off until you start the journey or the walk.'}
              </p>
              {lastGpsSyncAt && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Last sent: {new Date(lastGpsSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  {currentLocation?.accuracy != null
                    ? ` · ±${Math.round(currentLocation.accuracy)}m`
                    : ''}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="mb-4 border-gray-100 p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900">{bookingData?.customerName}</h3>
              <p className="text-sm text-gray-500">Pet: {bookingData?.petName}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={`tel:${bookingData?.customerPhone}`}
                className="rounded-full border border-[#FF8C42]/30 bg-orange-50 p-2 text-[#FF8C42] transition-colors hover:bg-orange-100"
                aria-label="Call customer"
              >
                <Phone className="h-5 w-5" />
              </a>
              <button
                type="button"
                className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 hover:border-[#FF8C42]/40 hover:text-[#FF8C42]"
                aria-label="Message (coming soon)"
              >
                <MessageCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>{bookingData?.address}</span>
          </div>
        </Card>

        {sessionState.status === 'traveling' && sessionState.currentEta !== null && (
          <Card className="mb-4 border-blue-100 bg-blue-50/80 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Navigation className="h-6 w-6 animate-pulse text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-900">{sessionState.currentEta} min</p>
                  <p className="text-sm text-blue-800">ETA to customer</p>
                </div>
              </div>
              {sessionState.distanceToDestination !== null && (
                <div className="text-right">
                  <p className="text-lg font-semibold text-blue-900">
                    {sessionState.distanceToDestination.toFixed(1)} km
                  </p>
                  <p className="text-xs text-blue-700">remaining</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {sessionState.status === 'in_progress' && (
          <Card className="mb-4 border-gray-100 p-4 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
              <Zap className="h-5 w-5 text-[#FF8C42]" />
              Session stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-orange-50/80 p-3 text-center">
                <Clock className="mx-auto mb-1 h-6 w-6 text-[#FF8C42]" />
                <p className="text-xl font-bold text-gray-900">{formatDuration(sessionDuration)}</p>
                <p className="text-xs font-medium text-gray-600">Duration</p>
              </div>
              {bookingData?.isWalkerSession && (
                <div className="rounded-xl bg-sky-50 p-3 text-center">
                  <Route className="mx-auto mb-1 h-6 w-6 text-sky-600" />
                  <p className="text-xl font-bold text-gray-900">{formatDistance(sessionState.totalDistance)}</p>
                  <p className="text-xs font-medium text-sky-800">Distance (device)</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {bookingData?.isWalkerSession && sessionState.routePoints.length > 0 && (
          <Card className="mb-4 border-gray-100 p-4 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
              <Route className="h-5 w-5 text-[#FF8C42]" />
              Walk route (preview)
            </h3>
            <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-sky-50">
              <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 100 100" aria-hidden>
                <path
                  d={`M ${sessionState.routePoints
                    .map((p) => `${((p.longitude % 1) * 100 + 50) % 100},${((p.latitude % 1) * 100 + 50) % 100}`)
                    .join(' L ')}`}
                  stroke="#ea580c"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              <div className="relative z-10 text-center px-2">
                <p className="text-sm font-medium text-gray-700">Recording locally</p>
                <p className="text-xs text-gray-500">
                  Customer live map uses GPS session history on the server.
                </p>
                <p className="mt-1 text-xs font-semibold text-[#FF8C42]">
                  {sessionState.routePoints.length} points
                </p>
              </div>
            </div>
          </Card>
        )}

        {sessionState.status === 'completed' && (
          <Card className="mb-4 border-emerald-100 bg-emerald-50/60 p-4 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-emerald-600" />
            <h3 className="text-lg font-bold text-emerald-900">Completed</h3>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">Duration</p>
                <p className="font-semibold text-gray-900">{formatDuration(sessionDuration)}</p>
              </div>
              {bookingData?.isWalkerSession && (
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="text-xs text-gray-500">Distance</p>
                  <p className="font-semibold text-gray-900">{formatDistance(sessionState.totalDistance)}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="mt-auto space-y-3 pt-2">
          {sessionState.status === 'pending' && (
            <Button onClick={handleStartTravel} disabled={processing} className={primaryBtn}>
              {processing ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Navigation className="mr-2 h-5 w-5" />}
              Start journey to customer
            </Button>
          )}

          {sessionState.status === 'traveling' && (
            <Button
              onClick={handleArrived}
              disabled={processing}
              className="w-full rounded-xl bg-amber-500 py-6 text-base font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
            >
              {processing ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Flag className="mr-2 h-5 w-5" />}
              I&apos;ve arrived
            </Button>
          )}

          {sessionState.status === 'arrived' && (
            <Button onClick={handleStartSession} disabled={processing} className={primaryBtn}>
              {processing ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
              {bookingData?.isWalkerSession || bookingData?.isSitterSession
                ? 'Start session (OTP)'
                : 'Start service'}
            </Button>
          )}

          {sessionState.status === 'in_progress' && (
            <Button
              onClick={handleEndSession}
              disabled={processing}
              className="w-full rounded-xl bg-rose-600 py-6 text-base font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
            >
              {processing ? <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> : <Square className="mr-2 h-5 w-5" />}
              {bookingData?.isWalkerSession || bookingData?.isSitterSession ? 'End session (OTP)' : 'Complete service'}
            </Button>
          )}

          {sessionState.status === 'completed' && (
            <Button
              onClick={() =>
                onComplete({
                  bookingId,
                  status: 'completed',
                  duration: sessionDuration,
                  distance: sessionState.totalDistance,
                })
              }
              className={primaryBtn}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Back to bookings
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showOtpModal} onOpenChange={(open) => !processing && setShowOtpModal(open)}>
        <DialogContent className="max-w-sm rounded-2xl border-gray-100">
          <DialogHeader>
            <DialogTitle>{otpType === 'start' ? 'Start session' : 'End session'}</DialogTitle>
            <DialogDescription>
              Enter the OTP from {bookingData?.customerName}.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="4–6 digit OTP"
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-2xl tracking-widest"
            maxLength={6}
            autoComplete="one-time-code"
          />
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="flex-1 rounded-xl" disabled={processing} onClick={() => setShowOtpModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl bg-[#FF8C42] hover:bg-[#FF7A2E]"
              disabled={(otpInput.length !== 4 && otpInput.length !== 6) || processing}
              onClick={() => {
                const len = otpInput.length;
                if (len === 4 || len === 6) {
                  if (otpType === 'start') confirmStartSession(otpInput);
                  else confirmEndSession(otpInput);
                } else toast.error('Enter a valid 4 or 6-digit OTP');
              }}
            >
              {processing ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HomeServiceTrackingManager;
