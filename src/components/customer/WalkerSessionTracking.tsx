import { useState, useEffect, useRef } from 'react';
import { MapPin, Play, StopCircle, Clock, Navigation, User, X, AlertCircle, CheckCircle, Copy, Phone } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

declare global {
  interface Window {
    google: any;
  }
}

interface WalkerSessionTrackingProps {
  bookingId: string;
  walkerName: string;
  walkerPhoto?: string;
  walkerPhone?: string;
  petName: string;
  startOtp: string;
  endOtp: string;
  onClose: () => void;
}

export function WalkerSessionTracking({
  bookingId,
  walkerName,
  walkerPhoto,
  walkerPhone,
  petName,
  startOtp,
  endOtp,
  onClose
}: WalkerSessionTrackingProps) {
  const [sessionStatus, setSessionStatus] = useState<'waiting_start' | 'active' | 'completed'>('waiting_start');
  const [walkerSession, setWalkerSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState<'start' | 'end' | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const walkerMarkerRef = useRef<any>(null);

  // Load Google Maps
  useEffect(() => {
    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey) {
      setLoading(false);
      return;
    }

    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Google Maps loaded');
      setMapLoaded(true);
    };
    script.onerror = () => {
      console.error('❌ Failed to load Google Maps');
      setLoading(false);
    };
    
    document.head.appendChild(script);
  }, []);

  // Check session status
  useEffect(() => {
    checkSessionStatus();
    
    const interval = setInterval(checkSessionStatus, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, [bookingId]);

  // Initialize or update map when data changes
  useEffect(() => {
    if (!mapLoaded || !walkerSession || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      initializeMap();
    } else {
      updateMap();
    }
  }, [mapLoaded, walkerSession]);

  const checkSessionStatus = async () => {
    try {
      console.log('🐕 [WALKER] Checking session status...');
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const booking = data.booking;
        
        console.log('📦 Booking data:', booking);

        if (booking.walkerSessionId) {
          // Session has started, fetch session details
          await fetchWalkerSession(booking.walkerSessionId);
          setSessionStatus('active');
        } else if (booking.status === 'completed') {
          setSessionStatus('completed');
        } else {
          setSessionStatus('waiting_start');
        }
      }
    } catch (error) {
      console.error('❌ [WALKER] Error checking status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWalkerSession = async (sessionId: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/walker-session/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [WALKER] Session data:', data.session);
        setWalkerSession(data.session);
      }
    } catch (error) {
      console.error('❌ [WALKER] Error fetching session:', error);
    }
  };

  const initializeMap = () => {
    if (!window.google || !walkerSession || !mapRef.current) return;

    console.log('🗺️ Initializing walker tracking map...');

    const startLocation = walkerSession.startLocation;
    
    if (!startLocation || !startLocation.latitude) {
      console.warn('No start location available');
      return;
    }

    const center = new window.google.maps.LatLng(
      startLocation.latitude,
      startLocation.longitude
    );

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 15,
      center: center,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    mapInstanceRef.current = map;

    // Add walker marker
    if (walkerSession.route && walkerSession.route.length > 0) {
      const lastPosition = walkerSession.route[walkerSession.route.length - 1];
      
      walkerMarkerRef.current = new window.google.maps.Marker({
        position: new window.google.maps.LatLng(lastPosition.latitude, lastPosition.longitude),
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="#10B981" stroke="white" stroke-width="3"/>
              <path d="M15 20 L18 23 L25 16" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 20)
        },
        title: walkerName
      });
    }

    // Draw route
    updateRoutePolyline(map);

    console.log('✅ Map initialized');
  };

  const updateMap = () => {
    if (!mapInstanceRef.current || !walkerSession) return;

    // Update walker marker position
    if (walkerSession.route && walkerSession.route.length > 0 && walkerMarkerRef.current) {
      const lastPosition = walkerSession.route[walkerSession.route.length - 1];
      const newPosition = new window.google.maps.LatLng(
        lastPosition.latitude,
        lastPosition.longitude
      );
      walkerMarkerRef.current.setPosition(newPosition);
      
      // Re-center map
      mapInstanceRef.current.panTo(newPosition);
    }

    // Update route
    updateRoutePolyline(mapInstanceRef.current);
  };

  const updateRoutePolyline = (map: any) => {
    if (!walkerSession || !walkerSession.route || walkerSession.route.length < 2) return;

    const routePath = walkerSession.route.map((point: any) => ({
      lat: point.latitude,
      lng: point.longitude
    }));

    if (routePolylineRef.current) {
      routePolylineRef.current.setPath(routePath);
    } else {
      routePolylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#10B981',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });
    }
  };

  const copyOtp = (otp: string, type: 'start' | 'end') => {
    navigator.clipboard.writeText(otp);
    setCopiedOtp(type);
    setTimeout(() => setCopiedOtp(null), 2000);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-500 to-green-600 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-white text-xl font-bold">Walking Session</h1>
            <p className="text-white/90 text-sm">{petName}'s walk with {walkerName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
          {sessionStatus === 'waiting_start' && (
            <>
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Waiting to Start</span>
            </>
          )}
          {sessionStatus === 'active' && (
            <>
              <Play className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Walk in Progress</span>
            </>
          )}
          {sessionStatus === 'completed' && (
            <>
              <CheckCircle className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">Completed</span>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Walker Info */}
        <div className="p-4 bg-white border-b">
          <div className="flex items-center gap-3">
            {walkerPhoto ? (
              <img 
                src={walkerPhoto}
                alt={walkerName}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{walkerName}</h3>
              <p className="text-sm text-gray-500">Professional Dog Walker</p>
            </div>
            {walkerPhone && (
              <a 
                href={`tel:${walkerPhone}`}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </a>
            )}
          </div>
        </div>

        {/* OTP Cards */}
        {sessionStatus === 'waiting_start' && (
          <div className="p-4 space-y-3">
            <Card className="p-4 border-green-200 bg-green-50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">START OTP</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Share this code with {walkerName} to start the walk
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-green-300">
                      <p className="text-3xl font-bold text-gray-900 text-center tracking-wider">
                        {startOtp}
                      </p>
                    </div>
                    <button
                      onClick={() => copyOtp(startOtp, 'start')}
                      className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center hover:bg-green-600 transition-colors"
                    >
                      {copiedOtp === 'start' ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <Copy className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium mb-1">How it works:</p>
                  <ol className="text-sm text-blue-700 space-y-1 ml-4">
                    <li>1. Walker arrives at your location</li>
                    <li>2. Share the START OTP to begin the walk</li>
                    <li>3. Track the walk in real-time on the map</li>
                    <li>4. Share END OTP when walker returns</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {sessionStatus === 'active' && (
          <>
            {/* Map */}
            <div className="h-80 relative">
              <div ref={mapRef} className="w-full h-full" />
              
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading map...</p>
                  </div>
                </div>
              )}

              {/* Live Indicator */}
              <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-900">Live</span>
              </div>
            </div>

            {/* Session Stats */}
            <div className="p-4 space-y-3">
              {walkerSession && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3 text-center">
                    <Clock className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="font-bold text-gray-900">
                      {formatDuration(walkerSession.duration || 0)}
                    </p>
                  </Card>

                  <Card className="p-3 text-center">
                    <Navigation className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 mb-1">Distance</p>
                    <p className="font-bold text-gray-900">
                      {walkerSession.distanceWalked?.toFixed(2) || '0.00'} km
                    </p>
                  </Card>

                  <Card className="p-3 text-center">
                    <MapPin className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-500 mb-1">Points</p>
                    <p className="font-bold text-gray-900">
                      {walkerSession.route?.length || 0}
                    </p>
                  </Card>
                </div>
              )}

              {/* END OTP Card */}
              <Card className="p-4 border-orange-200 bg-orange-50">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0">
                    <StopCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">END OTP</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Share this code when {walkerName} returns
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white rounded-lg px-4 py-3 border-2 border-orange-300">
                        <p className="text-3xl font-bold text-gray-900 text-center tracking-wider">
                          {endOtp}
                        </p>
                      </div>
                      <button
                        onClick={() => copyOtp(endOtp, 'end')}
                        className="w-12 h-12 bg-[#FF8C42] rounded-lg flex items-center justify-center hover:bg-[#ff7a28] transition-colors"
                      >
                        {copiedOtp === 'end' ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <Copy className="w-5 h-5 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}

        {sessionStatus === 'completed' && (
          <div className="p-6">
            <Card className="p-6 text-center border-green-200 bg-green-50">
              <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Walk Completed!</h3>
              <p className="text-gray-600 mb-4">
                {petName} had a great walk with {walkerName}
              </p>
              
              {walkerSession && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-1">Duration</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatDuration(walkerSession.duration || 0)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm text-gray-500 mb-1">Distance</p>
                    <p className="text-lg font-bold text-gray-900">
                      {walkerSession.distanceWalked?.toFixed(2) || '0.00'} km
                    </p>
                  </div>
                </div>
              )}
              
              <Button
                onClick={onClose}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                Close
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
