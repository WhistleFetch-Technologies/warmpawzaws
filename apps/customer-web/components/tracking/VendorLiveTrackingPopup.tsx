'use client';

/**
 * VendorLiveTrackingPopup - Customer-side live tracking component
 *
 * Shows as a popup on customer home screen when vendor is on the way
 * Features:
 * - Live GPS tracking of vendor location
 * - Real-time ETA updates
 * - Google Maps JavaScript API with Tracker map style
 * - Vendor/Staff details (phone, qualifications, profile)
 * - Appointment purpose and details
 * - Auto-dismisses when vendor arrives
 * - Mobile-optimized design
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Clock, Navigation, Phone, User, GraduationCap, Calendar, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorLiveTrackingPopupProps {
  bookingId: string;
  trackingSessionId: string;
  vendorName: string;
  vendorPhone?: string;
  customerAddress: string;
  onClose?: () => void;
  onVendorArrived?: () => void;
  serviceName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  purpose?: string;
  staffName?: string;
  staffPhone?: string;
  staffQualifications?: string;
  staffPhoto?: string;
  vendorPhoto?: string;
}

interface TrackingStatus {
  status: 'started' | 'in_transit' | 'arrived' | 'completed';
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  estimatedEtaMinutes?: number;
  distanceKm?: number;
  vendorName: string;
  bookingDetails?: {
    serviceName?: string;
    appointmentDate?: string;
    appointmentTime?: string;
    purpose?: string;
  };
  vendorDetails?: {
    phone?: string;
    photo?: string;
  };
  staffDetails?: {
    name?: string;
    phone?: string;
    qualifications?: string;
    photo?: string;
  };
}

export function VendorLiveTrackingPopup({
  bookingId,
  trackingSessionId,
  vendorName,
  vendorPhone,
  customerAddress,
  onClose,
  onVendorArrived,
  serviceName,
  appointmentDate,
  appointmentTime,
  purpose,
  staffName,
  staffPhone,
  staffQualifications,
  staffPhoto,
  vendorPhoto
}: VendorLiveTrackingPopupProps) {
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus | null>(null);
  const [googleMapsConfig, setGoogleMapsConfig] = useState<{ apiKey: string; mapId?: string } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);

  // Fetch Google Maps config (apiKey + mapId for Tracker style)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await apiClient.get('/config/google-maps-key') as any;
        const apiKey = response?.apiKey || response?.key;
        if (apiKey) {
          setGoogleMapsConfig({ apiKey, mapId: response?.mapId });
        }
      } catch (error) {
        console.warn('Could not fetch Google Maps config:', error);
      }
    };
    fetchConfig();
  }, []);

  // Load booking details on mount
  useEffect(() => {
    const loadBookingDetails = async () => {
      try {
        const response = await apiClient.get(`/customer/bookings/${bookingId}`) as any;
        if (response.booking) {
          setBookingDetails(response.booking);
        }
      } catch (error) {
        console.error('Error loading booking details:', error);
      }
    };
    loadBookingDetails();
  }, [bookingId]);

  // Poll for tracking updates
  useEffect(() => {
    const fetchTrackingStatus = async () => {
      try {
        // Try new endpoint first, fallback to old one
        let response: any = null;
        try {
          response = await apiClient.get(`/tracking/booking/${bookingId}`) as any;
        } catch (e) {
          response = null;
        }
        
        if (response?.success && response.tracking) {
          setTrackingStatus({
            status: response.tracking.status,
            currentLocation: response.tracking.currentLocation,
            estimatedEtaMinutes: response.tracking.estimatedEtaMinutes,
            distanceKm: response.tracking.distanceKm,
            vendorName: response.tracking.vendorName || vendorName,
            bookingDetails: response.tracking.bookingDetails,
            vendorDetails: response.tracking.vendorDetails,
            staffDetails: response.tracking.staffDetails
          });
          
          // If vendor arrived, trigger callback
          if (response.tracking.status === 'arrived' && onVendorArrived) {
            onVendorArrived();
          }
        }
      } catch (error) {
        console.error('Error fetching tracking status:', error);
      }
    };

    // Fetch immediately
    fetchTrackingStatus();

    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchTrackingStatus, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [trackingSessionId, bookingId, vendorName, onVendorArrived]);

  // Load Google Maps JS script
  const loadGoogleMaps = useCallback((apiKey: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const check = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(check);
            resolve();
          }
        }, 100);
        return;
      }
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.head.appendChild(script);
    });
  }, []);

  // Initialize map and show directions (Maps JavaScript API with mapId for Tracker style)
  useEffect(() => {
    const origin = trackingStatus?.currentLocation;
    if (!googleMapsConfig?.apiKey || !origin || !mapRef.current || !customerAddress) return;

    let mounted = true;
    const initMap = async () => {
      try {
        await loadGoogleMaps(googleMapsConfig.apiKey);
        if (!mounted || !mapRef.current || !window.google?.maps) return;

        const center = { lat: origin.latitude, lng: origin.longitude };
        const mapOptions: Record<string, unknown> = {
          center,
          zoom: 14,
          mapTypeControl: false,
          fullscreenControl: true,
          streetViewControl: false,
          zoomControl: true,
        };
        if (googleMapsConfig.mapId) {
          mapOptions.mapId = googleMapsConfig.mapId;
        }
        const map = new window.google.maps.Map(mapRef.current, mapOptions);
        mapInstanceRef.current = map;

        const directionsService = new window.google.maps.DirectionsService();
        const directionsRenderer = new window.google.maps.DirectionsRenderer({
          map,
          suppressMarkers: false,
        });
        directionsRendererRef.current = directionsRenderer;

        directionsService.route(
          {
            origin: { lat: origin.latitude, lng: origin.longitude },
            destination: customerAddress,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result: any, status: string) => {
            if (!mounted || !directionsRendererRef.current) return;
            if (status === window.google.maps.DirectionsStatus.OK && result) {
              directionsRendererRef.current.setDirections(result);
            }
          }
        );
      } catch (err) {
        console.warn('Error initializing tracking map:', err);
      }
    };
    initMap();
    return () => {
      mounted = false;
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [googleMapsConfig?.apiKey, googleMapsConfig?.mapId, trackingStatus?.currentLocation?.latitude, trackingStatus?.currentLocation?.longitude, customerAddress, loadGoogleMaps]);

  const formatETA = (minutes?: number) => {
    if (!minutes) return 'Calculating...';
    if (minutes < 1) return 'Less than 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Get effective vendor/staff details
  const effectiveVendorName = staffName || vendorName;
  const effectiveVendorPhone = staffPhone || vendorPhone || trackingStatus?.vendorDetails?.phone || trackingStatus?.staffDetails?.phone;
  const effectiveVendorPhoto = staffPhoto || vendorPhoto || trackingStatus?.vendorDetails?.photo || trackingStatus?.staffDetails?.photo;
  const effectiveQualifications = staffQualifications || trackingStatus?.staffDetails?.qualifications;
  const effectiveServiceName = serviceName || bookingDetails?.serviceName || trackingStatus?.bookingDetails?.serviceName;
  const effectivePurpose = purpose || bookingDetails?.purpose || bookingDetails?.notes || 'Service appointment';
  const effectiveAppointmentDate = appointmentDate || bookingDetails?.appointmentDate || bookingDetails?.date;
  const effectiveAppointmentTime = appointmentTime || bookingDetails?.appointmentTime || bookingDetails?.time;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white rounded-xl shadow-2xl border-2 border-[#FF8C42] p-3 cursor-pointer hover:shadow-3xl transition-all max-w-[280px]"
           onClick={() => setIsMinimized(false)}>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{effectiveVendorName} is on the way</div>
            <div className="text-xs text-gray-500">
              ETA: {formatETA(trackingStatus?.estimatedEtaMinutes)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-customer shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF7A2E] text-white p-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold truncate">GPS Tracker - Live Navigation</h3>
            <p className="text-xs sm:text-sm text-white/90 truncate">Traveling to {bookingDetails?.customerName || 'your'} location</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => setIsMinimized(true)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 text-xs sm:text-sm"
            >
              −
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Tracking Status */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-gray-700">Live Tracking</span>
            <span className="text-xs text-gray-500">Session: {trackingSessionId.slice(0, 8)}</span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          {/* Tracking Map (Maps JavaScript API with Tracker map style) */}
          <div className="relative bg-gray-100 min-h-[200px] sm:min-h-[300px]">
            {googleMapsConfig && trackingStatus?.currentLocation ? (
              <div ref={mapRef} className="w-full h-full min-h-[200px] sm:min-h-[300px]" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-center p-6">
                  <Navigation className="w-12 h-12 text-[#FF8C42] mx-auto mb-4 animate-pulse" />
                  <p className="text-base font-semibold text-gray-900 mb-2">GPS Tracking Active</p>
                  <p className="text-xs text-gray-600 px-4">Navigating to {customerAddress}</p>
                </div>
              </div>
            )}

            {/* ETA Overlay */}
            {trackingStatus && (
              <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-gray-200 max-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-[#FF8C42]" />
                  <span className="text-xs font-semibold text-gray-900">Estimated Arrival</span>
                </div>
                <div className="text-xl font-bold text-[#FF8C42]">
                  {formatETA(trackingStatus.estimatedEtaMinutes)}
                </div>
                {trackingStatus.distanceKm && (
                  <div className="text-xs text-gray-500 mt-1">
                    {trackingStatus.distanceKm.toFixed(1)} km away
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Appointment Details */}
          <div className="p-4 space-y-3">
            {effectiveServiceName && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-blue-900 mb-1">Service Purpose</div>
                    <div className="text-sm text-blue-700">{effectiveServiceName}</div>
                    {effectivePurpose && effectivePurpose !== effectiveServiceName && (
                      <div className="text-xs text-blue-600 mt-1">{effectivePurpose}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(effectiveAppointmentDate || effectiveAppointmentTime) && (
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-purple-900 mb-1">Appointment Details</div>
                    {effectiveAppointmentDate && (
                      <div className="text-sm text-purple-700">Date: {new Date(effectiveAppointmentDate).toLocaleDateString()}</div>
                    )}
                    {effectiveAppointmentTime && (
                      <div className="text-sm text-purple-700">Time: {effectiveAppointmentTime}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Vendor/Staff Information */}
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="flex items-start gap-3">
                {effectiveVendorPhoto ? (
                  <img 
                    src={effectiveVendorPhoto} 
                    alt={effectiveVendorName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-green-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center border-2 border-green-300">
                    <User className="w-6 h-6 text-green-700" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-green-900 mb-1">Service Provider</div>
                  <div className="text-sm font-semibold text-green-800 mb-1">{effectiveVendorName}</div>
                  {effectiveVendorPhone && (
                    <div className="flex items-center gap-1 text-xs text-green-700">
                      <Phone className="w-3 h-3" />
                      <a href={`tel:${effectiveVendorPhone}`} className="hover:underline">{effectiveVendorPhone}</a>
                    </div>
                  )}
                  {effectiveQualifications && (
                    <div className="flex items-center gap-1 text-xs text-green-700 mt-1">
                      <GraduationCap className="w-3 h-3" />
                      <span>{effectiveQualifications}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-start gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[#FF8C42] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 break-words">{customerAddress}</div>
              {bookingDetails?.customerName && (
                <div className="text-xs text-gray-500 mt-1">
                  Customer: {bookingDetails.customerName} {bookingDetails.customerPhone ? `• ${bookingDetails.customerPhone}` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {effectiveVendorPhone && (
              <button
                onClick={() => window.open(`tel:${effectiveVendorPhone}`)}
                className="flex-1 px-3 py-2.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-green-100 flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">Call Provider</span>
                <span className="sm:hidden">Call</span>
              </button>
            )}
            <button
              onClick={() => {
                if (trackingStatus?.currentLocation) {
                  window.open(`https://www.google.com/maps?q=${trackingStatus.currentLocation.latitude},${trackingStatus.currentLocation.longitude}`, '_blank');
                }
              }}
              className="flex-1 px-3 py-2.5 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-lg text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              <span className="hidden sm:inline">Open in Google Maps</span>
              <span className="sm:hidden">Maps</span>
            </button>
            <button
              onClick={() => onClose?.()}
              className="px-3 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-200"
            >
              Close Tracker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
