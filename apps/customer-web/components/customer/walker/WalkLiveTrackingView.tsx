'use client';

/**
 * WalkLiveTrackingView - Real-time GPS tracking for dog walks
 * 
 * Features:
 * - Live map with walker position
 * - Route visualization
 * - Distance and duration stats
 * - Walk photos
 * - Direct messaging to walker
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  MapPin, Navigation, Clock, Footprints, Camera, 
  MessageCircle, Phone, ChevronLeft, RefreshCw,
  Dog, User, Battery, Signal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface WalkTrackingData {
  isActive: boolean;
  walker: {
    name: string;
    phone: string;
    image?: string;
  };
  petName: string;
  currentPosition: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    lastUpdated: string;
  };
  route: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
  stats: {
    distanceMeters: number;
    distanceKm: string;
    durationSeconds: number;
    durationMinutes: number;
  };
  photos: Array<{
    url: string;
    caption?: string;
    timestamp: string;
  }>;
  startedAt: string;
}

interface WalkLiveTrackingViewProps {
  bookingId: string;
  onBack?: () => void;
  onMessage?: () => void;
}

export function WalkLiveTrackingView({
  bookingId,
  onBack,
  onMessage
}: WalkLiveTrackingViewProps) {
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<WalkTrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchTrackingData();
    
    // Poll for updates every 5 seconds
    pollingRef.current = setInterval(fetchTrackingData, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [bookingId]);

  const fetchTrackingData = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${bookingId}/track-walk`);
      
      if (response?.success) {
        setTracking(response as unknown as WalkTrackingData);
        setError(null);
      } else if (!response?.isActive) {
        setError('Walk has not started yet or has ended');
      }
    } catch (err: any) {
      console.error('Error fetching tracking:', err);
      setError('Unable to fetch tracking data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getDirectionIcon = (heading?: number) => {
    if (!heading) return '→';
    const directions = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const index = Math.round(heading / 45) % 8;
    return directions[index];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading walk tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Dog className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Walk Not Active</h2>
          <p className="text-gray-600 mb-6">{error || 'The walk has not started yet or has already ended.'}</p>
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="flex items-center justify-between p-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="font-bold text-gray-900">Live Walk Tracking</h1>
            <p className="text-xs text-green-600 flex items-center justify-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </p>
          </div>
          <button 
            onClick={fetchTrackingData}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Map Placeholder */}
      <div 
        ref={mapRef}
        className="relative bg-gradient-to-br from-green-100 to-emerald-200 h-64 overflow-hidden"
      >
        {/* Simulated Map with Route */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Route Line (simplified visualization) */}
            <svg className="absolute inset-0 w-full h-full">
              <path
                d={`M 50 200 Q 100 150 150 180 T 250 160 T 350 140`}
                fill="none"
                stroke="#F97316"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="8,4"
                className="animate-pulse"
              />
            </svg>

            {/* Walker Position */}
            <div 
              className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-bounce"
              style={{ left: '80%', top: '35%' }}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white">
                  <Dog className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-xs text-white font-bold">
                    {getDirectionIcon(tracking.currentPosition.heading)}
                  </span>
                </div>
              </div>
            </div>

            {/* Start Point */}
            <div 
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: '15%', top: '80%' }}
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-md border-3 border-white">
                <MapPin className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Speed Indicator */}
        {tracking.currentPosition.speed && tracking.currentPosition.speed > 0 && (
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-orange-500" />
              <span className="font-bold text-gray-900">
                {tracking.currentPosition.speed.toFixed(1)} km/h
              </span>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md">
          <p className="text-xs text-gray-600">
            Updated {formatTime(tracking.currentPosition.lastUpdated)}
          </p>
        </div>
      </div>

      {/* Walker Info Card */}
      <div className="bg-white mx-4 -mt-6 rounded-xl shadow-lg p-4 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {tracking.walker.image ? (
                <img 
                  src={tracking.walker.image} 
                  alt={tracking.walker.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                tracking.walker.name.charAt(0)
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-900">{tracking.walker.name}</h3>
              <p className="text-sm text-gray-600">
                Walking {tracking.petName}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.href = `tel:${tracking.walker.phone}`}
              className="border-orange-200"
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={onMessage}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <Footprints className="w-6 h-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{tracking.stats.distanceKm}</p>
          <p className="text-xs text-gray-500">km walked</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <Clock className="w-6 h-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">
            {formatDuration(tracking.stats.durationSeconds)}
          </p>
          <p className="text-xs text-gray-500">duration</p>
        </div>
        <div className="bg-white rounded-xl p-4 text-center shadow-sm">
          <MapPin className="w-6 h-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{tracking.route.length}</p>
          <p className="text-xs text-gray-500">waypoints</p>
        </div>
      </div>

      {/* Walk Timeline */}
      <div className="bg-white mx-4 rounded-xl p-4 shadow-sm mb-4">
        <h3 className="font-bold text-gray-900 mb-3">Walk Timeline</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Dog className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Walk Started</p>
              <p className="text-xs text-gray-500">{formatTime(tracking.startedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center animate-pulse">
              <Footprints className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Currently Walking</p>
              <p className="text-xs text-gray-500">
                {tracking.stats.distanceKm} km covered
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Walk Photos */}
      {tracking.photos.length > 0 && (
        <div className="bg-white mx-4 rounded-xl p-4 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-orange-500" />
              Walk Photos
            </h3>
            <span className="text-xs text-gray-500">{tracking.photos.length} photos</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tracking.photos.map((photo, index) => (
              <div 
                key={index}
                className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100"
              >
                <img 
                  src={photo.url} 
                  alt={photo.caption || `Walk photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Notice */}
      <div className="bg-blue-50 mx-4 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Signal className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Live Tracking Active</p>
            <p className="text-xs text-blue-700">
              Location updates every 5 seconds. Your pet is safe with {tracking.walker.name}!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WalkLiveTrackingView;
