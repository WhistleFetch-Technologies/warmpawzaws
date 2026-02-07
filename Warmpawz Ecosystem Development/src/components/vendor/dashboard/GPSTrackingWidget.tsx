import { useState, useEffect } from 'react';
import { Navigation } from 'lucide-react';
import { Button } from '../../ui/button';
import { toast } from 'sonner@2.0.3';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface GPSTrackingWidgetProps {
  staffId: string;
  isSoloProvider: boolean;
  onUpdate: () => void;
}

export function GPSTrackingWidget({ staffId, isSoloProvider, onUpdate }: GPSTrackingWidgetProps) {
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [position, setPosition] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const API_BASE = getApiBaseUrl();

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (trackingEnabled) {
      // Update immediately
      updateLocation();

      // Then update every 30 seconds
      interval = setInterval(updateLocation, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [trackingEnabled, staffId]);

  const updateLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);

      const response = await fetch(`${API_BASE}/staff/${staffId}/gps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        setLastUpdate(new Date().toISOString());
      }
    } catch (error) {
      console.error('GPS update error:', error);
      toast.error('Failed to update location');
    }
  };

  const handleToggle = async () => {
    if (!trackingEnabled) {
      try {
        await getCurrentPosition(); // Test permission first
        setTrackingEnabled(true);
        toast.success('GPS tracking enabled');
      } catch (error) {
        toast.error('Please enable location permission');
      }
    } else {
      setTrackingEnabled(false);
      toast.success('GPS tracking disabled');
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">GPS Tracking</h3>
          <p className="text-sm text-gray-600">
            {isSoloProvider 
              ? 'Enable when traveling to customer locations'
              : 'Let customers track your arrival'
            }
          </p>
        </div>
        <Button
          variant={trackingEnabled ? 'default' : 'outline'}
          onClick={handleToggle}
          className={trackingEnabled ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          {trackingEnabled ? '🟢 Tracking Active' : 'Start Tracking'}
        </Button>
      </div>

      {trackingEnabled && (
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <p className="text-sm text-green-800">
            ✓ Your location is being shared with customers
          </p>
          {lastUpdate && (
            <p className="text-xs text-gray-600 mt-1">
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </p>
          )}
          {position && (
            <p className="text-xs text-gray-600">
              Lat: {position.coords.latitude.toFixed(6)}, Lng: {position.coords.longitude.toFixed(6)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
