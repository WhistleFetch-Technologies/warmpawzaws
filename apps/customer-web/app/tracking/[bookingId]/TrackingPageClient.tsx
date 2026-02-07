'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface TrackingData {
  sessionId?: string;
  bookingId: string;
  vendorId?: string;
  staffId?: string;
  providerName?: string;
  staff_name?: string;
  staff_phone?: string;
  vendorPhone?: string;
  staff_photo_url?: string;
  vendorPhoto?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  current_location?: {
    latitude: number;
    longitude: number;
  };
  destinationLocation?: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  eta?: number | null;
  eta_minutes?: number | null;
  distance?: number | null;
  distance_km?: number;
  distance_traveled_km?: number;
  status: 'in_transit' | 'on_way' | 'arriving' | 'arrived' | 'in_progress' | 'completed';
  eta_calculation_method?: 'google_maps' | 'estimated';
  serviceName?: string;
  service_name?: string;
  petName?: string;
  booking_time?: string;
  startedAt?: string;
}

interface TrackingPageClientProps {
  bookingId: string;
}

export function TrackingPageClient({ bookingId }: TrackingPageClientProps) {
  const router = useRouter();
  
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Normalize tracking data from API response
  const normalizeTracking = (data: any): TrackingData | null => {
    if (!data) return null;
    
    return {
      sessionId: data.sessionId || data.session_id,
      bookingId: data.bookingId || data.booking_id || bookingId,
      vendorId: data.vendorId || data.vendor_id,
      staffId: data.staffId || data.staff_id,
      providerName: data.providerName || data.vendorName || data.staff_name || 'Service Provider',
      staff_name: data.providerName || data.vendorName || data.staff_name || 'Service Provider',
      staff_phone: data.vendorPhone || data.staff_phone || data.provider_phone,
      vendorPhone: data.vendorPhone || data.staff_phone || data.provider_phone,
      staff_photo_url: data.vendorPhoto || data.staff_photo_url || data.provider_photo,
      vendorPhoto: data.vendorPhoto || data.staff_photo_url || data.provider_photo,
      currentLocation: data.currentLocation || data.current_location,
      current_location: data.currentLocation || data.current_location,
      destinationLocation: data.destinationLocation || data.destination,
      destination: data.destinationLocation || data.destination,
      eta: data.eta ?? data.eta_minutes ?? data.estimated_eta_minutes,
      eta_minutes: data.eta ?? data.eta_minutes ?? data.estimated_eta_minutes,
      distance: data.distance ?? data.distance_km ?? data.distance_remaining_km,
      distance_km: data.distance ?? data.distance_km ?? data.distance_remaining_km ?? 0,
      status: data.status === 'in_transit' ? 'on_way' : data.status,
      serviceName: data.serviceName || data.service_name || 'Service',
      service_name: data.serviceName || data.service_name || 'Service',
      petName: data.petName || data.pet_name,
      startedAt: data.startedAt || data.started_at,
    };
  };

  // ✅ Polling-based GPS tracking (SSE not supported on Lambda)
  useEffect(() => {
    if (!bookingId) return;

    setLoading(true);
    let pollInterval: NodeJS.Timeout | null = null;
    let mounted = true;

    console.log('📡 [GPS] Starting polling mode for booking:', bookingId);
    setIsPolling(true);

    const loadTracking = async () => {
      try {
        // Use correct endpoint path: /tracking/booking/:bookingId
        const response = await apiClient.get<any>(`/tracking/booking/${bookingId}`);
        
        if (!mounted) return;
        
        if (response.success && response.tracking) {
          const normalized = normalizeTracking(response.tracking);
          setTracking(normalized);
          setError(null);
          setLastUpdate(new Date());
        } else if (response.success && !response.tracking) {
          setError(response.message || 'GPS tracking is not active for this booking');
          setTracking(null);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error loading tracking:', err);
        setError(err.message || 'Failed to load tracking data');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial load
    loadTracking();

    // Poll every 3 seconds for real-time updates
    pollInterval = setInterval(loadTracking, 3000);

    // Cleanup
    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      setIsPolling(false);
    };
  }, [bookingId]);

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'in_transit':
      case 'on_way': return 'On the way to you';
      case 'arriving': return 'Almost there!';
      case 'arrived': return 'Has arrived at your location';
      case 'in_progress': return 'Service in progress';
      case 'completed': return 'Service completed';
      default: return 'Tracking...';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_transit':
      case 'on_way': return 'text-blue-500';
      case 'arriving': return 'text-yellow-500';
      case 'arrived': return 'text-green-500';
      case 'in_progress': return 'text-orange-500';
      case 'completed': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  // Get current and destination locations with fallbacks
  const currentLoc = tracking?.currentLocation || tracking?.current_location;
  const destLoc = tracking?.destinationLocation || tracking?.destination;
  const providerName = tracking?.providerName || tracking?.staff_name || 'Service Provider';
  const providerPhone = tracking?.vendorPhone || tracking?.staff_phone;
  const providerPhoto = tracking?.vendorPhoto || tracking?.staff_photo_url;
  const serviceName = tracking?.serviceName || tracking?.service_name || 'Service';
  const etaMinutes = tracking?.eta ?? tracking?.eta_minutes;
  const distanceKm = tracking?.distance ?? tracking?.distance_km ?? 0;

  // Build Google Maps embed URL - API key loaded from environment
  const getMapEmbedUrl = () => {
    if (!currentLoc?.latitude || !destLoc?.latitude) return null;
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return null;
    }
    
    // Use directions mode to show route
    const origin = `${currentLoc.latitude},${currentLoc.longitude}`;
    const destination = `${destLoc.latitude},${destLoc.longitude}`;
    
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`;
  };

  // Build static map URL - requires API key
  const getStaticMapUrl = () => {
    if (!currentLoc?.latitude || !destLoc?.latitude) return null;
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return null;
    }
    
    const markers = `markers=color:blue|label:V|${currentLoc.latitude},${currentLoc.longitude}&markers=color:red|label:D|${destLoc.latitude},${destLoc.longitude}`;
    const path = `path=color:0x0000ff|weight:3|${currentLoc.latitude},${currentLoc.longitude}|${destLoc.latitude},${destLoc.longitude}`;
    
    return `https://maps.googleapis.com/maps/api/staticmap?size=400x300&${markers}&${path}&key=${apiKey}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center px-4">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-200 opacity-75"></div>
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg">
              <span className="text-4xl animate-bounce">🚗</span>
            </div>
          </div>
          <p className="text-gray-600 font-medium">Loading tracking...</p>
          <p className="text-gray-400 text-sm mt-1">Finding your service provider</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg w-full max-w-sm mx-auto">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Tracking Not Available</h2>
          <p className="text-gray-500 mb-4 text-sm">{error || 'Unable to load tracking data'}</p>
          <button
            onClick={() => router.back()}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition font-medium"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-100 flex flex-col w-full max-w-md mx-auto">
      {/* Header - Mobile optimized */}
      <header className="bg-white shadow-sm sticky top-0 z-50 safe-area-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">Live Tracking</h1>
            <p className="text-xs text-gray-500 truncate">{serviceName}</p>
          </div>
          <div className="flex items-center gap-2">
            {providerPhone && (
              <a 
                href={`tel:${providerPhone}`}
                className="w-10 h-10 flex items-center justify-center bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Map Section - Mobile optimized height */}
      <div className="flex-1 min-h-[45vh] bg-gray-200 relative overflow-hidden">
        {currentLoc?.latitude && destLoc?.latitude ? (
          <>
            {/* Interactive Map Link Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-blue-900/30">
              {/* Animated Vehicle Icon */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  {/* Pulse ring */}
                  <div className="absolute inset-0 w-24 h-24 -m-6 rounded-full bg-blue-500/20 animate-ping"></div>
                  <div className="absolute inset-0 w-20 h-20 -m-4 rounded-full bg-blue-500/30 animate-pulse"></div>
                  
                  {/* Vehicle icon */}
                  <div className="relative w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center">
                    <span className="text-2xl animate-bounce">🚗</span>
                  </div>
                  
                  {/* Direction indicator */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                    <div className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full whitespace-nowrap shadow-lg">
                      {tracking.status === 'arriving' ? '🎯 Almost there!' : '→ En route'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Open in Maps button */}
              <a
                href={`https://www.google.com/maps/dir/${currentLoc.latitude},${currentLoc.longitude}/${destLoc.latitude},${destLoc.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white text-blue-600 rounded-full shadow-lg hover:bg-blue-50 transition text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Open in Google Maps
              </a>
            </div>
            
            {/* ETA & Distance Cards */}
            <div className="absolute top-3 left-3 right-3 flex justify-between gap-2">
              <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg flex-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">ETA</p>
                <p className="text-xl font-bold text-blue-600">
                  {etaMinutes != null ? `${Math.round(etaMinutes)}` : '--'}
                  <span className="text-sm font-normal ml-1">min</span>
                </p>
              </div>
              <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg flex-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Distance</p>
                <p className="text-xl font-bold text-gray-900">
                  {distanceKm > 0 ? distanceKm.toFixed(1) : '--'}
                  <span className="text-sm font-normal ml-1">km</span>
                </p>
              </div>
            </div>
            
            {/* Live indicator */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                LIVE
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">📍</span>
              </div>
              <p className="text-gray-500 text-sm">Waiting for location update...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet - Mobile optimized */}
      <div className="bg-white rounded-t-3xl -mt-4 relative z-10 shadow-2xl flex-shrink-0">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        {/* Provider Info Card */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-2xl overflow-hidden shadow-lg">
                {providerPhoto ? (
                  <img src={providerPhoto} alt={providerName} className="w-full h-full object-cover" />
                ) : '👤'}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 ${
                tracking.status === 'on_way' || tracking.status === 'in_transit' || tracking.status === 'arriving' 
                  ? 'bg-green-500 animate-pulse' 
                  : tracking.status === 'arrived' || tracking.status === 'in_progress'
                  ? 'bg-green-500'
                  : 'bg-gray-400'
              } rounded-full border-2 border-white flex items-center justify-center shadow`}>
                <span className="text-[10px]">✓</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{providerName}</h3>
              <p className={`text-sm ${getStatusColor(tracking.status)} font-medium flex items-center gap-1`}>
                {(tracking.status === 'on_way' || tracking.status === 'in_transit') && (
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                )}
                {getStatusMessage(tracking.status)}
              </p>
              {tracking.petName && (
                <p className="text-xs text-gray-500 mt-0.5">🐾 {tracking.petName}</p>
              )}
            </div>
            {providerPhone && (
              <a 
                href={`tel:${providerPhone}`}
                className="w-11 h-11 flex items-center justify-center bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Progress Steps - Compact for mobile */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between relative">
            {/* Progress line background */}
            <div className="absolute top-3 left-6 right-6 h-1 bg-gray-200 rounded-full"></div>
            {/* Progress line fill */}
            <div 
              className="absolute top-3 left-6 h-1 bg-blue-500 rounded-full transition-all duration-700 ease-out"
              style={{ 
                width: tracking.status === 'on_way' || tracking.status === 'in_transit' ? '0%' : 
                       tracking.status === 'arriving' ? 'calc(33% - 12px)' : 
                       tracking.status === 'arrived' ? 'calc(66% - 12px)' : 
                       tracking.status === 'in_progress' || tracking.status === 'completed' ? 'calc(100% - 24px)' : '0%' 
              }}
            ></div>
            
            {/* Steps */}
            {[
              { id: 'on_way', icon: '🚗', label: 'On Way' },
              { id: 'arriving', icon: '📍', label: 'Arriving' },
              { id: 'arrived', icon: '✅', label: 'Arrived' },
              { id: 'completed', icon: '🎉', label: 'Done' },
            ].map((step) => {
              const steps = ['on_way', 'in_transit', 'arriving', 'arrived', 'in_progress', 'completed'];
              const currentIdx = steps.indexOf(tracking.status);
              const stepIdx = step.id === 'on_way' ? 0 : step.id === 'arriving' ? 2 : step.id === 'arrived' ? 3 : 5;
              const isComplete = stepIdx <= currentIdx;
              const isCurrent = (step.id === 'on_way' && (tracking.status === 'on_way' || tracking.status === 'in_transit')) ||
                               step.id === tracking.status || 
                               (tracking.status === 'in_progress' && step.id === 'completed');
              
              return (
                <div key={step.id} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                    isComplete ? 'bg-blue-500 text-white shadow-md scale-110' : 
                    isCurrent ? 'bg-blue-100 text-blue-500 ring-2 ring-blue-300 ring-offset-1' : 
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium ${isComplete || isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 safe-area-bottom space-y-2">
          {tracking.status === 'arrived' && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-200">
              <p className="text-green-700 font-medium text-center flex items-center justify-center gap-2">
                <span className="text-xl">🎉</span>
                Your provider has arrived!
              </p>
            </div>
          )}
          
          {(tracking.status === 'in_progress') && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Service in progress...
              </p>
            </div>
          )}
          
          {tracking.status === 'completed' && (
            <button 
              onClick={() => router.push(`/bookings/${bookingId}/review`)}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-200"
            >
              ⭐ Rate & Review
            </button>
          )}
          
          {/* Update indicator */}
          {lastUpdate && (
            <p className="text-center text-[10px] text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
              {isPolling && <span className="ml-1">• Auto-refreshing</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

