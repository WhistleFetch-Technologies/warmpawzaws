import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Phone, Clock, User, X, AlertTriangle, CheckCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

declare global {
  interface Window {
    google: any;
  }
}

interface UniversalHomeServiceTrackingProps {
  bookingId: string;
  trackingSessionId?: string;
  onClose: () => void;
  staffName?: string;
  staffPhone?: string;
  serviceType?: string;
  customerName?: string;
}

export function UniversalHomeServiceTracking({ 
  bookingId, 
  trackingSessionId, 
  onClose,
  staffName = 'Service Provider',
  staffPhone,
  serviceType = 'Home Service',
  customerName = 'Valued Customer'
}: UniversalHomeServiceTrackingProps) {
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const staffMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);

  // Load Google Maps script from platform settings
  useEffect(() => {
    let isMounted = true;
    
    async function loadGoogleMaps() {
      try {
        // Fetch from backend like existing components do
        const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (envApiKey) {
          // Use env var if available (fallback)
          if (window.google && window.google.maps) {
            if (isMounted) setMapLoaded(true);
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${envApiKey}&libraries=geometry`;
          script.async = true;
          script.defer = true;
          script.onload = () => { if (isMounted) setMapLoaded(true); };
          script.onerror = () => { if (isMounted) { setError('Failed to load map'); setLoading(false); } };
          document.head.appendChild(script);
          return;
        }
        
        // Fetch from admin portal settings
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/integrations/settings`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          const apiKey = data.settings?.googleMaps?.apiKey;
          
          if (!apiKey) {
            if (isMounted) {
              setError('Google Maps API key not configured. Please configure it in Admin Portal → Platform Settings → Cloud & Maps.');
              setLoading(false);
            }
            return;
          }

          if (window.google && window.google.maps) {
            if (isMounted) setMapLoaded(true);
            return;
          }

          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
          script.async = true;
          script.defer = true;
          script.onload = () => { if (isMounted) setMapLoaded(true); };
          script.onerror = () => { if (isMounted) { setError('Failed to load map'); setLoading(false); } };
          document.head.appendChild(script);
        } else {
          if (isMounted) {
            setError('Failed to load Google Maps configuration');
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('❌ Error loading Google Maps:', err);
        if (isMounted) {
          setError('Failed to load Google Maps configuration');
          setLoading(false);
        }
      }
    }
    
    loadGoogleMaps();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize map once Google Maps is loaded and we have tracking data
  useEffect(() => {
    if (!mapLoaded || !trackingData || !mapRef.current) return;
    if (!mapInstanceRef.current) {
        initializeMap();
    } else {
        updateMapMarkers(trackingData.session);
    }
  }, [mapLoaded, trackingData]);

  // Fetch tracking data
  useEffect(() => {
    // ✅ FIX: Use bookingId instead of trackingSessionId
    if (!bookingId) {
        // If no booking ID, cannot fetch tracking
        setLoading(false);
        return;
    }

    fetchTrackingData();
    
    const interval = setInterval(fetchTrackingData, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  const fetchTrackingData = async () => {
    try {
      // ✅ FIX: Use bookingId instead of trackingSessionId
      if (!bookingId) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/gps/tracking/${bookingId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTrackingData(data);
        setError(null);
      } else {
        console.warn('Tracking session fetch failed');
        // Don't set error immediately to avoid flashing if it's just a blip
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    if (!window.google || !trackingData?.session || !mapRef.current) return;

    const { currentLocation, destinationLocation } = trackingData.session;
    
    if (!currentLocation) return;

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
    map.fitBounds(bounds);

    // Staff Marker
    staffMarkerRef.current = new window.google.maps.Marker({
      position: staffLatLng,
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="#FF8C42" stroke="white" stroke-width="3"/>
            <path d="M24 14 L30 30 L24 26 L18 30 Z" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(48, 48),
        anchor: new window.google.maps.Point(24, 24)
      },
      title: staffName,
      animation: window.google.maps.Animation.DROP
    });

    // Customer Marker
    if (destinationLocation) {
      customerMarkerRef.current = new window.google.maps.Marker({
        position: new window.google.maps.LatLng(destinationLocation.latitude, destinationLocation.longitude),
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

    // Route
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
  };

  const updateMapMarkers = (session: any) => {
    if (!staffMarkerRef.current || !session.currentLocation) return;

    const newPosition = new window.google.maps.LatLng(
      session.currentLocation.latitude,
      session.currentLocation.longitude
    );

    staffMarkerRef.current.setPosition(newPosition);

    if (session.locationHistory && session.locationHistory.length > 1 && routePolylineRef.current) {
      const routePath = session.locationHistory.map((loc: any) => ({
        lat: loc.latitude,
        lng: loc.longitude
      }));
      routePolylineRef.current.setPath(routePath);
    }
  };

  const handleEmergencyReassign = async () => {
    try {
      setReassigning(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/booking/${bookingId}/emergency-reassign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            requestedBy: customerName,
            reason: 'Customer reported issue: Provider not moving / unresponsive'
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
            toast.success('Reassignment request initiated. Looking for nearby providers.');
            setShowEmergencyDialog(false);
            // Optionally close tracking or show "Searching" state
        } else {
            toast.error(data.message || 'Failed to reassign.');
        }
      } else {
        toast.error('Failed to initiate reassignment.');
      }
    } catch (error) {
      console.error('Reassignment error:', error);
      toast.error('Network error during reassignment.');
    } finally {
      setReassigning(false);
    }
  };

  const formatETA = (minutes: number) => {
    if (minutes < 1) return 'Arriving soon';
    if (minutes === 1) return '1 min';
    return `${minutes} mins`;
  };

  if (loading && !trackingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto">
        <div className="text-center">
          <Loader2 className="animate-spin w-10 h-10 text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Initializing secure tracking...</p>
        </div>
      </div>
    );
  }

  if (error && !trackingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto p-6">
        <Card className="w-full p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Tracking Unavailable</h3>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Button onClick={onClose} variant="outline" className="w-full">Go Back</Button>
        </Card>
      </div>
    );
  }

  const session = trackingData?.session;
  const staff = trackingData?.staff;
  const displayStaffName = staff?.fullName || staffName;
  const displayStaffPhone = staff?.phone || staffPhone;

  return (
    <div className="min-h-screen bg-white max-w-[430px] mx-auto flex flex-col relative">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-4 z-10">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-white text-xl font-bold">Live Tracking</h1>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <p className="text-white/90 text-sm">{serviceType}</p>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full min-h-[400px] bg-gray-100" />
        
        {/* Status Overlay */}
        {session && (
          <div className="absolute top-4 left-4 right-4">
            <div className="bg-white/95 backdrop-blur-md rounded-xl p-4 shadow-lg border border-gray-100">
               <div className="flex items-center gap-4">
                  {staff?.photo ? (
                    <img src={staff.photo} alt={displayStaffName} className="w-12 h-12 rounded-full object-cover border-2 border-[#FF8C42]" />
                  ) : (
                    <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center text-white">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{displayStaffName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        {session.status === 'traveling' && (
                            <>
                                <span className="flex items-center gap-1 text-xs font-medium text-[#FF8C42] bg-orange-50 px-2 py-0.5 rounded-full">
                                    <Navigation className="w-3 h-3" /> On the way
                                </span>
                                {session.estimatedTimeToArrival && (
                                    <span className="text-xs text-gray-500">• {formatETA(session.estimatedTimeToArrival)}</span>
                                )}
                            </>
                        )}
                        {session.status === 'arrived' && (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                <CheckCircle className="w-3 h-3" /> Arrived
                            </span>
                        )}
                    </div>
                  </div>
                  
                  {displayStaffPhone && (
                    <a href={`tel:${displayStaffPhone}`} className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center hover:bg-green-200 transition">
                        <Phone className="w-5 h-5 text-green-700" />
                    </a>
                  )}
               </div>
            </div>
          </div>
        )}

        {/* Emergency / Help Button */}
        <div className="absolute bottom-8 right-4">
            <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
                <DialogTrigger asChild>
                    <button className="w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center border border-red-100 text-red-500 hover:bg-red-50 transition">
                        <ShieldAlert className="w-6 h-6" />
                    </button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Report Issue</DialogTitle>
                        <DialogDescription>
                            Is there a problem with your service provider?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="bg-yellow-50 p-4 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-yellow-800">
                                Use this only if the provider is unresponsive, moving in the wrong direction, or there is an emergency.
                            </p>
                        </div>
                        
                        <div className="grid gap-3">
                            <Button variant="outline" className="justify-start h-auto py-3">
                                <span className="text-left">
                                    <span className="block font-medium">Provider not moving</span>
                                    <span className="text-xs text-gray-500">Location hasn't updated in 5+ mins</span>
                                </span>
                            </Button>
                            <Button 
                                variant="destructive" 
                                className="justify-start h-auto py-3"
                                onClick={handleEmergencyReassign}
                                disabled={reassigning}
                            >
                                {reassigning ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <ShieldAlert className="w-4 h-4 mr-2" />
                                )}
                                <span className="text-left">
                                    <span className="block font-medium">Request Emergency Reassignment</span>
                                    <span className="text-xs text-white/90">Find another provider immediately</span>
                                </span>
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>
    </div>
  );
}
