import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Phone, MessageCircle, Navigation, Play, Pause, AlertCircle, Camera, ChevronDown, ChevronUp, Maximize2, Minimize2, Clock, Timer, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

interface LiveTrackingProps {
  sessionId: string;
  onBack: () => void;
}

interface SessionData {
  id: string;
  dogName: string;
  dogBreed: string;
  walkerName: string;
  walkerPhoto: string;
  walkerRating?: number;
  petName?: string;
  status: 'in_progress' | 'paused' | 'completed';
  startTime: string;
  currentLocation: { lat: number; lng: number };
  petLocation: { lat: number; lng: number };
  route: Array<{ lat: number; lng: number }>;
  distance: number;
  duration: number;
  photos: Array<{ url: string; timestamp: string; caption?: string }>;
  lastUpdate: string;
}

export function LiveTracking({ sessionId, onBack }: LiveTrackingProps) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhotos, setShowPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const walkerMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('');

  useEffect(() => {
    loadSessionData();
    fetchGoogleMapsApiKey();
  }, [sessionId]);

  const fetchGoogleMapsApiKey = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/config/google-maps-key`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.apiKey) {
          setGoogleMapsApiKey(data.apiKey);
          loadGoogleMapsScript(data.apiKey);
        }
      } else {
        console.error('Failed to fetch Google Maps API key');
      }
    } catch (error) {
      console.error('Error loading Google Maps API key:', error);
    }
  };

  useEffect(() => {
    if (!sessionData) return;
    
    const interval = setInterval(() => {
      loadSessionData();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [sessionData?.status]);

  const loadGoogleMapsScript = (apiKey: string) => {
    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    if (document.querySelector('script[src*="maps.googleapis.com"]')) return;

    if (!apiKey) {
      console.error('Google Maps API key not available');
      return;
    }

    const script = document.createElement('script');
    // ✅ Load with loading=async parameter for optimal performance
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => initializeMap();
    script.onerror = () => console.error('Failed to load Google Maps');
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !sessionData) return;

    const map = new google.maps.Map(mapRef.current, {
      center: sessionData.currentLocation,
      zoom: 15,
      disableDefaultUI: false,
      zoomControl: true,
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

    googleMapRef.current = map;

    // Add walker marker
    walkerMarkerRef.current = new google.maps.Marker({
      position: sessionData.currentLocation,
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" fill="#FF8C42" stroke="white" stroke-width="4"/>
            <path d="M24 12 L28 24 L24 36 L20 24 Z" fill="white"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(48, 48),
        anchor: new google.maps.Point(24, 24)
      },
      title: 'Walker Location'
    });

    // Add pet start location marker
    new google.maps.Marker({
      position: sessionData.petLocation,
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="16" fill="#4CAF50" stroke="white" stroke-width="3"/>
            <text x="20" y="27" font-size="20" text-anchor="middle" fill="white">🏠</text>
          </svg>
        `),
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      },
      title: 'Start Location'
    });

    // Draw route
    if (sessionData.route.length > 0) {
      routePolylineRef.current = new google.maps.Polyline({
        path: sessionData.route,
        geodesic: true,
        strokeColor: '#FF8C42',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });
    }
  };

  const updateMapMarkers = () => {
    if (!googleMapRef.current || !sessionData) return;

    // Update walker marker position
    if (walkerMarkerRef.current) {
      walkerMarkerRef.current.setPosition(sessionData.currentLocation);
      
      // Smooth pan to new location
      googleMapRef.current.panTo(sessionData.currentLocation);
    }

    // Update route polyline
    if (routePolylineRef.current) {
      routePolylineRef.current.setPath(sessionData.route);
    } else if (sessionData.route.length > 0) {
      routePolylineRef.current = new google.maps.Polyline({
        path: sessionData.route,
        geodesic: true,
        strokeColor: '#FF8C42',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: googleMapRef.current
      });
    }
  };

  const loadSessionData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/session/${sessionId}/tracking`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSessionData(result.session);
        
        // Initialize map after data is loaded
        setTimeout(() => {
          if (window.google && window.google.maps) {
            initializeMap();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateSpeed = (distance: number, duration: number) => {
    if (duration === 0) return 0;
    return ((distance / (duration / 3600))).toFixed(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading live tracking...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto p-6">
        <button onClick={onBack} className="mb-4">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <p className="text-center text-gray-600">Session not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Google Map */}
      <div className={`relative bg-gray-200 ${isFullScreen ? 'h-screen' : 'h-[400px]'}`}>
        <div ref={mapRef} className="w-full h-full" />

        {/* Map Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/30 to-transparent">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>

            <div className="flex items-center gap-2">
              <div className="px-4 py-2 bg-green-500 text-white rounded-full text-sm font-semibold shadow-lg animate-pulse">
                🔴 Live Tracking
              </div>
              
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg"
              >
                {isFullScreen ? (
                  <Minimize2 className="w-5 h-5 text-gray-700" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Stats Overlay */}
        {!isFullScreen && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <Clock className="w-5 h-5 text-[#FF8C42] mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{formatDuration(sessionData.duration)}</p>
                  <p className="text-xs text-gray-600">Time</p>
                </div>
                <div className="text-center">
                  <MapPin className="w-5 h-5 text-[#FF8C42] mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{sessionData.distance.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">km</p>
                </div>
                <div className="text-center">
                  <Navigation className="w-5 h-5 text-[#FF8C42] mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{calculateSpeed(sessionData.distance, sessionData.duration)}</p>
                  <p className="text-xs text-gray-600">km/h</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Session Details */}
      {!isFullScreen && (
        <div className="px-6 py-6 space-y-4">
          {/* Walker Info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center">
                {sessionData.walkerPhoto ? (
                  <img src={sessionData.walkerPhoto} alt={sessionData.walkerName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl">👨</span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 mb-1">{sessionData.walkerName}</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-yellow-50 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-semibold">{sessionData.walkerRating}</span>
                  </div>
                  <span className="text-xs text-gray-500">• Walking {sessionData.petName}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center hover:bg-green-100 transition-all">
                  <Phone className="w-5 h-5 text-green-600" />
                </button>
                <button className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center hover:bg-blue-100 transition-all">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Session Progress */}
          <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl p-5 border border-orange-100">
            <h4 className="font-semibold text-gray-800 mb-4">Session Progress</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Started at</span>
                <span className="font-semibold text-gray-800">
                  {sessionData.startTime 
                    ? new Date(sessionData.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Route points tracked</span>
                <span className="font-semibold text-gray-800">{sessionData.route.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Average speed</span>
                <span className="font-semibold text-gray-800">{calculateSpeed(sessionData.distance, sessionData.duration)} km/h</span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <p className="text-sm text-blue-800 text-center">
              📍 Location updates every 3 seconds
            </p>
          </div>
        </div>
      )}

      {/* Full Screen Stats */}
      {isFullScreen && (
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-6 max-w-[430px] mx-auto">
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 mb-1">{sessionData.walkerName}</h3>
            <p className="text-sm text-gray-600">Walking {sessionData.petName}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <Clock className="w-6 h-6 text-[#FF8C42] mx-auto mb-2" />
              <p className="text-xl font-bold text-gray-800">{formatDuration(sessionData.duration)}</p>
              <p className="text-xs text-gray-600">Duration</p>
            </div>
            <div className="text-center">
              <MapPin className="w-6 h-6 text-[#FF8C42] mx-auto mb-2" />
              <p className="text-xl font-bold text-gray-800">{sessionData.distance.toFixed(2)}</p>
              <p className="text-xs text-gray-600">Distance (km)</p>
            </div>
            <div className="text-center">
              <Navigation className="w-6 h-6 text-[#FF8C42] mx-auto mb-2" />
              <p className="text-xl font-bold text-gray-800">{calculateSpeed(sessionData.distance, sessionData.duration)}</p>
              <p className="text-xs text-gray-600">Speed (km/h)</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 bg-green-50 text-green-700 py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
              <Phone className="w-4 h-4" />
              Call Walker
            </button>
            <button className="flex-1 bg-blue-50 text-blue-700 py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}