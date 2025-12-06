import { useState, useEffect, useRef } from 'react';
import { trackingApi } from '../../utils/api/client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Navigation, MapPin, Clock, TrendingUp, Users, Phone, MessageCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface TrackingSession {
  bookingId: string;
  vendorId: string;
  vendorName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  serviceName: string;
  status: 'en_route' | 'arrived' | 'in_progress' | 'completed';
  vendorLocation: {
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
  };
  customerLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  route?: Array<{ lat: number; lng: number }>;
  distanceTraveled: number;
  distanceRemaining: number;
  eta: number; // minutes
  speed?: number; // km/h
  startedAt: string;
  updatedAt: string;
}

const STATUS_CONFIG = {
  en_route: { label: 'En Route', color: 'bg-blue-500', icon: '🚗' },
  arrived: { label: 'Arrived', color: 'bg-yellow-500', icon: '📍' },
  in_progress: { label: 'In Progress', color: 'bg-purple-500', icon: '⚡' },
  completed: { label: 'Completed', color: 'bg-green-500', icon: '✅' }
};

export function GPSTrackingDashboard() {
  const [activeSessions, setActiveSessions] = useState<TrackingSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<TrackingSession[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [wsConnected, setWsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<any>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mock Google Maps API key - replace with actual
  const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

  useEffect(() => {
    loadActiveSessions();
    connectWebSocket();
    
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(loadActiveSessions, 30000); // Refresh every 30s
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [autoRefresh]);

  useEffect(() => {
    filterSessions();
  }, [activeSessions, searchTerm, statusFilter, serviceFilter]);

  async function loadActiveSessions() {
    try {
      setLoading(true);
      const data = await trackingApi.getActive();
      setActiveSessions(data.sessions || []);
    } catch (error: any) {
      console.error('Error loading tracking sessions:', error);
      toast.error(error.message || 'Failed to load tracking sessions');
    } finally {
      setLoading(false);
    }
  }

  function connectWebSocket() {
    try {
      const wsUrl = 'wss://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/ws/tracking';
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        toast.success('Live tracking connected');
      };

      socket.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          
          // Update session with new location
          setActiveSessions(prev => prev.map(session => 
            session.bookingId === update.bookingId
              ? {
                  ...session,
                  vendorLocation: update.location,
                  distanceRemaining: update.distanceRemaining || session.distanceRemaining,
                  eta: update.eta || session.eta,
                  speed: update.speed || session.speed,
                  updatedAt: update.timestamp
                }
              : session
          ));
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      socket.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        
        // Attempt reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000);
      };

      wsRef.current = socket;
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }

  function filterSessions() {
    let filtered = activeSessions;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(session => session.status === statusFilter);
    }

    // Service filter
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(session => session.serviceType === serviceFilter);
    }

    setFilteredSessions(filtered);
  }

  function getTimeSinceUpdate(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  function formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  // Calculate summary stats
  const totalActive = activeSessions.length;
  const enRouteCount = activeSessions.filter(s => s.status === 'en_route').length;
  const arrivedCount = activeSessions.filter(s => s.status === 'arrived').length;
  const inProgressCount = activeSessions.filter(s => s.status === 'in_progress').length;
  const avgETA = activeSessions.length > 0 
    ? Math.round(activeSessions.reduce((sum, s) => sum + s.eta, 0) / activeSessions.length)
    : 0;

  const uniqueServices = [...new Set(activeSessions.map(s => s.serviceType))];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Active Sessions List */}
      <div className="w-96 bg-white shadow-lg overflow-y-auto">
        <div className="p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Live Tracking</h2>
              <p className="text-xs text-gray-500">
                {totalActive} active session{totalActive !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={wsConnected ? 'default' : 'secondary'} className="text-xs">
                <div className={`w-2 h-2 rounded-full mr-1 ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                {wsConnected ? 'Live' : 'Offline'}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={loadActiveSessions}
                disabled={loading}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="space-y-2">
            <Input
              placeholder="Search bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm"
            />
            
            <div className="grid grid-cols-2 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="en_route">En Route</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                </SelectContent>
              </Select>

              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Services</SelectItem>
                  {uniqueServices.map(service => (
                    <SelectItem key={service} value={service}>{service}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="divide-y">
          {loading && activeSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Loading tracking sessions...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No active tracking sessions found
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isSelected = selectedBooking === session.bookingId;
              const statusConfig = STATUS_CONFIG[session.status];
              
              return (
                <div
                  key={session.bookingId}
                  onClick={() => setSelectedBooking(session.bookingId)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-orange-50 border-l-4 border-orange-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm">{session.serviceName}</h3>
                        <Badge variant="outline" className="text-xs">
                          {statusConfig.icon} {statusConfig.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{session.customerName}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Vendor:</span>
                      <span className="font-medium">{session.vendorName}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">ETA:</span>
                      <span className="font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.eta} min
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Distance:</span>
                      <span className="font-medium">
                        {(session.distanceRemaining / 1000).toFixed(1)} km
                      </span>
                    </div>

                    {session.speed && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Speed:</span>
                        <span className="font-medium">{session.speed} km/h</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-gray-400">
                      <span>Last updated:</span>
                      <span>{getTimeSinceUpdate(session.updatedAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      <Phone className="w-3 h-3 mr-1" />
                      Call
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      <MessageCircle className="w-3 h-3 mr-1" />
                      Message
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 flex flex-col">
        {/* Summary Bar */}
        <div className="bg-white border-b p-4">
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Active</p>
                  <p className="text-2xl font-bold">{totalActive}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">En Route</p>
                  <p className="text-2xl font-bold text-blue-600">{enRouteCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Arrived</p>
                  <p className="text-2xl font-bold text-yellow-600">{arrivedCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="text-2xl font-bold text-purple-600">{inProgressCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Avg ETA</p>
                  <p className="text-2xl font-bold text-orange-600">{avgETA}m</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-gray-200">
          {/* Placeholder for Google Maps */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <MapPin className="w-16 h-16 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-700">Google Maps Integration</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Configure Google Maps API key to enable live map tracking
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Set VITE_GOOGLE_MAPS_API_KEY in your environment variables
                </p>
              </div>

              {/* Mock Map View */}
              <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto mt-4">
                <h4 className="font-medium mb-3">Active Sessions on Map:</h4>
                <div className="space-y-2">
                  {activeSessions.slice(0, 3).map((session) => (
                    <div key={session.bookingId} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[session.status].color}`} />
                        <span>{session.vendorName}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        📍 {session.vendorLocation.lat.toFixed(4)}, {session.vendorLocation.lng.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Implementation Note */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg mx-auto text-left">
                <p className="text-sm font-medium text-blue-900 mb-2">To enable Google Maps:</p>
                <ol className="text-xs text-blue-700 space-y-1 ml-4 list-decimal">
                  <li>Get a Google Maps API key from Google Cloud Console</li>
                  <li>Enable Maps JavaScript API and Directions API</li>
                  <li>Add the API key to your .env file as VITE_GOOGLE_MAPS_API_KEY</li>
                  <li>Install @react-google-maps/api package</li>
                  <li>Uncomment the GoogleMap component below</li>
                </ol>
              </div>
            </div>
          </div>

          {/* 
          // Uncomment this when Google Maps API key is configured:
          
          <GoogleMap
            zoom={12}
            center={
              selectedBooking 
                ? activeSessions.find(s => s.bookingId === selectedBooking)?.vendorLocation 
                : { lat: 12.9716, lng: 77.5946 }
            }
            mapContainerClassName="w-full h-full"
            options={{
              styles: [/* custom map styles */],
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
            }}
          >
            {activeSessions.map(session => (
              <React.Fragment key={session.bookingId}>
                // Vendor Marker
                <Marker
                  position={session.vendorLocation}
                  icon={{
                    url: '/vendor-marker.png',
                    scaledSize: new google.maps.Size(40, 40)
                  }}
                  label={{
                    text: session.vendorName,
                    className: 'marker-label'
                  }}
                />

                // Customer Marker
                <Marker
                  position={session.customerLocation}
                  icon={{
                    url: '/customer-marker.png',
                    scaledSize: new google.maps.Size(40, 40)
                  }}
                />

                // Route Polyline
                {session.route && (
                  <Polyline
                    path={session.route}
                    options={{
                      strokeColor: STATUS_CONFIG[session.status].color,
                      strokeWeight: 4,
                      strokeOpacity: 0.8
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </GoogleMap>
          */}
        </div>

        {/* Selected Booking Details Panel */}
        {selectedBooking && (
          <div className="bg-white border-t p-4">
            {(() => {
              const session = activeSessions.find(s => s.bookingId === selectedBooking);
              if (!session) return null;

              return (
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{session.serviceName}</h3>
                      <p className="text-sm text-gray-600">Booking ID: {session.bookingId}</p>
                    </div>
                    <Badge className={STATUS_CONFIG[session.status].color}>
                      {STATUS_CONFIG[session.status].icon} {STATUS_CONFIG[session.status].label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-xs text-gray-500">Vendor</Label>
                      <p className="font-medium">{session.vendorName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Customer</Label>
                      <p className="font-medium">{session.customerName}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Distance Remaining</Label>
                      <p className="font-medium">{(session.distanceRemaining / 1000).toFixed(2)} km</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">ETA</Label>
                      <p className="font-medium">{session.eta} minutes</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
