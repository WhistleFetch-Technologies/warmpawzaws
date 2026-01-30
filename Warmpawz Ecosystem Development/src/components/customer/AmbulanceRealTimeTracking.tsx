import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import {
  Ambulance,
  MapPin,
  Phone,
  Navigation,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { GoogleMapsTracking } from './GoogleMapsTracking';

const BASE_URL = `${getApiBaseUrl()}`;

interface RealTimeTrackingProps {
  bookingId: string;
}

interface TrackingData {
  bookingId: string;
  status: string;
  currentLocation: { lat: number; lng: number } | null;
  route: Array<{ lat: number; lng: number }>;
  lastUpdated: string;
  pickupLocation: { lat: number; lng: number; address: string };
  dropLocation: { lat: number; lng: number; address: string };
  eta: {
    minutes: number;
    arrival: string;
  } | null;
}

interface BookingDetails {
  booking: any;
  ambulance: any;
  driver: any;
}

export function AmbulanceRealTimeTracking({ bookingId }: RealTimeTrackingProps) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Fetch booking details
  const fetchBookingDetails = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/ambulance/booking/${bookingId}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setDetails(data);
      } else {
        setError('Failed to fetch booking details');
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      setError('Error fetching booking details');
    }
  };

  // Fetch tracking data
  const fetchTracking = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/ambulance/track/${bookingId}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTracking(data);
        setLoading(false);
      } else {
        setError('Failed to fetch tracking data');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching tracking:', error);
      setError('Error fetching tracking data');
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchBookingDetails();
    fetchTracking();

    // Poll for updates every 10 seconds
    intervalRef.current = window.setInterval(() => {
      fetchTracking();
    }, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [bookingId]);

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any; bg: string }> = {
      assigned: {
        label: 'Driver Assigned',
        color: 'text-blue-600',
        icon: CheckCircle,
        bg: 'bg-blue-100'
      },
      en_route: {
        label: 'On the Way',
        color: 'text-orange-600',
        icon: Navigation,
        bg: 'bg-orange-100'
      },
      arrived: {
        label: 'Arrived at Pickup',
        color: 'text-green-600',
        icon: MapPin,
        bg: 'bg-green-100'
      },
      transporting: {
        label: 'Transporting Pet',
        color: 'text-purple-600',
        icon: Ambulance,
        bg: 'bg-purple-100'
      },
      completed: {
        label: 'Completed',
        color: 'text-green-600',
        icon: CheckCircle,
        bg: 'bg-green-100'
      },
      cancelled: {
        label: 'Cancelled',
        color: 'text-red-600',
        icon: AlertCircle,
        bg: 'bg-red-100'
      }
    };

    return statusMap[status] || statusMap.assigned;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tracking || !details) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">Error Loading Tracking</h3>
            <p className="text-gray-600">{error || 'Unable to load tracking information'}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(tracking.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Status Header */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <div className={`${statusInfo.bg} border-b border-gray-200 p-6`}>
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 ${statusInfo.bg} rounded-full flex items-center justify-center`}>
              <StatusIcon className={`w-8 h-8 ${statusInfo.color}`} />
            </div>
            <div className="flex-1">
              <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
                {statusInfo.label}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Booking ID: {bookingId}
              </p>
            </div>
            {tracking.eta && tracking.status !== 'completed' && (
              <div className="text-right">
                <p className="text-sm text-gray-600">ETA</p>
                <p className={`text-3xl font-bold ${statusInfo.color}`}>
                  {tracking.eta.minutes} min
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Map - Use Google Maps if available */}
        <GoogleMapsTracking
          currentLocation={tracking.currentLocation}
          pickupLocation={{
            lat: tracking.pickupLocation.lat,
            lng: tracking.pickupLocation.lng,
            address: tracking.pickupLocation.address
          }}
          dropLocation={{
            lat: tracking.dropLocation.lat,
            lng: tracking.dropLocation.lng,
            address: tracking.dropLocation.address
          }}
          route={tracking.route}
          status={tracking.status}
          driverName={details.driver.name}
          vehicleNumber={details.ambulance.vehicleNumber}
          eta={tracking.eta?.minutes}
        />
      </div>

      {/* Driver & Ambulance Info */}
      {details.driver && details.ambulance && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Driver Info */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-orange-600" />
              Driver Information
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Name</p>
                <p className="font-medium text-gray-900">{details.driver.name}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Rating</p>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500 text-lg">★</span>
                  <span className="font-medium text-gray-900">
                    {details.driver.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({details.driver.totalTrips} trips)
                  </span>
                </div>
              </div>

              <Button
                onClick={() => window.location.href = `tel:${details.driver.phone}`}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Driver
              </Button>
            </div>
          </div>

          {/* Ambulance Info */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Ambulance className="w-5 h-5 text-orange-600" />
              Ambulance Details
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Vehicle Number</p>
                <p className="font-bold text-gray-900 text-lg">
                  {details.ambulance.vehicleNumber}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Vehicle Type</p>
                <p className="font-medium text-gray-900 capitalize">
                  {details.ambulance.vehicleType}
                </p>
              </div>

              {details.ambulance.equipment && details.ambulance.equipment.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Equipment</p>
                  <div className="flex flex-wrap gap-2">
                    {details.ambulance.equipment.map((item: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Journey Timeline */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-600" />
          Journey Timeline
        </h3>

        <div className="space-y-6">
          {/* Pickup Location */}
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <MapPin className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">Pickup Location</h4>
                {tracking.status === 'arrived' && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    Arrived
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{tracking.pickupLocation.address}</p>
              {details.booking.actualPickupTime && (
                <p className="text-xs text-gray-500 mt-1">
                  Picked up at {new Date(details.booking.actualPickupTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Current Status */}
          {tracking.status !== 'completed' && tracking.currentLocation && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1 relative">
                <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75" />
                <Ambulance className="w-5 h-5 text-blue-600 relative z-10" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">Currently {tracking.status.replace('_', ' ')}</h4>
                <p className="text-sm text-gray-600">
                  Last location updated {new Date(tracking.lastUpdated).toLocaleString()}
                </p>
                {tracking.eta && (
                  <p className="text-sm text-blue-600 mt-1 font-medium">
                    Arriving in {tracking.eta.minutes} minutes
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Drop Location */}
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 ${tracking.status === 'completed' ? 'bg-green-100' : 'bg-gray-100'} rounded-full flex items-center justify-center flex-shrink-0 mt-1`}>
              <MapPin className={`w-5 h-5 ${tracking.status === 'completed' ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-gray-900">Drop Location</h4>
                {tracking.status === 'completed' && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    Completed
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{tracking.dropLocation.address}</p>
              {details.booking.actualDropTime && (
                <p className="text-xs text-gray-500 mt-1">
                  Dropped at {new Date(details.booking.actualDropTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Info */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Booking Information</h3>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Pet Name</p>
            <p className="font-medium text-gray-900">{details.booking.petName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Emergency Type</p>
            <p className="font-medium text-gray-900 capitalize">
              {details.booking.emergencyType}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Distance</p>
            <p className="font-medium text-gray-900">
              {details.booking.distance?.toFixed(1)} km
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Fare</p>
            <p className="font-bold text-gray-900 text-xl">
              ₹{details.booking.fare?.toLocaleString()}
            </p>
          </div>

          {details.booking.symptoms && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600 mb-1">Symptoms</p>
              <p className="text-gray-900">{details.booking.symptoms}</p>
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
        <h3 className="font-bold text-orange-900 mb-2">Need Help?</h3>
        <p className="text-sm text-orange-700 mb-4">
          If you have any concerns or need immediate assistance, please contact our 24/7 support team.
        </p>
        <Button variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-100">
          <Phone className="w-4 h-4 mr-2" />
          Contact Support
        </Button>
      </div>
    </div>
  );
}