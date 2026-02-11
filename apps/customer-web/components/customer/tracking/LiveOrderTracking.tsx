"use client";

import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Package, Truck, CheckCircle, Clock, Phone, 
  MessageCircle, Navigation, ChevronDown, Star, ArrowLeft,
  AlertCircle, Loader2, User, Bike
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// Google Maps Script Loader
declare global {
  interface Window {
    google: any;
    initTrackingMap: () => void;
  }
}

interface DeliveryPerson {
  name: string;
  phone: string;
  photo?: string;
  vehicleNumber?: string;
}

interface TrackingData {
  id: string;
  status: string;
  deliveryPerson: DeliveryPerson;
  currentLocation: {
    lat: number;
    lng: number;
    updatedAt: string;
  } | null;
  eta: number;
  distanceRemaining: number;
  timestamps: {
    assigned: string;
    reachedPickup: string;
    pickedUp: string;
    delivered: string;
  };
}

interface LiveOrderTrackingProps {
  orderId: string;
  orderType: 'pharmacy' | 'meal';
  deliveryAddress: { lat: number; lng: number; address: string };
  onBack?: () => void;
}

export function LiveOrderTracking({ 
  orderId, 
  orderType, 
  deliveryAddress,
  onBack 
}: LiveOrderTrackingProps) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const deliveryMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Load tracking data
  useEffect(() => {
    loadTracking();
    const interval = setInterval(loadTracking, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [orderId, orderType]);

  // Load Google Maps with API key from Secrets Manager
  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (window.google?.maps) {
        initMap();
        return;
      }

      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const checkGoogle = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checkGoogle);
            initMap();
          }
        }, 100);
        return;
      }

      try {
        // Fetch API key from backend (Secrets Manager)
        const response = await apiClient.get('/config/google-maps-key') as any;
        const apiKey = response?.apiKey || response?.key;
        
        if (!apiKey) {
          console.warn('Google Maps API key not available');
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initTrackingMap`;
        script.async = true;
        script.defer = true;

        window.initTrackingMap = () => initMap();
        document.head.appendChild(script);
      } catch (error) {
        console.warn('Failed to fetch Google Maps API key:', error);
      }
    };

    loadGoogleMaps();
  }, []);

  // Update map when tracking changes
  useEffect(() => {
    if (mapLoaded && tracking?.currentLocation) {
      updateDeliveryMarker(tracking.currentLocation);
    }
  }, [tracking, mapLoaded]);

  const loadTracking = async () => {
    try {
      const response = await apiClient.get(`/delivery/order/${orderType}/${orderId}`) as any;
      if (response.success) {
        setTracking(response.tracking);
      }
    } catch (error) {
      console.error('Error loading tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const initMap = () => {
    if (!mapRef.current || googleMapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 15,
      center: { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    googleMapRef.current = map;

    // Add destination marker
    destinationMarkerRef.current = new window.google.maps.Marker({
      position: { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
      map,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#22c55e',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
      title: 'Delivery Location',
    });

    setMapLoaded(true);
  };

  const updateDeliveryMarker = (location: { lat: number; lng: number }) => {
    if (!googleMapRef.current) return;

    // Update or create delivery marker
    if (deliveryMarkerRef.current) {
      deliveryMarkerRef.current.setPosition({ lat: location.lat, lng: location.lng });
    } else {
      deliveryMarkerRef.current = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: googleMapRef.current,
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#f97316',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          rotation: 0,
        },
        title: 'Delivery Partner',
      });
    }

    // Draw/update route line
    if (polylineRef.current) {
      polylineRef.current.setPath([
        { lat: location.lat, lng: location.lng },
        { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
      ]);
    } else {
      polylineRef.current = new window.google.maps.Polyline({
        path: [
          { lat: location.lat, lng: location.lng },
          { lat: deliveryAddress.lat, lng: deliveryAddress.lng },
        ],
        geodesic: true,
        strokeColor: '#f97316',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: googleMapRef.current,
      });
    }

    // Fit bounds to show both markers
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: location.lat, lng: location.lng });
    bounds.extend({ lat: deliveryAddress.lat, lng: deliveryAddress.lng });
    googleMapRef.current.fitBounds(bounds, { padding: 50 });
  };

  const getStatusStep = (status: string): number => {
    const steps = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'on_the_way', 'nearby', 'delivered'];
    return steps.indexOf(status);
  };

  const formatETA = (minutes: number): string => {
    if (!minutes) return '--';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    // ✅ FIX: Show hours when >= 60 minutes
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hrs} ${hrs === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hrs}h ${mins}m`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Package className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Waiting for Pickup</h2>
        <p className="text-gray-600 text-center">
          Your order is being prepared. Tracking will start once it&apos;s picked up.
        </p>
        <button onClick={onBack} className="mt-6 text-orange-600 font-medium">
          Go Back
        </button>
      </div>
    );
  }

  const currentStep = getStatusStep(tracking.status);
  const isDelivered = tracking.status === 'delivered';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with ETA */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold">Live Tracking</h1>
            <p className="text-sm text-white/80">
              {isDelivered ? 'Order Delivered!' : tracking.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </p>
          </div>
        </div>

        {/* ETA Card */}
        {!isDelivered && tracking.eta && (
          <div className="bg-white/20 backdrop-blur rounded-2xl p-4 flex items-center gap-4">
            <div className="w-16 h-16 bg-white/30 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <p className="text-sm text-white/80">Arriving in</p>
              <p className="text-3xl font-bold">{formatETA(tracking.eta)}</p>
            </div>
            {tracking.distanceRemaining > 0 && (
              <div className="ml-auto text-right">
                <p className="text-sm text-white/80">Distance</p>
                <p className="text-xl font-semibold">{tracking.distanceRemaining.toFixed(1)} km</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="relative -mt-4">
        <div 
          ref={mapRef} 
          className="h-64 rounded-t-3xl overflow-hidden bg-gray-200"
        >
          {!mapLoaded && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Loading map...</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Live indicator */}
        {tracking.currentLocation && (
          <div className="absolute top-4 left-4 bg-white rounded-full px-3 py-1.5 shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-700">LIVE</span>
          </div>
        )}
      </div>

      {/* Delivery Person Card */}
      {tracking.deliveryPerson && !isDelivered && (
        <div className="mx-4 -mt-6 relative z-10">
          <div className="bg-white rounded-2xl shadow-lg p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white text-xl font-bold overflow-hidden">
              {tracking.deliveryPerson.photo ? (
                <img 
                  src={tracking.deliveryPerson.photo} 
                  alt={tracking.deliveryPerson.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                tracking.deliveryPerson.name?.charAt(0) || <User className="w-7 h-7" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{tracking.deliveryPerson.name}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Bike className="w-4 h-4" />
                <span>{tracking.deliveryPerson.vehicleNumber || 'Delivery Partner'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`tel:${tracking.deliveryPerson.phone}`}
                className="w-11 h-11 bg-green-100 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </a>
              <button className="w-11 h-11 bg-blue-100 rounded-full flex items-center justify-center active:scale-95 transition-transform">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="p-4 mt-4">
        <h3 className="font-semibold text-gray-900 mb-4">Delivery Status</h3>
        <div className="space-y-0">
          {[
            { key: 'picked_up', label: 'Picked Up', icon: Package },
            { key: 'on_the_way', label: 'On The Way', icon: Truck },
            { key: 'nearby', label: 'Nearby', icon: MapPin },
            { key: 'delivered', label: 'Delivered', icon: CheckCircle },
          ].map((step, index) => {
            const stepIndex = ['assigned', 'heading_to_pickup', 'at_pickup', 'picked_up', 'on_the_way', 'nearby', 'delivered'].indexOf(step.key);
            const isCompleted = currentStep >= stepIndex;
            const isCurrent = currentStep === stepIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-start gap-4">
                {/* Icon & Line */}
                <div className="relative flex-shrink-0 flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-100 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-100 scale-110' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {index < 3 && (
                    <div className={`w-0.5 h-12 ${
                      isCompleted && currentStep > stepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <p className={`font-medium ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-sm text-orange-500 font-medium mt-0.5 flex items-center gap-1">
                      <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      In Progress
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivered Success */}
      {isDelivered && (
        <div className="mx-4 mb-4">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Delivered!</h2>
            <p className="text-sm text-white/80 mb-4">
              Enjoy your {orderType === 'pharmacy' ? 'medicines' : 'meal'}!
            </p>
            <button className="bg-white text-green-600 px-6 py-2.5 rounded-full font-semibold flex items-center gap-2 mx-auto active:scale-95 transition-transform">
              <Star className="w-5 h-5" />
              Rate Delivery
            </button>
          </div>
        </div>
      )}

      {/* Delivery Address */}
      <div className="px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Delivering to</p>
              <p className="font-medium text-gray-900">{deliveryAddress.address}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
