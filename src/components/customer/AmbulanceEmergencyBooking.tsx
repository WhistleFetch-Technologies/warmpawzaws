import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Ambulance,
  MapPin,
  AlertCircle,
  Phone,
  Clock,
  Navigation,
  CheckCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface EmergencyBookingProps {
  customerId: string;
  petId: string;
  petName: string;
  onBookingComplete?: (bookingId: string) => void;
}

interface Location {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  pincode?: string;
}

export function AmbulanceEmergencyBooking({
  customerId,
  petId,
  petName,
  onBookingComplete
}: EmergencyBookingProps) {
  const [step, setStep] = useState<'emergency' | 'details' | 'confirm' | 'tracking'>('emergency');
  const [emergencyType, setEmergencyType] = useState<'critical' | 'urgent' | 'scheduled'>('urgent');
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [dropLocation, setDropLocation] = useState<Location | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Get current location
  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser');
        return;
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address (in production, use Google Maps API)
      const location: Location = {
        lat: latitude,
        lng: longitude,
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        city: 'Current Location'
      };

      setPickupLocation(location);
      toast.success('Current location detected');

    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Failed to get current location');
    } finally {
      setGettingLocation(false);
    }
  };

  // Create emergency booking
  const createEmergencyBooking = async () => {
    if (!pickupLocation || !dropLocation) {
      toast.error('Please provide pickup and drop locations');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/ambulance/emergency/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId,
          petId,
          petName,
          emergencyType,
          pickupLocation,
          dropLocation,
          symptoms,
          specialRequirements
        })
      });

      if (response.ok) {
        const data = await response.json();
        setBooking(data);
        setStep('tracking');
        toast.success('Ambulance assigned successfully!');
        onBookingComplete?.(data.booking.bookingId);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to book ambulance');
      }
    } catch (error) {
      console.error('Error booking ambulance:', error);
      toast.error('Error booking ambulance');
    } finally {
      setLoading(false);
    }
  };

  // Emergency Type Selection
  if (step === 'emergency') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ambulance className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Emergency Ambulance
            </h2>
            <p className="text-gray-600">
              Request immediate medical transport for {petName}
            </p>
          </div>

          {/* Emergency Type Selection */}
          <div className="space-y-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Select Emergency Level</h3>

            <button
              onClick={() => setEmergencyType('critical')}
              className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                emergencyType === 'critical'
                  ? 'border-red-600 bg-red-50'
                  : 'border-gray-200 hover:border-red-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">Critical Emergency</h4>
                  <p className="text-sm text-gray-600">
                    Life-threatening condition. Immediate response required.
                  </p>
                  <p className="text-xs text-red-600 mt-2">
                    ⚡ Priority dispatch • Additional charges apply
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setEmergencyType('urgent')}
              className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                emergencyType === 'urgent'
                  ? 'border-orange-600 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">Urgent Care</h4>
                  <p className="text-sm text-gray-600">
                    Requires immediate medical attention but not life-threatening.
                  </p>
                  <p className="text-xs text-orange-600 mt-2">
                    ⚡ Fast response • Standard rates
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setEmergencyType('scheduled')}
              className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                emergencyType === 'scheduled'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">Scheduled Transport</h4>
                  <p className="text-sm text-gray-600">
                    Non-emergency medical transport. Can be scheduled in advance.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    📅 Schedule for later • Economy rates
                  </p>
                </div>
              </div>
            </button>
          </div>

          <Button
            onClick={() => setStep('details')}
            className="w-full bg-red-600 hover:bg-red-700"
            size="lg"
          >
            Continue
          </Button>
        </div>
      </div>
    );
  }

  // Location & Details
  if (step === 'details') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Pickup & Drop Details
            </h2>
            <p className="text-gray-600">
              Provide location and emergency details
            </p>
          </div>

          {/* Pickup Location */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pickup Location
            </label>
            
            <Button
              onClick={getCurrentLocation}
              disabled={gettingLocation}
              variant="outline"
              className="w-full mb-3"
            >
              <Navigation className="w-4 h-4 mr-2" />
              {gettingLocation ? 'Getting location...' : 'Use Current Location'}
            </Button>

            {pickupLocation && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{pickupLocation.address}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {pickupLocation.lat.toFixed(6)}, {pickupLocation.lng.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Drop Location */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Drop Location (Vet/Hospital)
            </label>
            <input
              type="text"
              placeholder="Enter destination address"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              onChange={(e) => {
                // In production, use Google Places API
                setDropLocation({
                  lat: 0,
                  lng: 0,
                  address: e.target.value
                });
              }}
            />
          </div>

          {/* Symptoms */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Symptoms / Condition
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="Describe the emergency condition..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Special Requirements */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Requirements (Optional)
            </label>
            <input
              type="text"
              value={specialRequirements}
              onChange={(e) => setSpecialRequirements(e.target.value)}
              placeholder="e.g., Oxygen support, ICU ambulance"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={() => setStep('emergency')}
              variant="outline"
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={createEmergencyBooking}
              disabled={!pickupLocation || !dropLocation || loading}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Booking...' : 'Request Ambulance'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Tracking View
  if (step === 'tracking' && booking) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
          {/* Success Header */}
          <div className="bg-green-50 border-b border-green-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-900 mb-1">
                  Ambulance Assigned!
                </h3>
                <p className="text-sm text-green-700">
                  Booking ID: {booking.booking.bookingId}
                </p>
              </div>
            </div>
          </div>

          {/* Ambulance Details */}
          <div className="p-6 border-b border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Ambulance Details</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Vehicle Number</span>
                <span className="font-medium text-gray-900">
                  {booking.ambulance.vehicleNumber}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Vehicle Type</span>
                <span className="font-medium text-gray-900 capitalize">
                  {booking.ambulance.vehicleType}
                </span>
              </div>
            </div>
          </div>

          {/* Driver Details */}
          <div className="p-6 border-b border-gray-200">
            <h4 className="font-medium text-gray-900 mb-4">Driver Details</h4>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-gray-900">{booking.driver.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-yellow-500">★</span>
                  <span className="text-sm text-gray-600">{booking.driver.rating.toFixed(1)}</span>
                </div>
              </div>
              <Button
                onClick={() => window.location.href = `tel:${booking.driver.phone}`}
                variant="outline"
                size="sm"
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Driver
              </Button>
            </div>
          </div>

          {/* ETA */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">Estimated Arrival</p>
                <p className="font-bold text-gray-900 text-lg">
                  {booking.tracking.estimatedMinutes} minutes
                </p>
              </div>
            </div>
          </div>

          {/* Fare */}
          <div className="p-6 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Estimated Fare</span>
              <span className="text-2xl font-bold text-gray-900">
                ₹{booking.booking.fare.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Distance: {booking.booking.distance.toFixed(1)} km
            </p>
          </div>

          {/* Track Button */}
          <div className="p-6">
            <Button
              onClick={() => window.location.href = `/tracking/${booking.booking.bookingId}`}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              <Activity className="w-4 h-4 mr-2" />
              Track Live
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
