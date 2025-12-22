import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Home,
  Navigation,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { WARM_ORANGE } from '../../assets/design-tokens';

declare global {
  interface Window {
    google: any;
  }
}

interface OrderTrackingViewProps {
  order: any;
  onBack: () => void;
  onContactDelivery?: () => void;
}

export function OrderTrackingView({ order, onBack, onContactDelivery }: OrderTrackingViewProps) {
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<{ lat: number; lng: number } | null>(null);
  const [estimatedTime, setEstimatedTime] = useState('25 mins');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const deliveryMarkerRef = useRef<any>(null);
  const customerMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const directionsServiceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);

  // Mock tracking statuses
  const trackingSteps = [
    {
      status: 'Order Confirmed',
      timestamp: '2024-12-02, 10:30 AM',
      location: 'Warmpawz Warehouse, Bangalore',
      icon: CheckCircle2,
      completed: true
    },
    {
      status: 'Packed & Ready',
      timestamp: '2024-12-02, 02:15 PM',
      location: 'Warmpawz Warehouse, Bangalore',
      icon: Package,
      completed: true
    },
    {
      status: 'Out for Delivery',
      timestamp: '2024-12-03, 09:00 AM',
      location: 'Delivery Hub, Koramangala',
      icon: Truck,
      completed: true,
      active: true
    },
    {
      status: 'Delivered',
      timestamp: '',
      location: order.deliveryAddress,
      icon: Home,
      completed: false
    }
  ];

  const deliveryPartner = {
    name: order.deliveryPartner?.name || 'Rajesh Kumar',
    phone: order.deliveryPartner?.phone || '+91 98765 43210',
    vehicle: order.deliveryPartner?.vehicle || 'Bike - KA01AB1234',
    rating: order.deliveryPartner?.rating || 4.8,
    deliveries: order.deliveryPartner?.deliveries || 2450
  };

  // Load Google Maps script from platform settings
  useEffect(() => {
    let isMounted = true;
    
    async function loadGoogleMaps() {
      try {
        // Fetch from backend like existing components do
        const envApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
        if (envApiKey) {
          // Use env var if available (fallback)
          if (window.google && window.google.maps) {
            if (isMounted) setMapLoaded(true);
            return;
          }
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${envApiKey}&libraries=geometry,places,directions`;
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
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places,directions`;
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

  // Fetch order tracking data
  useEffect(() => {
    if (!order) return;

    async function fetchTrackingData() {
      try {
        setLoading(true);
        
        let locationFetched = false;
        
        // Try to fetch real-time tracking if order has tracking number
        if (order.trackingNumber || order.id) {
          const trackingResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/delivery/track/${order.trackingNumber || order.id}`,
            { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
          );
          
          if (trackingResponse.ok) {
            const trackingData = await trackingResponse.json();
            if (trackingData.tracking?.currentLocation) {
              setCurrentLocation({
                lat: trackingData.tracking.currentLocation.lat || trackingData.tracking.currentLocation.latitude,
                lng: trackingData.tracking.currentLocation.lng || trackingData.tracking.currentLocation.longitude
              });
              locationFetched = true;
            }
          }
        }

        // Set default delivery location if not available
        if (!locationFetched) {
          // Use warehouse location as default (can be enhanced with actual warehouse location)
          setCurrentLocation({ lat: 12.9352, lng: 77.6245 }); // Bangalore warehouse area
        }

        // Set default delivery address (will be geocoded when map loads)
        if (order.deliveryAddress || order.address) {
          // Will geocode when map is loaded
          setDeliveryAddress(null); // Reset to trigger geocoding
        } else {
          // Fallback to default location (Bangalore)
          setDeliveryAddress({ lat: 12.9716, lng: 77.5946 });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching tracking data:', err);
        // Fallback to default locations
        setCurrentLocation({ lat: 12.9352, lng: 77.6245 });
        setDeliveryAddress({ lat: 12.9716, lng: 77.5946 });
        setLoading(false);
      }
    }

    fetchTrackingData();
  }, [order]);

  // Geocode address once map is loaded
  useEffect(() => {
    if (!mapLoaded || !window.google || !order) return;
    if (deliveryAddress) return; // Already geocoded

    const address = order.deliveryAddress || order.address;
    if (address) {
      geocodeAddress(address);
    }
  }, [mapLoaded, order]);

  // Geocode address to get coordinates
  const geocodeAddress = (address: string) => {
    if (!window.google || !window.google.maps) {
      // Fallback: Use default location
      setDeliveryAddress({ lat: 12.9716, lng: 77.5946 });
      return;
    }

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results: any, status: string) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          setDeliveryAddress({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          // Fallback to default location
          setDeliveryAddress({ lat: 12.9716, lng: 77.5946 });
        }
      });
    } catch (err) {
      console.error('Geocoding error:', err);
      setDeliveryAddress({ lat: 12.9716, lng: 77.5946 });
    }
  };

  // Initialize map once Google Maps is loaded
  useEffect(() => {
    if (!mapLoaded || !currentLocation || !mapRef.current) return;
    if (!mapInstanceRef.current) {
      initializeMap();
    } else {
      updateMapMarkers();
    }
  }, [mapLoaded, currentLocation, deliveryAddress]);

  // Update location periodically if order is in transit
  useEffect(() => {
    if (!order || order.status === 'delivered' || order.status === 'cancelled') return;

    const interval = setInterval(async () => {
      if (order.trackingNumber || order.id) {
        try {
          const trackingResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/ecommerce/delivery/track/${order.trackingNumber || order.id}`,
            { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
          );
          
          if (trackingResponse.ok) {
            const trackingData = await trackingResponse.json();
            if (trackingData.tracking?.currentLocation) {
              setCurrentLocation({
                lat: trackingData.tracking.currentLocation.lat || trackingData.tracking.currentLocation.latitude,
                lng: trackingData.tracking.currentLocation.lng || trackingData.tracking.currentLocation.longitude
              });
            }
          }
        } catch (err) {
          console.error('Error updating location:', err);
        }
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [order]);

  const initializeMap = () => {
    if (!window.google || !currentLocation || !mapRef.current) return;

    const bounds = new window.google.maps.LatLngBounds();
    
    const deliveryLatLng = new window.google.maps.LatLng(
      currentLocation.lat,
      currentLocation.lng
    );
    bounds.extend(deliveryLatLng);
    
    if (deliveryAddress) {
      const customerLatLng = new window.google.maps.LatLng(
        deliveryAddress.lat,
        deliveryAddress.lng
      );
      bounds.extend(customerLatLng);
    }

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 14,
      center: deliveryLatLng,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    mapInstanceRef.current = map;
    if (deliveryAddress) {
      map.fitBounds(bounds);
    }

    // Delivery Partner Marker (Truck)
    deliveryMarkerRef.current = new window.google.maps.Marker({
      position: deliveryLatLng,
      map: map,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="#FF8C42" stroke="white" stroke-width="3"/>
            <path d="M12 28 L20 28 L20 20 L28 20 L28 28 L36 28 L36 32 L12 32 Z" fill="white"/>
            <circle cx="18" cy="34" r="3" fill="white"/>
            <circle cx="30" cy="34" r="3" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(48, 48),
        anchor: new window.google.maps.Point(24, 24)
      },
      title: 'Delivery Partner',
      animation: window.google.maps.Animation.DROP
    });

    // Customer Location Marker (Home)
    if (deliveryAddress) {
      customerMarkerRef.current = new window.google.maps.Marker({
        position: new window.google.maps.LatLng(deliveryAddress.lat, deliveryAddress.lng),
        map: map,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
              <path d="M20 5 L10 15 L10 30 L15 30 L15 20 L25 20 L25 30 L30 30 L30 15 Z" fill="#10B981" stroke="white" stroke-width="2"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40)
        },
        title: 'Delivery Address'
      });
    }

    // Calculate and display route
    if (deliveryAddress && window.google.maps.DirectionsService) {
      directionsServiceRef.current = new window.google.maps.DirectionsService();
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: true, // We use custom markers
        polylineOptions: {
          strokeColor: '#FF8C42',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      });

      directionsServiceRef.current.route({
        origin: deliveryLatLng,
        destination: new window.google.maps.LatLng(deliveryAddress.lat, deliveryAddress.lng),
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result: any, status: string) => {
        if (status === 'OK' && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
          
          // Calculate ETA from route
          if (result.routes && result.routes[0] && result.routes[0].legs && result.routes[0].legs[0]) {
            const duration = result.routes[0].legs[0].duration;
            if (duration) {
              const minutes = Math.ceil(duration.value / 60);
              setEstimatedTime(`${minutes} min${minutes > 1 ? 's' : ''}`);
            }
          }
        }
      });
    }
  };

  const updateMapMarkers = () => {
    if (!deliveryMarkerRef.current || !currentLocation) return;

    const newPosition = new window.google.maps.LatLng(
      currentLocation.lat,
      currentLocation.lng
    );

    deliveryMarkerRef.current.setPosition(newPosition);

    // Update route if address is available
    if (deliveryAddress && directionsServiceRef.current && directionsRendererRef.current) {
      directionsServiceRef.current.route({
        origin: newPosition,
        destination: new window.google.maps.LatLng(deliveryAddress.lat, deliveryAddress.lng),
        travelMode: window.google.maps.TravelMode.DRIVING
      }, (result: any, status: string) => {
        if (status === 'OK' && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
          
          // Update ETA
          if (result.routes && result.routes[0] && result.routes[0].legs && result.routes[0].legs[0]) {
            const duration = result.routes[0].legs[0].duration;
            if (duration) {
              const minutes = Math.ceil(duration.value / 60);
              setEstimatedTime(`${minutes} min${minutes > 1 ? 's' : ''}`);
            }
          }
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Track Order</h1>
            <p className="text-sm text-gray-500">{order.orderNumber}</p>
          </div>
        </div>
      </div>

      <div className="pb-24">
        {/* Live Map */}
        <div className="relative h-80 bg-gray-100">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center p-4">
                <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-2" />
                <p className="text-gray-700 font-medium mb-1">Map unavailable</p>
                <p className="text-sm text-gray-500">{error}</p>
              </div>
            </div>
          ) : loading || !mapLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: WARM_ORANGE }} />
                <p className="text-gray-600 text-sm">Loading map...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Google Maps Container */}
              <div ref={mapRef} className="w-full h-full" />
              
              {/* Overlay Info */}
              <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Estimated Delivery</p>
                    <p className="font-semibold text-gray-900">{estimatedTime}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: WARM_ORANGE }} />
                    <span className="text-xs text-gray-600">In Transit</span>
                  </div>
                </div>
              </div>

              {/* Live Location Button */}
              <button 
                onClick={() => {
                  if (mapInstanceRef.current && currentLocation) {
                    mapInstanceRef.current.setCenter(new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng));
                    mapInstanceRef.current.setZoom(15);
                  }
                }}
                className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg hover:shadow-xl transition-shadow z-10"
              >
                <Navigation className="w-5 h-5 text-[#FF8C42]" />
              </button>
            </>
          )}
        </div>

        {/* Delivery Partner Info */}
        <div className="bg-white p-4 mx-4 -mt-8 rounded-xl shadow-lg relative z-10 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">👤</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{deliveryPartner.name}</p>
              <p className="text-sm text-gray-500">{deliveryPartner.vehicle}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-gray-600">{deliveryPartner.deliveries} deliveries</span>
                </div>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">⭐ {deliveryPartner.rating}</span>
              </div>
            </div>
            <button 
              onClick={onContactDelivery}
              className="p-3 bg-green-100 hover:bg-green-200 rounded-full transition-colors"
            >
              <Phone className="w-5 h-5 text-green-600" />
            </button>
          </div>
        </div>

        {/* Estimated Delivery Time */}
        <div className="mx-4 mb-4 p-4 bg-gradient-to-r from-[#FF8C42] to-[#FF7028] rounded-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90 mb-1">Estimated Delivery</p>
              <p className="text-2xl font-bold">Today, {estimatedTime}</p>
            </div>
            <Clock className="w-12 h-12 opacity-90" />
          </div>
        </div>

        {/* Tracking Timeline */}
        <div className="bg-white p-6 mx-4 rounded-xl mb-4">
          <h2 className="font-semibold text-gray-900 mb-6">Tracking History</h2>
          <div className="relative">
            {trackingSteps.map((step, index) => (
              <div key={index} className="flex gap-4 pb-8 last:pb-0">
                {/* Timeline Line */}
                {index < trackingSteps.length - 1 && (
                  <div 
                    className={`absolute left-[15px] w-0.5 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                    style={{ 
                      top: `${32 + index * 96}px`, 
                      height: '64px' 
                    }}
                  />
                )}
                
                {/* Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.active 
                    ? 'bg-[#FF8C42] animate-pulse' 
                    : step.completed 
                    ? 'bg-green-500' 
                    : 'bg-gray-200'
                }`}>
                  <step.icon className={`w-4 h-4 ${
                    step.completed || step.active ? 'text-white' : 'text-gray-400'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex items-start justify-between mb-1">
                    <p className={`font-medium ${
                      step.active 
                        ? 'text-[#FF8C42]' 
                        : step.completed 
                        ? 'text-gray-900' 
                        : 'text-gray-400'
                    }`}>
                      {step.status}
                    </p>
                    {step.active && (
                      <Badge className="bg-[#FF8C42] text-white">In Progress</Badge>
                    )}
                  </div>
                  
                  {step.timestamp && (
                    <p className="text-xs text-gray-500 mb-1">{step.timestamp}</p>
                  )}
                  
                  <div className="flex items-start gap-1 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{step.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Package Details */}
        <div className="bg-white p-6 mx-4 rounded-xl">
          <h2 className="font-semibold text-gray-900 mb-4">Package Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tracking Number</span>
              <span className="font-mono font-medium text-gray-900">{order.trackingNumber || 'TRK1234567890'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Items</span>
              <span className="font-medium text-gray-900">{order.items?.length || 1} items</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Weight</span>
              <span className="font-medium text-gray-900">2.5 kg</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Shipping Method</span>
              <span className="font-medium text-gray-900">Standard Delivery</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="flex gap-3">
          <Button
            onClick={onContactDelivery}
            variant="outline"
            className="flex-1 border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
          >
            <Phone className="w-4 h-4 mr-2" />
            Call Delivery Partner
          </Button>
          <Button
            className="flex-1 bg-[#FF8C42] hover:bg-[#FF7028] text-white"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Share Live Location
          </Button>
        </div>
      </div>
    </div>
  );
}
