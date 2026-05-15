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
  Loader2,
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
    /** Booking row status — used after refresh when GPS row is still `arrived` but OTP already verified */
    bookingStatus?: string;
    /** Walk package duration (e.g. 30 / 60) — countdown timer starts here and counts down to 00:00 */
    plannedWalkDurationMinutes?: number;
    /** Booking-level walk clock anchor when GPS row has not persisted session_started_at yet */
    sessionStartedAt?: string | null;
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

/** One-shot GPS read — use before start-travel; watchPosition does not run synchronously. */
function getCurrentGeoPosition(): Promise<LocationPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GPS not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        const code = (err as GeolocationPositionError)?.code;
        if (code === 1) reject(new Error('Location permission denied. Allow location to start the journey.'));
        else if (code === 2) reject(new Error('Location unavailable. Try again in an open area.'));
        else if (code === 3) reject(new Error('Location request timed out. Try again.'));
        else reject(new Error(err?.message || 'Could not read your location'));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  });
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
  /** watchPosition callbacks close over stale state — always read latest phase here */
  const sessionStatusRef = useRef<SessionState['status']>('pending');
  const isWalkerSessionRef = useRef(!!bookingData?.isWalkerSession);
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

  /** Customer pin for en-route map + ETA when booking lat/lng missing (geocode address once). */
  const [resolvedCustomerDest, setResolvedCustomerDest] = useState<{ lat: number; lng: number } | null>(null);
  const resolvedCustomerDestRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    resolvedCustomerDestRef.current = resolvedCustomerDest;
  }, [resolvedCustomerDest]);

  const journeyMapContainerRef = useRef<HTMLDivElement>(null);
  const journeyMapInstanceRef = useRef<any>(null);
  const journeyPolylineRef = useRef<any>(null);
  const journeyVendorMarkerRef = useRef<any>(null);
  const journeyHomeMarkerRef = useRef<any>(null);
  const journeyMapStyleIdRef = useRef<string | null>(null);
  const [journeyMapLoading, setJourneyMapLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!bookingData) return;
      const lat = Number(bookingData.latitude);
      const lng = Number(bookingData.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        if (!cancelled) setResolvedCustomerDest({ lat, lng });
        return;
      }
      const addr = (bookingData.address || '').trim();
      if (!addr) {
        if (!cancelled) setResolvedCustomerDest(null);
        return;
      }
      try {
        const keyRes = (await apiClient.get<any>('/config/google-maps-key').catch(() => null)) as any;
        const key = keyRes?.apiKey || keyRes?.key;
        if (!key || cancelled) return;
        if (keyRes?.mapId) journeyMapStyleIdRef.current = keyRes.mapId;
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addr)}&key=${encodeURIComponent(key)}`;
        const geo = await fetch(geoUrl).then((r) => r.json());
        if (cancelled) return;
        const loc = geo?.results?.[0]?.geometry?.location;
        if (loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))) {
          setResolvedCustomerDest({ lat: Number(loc.lat), lng: Number(loc.lng) });
        } else {
          setResolvedCustomerDest(null);
        }
      } catch {
        if (!cancelled) setResolvedCustomerDest(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [bookingData?.latitude, bookingData?.longitude, bookingData?.address]);

  useEffect(() => {
    sessionStatusRef.current = sessionState.status;
  }, [sessionState.status]);

  useEffect(() => {
    isWalkerSessionRef.current = !!bookingData?.isWalkerSession;
  }, [bookingData?.isWalkerSession]);

  // Walk: countdown (planned minutes → 00:00). Other in-service: elapsed time up.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const clockAnchor =
      sessionState.sessionStartedAt || (bookingData?.sessionStartedAt ?? null) || null;
    if (!clockAnchor || sessionState.status !== 'in_progress') {
      return () => {
        if (timer) clearInterval(timer);
      };
    }
    const startedMs = new Date(clockAnchor).getTime();
    const plannedSec = (bookingData?.plannedWalkDurationMinutes ?? 30) * 60;
    const walker = !!bookingData?.isWalkerSession;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedMs) / 1000);
      if (walker) {
        setSessionDuration(Math.max(0, plannedSec - elapsed));
      } else {
        setSessionDuration(elapsed);
      }
    };
    tick();
    timer = setInterval(tick, 1000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [
    sessionState.sessionStartedAt,
    sessionState.status,
    bookingData?.sessionStartedAt,
    bookingData?.isWalkerSession,
    bookingData?.plannedWalkDurationMinutes,
  ]);

  // Load existing session data (re-run when booking lifecycle catches up after refresh)
  useEffect(() => {
    loadSessionData();
  }, [
    bookingId,
    bookingData?.bookingStatus,
    bookingData?.isWalkerSession,
    bookingData?.isSitterSession,
    bookingData?.plannedWalkDurationMinutes,
    bookingData?.sessionStartedAt,
  ]);

  // Cleanup on unmount (GPS only — map teardown runs after map helpers below)
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
        const rawStatus = response.session.status as string;
        let normalizedStatus =
          rawStatus === 'is_traveling' || rawStatus === 'in_transit' ? 'traveling' : rawStatus;

        const bookingSt = String(bookingData?.bookingStatus || '').toLowerCase();
        const bookingWalkClock =
          (bookingData as { sessionStartedAt?: string | null; session_started_at?: string | null } | undefined)
            ?.sessionStartedAt ||
          (bookingData as { session_started_at?: string | null } | undefined)?.session_started_at ||
          null;

        let sessionStartedAt =
          response.session.sessionStartedAt || response.session.session_started_at || bookingWalkClock || null;

        if (
          bookingSt === 'in_progress' &&
          (bookingData?.isWalkerSession || bookingData?.isSitterSession) &&
          (normalizedStatus === 'arrived' || normalizedStatus === 'traveling')
        ) {
          normalizedStatus = 'in_progress';
          // Never use "now" here — it resets the countdown on every refresh. Use GPS or booking anchor only.
          sessionStartedAt = sessionStartedAt || bookingWalkClock || null;
        }

        const serverTotalM = Number(response.session.totalDistance ?? response.session.total_distance ?? 0) || 0;
        const routePts = (response.session.routePoints || []) as LocationPoint[];

        setSessionState(prev => ({
          ...prev,
          ...response.session,
          status: normalizedStatus as SessionState['status'],
          sessionStartedAt: sessionStartedAt ?? prev.sessionStartedAt,
          routePoints: routePts,
          totalDistance: serverTotalM,
        }));

        sessionStatusRef.current = normalizedStatus as SessionState['status'];

        const sessStarted =
          sessionStartedAt ||
          (response.session.sessionStartedAt as string | undefined) ||
          (response.session.session_started_at as string | undefined);
        const plannedMin =
          bookingData?.plannedWalkDurationMinutes ??
          (typeof response.session?.plannedWalkDurationMinutes === 'number'
            ? response.session.plannedWalkDurationMinutes
            : undefined) ??
          30;
        const plannedSec = plannedMin * 60;
        if (normalizedStatus === 'in_progress' && bookingData?.isWalkerSession) {
          if (typeof response.session.remainingWalkSeconds === 'number') {
            setSessionDuration(Math.max(0, response.session.remainingWalkSeconds));
          } else if (sessStarted) {
            const startedMs = new Date(sessStarted).getTime();
            const elapsed = Math.floor((Date.now() - startedMs) / 1000);
            setSessionDuration(Math.max(0, plannedSec - elapsed));
          } else {
            setSessionDuration(plannedSec);
          }
        } else if (normalizedStatus === 'in_progress' && sessStarted && !bookingData?.isWalkerSession) {
          const startedMs = new Date(sessStarted).getTime();
          setSessionDuration(Math.floor((Date.now() - startedMs) / 1000));
        }

        if (normalizedStatus === 'traveling' || normalizedStatus === 'in_progress') {
          startLocationTracking();
        }
      } else if (
        String(bookingData?.bookingStatus || '').toLowerCase() === 'in_progress' &&
        (bookingData?.isWalkerSession || bookingData?.isSitterSession)
      ) {
        sessionStatusRef.current = 'in_progress';
        const anchor =
          (bookingData as { sessionStartedAt?: string | null; session_started_at?: string | null } | undefined)
            ?.sessionStartedAt ||
          (bookingData as { session_started_at?: string | null } | undefined)?.session_started_at ||
          null;
        setSessionState(prev => ({
          ...prev,
          status: 'in_progress',
          sessionStartedAt: anchor || prev.sessionStartedAt,
        }));
        const plannedSec = (bookingData?.plannedWalkDurationMinutes ?? 30) * 60;
        if (bookingData?.isWalkerSession && anchor) {
          const elapsed = Math.floor((Date.now() - new Date(anchor).getTime()) / 1000);
          setSessionDuration(Math.max(0, plannedSec - elapsed));
        } else if (bookingData?.isWalkerSession) {
          setSessionDuration(plannedSec);
        } else {
          setSessionDuration(0);
        }
        if (bookingData?.isWalkerSession) {
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

    // Avoid duplicate watchPosition / intervals if start is called again (e.g. walker after OTP)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
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

        // Add to route if session is active (for walkers) — use refs (geolocation callback is stale otherwise)
        if (sessionStatusRef.current === 'in_progress' && isWalkerSessionRef.current) {
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
        
        // Calculate ETA if traveling (use geocoded customer pin when booking has no lat/lng)
        if (sessionStatusRef.current === 'traveling') {
          const dest = resolvedCustomerDestRef.current;
          if (dest) {
            const distance = calculateDistance(
              newLocation.latitude,
              newLocation.longitude,
              dest.lat,
              dest.lng
            );
            const etaMinutes = Math.ceil(distance / 0.5); // ~30 km/h heuristic
            setSessionState((prev) => ({
              ...prev,
              distanceToDestination: distance,
              currentEta: etaMinutes,
            }));
          }
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

  const loadGoogleMapsForJourney = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).google?.maps) {
        resolve();
        return;
      }
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const iv = window.setInterval(() => {
          if ((window as any).google?.maps) {
            window.clearInterval(iv);
            resolve();
          }
        }, 100);
        window.setTimeout(() => {
          window.clearInterval(iv);
          if ((window as any).google?.maps) resolve();
          else reject(new Error('Google Maps load timeout'));
        }, 15000);
        return;
      }
      void (async () => {
        try {
          const r = (await apiClient.get<any>('/config/google-maps-key').catch(() => null)) as any;
          const key = r?.apiKey || r?.key;
          if (r?.mapId) journeyMapStyleIdRef.current = r.mapId;
          if (!key) {
            reject(new Error('Google Maps API key not configured'));
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geometry`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Maps'));
          document.head.appendChild(script);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      })();
    });
  }, []);

  const teardownJourneyMap = useCallback(() => {
    try {
      if (journeyPolylineRef.current) {
        journeyPolylineRef.current.setMap(null);
        journeyPolylineRef.current = null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (journeyVendorMarkerRef.current) {
        journeyVendorMarkerRef.current.setMap(null);
        journeyVendorMarkerRef.current = null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (journeyHomeMarkerRef.current) {
        journeyHomeMarkerRef.current.setMap(null);
        journeyHomeMarkerRef.current = null;
      }
    } catch {
      /* ignore */
    }
    journeyMapInstanceRef.current = null;
  }, []);

  const buildOrRefreshJourneyMap = useCallback(async () => {
    if (sessionStatusRef.current !== 'traveling') return;
    if (!journeyMapContainerRef.current) return;
    const dest = resolvedCustomerDestRef.current;
    const vendor = latestLocationRef.current;
    if (!dest || !vendor) return;

    setJourneyMapLoading(true);
    try {
      await loadGoogleMapsForJourney();
      const g = (window as any).google;
      if (!g?.maps || !journeyMapContainerRef.current) return;

      const destLL = new g.maps.LatLng(dest.lat, dest.lng);
      const venLL = new g.maps.LatLng(vendor.latitude, vendor.longitude);

      if (!journeyMapInstanceRef.current) {
        const mapId = journeyMapStyleIdRef.current || undefined;
        const opts: Record<string, unknown> = {
          center: { lat: (dest.lat + vendor.latitude) / 2, lng: (dest.lng + vendor.longitude) / 2 },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        };
        if (mapId) opts.mapId = mapId;
        journeyMapInstanceRef.current = new g.maps.Map(journeyMapContainerRef.current, opts as any);
      }

      const map = journeyMapInstanceRef.current;
      if (!journeyVendorMarkerRef.current) {
        journeyVendorMarkerRef.current = new g.maps.Marker({
          map,
          position: venLL,
          title: 'You',
        });
      } else {
        journeyVendorMarkerRef.current.setPosition(venLL);
      }

      if (!journeyHomeMarkerRef.current) {
        journeyHomeMarkerRef.current = new g.maps.Marker({
          map,
          position: destLL,
          title: 'Customer',
        });
      } else {
        journeyHomeMarkerRef.current.setPosition(destLL);
      }

      if (journeyPolylineRef.current) {
        journeyPolylineRef.current.setMap(null);
      }
      journeyPolylineRef.current = new g.maps.Polyline({
        path: [venLL, destLL],
        geodesic: true,
        strokeColor: '#FF8C42',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });

      const bounds = new g.maps.LatLngBounds();
      bounds.extend(venLL);
      bounds.extend(destLL);
      map.fitBounds(bounds, { top: 40, right: 24, bottom: 40, left: 24 });
    } catch (e) {
      console.warn('[HomeServiceTracking] journey map:', e);
    } finally {
      setJourneyMapLoading(false);
    }
  }, [loadGoogleMapsForJourney]);

  useEffect(() => {
    if (sessionState.status !== 'traveling') {
      teardownJourneyMap();
      return;
    }
    const id = window.setTimeout(() => {
      void buildOrRefreshJourneyMap();
    }, 200);
    return () => window.clearTimeout(id);
  }, [sessionState.status, currentLocation, resolvedCustomerDest, buildOrRefreshJourneyMap, teardownJourneyMap]);

  useEffect(() => {
    return () => {
      teardownJourneyMap();
    };
  }, [teardownJourneyMap]);

  // Start traveling
  const handleStartTravel = async () => {
    setProcessing(true);
    try {
      const startLoc = await getCurrentGeoPosition();
      setCurrentLocation(startLoc);
      latestLocationRef.current = startLoc;

      await apiClient.post(`/vendor/bookings/${bookingId}/start-travel`, {
        vendorId,
        startLocation: { latitude: startLoc.latitude, longitude: startLoc.longitude },
      });

      sessionStatusRef.current = 'traveling';
      startLocationTracking();

      setSessionState(prev => ({
        ...prev,
        status: 'traveling',
        startedAt: new Date().toISOString(),
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
      let loc = latestLocationRef.current ?? currentLocation;
      if (!loc) {
        loc = await getCurrentGeoPosition();
        setCurrentLocation(loc);
        latestLocationRef.current = loc;
      }

      await apiClient.post(`/vendor/bookings/${bookingId}/mark-arrived`, {
        vendorId,
        arrivedAt: new Date().toISOString(),
        location: { latitude: loc.latitude, longitude: loc.longitude },
      });
      
      sessionStatusRef.current = 'arrived';
      setSessionState(prev => ({
        ...prev,
        status: 'arrived',
        arrivedAt: new Date().toISOString()
      }));

      // Journey live GPS ends here; backend only accepts location-update while in_transit/started/active.
      // Walkers get watch restarted when they confirm start-session (OTP).
      stopLocationTracking();

      toast.success('Marked as arrived! Please verify with customer.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark arrived');
    } finally {
      setProcessing(false);
    }
  };

  // Start session — OTP required (4 or 6 digits) for API validation and customer verification
  const handleStartSession = () => {
    setOtpType('start');
    setOtpInput('');
    setShowOtpModal(true);
  };

  const confirmStartSession = async (otp?: string) => {
    setProcessing(true);
    try {
      const trimmed = String(otp ?? '').trim();
      if (!/^\d{4}$|^\d{6}$/.test(trimmed)) {
        toast.error('Enter the 4 or 6-digit OTP from the customer');
        return;
      }

      const response = await apiClient.post<any>(`/vendor/bookings/${bookingId}/start-session`, {
        vendorId,
        otp: trimmed,
        startedAt: new Date().toISOString(),
        ...(currentLocation
          ? {
              location: {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                ...(currentLocation.accuracy != null ? { accuracy: currentLocation.accuracy } : {}),
                ...(currentLocation.timestamp ? { timestamp: currentLocation.timestamp } : {}),
              },
            }
          : {}),
      });

      if (response.success) {
        sessionStatusRef.current = 'in_progress';
        isWalkerSessionRef.current = !!bookingData?.isWalkerSession;
        const plannedSec = (bookingData?.plannedWalkDurationMinutes ?? 30) * 60;
        const startedAt = new Date().toISOString();
        setSessionState(prev => ({
          ...prev,
          status: 'in_progress',
          sessionStartedAt: startedAt,
          routePoints: bookingData?.isWalkerSession ? [currentLocation!] : []
        }));
        setSessionDuration(bookingData?.isWalkerSession ? plannedSec : 0);
        
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

  // End session — OTP required for completion (same as start)
  const handleEndSession = () => {
    setOtpType('end');
    setOtpInput('');
    setShowOtpModal(true);
  };

  const confirmEndSession = async (otp?: string) => {
    setProcessing(true);
    try {
      const trimmed = String(otp ?? '').trim();
      if (!/^\d{4}$|^\d{6}$/.test(trimmed)) {
        toast.error('Enter the 4 or 6-digit OTP from the customer');
        return;
      }

      stopLocationTracking();

      const plannedSecWalker = (bookingData?.plannedWalkDurationMinutes ?? 30) * 60;
      const durationSecondsForReport = bookingData?.isWalkerSession
        ? Math.max(0, plannedSecWalker - sessionDuration)
        : sessionDuration;

      const response = await apiClient.post<any>(`/vendor/bookings/${bookingId}/complete`, {
        vendorId,
        otp: trimmed,
        notes: bookingData?.isWalkerSession
          ? `Route: ${sessionState.totalDistance}m, walked ~${Math.round(durationSecondsForReport / 60)} min of ${bookingData?.plannedWalkDurationMinutes ?? 30} min booked`
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
          duration: durationSecondsForReport,
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

  // Format duration (elapsed)
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

  /** Walk countdown display: MM:SS from remaining seconds */
  const formatWalkCountdown = (remainingSeconds: number): string => {
    const m = Math.floor(Math.max(0, remainingSeconds) / 60);
    const s = Math.max(0, remainingSeconds) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
      <div className="vendor-app-column flex min-h-[100dvh] min-h-screen flex-col items-center justify-center bg-[#FFF5F1] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <RefreshCw className="h-10 w-10 animate-spin text-[#FF8C42]" aria-hidden />
        <p className="mt-3 text-sm font-medium text-gray-600">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="vendor-root-scroll vendor-app-column flex min-h-[100dvh] min-h-screen flex-col bg-[#FFF5F1] overscroll-y-contain pb-[env(safe-area-inset-bottom)]">
      {/* Header: safe-area + sticky for mobile browsers */}
      <header className="sticky top-0 z-20 shrink-0 border-b border-orange-100/80 bg-[#FFF5F1]/95 px-4 pb-4 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="relative mx-auto max-w-lg text-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2.5 shadow-sm ring-1 ring-black/5 transition-colors hover:bg-white min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Back to bookings"
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
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[28px] bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] sm:mx-auto sm:max-w-lg sm:rounded-t-[40px] sm:px-5 sm:pb-8 sm:pt-6">
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
                  : sessionState.status === 'in_progress' && !bookingData?.isWalkerSession
                    ? 'Live map was for your trip here. During in-home service the customer map stays on your last journey position.'
                    : sessionState.status === 'arrived'
                      ? 'Journey GPS paused at arrival. For dog walks, start the session (OTP) to resume route tracking.'
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

        {sessionState.status === 'traveling' && (
          <Card className="mb-4 overflow-hidden border-orange-100 shadow-sm">
            <div className="border-b border-orange-100 bg-orange-50/80 px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">Route to customer</p>
              <p className="text-xs text-gray-600">Your live position and the visit address (same as customer map).</p>
            </div>
            <div className="relative h-[min(52vh,320px)] w-full min-h-[220px] bg-gray-100">
              <div ref={journeyMapContainerRef} className="h-full w-full" />
              {(journeyMapLoading || !resolvedCustomerDest) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm text-gray-600">
                  <Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" aria-hidden />
                  {!resolvedCustomerDest ? 'Finding customer location…' : 'Loading map…'}
                </div>
              )}
            </div>
          </Card>
        )}

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
                <p className="text-xl font-bold text-gray-900">
                  {bookingData?.isWalkerSession
                    ? formatWalkCountdown(sessionDuration)
                    : formatDuration(sessionDuration)}
                </p>
                <p className="text-xs font-medium text-gray-600">
                  {bookingData?.isWalkerSession
                    ? `Time left (${bookingData.plannedWalkDurationMinutes ?? 30} min walk)`
                    : 'Duration'}
                </p>
              </div>
              {bookingData?.isWalkerSession && (
                <div className="rounded-xl bg-sky-50 p-3 text-center">
                  <Route className="mx-auto mb-1 h-6 w-6 text-sky-600" />
                  <p className="text-xl font-bold text-gray-900">{formatDistance(sessionState.totalDistance)}</p>
                  <p className="text-xs font-medium text-sky-800">Distance walked</p>
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
                <p className="text-xs text-gray-500">
                  {bookingData?.isWalkerSession ? 'Walk time used' : 'Duration'}
                </p>
                <p className="font-semibold text-gray-900">
                  {bookingData?.isWalkerSession
                    ? formatDuration(
                        Math.max(
                          0,
                          (bookingData.plannedWalkDurationMinutes ?? 30) * 60 - sessionDuration
                        )
                      )
                    : formatDuration(sessionDuration)}
                </p>
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

        <footer className="mt-auto space-y-3 border-t border-gray-100/80 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
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
                  duration: bookingData?.isWalkerSession
                    ? Math.max(
                        0,
                        (bookingData.plannedWalkDurationMinutes ?? 30) * 60 - sessionDuration
                      )
                    : sessionDuration,
                  distance: sessionState.totalDistance,
                })
              }
              className={primaryBtn}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Back to bookings
            </Button>
          )}
        </footer>
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
