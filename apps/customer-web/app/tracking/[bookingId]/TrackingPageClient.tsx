'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface TrackingData {
  booking_id: string;
  staff_name: string;
  staff_phone: string;
  staff_photo_url?: string;
  current_location: {
    latitude: number;
    longitude: number;
  };
  destination: {
    latitude: number;
    longitude: number;
    address: string;
  };
  eta_minutes: number | null;
  distance_km: number;
  distance_traveled_km?: number;
  status: 'on_way' | 'arriving' | 'arrived' | 'in_progress' | 'completed';
  eta_calculation_method?: 'google_maps' | 'estimated';
  service_name: string;
  booking_time: string;
}

interface TrackingPageClientProps {
  bookingId: string;
}

export function TrackingPageClient({ bookingId }: TrackingPageClientProps) {
  const router = useRouter();
  
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTracking = useCallback(async () => {
    try {
      const response = await apiClient.get<any>(`/gps-tracking/booking/${bookingId}`);
      if (response.isTracking && response.tracking) {
        setTracking(response.tracking);
        setError(null);
      } else if (!response.isTracking) {
        setError(response.message || 'GPS tracking is not active for this booking');
        setTracking(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tracking data');
      setTracking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadTracking();
    
    // Poll for updates every 5 seconds for better real-time feel
    const interval = setInterval(loadTracking, 5000);
    return () => clearInterval(interval);
  }, [loadTracking]);

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'on_way': return 'On the way to you';
      case 'arriving': return 'Almost there!';
      case 'arrived': return 'Has arrived at your location';
      case 'in_progress': return 'Service in progress';
      case 'completed': return 'Service completed';
      default: return 'Tracking...';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_way': return 'text-blue-500';
      case 'arriving': return 'text-yellow-500';
      case 'arrived': return 'text-green-500';
      case 'in_progress': return 'text-orange-500';
      case 'completed': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tracking...</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg max-w-md">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Tracking Not Available</h2>
          <p className="text-gray-500 mb-4">{error || 'Unable to load tracking data'}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900">
            ←
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Track Service Provider</h1>
            <p className="text-sm text-gray-500">{tracking.service_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={`tel:${tracking.staff_phone}`}
              className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition"
            >
              📞
            </a>
            <button className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition">
              💬
            </button>
          </div>
        </div>
      </header>

      {/* Map with Google Maps Link */}
      <div className="h-[50vh] bg-gray-200 relative">
        {tracking.current_location && tracking.current_location.latitude && tracking.destination && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🗺️</div>
              <p className="text-gray-500 mb-2">Live Tracking</p>
              <a
                href={`https://www.google.com/maps/dir/${tracking.current_location.latitude},${tracking.current_location.longitude}/${tracking.destination.latitude},${tracking.destination.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
              >
                Open in Google Maps →
              </a>
              <p className="text-xs text-gray-400 mt-2">
                Real-time location updates every 5 seconds
              </p>
            </div>
          </div>
        )}
        {(!tracking.current_location || !tracking.current_location.latitude) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📍</div>
              <p className="text-gray-500">Waiting for location update...</p>
            </div>
          </div>
        )}
        
        {/* ETA Badge */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <div className="bg-white rounded-xl px-4 py-2 shadow-lg">
            <p className="text-xs text-gray-500">ETA</p>
            <p className="text-lg font-bold text-blue-600">
              {tracking.eta_minutes !== null && tracking.eta_minutes !== undefined 
                ? `${tracking.eta_minutes} mins` 
                : 'Calculating...'}
            </p>
            {tracking.eta_calculation_method && (
              <p className="text-xs text-gray-400">
                {tracking.eta_calculation_method === 'google_maps' ? '🚗 Google Maps' : '📍 Estimated'}
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl px-4 py-2 shadow-lg">
            <p className="text-xs text-gray-500">Distance</p>
            <p className="text-lg font-bold text-gray-900">
              {tracking.distance_km !== null && tracking.distance_km !== undefined 
                ? `${tracking.distance_km.toFixed(1)} km` 
                : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="bg-white rounded-t-3xl -mt-6 relative z-10 shadow-2xl">
        {/* Status Bar */}
        <div className="p-6 border-b">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center text-3xl overflow-hidden">
                {tracking.staff_photo_url ? (
                  <img src={tracking.staff_photo_url} alt={tracking.staff_name} className="w-full h-full object-cover" />
                ) : '👤'}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${
                tracking.status === 'on_way' || tracking.status === 'arriving' 
                  ? 'bg-green-500 animate-pulse' 
                  : tracking.status === 'arrived' || tracking.status === 'in_progress'
                  ? 'bg-green-500'
                  : 'bg-gray-400'
              } rounded-full border-2 border-white flex items-center justify-center`}>
                <span className="text-xs">📍</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{tracking.staff_name}</h3>
              <p className={`text-sm ${getStatusColor(tracking.status)} font-medium`}>
                {getStatusMessage(tracking.status)}
              </p>
              {tracking.distance_traveled_km != null && tracking.distance_traveled_km > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Traveled: {tracking.distance_traveled_km.toFixed(2)} km
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="p-6">
          <div className="flex items-center justify-between relative">
            {/* Line */}
            <div className="absolute top-4 left-8 right-8 h-0.5 bg-gray-200"></div>
            <div 
              className="absolute top-4 left-8 h-0.5 bg-blue-500 transition-all duration-500"
              style={{ 
                width: tracking.status === 'on_way' ? '0%' : 
                       tracking.status === 'arriving' ? '33%' : 
                       tracking.status === 'arrived' ? '66%' : 
                       tracking.status === 'in_progress' || tracking.status === 'completed' ? '100%' : '0%' 
              }}
            ></div>
            
            {/* Steps */}
            {[
              { id: 'on_way', icon: '🚗', label: 'On Way' },
              { id: 'arriving', icon: '📍', label: 'Arriving' },
              { id: 'arrived', icon: '✅', label: 'Arrived' },
              { id: 'completed', icon: '🎉', label: 'Done' },
            ].map((step) => {
              const steps = ['on_way', 'arriving', 'arrived', 'in_progress', 'completed'];
              const currentIdx = steps.indexOf(tracking.status);
              const stepIdx = step.id === 'completed' ? 3 : steps.indexOf(step.id);
              const isComplete = stepIdx <= currentIdx;
              const isCurrent = step.id === tracking.status || (tracking.status === 'in_progress' && step.id === 'completed');
              
              return (
                <div key={step.id} className="flex flex-col items-center z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                    isComplete ? 'bg-blue-500 text-white' : 
                    isCurrent ? 'bg-blue-100 text-blue-500 ring-4 ring-blue-100' : 
                    'bg-gray-200 text-gray-400'
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`text-xs mt-2 ${isComplete || isCurrent ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Destination */}
        <div className="p-6 pt-0">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Destination</p>
            <p className="text-gray-900">{tracking.destination.address}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-3">
          {tracking.status === 'arrived' && (
            <button className="w-full py-4 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition">
              Provider Has Arrived ✓
            </button>
          )}
          
          {(tracking.status === 'in_progress') && (
            <div className="text-center">
              <p className="text-blue-600 font-medium animate-pulse">🔵 Service in progress...</p>
            </div>
          )}
          
          {tracking.status === 'completed' && (
            <button 
              onClick={() => router.push(`/bookings/${bookingId}/review`)}
              className="w-full py-4 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition"
            >
              Rate & Review
            </button>
          )}
          
          <button className="w-full py-3 text-gray-600 font-medium hover:text-gray-800 transition">
            Need Help? Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

