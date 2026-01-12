import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Phone, Clock, User, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// Google Maps API key is available as VITE_GOOGLE_MAPS_API_KEY
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

interface LiveTrackingMapProps {
  bookingId: string;
  trackingSessionId: string;
  onClose: () => void;
  staffName?: string;
  staffPhone?: string;
  serviceType?: string;
}

export function LiveTrackingMap({ 
  bookingId, 
  trackingSessionId, 
  onClose,
  staffName = 'Service Provider',
  staffPhone,
  serviceType = 'service'
}: LiveTrackingMapProps) {
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const staffMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  // Load Google Maps script
  useEffect(() => {
    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey) {
      setError('Google Maps API key not configured');
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
      setError('Failed to load map');
      setLoading(false);
    };
    
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // Initialize map once Google Maps is loaded and we have tracking data
  useEffect(() => {
    if (!mapLoaded || !trackingData || !mapRef.current) return;

    initializeMap();
  }, [mapLoaded, trackingData]);

  // Fetch tracking data
  useEffect(() => {
    fetchTrackingData();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchTrackingData, 5000);
    
    return () => clearInterval(interval);
  }, [trackingSessionId]);

  const fetchTrackingData = async () => {
    try {
      console.log(`🗺️ [TRACKING] Fetching tracking data for session ${trackingSessionId}`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/tracking/${trackingSessionId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [TRACKING] Data received:', data);
        setTrackingData(data);
        setError(null);
        
        // Update map if already initialized
        if (mapInstanceRef.current && data.session) {
          updateMapMarkers(data.session);
        }
      } else {
        const error = await response.json();
        console.error('❌ [TRACKING] Error:', error);
        setError('Failed to load tracking data');
      }
    } catch (err) {
      console.error('❌ [TRACKING] Fetch error:', err);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!window.google || !trackingData?.session || !mapRef.current) return;

    const { currentLocation, destinationLocation } = trackingData.session;
    
    if (!currentLocation) {
      console.warn('No current location available');
      return;
    }

    console.log('🗺️ Initializing map...');

    // Create map centered between staff and customer
    const bounds = new window.google.maps.LatLngBounds();
    
    const staffLatLng = new window.google.maps.LatLng(
      currentLocation.latitude,
      currentLocation.longitude
    );
    bounds.extend(staffLatLng);
    
    if (destinationLocation) {
      const customerLatLng = new window.google.maps.LatLng(
        destinationLocation.latitude,
        destinationLocation.longitude
      );
      bounds.extend(customerLatLng);
    }

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 14,
      center: staffLatLng,
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

    // Fit bounds
    map.fitBounds(bounds);

    // Add staff marker (moving)
    staffMarkerRef.current = new window.google.maps.Marker({
      position: staffLatLng,
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="#FF8C42" stroke="white" stroke-width="3"/>
            <path d="M20 10 L25 25 L20 22 L15 25 Z" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(40, 40),
        anchor: new window.google.maps.Point(20, 20)
      },
      title: staffName,
      animation: window.google.maps.Animation.DROP
    });

    // Add customer marker (destination)
    if (destinationLocation) {
      customerMarkerRef.current = new window.google.maps.Marker({
        position: customerLatLng,
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <path d="M20 5 C15 5 10 9 10 15 C10 23 20 35 20 35 S30 23 30 15 C30 9 25 5 20 5 Z" fill="#10B981" stroke="white" stroke-width="2"/>
              <circle cx="20" cy="15" r="4" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40)
        },
        title: 'Your Location'
      });
    }

    // Draw route if location history exists
    if (trackingData.session.locationHistory && trackingData.session.locationHistory.length > 1) {
      const routePath = trackingData.session.locationHistory.map((loc: any) => ({
        lat: loc.latitude,
        lng: loc.longitude
      }));

      routePolylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#FF8C42',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: map
      });
    }

    console.log('✅ Map initialized');
  };

  const updateMapMarkers = (session: any) => {
    if (!staffMarkerRef.current || !session.currentLocation) return;

    const newPosition = new window.google.maps.LatLng(
      session.currentLocation.latitude,
      session.currentLocation.longitude
    );

    // Animate marker movement
    staffMarkerRef.current.setPosition(newPosition);

    // Update route polyline
    if (session.locationHistory && session.locationHistory.length > 1 && routePolylineRef.current) {
      const routePath = session.locationHistory.map((loc: any) => ({
        lat: loc.latitude,
        lng: loc.longitude
      }));
      routePolylineRef.current.setPath(routePath);
    }

    // Optionally recenter map
    if (mapInstanceRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(newPosition);
      if (customerMarkerRef.current) {
        bounds.extend(customerMarkerRef.current.getPosition());
      }
      mapInstanceRef.current.fitBounds(bounds);
    }
  };

  const formatETA = (minutes: number) => {
    if (minutes < 1) return 'Arriving soon';
    if (minutes === 1) return '1 min';
    return `${minutes} mins`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'traveling':
        return <Navigation className="w-5 h-5 text-[#FF8C42]" />;
      case 'arrived':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return <MapPin className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'traveling':
        return 'On the way';
      case 'arrived':
        return 'Arrived';
      default:
        return 'Preparing';
    }
  };

  if (loading && !trackingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tracking...</p>
        </div>
      </div>
    );
  }

  if (error && !trackingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto p-6">
        <Card className="w-full p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Tracking Unavailable</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={onClose} variant="outline" className="w-full">
            Go Back
          </Button>
        </Card>
      </div>
    );
  }

  const session = trackingData?.session;
  const staff = trackingData?.staff;

  return (
    <div className="min-h-screen bg-white max-w-[430px] mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-white text-xl font-bold">Live Tracking</h1>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        
        {/* Status Badge */}
        {session && (
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
            {getStatusIcon(session.status)}
            <span className="text-white text-sm font-medium">{getStatusText(session.status)}</span>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full min-h-[400px]" />
        
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Loading map...</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="p-4 border-t bg-white">
        <Card className="p-4">
          {/* Staff Info */}
          <div className="flex items-center gap-3 mb-4">
            {staff?.photo ? (
              <img 
                src={staff.photo} 
                alt={staff.fullName}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{staff?.fullName || staffName}</h3>
              <p className="text-sm text-gray-500">{serviceType}</p>
            </div>
            {staffPhone && (
              <a 
                href={`tel:${staffPhone}`}
                className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </a>
            )}
          </div>

          {/* ETA & Distance */}
          {session && session.status === 'traveling' && (
            <div className="grid grid-cols-2 gap-3">
              {session.estimatedTimeToArrival !== undefined && (
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-[#FF8C42]" />
                    <span className="text-xs text-gray-600">ETA</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {formatETA(session.estimatedTimeToArrival)}
                  </p>
                </div>
              )}
              
              {session.distanceToDestination !== undefined && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-gray-600">Distance</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {session.distanceToDestination.toFixed(1)} km
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Arrived Status */}
          {session && session.status === 'arrived' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-800">Provider has arrived!</p>
              <p className="text-xs text-green-700 mt-1">They will begin the service shortly</p>
            </div>
          )}
        </Card>

        {/* Live Indicator */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-gray-500">Live tracking • Updates every 5s</span>
        </div>
      </div>
    </div>
  );
}
