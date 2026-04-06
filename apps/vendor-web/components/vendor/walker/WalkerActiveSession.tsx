'use client';

/**
 * WalkerActiveSession - GPS tracking interface for walkers during active walks
 * 
 * Features:
 * - Live GPS tracking with route recording
 * - Photo capture during walk
 * - Session notes
 * - Distance and duration tracking
 * - OTP verification for start/end
 * 
 * Date: 2026-01-15
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  MapPin, Navigation, Clock, Footprints, Camera, Play, Square,
  MessageCircle, Phone, ChevronLeft, Upload, CheckCircle, Dog,
  AlertTriangle, Plus, Trash2, Battery, Signal, AlertCircle
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { toast } from 'sonner';

interface BookingDetails {
  id: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petBreed: string;
  address: string;
  notes?: string;
  duration: number; // Expected duration in minutes
}

interface SessionStats {
  distanceMeters: number;
  durationSeconds: number;
  waypointCount: number;
  averageSpeed: number;
}

interface WalkerActiveSessionProps {
  walkerId: string;
  booking?: BookingDetails;
  onBack?: () => void;
  onSessionComplete?: (summary: any) => void;
}

export function WalkerActiveSession({
  walkerId,
  booking,
  onBack,
  onSessionComplete
}: WalkerActiveSessionProps) {
  const [sessionStatus, setSessionStatus] = useState<'pending' | 'active' | 'completed'>('pending');
  const [startOtp, setStartOtp] = useState('');
  const [endOtp, setEndOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    distanceMeters: 0,
    durationSeconds: 0,
    waypointCount: 0,
    averageSpeed: 0
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [pottyBreaks, setPottyBreaks] = useState(0);
  const [loading, setLoading] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    // Get initial position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast.error('Unable to get your location');
        }
      );
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startGpsTracking = () => {
    if (!navigator.geolocation) {
      toast.error('GPS not available');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const newPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCurrentPosition(newPos);

        // Send GPS update to backend
        try {
          await apiClient.post(`/walker/${walkerId}/gps-update`, {
            bookingId: booking?.id,
            lat: newPos.lat,
            lng: newPos.lng,
            heading: position.coords.heading,
            speed: position.coords.speed ? position.coords.speed * 3.6 : 0, // Convert m/s to km/h
            accuracy: position.coords.accuracy
          });

          setStats(prev => ({
            ...prev,
            waypointCount: prev.waypointCount + 1
          }));
        } catch (error) {
          console.error('Error sending GPS update:', error);
        }
      },
      (error) => {
        console.error('GPS tracking error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    // Start duration timer
    startTimeRef.current = new Date();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        setStats(prev => ({
          ...prev,
          durationSeconds: elapsed
        }));
      }
    }, 1000);
  };

  const handleStartSession = async () => {
    if (!startOtp || startOtp.length !== 4) {
      toast.error('Please enter the 4-digit OTP');
      return;
    }

    if (!currentPosition) {
      toast.error('Unable to get your location. Please enable GPS.');
      return;
    }

    try {
      setVerifyingOtp(true);

      // Verify OTP and start session
      const response = await apiClient.post<any>(`/walker/${walkerId}/start-session`, {
        bookingId: booking?.id,
        otp: startOtp,
        startLat: currentPosition.lat,
        startLng: currentPosition.lng
      });

      if (response?.success) {
        toast.success('Walk started! GPS tracking active.');
        setSessionStatus('active');
        startGpsTracking();
      } else {
        toast.error(response?.error || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Error starting session:', error);
      toast.error(error.message || 'Failed to start session');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleEndSession = async () => {
    if (!endOtp || endOtp.length !== 4) {
      toast.error('Please enter the 4-digit OTP');
      return;
    }

    try {
      setVerifyingOtp(true);

      // Stop GPS tracking
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // End session
      const response = await apiClient.post<any>(`/walker/${walkerId}/end-session`, {
        bookingId: booking?.id,
        otp: endOtp,
        endLat: currentPosition?.lat,
        endLng: currentPosition?.lng,
        notes,
        pottyBreaks,
        weatherConditions: 'clear' // TODO: Add weather selection
      });

      if (response?.success) {
        toast.success('Walk completed successfully!');
        setSessionStatus('completed');
        if (onSessionComplete) {
          onSessionComplete(response.route);
        }
      } else {
        toast.error(response?.error || 'Failed to end session');
      }
    } catch (error: any) {
      console.error('Error ending session:', error);
      toast.error(error.message || 'Failed to end session');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleAddPhoto = async () => {
    // In a real app, this would open camera/file picker
    const photoUrl = prompt('Enter photo URL (for testing):');
    if (photoUrl) {
      try {
        await apiClient.post(`/walker/${walkerId}/add-photo`, {
          bookingId: booking?.id,
          photoUrl,
          lat: currentPosition?.lat,
          lng: currentPosition?.lng
        });
        setPhotos(prev => [...prev, photoUrl]);
        toast.success('Photo added!');
      } catch (error) {
        toast.error('Failed to add photo');
      }
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

  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${meters} m`;
    }
    return `${(meters / 1000).toFixed(2)} km`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col vendor-app-column">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2">
          <button onClick={onBack} className="p-2 hover:bg-white/20 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="font-bold">Walking Session</h1>
            <p className="text-xs text-white/80">
              {sessionStatus === 'pending' && 'Ready to start'}
              {sessionStatus === 'active' && '🔴 Active'}
              {sessionStatus === 'completed' && '✅ Completed'}
            </p>
          </div>
          <div className="w-10" />
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-white p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
            <Dog className="w-7 h-7 text-orange-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900">{booking?.petName || 'Pet'}</h2>
            <p className="text-sm text-gray-600">{booking?.petBreed}</p>
            <p className="text-sm text-gray-500">Owner: {booking?.customerName}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = `tel:${booking?.customerPhone}`}
          >
            <Phone className="w-4 h-4" />
          </Button>
        </div>
        {booking?.notes && (
          <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {booking.notes}
            </p>
          </div>
        )}
      </div>

      {/* Session Status */}
      {sessionStatus === 'pending' && (
        <div className="flex-1 p-4">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="w-10 h-10 text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Start Walk</h3>
            <p className="text-gray-600 mb-6">
              Enter the OTP from the customer to begin tracking
            </p>

            <div className="space-y-4">
              <Input
                type="text"
                maxLength={4}
                placeholder="Enter 4-digit OTP"
                value={startOtp}
                onChange={(e) => setStartOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl font-bold tracking-widest"
              />
              <Button
                onClick={handleStartSession}
                disabled={verifyingOtp || startOtp.length !== 4}
                className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-lg"
              >
                {verifyingOtp ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Start Walk
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              GPS location: {currentPosition ? '✅ Available' : '❌ Unavailable'}
            </p>
          </div>
        </div>
      )}

      {sessionStatus === 'active' && (
        <>
          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-2 p-4">
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <Clock className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-900">
                {formatDuration(stats.durationSeconds)}
              </p>
              <p className="text-xs text-gray-500">Duration</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <Footprints className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-900">
                {formatDistance(stats.distanceMeters)}
              </p>
              <p className="text-xs text-gray-500">Distance</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center shadow-sm">
              <MapPin className="w-5 h-5 text-orange-500 mx-auto mb-1" />
              <p className="text-xl font-bold text-gray-900">{stats.waypointCount}</p>
              <p className="text-xs text-gray-500">Points</p>
            </div>
          </div>

          {/* Map Area (placeholder) */}
          <div className="mx-4 bg-gradient-to-br from-green-100 to-emerald-200 rounded-xl h-48 relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Navigation className="w-8 h-8 text-green-600 mx-auto mb-2 animate-pulse" />
                <p className="text-sm font-medium text-green-700">GPS Tracking Active</p>
                <p className="text-xs text-green-600">
                  {currentPosition ? `${currentPosition.lat.toFixed(6)}, ${currentPosition.lng.toFixed(6)}` : 'Acquiring...'}
                </p>
              </div>
            </div>
            <div className="absolute top-2 right-2 bg-white/90 rounded-lg px-2 py-1 flex items-center gap-1">
              <Signal className="w-3 h-3 text-green-500" />
              <span className="text-xs text-green-700">Live</span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 space-y-3">
            {/* Emergency SOS Button - As per Master Plan */}
            <Button
              onClick={async () => {
                try {
                  // Send emergency alert
                  await apiClient.post(`/walker/${walkerId}/emergency`, {
                    bookingId: booking?.id,
                    latitude: currentPosition?.lat,
                    longitude: currentPosition?.lng,
                    timestamp: new Date().toISOString()
                  });
                  
                  // Also try to call emergency contact
                  const emergencyNumber = '100'; // Emergency services
                  window.location.href = `tel:${emergencyNumber}`;
                  
                  toast.error('🚨 Emergency alert sent! Emergency services notified.', {
                    duration: 10000,
                  });
                } catch (error: any) {
                  console.error('Emergency alert error:', error);
                  // Still try to call even if API fails
                  window.location.href = 'tel:100';
                  toast.error('Emergency services called. Please stay safe!', {
                    duration: 10000,
                  });
                }
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 text-base shadow-lg animate-pulse"
            >
              <AlertCircle className="w-6 h-6 mr-3" />
              🆘 EMERGENCY SOS
            </Button>

            {/* Add Photo */}
            <Button
              variant="outline"
              onClick={handleAddPhoto}
              className="w-full justify-start"
            >
              <Camera className="w-5 h-5 mr-3 text-orange-500" />
              Add Photo ({photos.length})
            </Button>

            {/* Potty Break Counter */}
            <div className="bg-white rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💩</span>
                <span className="font-medium text-gray-900">Potty Breaks</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPottyBreaks(Math.max(0, pottyBreaks - 1))}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-8 text-center font-bold">{pottyBreaks}</span>
                <button
                  onClick={() => setPottyBreaks(pottyBreaks + 1)}
                  className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600"
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Walk Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any observations about the walk..."
                className="w-full p-3 border rounded-lg text-sm h-20 resize-none"
              />
            </div>

            {/* Photo Preview */}
            {photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map((url, i) => (
                  <div key={i} className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                    <img src={url} alt={`Walk photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* End Walk */}
          <div className="p-4 mt-auto bg-white border-t">
            <div className="space-y-3">
              <Input
                type="text"
                maxLength={4}
                placeholder="Enter customer OTP to end"
                value={endOtp}
                onChange={(e) => setEndOtp(e.target.value.replace(/\D/g, ''))}
                className="text-center text-xl font-bold tracking-widest"
              />
              <Button
                onClick={handleEndSession}
                disabled={verifyingOtp || endOtp.length !== 4}
                className="w-full bg-red-500 hover:bg-red-600 py-6 text-lg"
              >
                {verifyingOtp ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <>
                    <Square className="w-5 h-5 mr-2" />
                    End Walk
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {sessionStatus === 'completed' && (
        <div className="flex-1 p-4">
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Walk Completed!</h3>
            <p className="text-gray-600 mb-6">
              Great job! The walk has been recorded.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">
                  {formatDuration(stats.durationSeconds)}
                </p>
                <p className="text-sm text-gray-500">Duration</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-900">
                  {formatDistance(stats.distanceMeters)}
                </p>
                <p className="text-sm text-gray-500">Distance</p>
              </div>
            </div>

            <Button onClick={onBack} className="w-full">
              Back to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WalkerActiveSession;
