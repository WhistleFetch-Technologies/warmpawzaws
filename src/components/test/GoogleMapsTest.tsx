import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle2, XCircle, AlertCircle, MapPin } from 'lucide-react';

export function GoogleMapsTest() {
  const [envKey, setEnvKey] = useState<string>('');
  const [backendKey, setBackendKey] = useState<string>('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [error, setError] = useState<string>('');
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check environment variable
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    console.log('🔍 Environment key:', key);
    setEnvKey(key || 'Not found');

    // Check backend
    fetchBackendKey();
  }, []);

  const fetchBackendKey = async () => {
    try {
      const response = await fetch(
        'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/integrations/settings',
        {
          headers: {
            Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const key = data.settings?.googleMaps?.apiKey;
        console.log('🔍 Backend key:', key);
        setBackendKey(key || 'Not found');
      } else {
        setBackendKey(`Error: ${response.status}`);
      }
    } catch (err) {
      setBackendKey(`Error: ${err}`);
    }
  };

  const testMapLoad = () => {
    const apiKey = envKey !== 'Not found' ? envKey : backendKey !== 'Not found' ? backendKey : '';
    
    if (!apiKey) {
      setError('No API key available');
      return;
    }

    // Check if already loaded
    if ((window as any).google?.maps) {
      setScriptLoaded(true);
      initMap();
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = () => {
      console.log('✅ Script loaded');
      setScriptLoaded(true);
      initMap();
    };
    script.onerror = (err) => {
      console.error('❌ Script error:', err);
      setError('Failed to load Google Maps script');
    };
    document.head.appendChild(script);
  };

  const initMap = () => {
    if (!mapRef.current) return;
    if (!(window as any).google?.maps) {
      setError('Google Maps API not available');
      return;
    }

    try {
      const map = new (window as any).google.maps.Map(mapRef.current, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 5
      });

      const marker = new (window as any).google.maps.Marker({
        map: map,
        position: { lat: 20.5937, lng: 78.9629 },
        draggable: true
      });

      setMapInitialized(true);
      console.log('✅ Map initialized');
    } catch (err) {
      console.error('❌ Map init error:', err);
      setError(`Map initialization failed: ${err}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Google Maps API Test</h1>

        <Card>
          <CardHeader>
            <CardTitle>API Key Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              {envKey !== 'Not found' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-sm">Environment Variable (VITE_GOOGLE_MAPS_API_KEY)</p>
                <p className="text-xs text-gray-600 font-mono mt-1">
                  {envKey !== 'Not found' ? `${envKey.substring(0, 20)}...` : envKey}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {backendKey !== 'Not found' && !backendKey.startsWith('Error') ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-sm">Backend Settings (KV Store)</p>
                <p className="text-xs text-gray-600 font-mono mt-1">
                  {backendKey !== 'Not found' && !backendKey.startsWith('Error')
                    ? `${backendKey.substring(0, 20)}...`
                    : backendKey}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {scriptLoaded ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-sm">Google Maps Script Loaded</p>
                <p className="text-xs text-gray-600 mt-1">
                  {scriptLoaded ? 'Yes' : 'Not yet loaded'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              {mapInitialized ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-sm">Map Initialized</p>
                <p className="text-xs text-gray-600 mt-1">
                  {mapInitialized ? 'Yes' : 'Not yet initialized'}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-semibold">Error:</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Map Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testMapLoad} className="w-full">
              <MapPin className="w-4 h-4 mr-2" />
              Test Load Google Maps
            </Button>

            <div 
              ref={mapRef}
              className="w-full h-96 rounded-lg border-2 border-gray-300 bg-gray-100"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto">
{`Environment Check:
- import.meta.env exists: ${typeof import.meta !== 'undefined' && !!import.meta.env}
- VITE_GOOGLE_MAPS_API_KEY: ${envKey}

Backend Check:
- API Key from KV Store: ${backendKey}

Script Status:
- window.google exists: ${!!(window as any).google}
- window.google.maps exists: ${!!((window as any).google?.maps)}

Map Status:
- Script Loaded: ${scriptLoaded}
- Map Initialized: ${mapInitialized}
- Error: ${error || 'None'}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
