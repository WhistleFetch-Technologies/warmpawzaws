'use client';

/**
 * ============================================================================
 * SERVICE RADIUS CONFIGURATION COMPONENT
 * ============================================================================
 * 
 * Allows solo providers to define their home service coverage area
 * - Visual radius selector on map
 * - Distance-based pricing tiers
 * - Travel time estimates
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Navigation, Save, AlertCircle, 
  Loader2, Plus, Trash2, Check, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RadiusTier {
  id: string;
  maxDistance: number; // in km
  additionalCharge: number; // in rupees
  estimatedTime: string;
}

interface ServiceRadiusConfigProps {
  vendorId: string;
  baseLocation?: { lat: number; lng: number };
  onSave?: () => void;
}

const DEFAULT_TIERS: RadiusTier[] = [
  { id: '1', maxDistance: 5, additionalCharge: 0, estimatedTime: '15-20 min' },
  { id: '2', maxDistance: 10, additionalCharge: 50, estimatedTime: '25-35 min' },
  { id: '3', maxDistance: 15, additionalCharge: 100, estimatedTime: '40-50 min' },
];

const RADIUS_OPTIONS = [3, 5, 7, 10, 15, 20, 25, 30];

export function ServiceRadiusConfig({
  vendorId,
  baseLocation,
  onSave,
}: ServiceRadiusConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maxRadius, setMaxRadius] = useState(10);
  const [tiers, setTiers] = useState<RadiusTier[]>(DEFAULT_TIERS);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(baseLocation || null);
  const [address, setAddress] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    loadConfig();
  }, [vendorId]);

  useEffect(() => {
    if (location && mapRef.current) {
      initMap();
    }
  }, [location]);

  useEffect(() => {
    if (circleRef.current && mapInstanceRef.current) {
      updateCircle();
    }
  }, [maxRadius]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/vendor/${vendorId}/service-radius`);
      if (res.success) {
        setMaxRadius(res.maxRadius || 10);
        setTiers(res.tiers || DEFAULT_TIERS);
        if (res.location) {
          setLocation(res.location);
          setAddress(res.address || '');
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
      // Load vendor profile for base location
      try {
        const profileRes = await apiClient.get<any>(`/vendor/${vendorId}/profile`);
        if (profileRes.lat && profileRes.lng) {
          setLocation({ lat: profileRes.lat, lng: profileRes.lng });
          setAddress(profileRes.address || '');
        }
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const initMap = async () => {
    if (!location || !mapRef.current) return;
    if (typeof window === 'undefined' || !window.google?.maps) {
      // Load Google Maps script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
      return;
    }

    // Create map
    const map = new window.google.maps.Map(mapRef.current, {
      center: location,
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapInstanceRef.current = map;

    // Create marker
    const marker = new window.google.maps.Marker({
      position: location,
      map,
      title: 'Your Location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#FF8C42',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
      },
    });
    markerRef.current = marker;

    // Create radius circle
    const circle = new window.google.maps.Circle({
      map,
      center: location,
      radius: maxRadius * 1000, // Convert km to meters
      fillColor: '#FF8C42',
      fillOpacity: 0.1,
      strokeColor: '#FF8C42',
      strokeOpacity: 0.8,
      strokeWeight: 2,
    });
    circleRef.current = circle;

    // Fit map to circle
    map.fitBounds(circle.getBounds()!);
  };

  const updateCircle = () => {
    if (circleRef.current) {
      circleRef.current.setRadius(maxRadius * 1000);
      if (mapInstanceRef.current && circleRef.current.getBounds()) {
        mapInstanceRef.current.fitBounds(circleRef.current.getBounds());
      }
    }
  };

  const handleRadiusChange = (value: number) => {
    setMaxRadius(value);
    
    // Auto-adjust tiers to match max radius
    const newTiers = tiers.filter(t => t.maxDistance <= value);
    if (newTiers.length === 0 || newTiers[newTiers.length - 1].maxDistance < value) {
      const lastCharge = newTiers.length > 0 ? newTiers[newTiers.length - 1].additionalCharge : 0;
      newTiers.push({
        id: `tier-${Date.now()}`,
        maxDistance: value,
        additionalCharge: lastCharge + 50,
        estimatedTime: `${Math.round(value * 3)}-${Math.round(value * 4)} min`,
      });
    }
    setTiers(newTiers);
  };

  const addTier = () => {
    if (tiers.length >= 5) {
      toast.error('Maximum 5 tiers allowed');
      return;
    }

    const lastTier = tiers[tiers.length - 1];
    const newDistance = Math.min(lastTier.maxDistance + 5, maxRadius);
    
    if (newDistance <= lastTier.maxDistance) {
      toast.error('Cannot add more tiers within current radius');
      return;
    }

    setTiers([...tiers, {
      id: `tier-${Date.now()}`,
      maxDistance: newDistance,
      additionalCharge: lastTier.additionalCharge + 50,
      estimatedTime: `${Math.round(newDistance * 3)}-${Math.round(newDistance * 4)} min`,
    }]);
  };

  const updateTier = (id: string, field: keyof RadiusTier, value: any) => {
    setTiers(tiers.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const removeTier = (id: string) => {
    if (tiers.length <= 1) {
      toast.error('At least one tier is required');
      return;
    }
    setTiers(tiers.filter(t => t.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put<any>(`/vendor/${vendorId}/service-radius`, {
        maxRadius,
        tiers,
        location,
        address,
      });

      if (res.success) {
        toast.success('Service radius updated successfully!');
        onSave?.();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(newLocation);
          
          // Reverse geocode
          try {
            const res = await apiClient.get<any>(
              `/maps/reverse-geocode?lat=${newLocation.lat}&lng=${newLocation.lng}`
            );
            if (res.address) {
              setAddress(res.address);
            }
          } catch (e) {
            console.error('Reverse geocode error:', e);
          }
          
          toast.success('Location detected!');
        },
        (error) => {
          toast.error('Could not detect location');
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Navigation className="w-6 h-6 text-[#FF8C42]" />
          Home Service Radius
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Define how far you're willing to travel for home visits
        </p>
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <div 
          ref={mapRef} 
          className="w-full h-64 bg-gray-100"
        >
          {!location && (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <MapPin className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 mb-3">No base location set</p>
              <Button onClick={detectLocation} variant="outline">
                <Navigation className="w-4 h-4 mr-2" />
                Detect My Location
              </Button>
            </div>
          )}
        </div>
        {location && (
          <div className="p-3 bg-gray-50 border-t flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4" />
              <span>{address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={detectLocation}>
              Update Location
            </Button>
          </div>
        )}
      </Card>

      {/* Radius Selector */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Maximum Travel Distance</h3>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((radius) => (
            <button
              key={radius}
              onClick={() => handleRadiusChange(radius)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                maxRadius === radius
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {radius} km
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-3 flex items-center gap-1">
          <Info className="w-4 h-4" />
          Customers outside this radius won't see your services for home visits
        </p>
      </Card>

      {/* Distance Pricing Tiers */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Distance-Based Pricing</h3>
            <p className="text-sm text-gray-500">Add extra charges for farther locations</p>
          </div>
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="w-4 h-4 mr-1" />
            Add Tier
          </Button>
        </div>

        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div 
              key={tier.id} 
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
            >
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-orange-600">{index + 1}</span>
              </div>
              
              <div className="flex-1 grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Up to (km)</label>
                  <input
                    type="number"
                    value={tier.maxDistance}
                    onChange={(e) => updateTier(tier.id, 'maxDistance', parseInt(e.target.value) || 0)}
                    min={index > 0 ? tiers[index - 1].maxDistance + 1 : 1}
                    max={maxRadius}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Extra Charge (₹)</label>
                  <input
                    type="number"
                    value={tier.additionalCharge}
                    onChange={(e) => updateTier(tier.id, 'additionalCharge', parseInt(e.target.value) || 0)}
                    min={0}
                    step={10}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Est. Travel Time</label>
                  <input
                    type="text"
                    value={tier.estimatedTime}
                    onChange={(e) => updateTier(tier.id, 'estimatedTime', e.target.value)}
                    placeholder="e.g., 15-20 min"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              {tiers.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => removeTier(tier.id)}
                  className="text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <h4 className="font-medium text-blue-900 mb-2">Pricing Preview</h4>
          <div className="space-y-1 text-sm text-blue-800">
            {tiers.map((tier, index) => (
              <div key={tier.id} className="flex justify-between">
                <span>
                  {index === 0 ? '0' : tiers[index - 1].maxDistance} - {tier.maxDistance} km
                </span>
                <span className="font-medium">
                  {tier.additionalCharge === 0 ? 'No extra charge' : `+₹${tier.additionalCharge}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={saving || !location}
        className="w-full bg-[#FF8C42] hover:bg-[#E67A35] py-6"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Save className="w-5 h-5 mr-2" />
            Save Configuration
          </>
        )}
      </Button>
    </div>
  );
}

export default ServiceRadiusConfig;
