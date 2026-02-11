"use client";

/**
 * HomeServiceLiveTracking - Customer View for Tracking Service Provider
 * 
 * Features:
 * - Real-time GPS tracking of service provider
 * - ETA display
 * - Provider status updates
 * - OTP display for session start/end
 * - Route visualization for walker sessions
 * - Session progress tracking
 */

import { useState, useEffect, useRef } from 'react';
import { 
  X, MapPin, Clock, User, Phone, MessageCircle, Navigation,
  CheckCircle2, AlertTriangle, RefreshCw, Route, Zap, Car, Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface HomeServiceLiveTrackingProps {
  bookingId: string;
  phone: string;
  onClose: () => void;
  onComplete?: () => void;
  initialData?: {
    providerName: string;
    providerPhoto?: string;
    providerPhone?: string;
    serviceName: string;
    serviceType: string;
    petName: string;
    scheduledTime: string;
    startOtp?: string;
    endOtp?: string;
    isWalkerSession?: boolean;
  };
}

interface TrackingData {
  status: 'pending' | 'traveling' | 'arrived' | 'in_progress' | 'completed';
  providerLocation: {
    latitude: number;
    longitude: number;
    updatedAt: string;
  } | null;
  eta: number | null; // minutes
  distanceRemaining: number | null; // km
  
  // Session data
  sessionStartedAt: string | null;
  sessionDuration: number; // seconds
  routeDistance: number; // meters
  routePoints: Array<{ latitude: number; longitude: number }>;
  
  // OTPs
  startOtp: string | null;
  endOtp: string | null;
}

export function HomeServiceLiveTracking({
  bookingId,
  phone,
  onClose,
  onComplete,
  initialData
}: HomeServiceLiveTrackingProps) {
  const [loading, setLoading] = useState(true);
  const [trackingData, setTrackingData] = useState<TrackingData>({
    status: 'pending',
    providerLocation: null,
    eta: null,
    distanceRemaining: null,
    sessionStartedAt: null,
    sessionDuration: 0,
    routeDistance: 0,
    routePoints: [],
    startOtp: initialData?.startOtp || null,
    endOtp: initialData?.endOtp || null
  });
  
  const [showOtp, setShowOtp] = useState<'start' | 'end' | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Duration timer
  const [displayDuration, setDisplayDuration] = useState(0);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (trackingData.sessionStartedAt && trackingData.status === 'in_progress') {
      timer = setInterval(() => {
        const start = new Date(trackingData.sessionStartedAt!).getTime();
        const now = Date.now();
        setDisplayDuration(Math.floor((now - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [trackingData.sessionStartedAt, trackingData.status]);

  // Load initial data and start polling
  useEffect(() => {
    loadTrackingData();
    
    // Poll for updates every 10 seconds
    pollingRef.current = setInterval(loadTrackingData, 10000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [bookingId]);

  const loadTrackingData = async () => {
    try {
      const response = await apiClient.get<any>(`/tracking/booking/${bookingId}`);
      
      if (response.success && response.tracking) {
        const t = response.tracking;
        // Normalize backend shape to UI shape (backend: currentLocation, estimatedEtaMinutes, distanceKm, startedAt; status: started|in_transit|arrived|completed)
        const statusMap: Record<string, TrackingData['status']> = {
          started: 'traveling',
          in_transit: 'traveling',
          traveling: 'traveling',
          arrived: 'arrived',
          in_progress: 'in_progress',
          completed: 'completed',
        };
        setTrackingData(prev => {
          const normalized = {
            status: statusMap[t.status] ?? (t.status === 'completed' ? 'completed' : 'pending'),
            providerLocation: t.currentLocation
              ? {
                  latitude: t.currentLocation.latitude,
                  longitude: t.currentLocation.longitude,
                  updatedAt: t.currentLocation.timestamp || (t.currentLocation as any).updatedAt || new Date().toISOString(),
                }
              : null,
            eta: t.estimatedEtaMinutes ?? t.eta ?? null,
            distanceRemaining: t.distanceKm ?? t.distanceRemaining ?? null,
            sessionStartedAt: t.sessionStartedAt ?? t.startedAt ?? null,
            routeDistance: t.routeDistance ?? prev.routeDistance ?? 0,
            routePoints: t.routePoints ?? prev.routePoints,
            startOtp: t.startOtp ?? prev.startOtp ?? initialData?.startOtp ?? null,
            endOtp: t.endOtp ?? prev.endOtp ?? initialData?.endOtp ?? null,
          };
          if (normalized.status === 'completed' && pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          return { ...prev, ...normalized };
        });
      }
    } catch (error) {
      console.error('Error loading tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Format duration
  // ✅ FIX: Format ETA to show hours when >= 60 minutes
  const formatETA = (minutes: number | null): string => {
    if (minutes === null) return 'Calculating...';
    if (minutes < 1) return 'Less than 1 min';
    if (minutes === 1) return '1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Format distance
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  };

  // Get status info
  const getStatusInfo = () => {
    switch (trackingData.status) {
      case 'pending':
        return { 
          color: 'bg-gray-100 text-gray-700', 
          label: 'Waiting to Start',
          message: 'Your service provider will start soon',
          icon: Clock
        };
      case 'traveling':
        return { 
          color: 'bg-blue-100 text-blue-700', 
          label: 'On the Way',
          message: trackingData.eta ? `Arriving in ~${formatETA(trackingData.eta)}` : 'Coming to you...',
          icon: Car
        };
      case 'arrived':
        return { 
          color: 'bg-amber-100 text-amber-700', 
          label: 'Arrived',
          message: 'Your service provider has arrived!',
          icon: MapPin
        };
      case 'in_progress':
        return { 
          color: 'bg-green-100 text-green-700', 
          label: 'In Progress',
          message: 'Service is in progress',
          icon: Zap
        };
      case 'completed':
        return { 
          color: 'bg-purple-100 text-purple-700', 
          label: 'Completed',
          message: 'Service completed successfully!',
          icon: CheckCircle2
        };
      default:
        return { 
          color: 'bg-gray-100 text-gray-700', 
          label: 'Unknown',
          message: '',
          icon: AlertTriangle
        };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div 
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 rounded-t-3xl text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl overflow-hidden flex items-center justify-center">
              {initialData?.providerPhoto ? (
                <img src={initialData.providerPhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-white" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{initialData?.providerName || 'Service Provider'}</h2>
              <p className="text-white/80 text-sm">{initialData?.serviceName}</p>
              <Badge className={`mt-1 ${statusInfo.color}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </div>
          </div>
          
          {/* Contact Buttons */}
          {initialData?.providerPhone && trackingData.status !== 'completed' && (
            <div className="flex gap-2 mt-4">
              <a 
                href={`tel:${initialData.providerPhone}`}
                className="flex-1 flex items-center justify-center gap-2 bg-white/20 py-2 rounded-lg hover:bg-white/30 transition"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">Call</span>
              </a>
              <button className="flex-1 flex items-center justify-center gap-2 bg-white/20 py-2 rounded-lg hover:bg-white/30 transition">
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm">Message</span>
              </button>
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Status Message */}
          <Card className={`p-4 ${statusInfo.color.replace('text-', 'border-').replace('100', '200')}`}>
            <div className="flex items-center gap-3">
              <StatusIcon className={`w-8 h-8 ${statusInfo.color.split(' ')[1]}`} />
              <div>
                <p className="font-semibold">{statusInfo.label}</p>
                <p className="text-sm opacity-80">{statusInfo.message}</p>
              </div>
            </div>
          </Card>

          {/* Live Location Map Placeholder */}
          {(trackingData.status === 'traveling' || trackingData.status === 'in_progress') && (
            <Card className="overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-blue-100 to-green-100 relative">
                {/* Map placeholder - integrate Google Maps in production */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    {trackingData.status === 'traveling' ? (
                      <>
                        <Navigation className="w-12 h-12 text-blue-600 animate-bounce mx-auto mb-2" />
                        <p className="font-medium text-gray-700">Live Tracking</p>
                        {trackingData.distanceRemaining && (
                          <p className="text-sm text-gray-500">
                            {trackingData.distanceRemaining.toFixed(1)} km away
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Route className="w-12 h-12 text-green-600 mx-auto mb-2" />
                        <p className="font-medium text-gray-700">Session in Progress</p>
                        {initialData?.isWalkerSession && (
                          <p className="text-sm text-gray-500">
                            {formatDistance(trackingData.routeDistance)} walked
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                
                {/* Last updated indicator */}
                {trackingData.providerLocation && (
                  <div className="absolute bottom-2 left-2 bg-white/80 backdrop-blur px-2 py-1 rounded text-xs text-gray-600">
                    Updated: {new Date(trackingData.providerLocation.updatedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* ETA Card */}
          {trackingData.status === 'traveling' && trackingData.eta !== null && (
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Estimated Arrival</p>
                  <p className="text-3xl font-bold text-blue-900">{formatETA(trackingData.eta)}</p>
                </div>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Car className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              </div>
            </Card>
          )}

          {/* Session Stats */}
          {trackingData.status === 'in_progress' && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center bg-green-50 border-green-200">
                <Clock className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-900">{formatDuration(displayDuration)}</p>
                <p className="text-xs text-green-700">Duration</p>
              </Card>
              
              {initialData?.isWalkerSession && (
                <Card className="p-4 text-center bg-purple-50 border-purple-200">
                  <Route className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-900">
                    {formatDistance(trackingData.routeDistance)}
                  </p>
                  <p className="text-xs text-purple-700">Distance</p>
                </Card>
              )}
            </div>
          )}

          {/* OTP Section */}
          {(trackingData.status === 'arrived' || trackingData.status === 'in_progress') && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Session OTP</h3>
              
              {trackingData.status === 'arrived' && trackingData.startOtp && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-800 mb-2">
                    Share this OTP with {initialData?.providerName} to start the session:
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {trackingData.startOtp.split('').map((digit, idx) => (
                      <span 
                        key={idx}
                        className="w-10 h-12 bg-white border-2 border-amber-300 rounded-lg flex items-center justify-center text-2xl font-bold text-amber-900"
                      >
                        {showOtp === 'start' ? digit : '•'}
                      </span>
                    ))}
                    <button
                      onClick={() => setShowOtp(showOtp === 'start' ? null : 'start')}
                      className="ml-2 text-amber-600 hover:text-amber-800"
                    >
                      {showOtp === 'start' ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {trackingData.status === 'in_progress' && trackingData.endOtp && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-800 mb-2">
                    Share this OTP to end the session:
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    {trackingData.endOtp.split('').map((digit, idx) => (
                      <span 
                        key={idx}
                        className="w-10 h-12 bg-white border-2 border-green-300 rounded-lg flex items-center justify-center text-2xl font-bold text-green-900"
                      >
                        {showOtp === 'end' ? digit : '•'}
                      </span>
                    ))}
                    <button
                      onClick={() => setShowOtp(showOtp === 'end' ? null : 'end')}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      {showOtp === 'end' ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Completion Summary */}
          {trackingData.status === 'completed' && (
            <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-green-900 mb-2">Service Completed!</h3>
                <p className="text-green-700 mb-4">
                  Thank you for using {initialData?.serviceName}
                </p>
                
                {/* Session Summary */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3">
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="font-semibold">{formatDuration(trackingData.sessionDuration)}</p>
                  </div>
                  {initialData?.isWalkerSession && (
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-sm text-gray-500">Distance</p>
                      <p className="font-semibold">{formatDistance(trackingData.routeDistance)}</p>
                    </div>
                  )}
                </div>

                {/* Rating Prompt */}
                <Button
                  onClick={onComplete}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Rate & Review
                </Button>
              </div>
            </Card>
          )}

          {/* Pet Info */}
          <Card className="p-3 bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🐾</span>
              <div>
                <p className="text-sm text-gray-600">Pet</p>
                <p className="font-medium">{initialData?.petName}</p>
              </div>
            </div>
          </Card>

          <div className="pb-6" />
        </div>
      </div>
    </div>
  );
}

export default HomeServiceLiveTracking;
