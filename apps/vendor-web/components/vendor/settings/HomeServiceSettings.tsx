'use client';

/**
 * Home Service Settings Component
 * Manages vendor's service radius, location, and home service configuration
 * Required for hyperlocal provider discovery
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { MapPin, Navigation, Clock, Save, RefreshCw, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

interface HomeServiceSettingsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onSave?: () => void;
}

interface ServiceRadiusConfig {
  serviceRadius: number; // in km
  isOnline: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationUpdate: string | null;
  autoLocationUpdate: boolean; // Auto-update location when online
  operatingHours: {
    start: string; // HH:MM
    end: string;   // HH:MM
  };
  daysAvailable: string[]; // ['monday', 'tuesday', ...]
  instantBooking: boolean; // Allow instant bookings
  advanceBookingDays: number; // How many days in advance customers can book
  minAdvanceNotice: number; // Minimum hours notice required
  maxDailyBookings: number; // Maximum bookings per day
  travelMode: 'driving' | 'walking' | 'bicycling';
}

export function HomeServiceSettings({ vendorId, vendorData, onBack, onSave }: HomeServiceSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  const [config, setConfig] = useState<ServiceRadiusConfig>({
    serviceRadius: 5, // Default 5km
    isOnline: false,
    currentLatitude: null,
    currentLongitude: null,
    lastLocationUpdate: null,
    autoLocationUpdate: true,
    operatingHours: {
      start: '09:00',
      end: '18:00'
    },
    daysAvailable: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    instantBooking: true,
    advanceBookingDays: 7,
    minAdvanceNotice: 2, // 2 hours
    maxDailyBookings: 10,
    travelMode: 'driving'
  });

  const weekDays = [
    { id: 'monday', label: 'Mon' },
    { id: 'tuesday', label: 'Tue' },
    { id: 'wednesday', label: 'Wed' },
    { id: 'thursday', label: 'Thu' },
    { id: 'friday', label: 'Fri' },
    { id: 'saturday', label: 'Sat' },
    { id: 'sunday', label: 'Sun' },
  ];

  useEffect(() => {
    loadSettings();
  }, [vendorId]);

  // Auto-update location when online status changes
  useEffect(() => {
    if (config.isOnline && config.autoLocationUpdate) {
      detectCurrentLocation();
    }
  }, [config.isOnline]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/home-service-settings`);
      
      if (response.success && response.settings) {
        setConfig(prev => ({
          ...prev,
          ...response.settings,
          operatingHours: response.settings.operatingHours || prev.operatingHours,
          daysAvailable: response.settings.daysAvailable || prev.daysAvailable
        }));
      }
    } catch (error: any) {
      console.log('Settings not found, using defaults');
      // If settings don't exist, that's fine - use defaults
    } finally {
      setLoading(false);
    }
  };

  const detectCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        setConfig(prev => ({
          ...prev,
          currentLatitude: latitude,
          currentLongitude: longitude,
          lastLocationUpdate: new Date().toISOString()
        }));

        // Try reverse geocoding to get address (for display only)
        try {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const response = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
            );
            const data = await response.json();
            if (data.results?.[0]) {
              toast.success(`Location updated: ${data.results[0].formatted_address.substring(0, 50)}...`);
            }
          }
        } catch (error) {
          console.log('Reverse geocoding failed, but location coordinates saved');
        }

        toast.success('Location detected successfully!');
        setDetectingLocation(false);
      },
      (error) => {
        setDetectingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Location permission denied. Please enable location access.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error('Location unavailable. Please try again.');
        } else if (error.code === error.TIMEOUT) {
          toast.error('Location request timed out.');
        } else {
          toast.error('Unable to get location.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleSave = async () => {
    // Validate
    if (config.serviceRadius < 1 || config.serviceRadius > 50) {
      toast.error('Service radius must be between 1 and 50 km');
      return;
    }

    if (!config.currentLatitude || !config.currentLongitude) {
      toast.error('Please set your current location first');
      return;
    }

    if (config.daysAvailable.length === 0) {
      toast.error('Please select at least one available day');
      return;
    }

    try {
      setSaving(true);
      
      await apiClient.put(`/vendor/${vendorId}/home-service-settings`, config);
      
      toast.success('Home service settings saved successfully!');
      onSave?.();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayId: string) => {
    setConfig(prev => ({
      ...prev,
      daysAvailable: prev.daysAvailable.includes(dayId)
        ? prev.daysAvailable.filter(d => d !== dayId)
        : [...prev.daysAvailable, dayId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
                ←
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-lg font-bold">Home Service Settings</h1>
              <p className="text-sm text-white/80">Configure your service radius & availability</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Online Status Toggle */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.isOnline ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <div className={`w-3 h-3 rounded-full ${config.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Online Status</h3>
                  <p className="text-sm text-gray-500">
                    {config.isOnline ? 'You are visible to customers' : 'Go online to receive bookings'}
                  </p>
                </div>
              </div>
              <Switch
                checked={config.isOnline}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, isOnline: checked }))}
              />
            </div>
          </Card>

          {/* Current Location */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-green-600" />
              Your Current Location
            </h3>
            
            {config.currentLatitude && config.currentLongitude ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Location Set</span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Lat: {config.currentLatitude.toFixed(6)}, Lng: {config.currentLongitude.toFixed(6)}
                  </p>
                  {config.lastLocationUpdate && (
                    <p className="text-xs text-green-500 mt-1">
                      Last updated: {new Date(config.lastLocationUpdate).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={detectCurrentLocation}
                  disabled={detectingLocation}
                  className="w-full"
                >
                  {detectingLocation ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                  ) : (
                    <><Navigation className="w-4 h-4 mr-2" /> Update Location</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">Location Required</span>
                  </div>
                  <p className="text-xs text-amber-600 mt-1">
                    Set your location to appear in customer searches
                  </p>
                </div>
                <Button
                  onClick={detectCurrentLocation}
                  disabled={detectingLocation}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {detectingLocation ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Detecting...</>
                  ) : (
                    <><Navigation className="w-4 h-4 mr-2" /> Detect My Location</>
                  )}
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Auto-update when online</span>
              </div>
              <Switch
                checked={config.autoLocationUpdate}
                onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoLocationUpdate: checked }))}
              />
            </div>
          </Card>

          {/* Service Radius */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Service Radius
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={config.serviceRadius}
                  onChange={(e) => setConfig(prev => ({ ...prev, serviceRadius: parseFloat(e.target.value) || 5 }))}
                  className="w-24"
                />
                <span className="text-gray-600">kilometers</span>
              </div>
              
              {/* Radius Slider */}
              <input
                type="range"
                min={1}
                max={50}
                value={config.serviceRadius}
                onChange={(e) => setConfig(prev => ({ ...prev, serviceRadius: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 km</span>
                <span>25 km</span>
                <span>50 km</span>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <Info className="w-4 h-4 inline mr-1" />
                  Customers within <strong>{config.serviceRadius} km</strong> of your location will see you in search results.
                </p>
              </div>
            </div>
          </Card>

          {/* Travel Mode */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Travel Mode</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'driving', icon: '🚗', label: 'Driving' },
                { id: 'bicycling', icon: '🚲', label: 'Bicycle' },
                { id: 'walking', icon: '🚶', label: 'Walking' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setConfig(prev => ({ ...prev, travelMode: mode.id as any }))}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    config.travelMode === mode.id
                      ? 'border-green-600 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl block text-center">{mode.icon}</span>
                  <span className="text-xs block text-center mt-1">{mode.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Operating Hours */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Operating Hours
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-sm text-gray-600">Start Time</Label>
                <Input
                  type="time"
                  value={config.operatingHours.start}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    operatingHours: { ...prev.operatingHours, start: e.target.value }
                  }))}
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">End Time</Label>
                <Input
                  type="time"
                  value={config.operatingHours.end}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    operatingHours: { ...prev.operatingHours, end: e.target.value }
                  }))}
                />
              </div>
            </div>

            <Label className="text-sm text-gray-600 mb-2 block">Available Days</Label>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    config.daysAvailable.includes(day.id)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </Card>

          {/* Booking Settings */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Booking Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Instant Booking</Label>
                  <p className="text-xs text-gray-500">Allow customers to book instantly</p>
                </div>
                <Switch
                  checked={config.instantBooking}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, instantBooking: checked }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-600">Advance Booking (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={config.advanceBookingDays}
                    onChange={(e) => setConfig(prev => ({ ...prev, advanceBookingDays: parseInt(e.target.value) || 7 }))}
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Min Notice (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    value={config.minAdvanceNotice}
                    onChange={(e) => setConfig(prev => ({ ...prev, minAdvanceNotice: parseInt(e.target.value) || 2 }))}
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-600">Max Daily Bookings</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={config.maxDailyBookings}
                  onChange={(e) => setConfig(prev => ({ ...prev, maxDailyBookings: parseInt(e.target.value) || 10 }))}
                />
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg"
          >
            {saving ? (
              <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> Save Settings</>
            )}
          </Button>

          <div className="pb-8" />
        </div>
      </div>
    </div>
  );
}
