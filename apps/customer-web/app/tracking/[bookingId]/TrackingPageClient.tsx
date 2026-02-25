'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface TrackingData {
  sessionId?: string;
  bookingId: string;
  vendorId?: string;
  staffId?: string;
  providerName?: string;
  staff_name?: string;
  staff_phone?: string;
  vendorPhone?: string;
  staff_photo_url?: string;
  vendorPhoto?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  current_location?: {
    latitude: number;
    longitude: number;
  };
  destinationLocation?: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  eta?: number | null;
  eta_minutes?: number | null;
  distance?: number | null;
  distance_km?: number;
  distance_traveled_km?: number;
  status: 'in_transit' | 'on_way' | 'arriving' | 'arrived' | 'in_progress' | 'completed';
  eta_calculation_method?: 'google_maps' | 'estimated';
  serviceName?: string;
  service_name?: string;
  petName?: string;
  booking_time?: string;
  startedAt?: string;
}

interface TrackingPageClientProps {
  bookingId?: string;
}

export function TrackingPageClient({ bookingId: bookingIdProp }: TrackingPageClientProps) {
  const router = useRouter();

  // ✅ CRITICAL FIX: Extract bookingId from URL path for static export compatibility
  // In static export mode, params.bookingId may be 'placeholder' or empty
  const bookingIdFromPath =
    typeof window !== 'undefined'
      ? window.location.pathname.match(/\/tracking\/([^/?]+)/)?.[1]
      : null;
  const bookingIdFromQuery =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('bookingId')
      : null;
  const normalizeBookingId = (value?: string | null) => (value && value !== 'placeholder' && value !== '_' ? value : '');
  const bookingId =
    normalizeBookingId(bookingIdProp) ||
    normalizeBookingId(bookingIdFromPath) ||
    normalizeBookingId(bookingIdFromQuery) ||
    '';

  // ✅ CRITICAL FIX: Handle phone query param for authentication (direct links from WhatsApp/SMS)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const phoneFromUrl = urlParams.get('phone');
    
    if (phoneFromUrl) {
      // Store phone for API authentication if not already logged in
      const existingPhone = localStorage.getItem('customerPhone');
      if (!existingPhone) {
        localStorage.setItem('customerPhone', phoneFromUrl);
      }
      
      // Ensure auth token exists for API calls (UAT mode)
      const existingToken = localStorage.getItem('authToken');
      if (!existingToken) {
        const uatToken = `uat-token-customer-${phoneFromUrl}-${Date.now()}`;
        localStorage.setItem('authToken', uatToken);
      }
    }
  }, []);

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [correctedDestination, setCorrectedDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const providerMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const mapInitializedRef = useRef<boolean>(false);

  // Normalize tracking data from API response
  const normalizeTracking = (data: any): TrackingData | null => {
    if (!data) return null;
    
    return {
      sessionId: data.sessionId || data.session_id,
      bookingId: data.bookingId || data.booking_id || bookingId,
      vendorId: data.vendorId || data.vendor_id,
      staffId: data.staffId || data.staff_id,
      providerName: data.providerName || data.vendorName || data.staff_name || 'Service Provider',
      staff_name: data.providerName || data.vendorName || data.staff_name || 'Service Provider',
      staff_phone: data.vendorPhone || data.staff_phone || data.provider_phone,
      vendorPhone: data.vendorPhone || data.staff_phone || data.provider_phone,
      staff_photo_url: data.vendorPhoto || data.staff_photo_url || data.provider_photo,
      vendorPhoto: data.vendorPhoto || data.staff_photo_url || data.provider_photo,
      currentLocation: data.currentLocation || data.current_location,
      current_location: data.currentLocation || data.current_location,
      destinationLocation: data.destinationLocation || data.destination,
      destination: data.destinationLocation || data.destination,
      // ✅ FIX: Handle both camelCase (from API) and snake_case formats
      eta: data.eta ?? data.eta_minutes ?? data.estimatedEtaMinutes ?? data.estimated_eta_minutes ?? null,
      eta_minutes: data.eta ?? data.eta_minutes ?? data.estimatedEtaMinutes ?? data.estimated_eta_minutes ?? null,
      // ✅ FIX: Handle both camelCase (from API) and snake_case formats
      distance: data.distance ?? data.distanceKm ?? data.distance_km ?? data.distance_remaining_km ?? data.distanceRemainingKm ?? null,
      distance_km: data.distance ?? data.distanceKm ?? data.distance_km ?? data.distance_remaining_km ?? data.distanceRemainingKm ?? null,
      status: data.status === 'in_transit' ? 'on_way' : data.status,
      serviceName: data.serviceName || data.service_name || 'Service',
      service_name: data.serviceName || data.service_name || 'Service',
      petName: data.petName || data.pet_name,
      startedAt: data.startedAt || data.started_at,
    };
  };

  // ✅ Polling-based GPS tracking (SSE not supported on Lambda)
  useEffect(() => {
    if (!bookingId) return;

    setLoading(true);
    let pollInterval: NodeJS.Timeout | null = null;
    let mounted = true;

    console.log('📡 [GPS] Starting polling mode for booking:', bookingId);
    setIsPolling(true);

    const loadTracking = async () => {
      try {
        // Use correct endpoint path: /tracking/booking/:bookingId
        const response = await apiClient.get<any>(`/tracking/booking/${bookingId}`);
        
        if (!mounted) return;
        
        if (response.success && response.tracking) {
          // ✅ DEBUG: Log raw API response with location details
          const rawTracking = response.tracking as any;
          console.log('📡 [TRACKING] Raw API response:', {
            currentLocation: rawTracking.currentLocation,
            current_location: rawTracking.current_location,
            destinationLocation: rawTracking.destinationLocation,
            destination: rawTracking.destination,
            startLocation: rawTracking.startLocation,
            start_location: rawTracking.start_location,
            status: rawTracking.status,
            sessionId: rawTracking.id || rawTracking.sessionId,
          });
          
          const normalized = normalizeTracking(response.tracking);
          
          // ✅ CRITICAL FIX: If destination is in Mumbai (wrong), try to get correct destination from booking
          if (normalized?.destinationLocation) {
            const destLat = normalized.destinationLocation.latitude;
            const destLng = normalized.destinationLocation.longitude;
            
            // Check if destination is in Mumbai area (should be Bengaluru for Alpine Eco)
            // Mumbai coordinates: ~19.0-19.3 lat, 72.7-73.0 lng
            // Bengaluru coordinates: ~12.9-13.0 lat, 77.5-77.7 lng
            if (destLat > 18.5 && destLat < 19.5 && destLng > 72.5 && destLng < 73.5) {
              console.warn('⚠️ [TRACKING] Destination appears to be in Mumbai, fetching booking coordinates to correct...', {
                wrongDestination: { lat: destLat, lng: destLng },
              });
              
              // Try to get correct destination from booking
              // ✅ FIX: Use diagnostic endpoint instead of /bookings/:bookingId (which requires authorization)
              try {
                const diagnosticResponse = await apiClient.get<any>(`/tracking/booking/${bookingId}/diagnostic`) as any;
                const diagnostic = diagnosticResponse?.diagnostic || diagnosticResponse;
                const booking = diagnostic?.booking;
                
                if (booking) {
                  let correctedDest: { latitude: number; longitude: number } | null = null;
                  
                  // Priority 1: booking.latitude/longitude
                  if (booking.latitude != null && booking.longitude != null) {
                    correctedDest = {
                      latitude: parseFloat(String(booking.latitude)),
                      longitude: parseFloat(String(booking.longitude)),
                    };
                    console.log('✅ [TRACKING] Corrected destination from booking.latitude/longitude:', correctedDest);
                  } else if (booking.delivery_latitude != null && booking.delivery_longitude != null) {
                    // Priority 2: booking.delivery_latitude/longitude
                    correctedDest = {
                      latitude: parseFloat(String(booking.delivery_latitude)),
                      longitude: parseFloat(String(booking.delivery_longitude)),
                    };
                    console.log('✅ [TRACKING] Corrected destination from booking.delivery_latitude/longitude:', correctedDest);
                  } else if (booking.address_id) {
                    // Priority 3: customer_addresses
                    try {
                      const addressResponse = await apiClient.get<any>(`/customer/addresses/${booking.address_id}`) as any;
                      const addr = addressResponse?.address || addressResponse;
                      if (addr?.latitude && addr?.longitude) {
                        correctedDest = {
                          latitude: parseFloat(String(addr.latitude)),
                          longitude: parseFloat(String(addr.longitude)),
                        };
                        console.log('✅ [TRACKING] Corrected destination from customer_addresses:', correctedDest);
                      }
                    } catch (addrErr) {
                      console.warn('Could not fetch customer address:', addrErr);
                    }
                  }
                  
                  // ✅ CRITICAL FIX: If still no coordinates but booking has address text, geocode it
                  if (!correctedDest && booking?.address && typeof booking.address === 'string') {
                    console.log('⚠️ [TRACKING] No coordinates found, attempting to geocode booking address...');
                    try {
                      // Get Google Maps API key from backend
                      const apiKeyResponse = await apiClient.get<any>('/config/google-maps-key') as any;
                      const apiKey = apiKeyResponse?.apiKey || apiKeyResponse?.key;
                      
                      if (apiKey) {
                        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(booking.address)}&key=${apiKey}`;
                        const geocodeResponse = await fetch(geocodeUrl);
                        const geocodeData = await geocodeResponse.json();
                        
                        if (geocodeData.status === 'OK' && geocodeData.results?.[0]?.geometry?.location) {
                          const loc = geocodeData.results[0].geometry.location;
                          correctedDest = {
                            latitude: parseFloat(loc.lat),
                            longitude: parseFloat(loc.lng),
                          };
                          console.log('✅ [TRACKING] Geocoded booking address to correct destination:', correctedDest);
                        } else {
                          console.warn('⚠️ [TRACKING] Geocoding failed:', geocodeData.status);
                        }
                      } else {
                        console.warn('⚠️ [TRACKING] Google Maps API key not available for geocoding');
                      }
                    } catch (geocodeErr) {
                      console.error('Error geocoding booking address:', geocodeErr);
                    }
                  }
                  
                  // Update normalized tracking with corrected destination
                  if (correctedDest) {
                    normalized.destinationLocation = correctedDest;
                    normalized.destination = correctedDest;
                    console.log('✅ [TRACKING] Updated tracking with corrected destination:', correctedDest);
                  } else {
                    console.error('❌ [TRACKING] Could not correct destination - no coordinates or geocoding failed');
                  }
                }
              } catch (bookingErr) {
                console.error('Error fetching booking to correct destination:', bookingErr);
              }
            }
          }
          
          // ✅ CRITICAL DEBUG: Verify locations are correct
          console.log('📡 [TRACKING] Final normalized locations:', {
            currentLocation: normalized?.currentLocation,
            destinationLocation: normalized?.destinationLocation,
            currentLocLat: normalized?.currentLocation?.latitude,
            currentLocLng: normalized?.currentLocation?.longitude,
            destLocLat: normalized?.destinationLocation?.latitude,
            destLocLng: normalized?.destinationLocation?.longitude,
            eta: normalized?.eta,
            distance: normalized?.distance,
          });
          
          // ✅ VALIDATION: Check if locations might be swapped
          if (normalized?.currentLocation && normalized?.destinationLocation) {
            const currLat = normalized.currentLocation.latitude;
            const currLng = normalized.currentLocation.longitude;
            const destLat = normalized.destinationLocation.latitude;
            const destLng = normalized.destinationLocation.longitude;
            
            // Check if they're the same (which would be wrong)
            if (Math.abs(currLat - destLat) < 0.0001 && Math.abs(currLng - destLng) < 0.0001) {
              console.error('⚠️ [TRACKING] WARNING: Current and destination locations are identical!', {
                lat: currLat,
                lng: currLng,
              });
            }
            
            // Check if destination is in Mumbai when it should be Bengaluru
            if (destLat > 18.5 && destLat < 19.5 && destLng > 72.5 && destLng < 73.5) {
              console.error('⚠️ [TRACKING] WARNING: Destination is in Mumbai but should be in Bengaluru!', {
                destinationLocation: { lat: destLat, lng: destLng },
                currentLocation: { lat: currLat, lng: currLng },
              });
            }
            
            // Check if current location is in Bengaluru (destination should be there, not current)
            if (currLat > 12.8 && currLat < 13.0 && currLng > 77.4 && currLng < 77.8) {
              console.error('⚠️ [TRACKING] WARNING: Current location appears to be in Bengaluru (should be destination)!', {
                currentLocation: { lat: currLat, lng: currLng },
                destinationLocation: { lat: destLat, lng: destLng },
              });
            }
          }
          setTracking(normalized);
          setError(null);
          setLastUpdate(new Date());
        } else if (response.success && !response.tracking) {
          setError(response.message || 'GPS tracking is not active for this booking');
          setTracking(null);
        }
      } catch (err: any) {
        if (!mounted) return;
        console.error('Error loading tracking:', err);
        setError(err.message || 'Failed to load tracking data');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial load
    loadTracking();

    // Poll every 3 seconds for real-time updates
    pollInterval = setInterval(loadTracking, 3000);

    // Cleanup
    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      setIsPolling(false);
    };
  }, [bookingId]);

  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'in_transit':
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
      case 'in_transit':
      case 'on_way': return 'text-blue-500';
      case 'arriving': return 'text-yellow-500';
      case 'arrived': return 'text-green-500';
      case 'in_progress': return 'text-orange-500';
      case 'completed': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  // Get current and destination locations with fallbacks
  const currentLoc = tracking?.currentLocation || tracking?.current_location;
  const rawDestLoc = tracking?.destinationLocation || tracking?.destination;
  // ✅ CRITICAL FIX: Use corrected destination if available, otherwise use raw destination
  const destLoc = correctedDestination || rawDestLoc;
  const providerName = tracking?.providerName || tracking?.staff_name || 'Service Provider';
  const providerPhone = tracking?.vendorPhone || tracking?.staff_phone;
  const providerPhoto = tracking?.vendorPhoto || tracking?.staff_photo_url;
  const serviceName = tracking?.serviceName || tracking?.service_name || 'Service';
  // ✅ FIX: Properly handle null/undefined values for ETA and distance
  const etaMinutes = tracking?.eta ?? tracking?.eta_minutes ?? (tracking as any)?.estimatedEtaMinutes ?? null;
  const distanceKm = tracking?.distance ?? tracking?.distance_km ?? (tracking as any)?.distance_remaining_km ?? null;

  // ✅ CRITICAL FIX: Correct destination for map display (same logic as "Open in Google Maps" button)
  useEffect(() => {
    const correctDestinationForMap = async () => {
      if (!rawDestLoc?.latitude || !rawDestLoc?.longitude) {
        return;
      }

      // Check if destination is in Mumbai (wrong location for Bengaluru bookings)
      const isMumbai = rawDestLoc.latitude > 18.5 && rawDestLoc.latitude < 19.5 && rawDestLoc.longitude > 72.5 && rawDestLoc.longitude < 73.5;
      const isBengaluru = rawDestLoc.latitude > 12.8 && rawDestLoc.latitude < 13.2 && rawDestLoc.longitude > 77.4 && rawDestLoc.longitude < 77.8;

      // If destination is already in Bengaluru, no correction needed
      if (isBengaluru) {
        setCorrectedDestination(null); // Use raw destination
        return;
      }

      // If destination is in Mumbai (wrong), try to correct it
      if (isMumbai) {
        console.warn('⚠️ [MAP] Destination is in Mumbai, attempting to correct for map display...');

        // Priority 1: Use corrected destination from tracking state (already corrected by backend/frontend)
        if (tracking?.destinationLocation &&
            tracking.destinationLocation.latitude > 12.8 && tracking.destinationLocation.latitude < 13.2) {
          setCorrectedDestination(tracking.destinationLocation);
          console.log('✅ [MAP] Using corrected destination from tracking state:', tracking.destinationLocation);
          return;
        }

        // Priority 2: Get booking address from diagnostic endpoint and geocode it
        try {
          const diagnosticResponse = await apiClient.get<any>(`/tracking/booking/${bookingId}/diagnostic`) as any;
          const diagnostic = diagnosticResponse?.diagnostic || diagnosticResponse;
          const bookingAddress = diagnostic?.booking?.address;

          if (bookingAddress && typeof bookingAddress === 'string') {
            console.log('⚠️ [MAP] Geocoding booking address from diagnostic endpoint for map...');
            const apiKeyResponse = await apiClient.get<any>('/config/google-maps-key') as any;
            const apiKey = apiKeyResponse?.apiKey || apiKeyResponse?.key;

            if (apiKey) {
              const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(bookingAddress)}&key=${apiKey}`;
              const geocodeResponse = await fetch(geocodeUrl);
              const geocodeData = await geocodeResponse.json();

              if (geocodeData.status === 'OK' && geocodeData.results?.[0]?.geometry?.location) {
                const loc = geocodeData.results[0].geometry.location;
                const corrected = {
                  latitude: parseFloat(loc.lat),
                  longitude: parseFloat(loc.lng),
                };
                setCorrectedDestination(corrected);
                console.log('✅ [MAP] Geocoded booking address for map display:', corrected);
                return;
              }
            }
          } else {
            console.warn('⚠️ [MAP] No booking address found in diagnostic response');
          }
        } catch (err) {
          console.error('Error getting/geocoding booking address for map:', err);
        }
      }
    };

    correctDestinationForMap();
  }, [rawDestLoc, tracking?.destinationLocation, bookingId]);

  // ✅ Load Google Maps JavaScript API
  useEffect(() => {
    const loadGoogleMaps = async () => {
      if (window.google?.maps) {
        setMapLoaded(true);
        return;
      }

      // Try to get API key from environment or backend
      let apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      
      if (!apiKey) {
        try {
          const response = await apiClient.get('/config/google-maps-key') as any;
          apiKey = response?.apiKey || response?.key;
        } catch (err) {
          console.warn('Failed to fetch Google Maps API key from backend:', err);
        }
      }

      if (!apiKey) {
        console.warn('Google Maps API key not configured');
        return;
      }

      // Check if script already exists
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        const checkGoogle = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checkGoogle);
            setMapLoaded(true);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ Google Maps loaded');
        setMapLoaded(true);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Google Maps');
      };
      
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // ✅ Initialize Google Maps ONCE when loaded and tracking data is first available
  useEffect(() => {
    // Only initialize once - don't recreate map on every tracking update
    // ✅ FIX: Allow initialization even if destLoc is temporarily null (will update when corrected)
    if (mapInitializedRef.current || !mapLoaded || !tracking || !mapRef.current || !currentLoc?.latitude) {
      console.log('🗺️ [MAP] Skipping initialization:', {
        mapInitialized: mapInitializedRef.current,
        mapLoaded,
        hasTracking: !!tracking,
        hasMapRef: !!mapRef.current,
        hasCurrentLoc: !!currentLoc?.latitude,
        hasDestLoc: !!destLoc?.latitude,
        currentLoc,
        destLoc,
        rawDestLoc,
        correctedDestination,
      });
      return;
    }

    // ✅ FIX: If destLoc is null but rawDestLoc exists, use rawDestLoc temporarily
    const effectiveDestLoc = destLoc || rawDestLoc;
    if (!effectiveDestLoc?.latitude) {
      console.warn('⚠️ [MAP] No destination location available yet, waiting...', {
        destLoc,
        rawDestLoc,
        correctedDestination,
      });
      return;
    }

    const initializeMap = () => {
      if (!window.google?.maps || !mapRef.current) return;

      console.log('🗺️ Initializing Google Maps for tracking (ONE TIME)...');
      console.log('🗺️ [MAP] Location data:', {
        providerLocation: { lat: currentLoc.latitude, lng: currentLoc.longitude },
        destinationLocation: { lat: effectiveDestLoc.latitude, lng: effectiveDestLoc.longitude },
        providerName,
        usingCorrected: !!correctedDestination,
      });

      // ✅ VALIDATION: Check if locations might be swapped before displaying
      if (Math.abs(currentLoc.latitude - effectiveDestLoc.latitude) < 0.0001 && 
          Math.abs(currentLoc.longitude - effectiveDestLoc.longitude) < 0.0001) {
        console.error('⚠️ [MAP] WARNING: Provider and destination locations are identical!');
      }
      
      // Check if provider location is in Bengaluru (destination should be there, not provider)
      if (currentLoc.latitude > 12.8 && currentLoc.latitude < 13.0 && 
          currentLoc.longitude > 77.4 && currentLoc.longitude < 77.8) {
        console.error('⚠️ [MAP] WARNING: Provider location appears to be in Bengaluru (should be destination)!', {
          providerLocation: { lat: currentLoc.latitude, lng: currentLoc.longitude },
          destinationLocation: { lat: effectiveDestLoc.latitude, lng: effectiveDestLoc.longitude },
        });
      }

      // Calculate center between provider and destination
      const center = {
        lat: (currentLoc.latitude + effectiveDestLoc.latitude) / 2,
        lng: (currentLoc.longitude + effectiveDestLoc.longitude) / 2,
      };

      // Create map
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      mapInstanceRef.current = map;

      // Create provider marker (vendor/staff location) - ORANGE CAR ICON
      const providerPos = { lat: currentLoc.latitude, lng: currentLoc.longitude };
      console.log('🗺️ [MAP] Creating provider marker at:', providerPos);
      providerMarkerRef.current = new window.google.maps.Marker({
        position: providerPos,
        map,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="20" fill="#FF8C42" stroke="white" stroke-width="4"/>
              <text x="24" y="32" font-size="24" text-anchor="middle" fill="white">🚗</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(48, 48),
          anchor: new window.google.maps.Point(24, 24),
        },
        title: `${providerName} (Provider) - Lat: ${currentLoc.latitude}, Lng: ${currentLoc.longitude}`,
        zIndex: 100,
      });

      // Create destination marker (customer location) - GREEN PIN ICON
      const destPos = { lat: effectiveDestLoc.latitude, lng: effectiveDestLoc.longitude };
      console.log('🗺️ [MAP] Creating destination marker at:', destPos);
      destinationMarkerRef.current = new window.google.maps.Marker({
        position: destPos,
        map,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(`
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="16" fill="#10B981" stroke="white" stroke-width="4"/>
              <path d="M20 12L26 28H14L20 12Z" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 40),
          anchor: new window.google.maps.Point(20, 40),
        },
        title: `Your Location (Destination) - Lat: ${effectiveDestLoc.latitude}, Lng: ${effectiveDestLoc.longitude}`,
        zIndex: 99,
      });

      // Draw route line
      routePolylineRef.current = new window.google.maps.Polyline({
        path: [
          { lat: currentLoc.latitude, lng: currentLoc.longitude },
          { lat: effectiveDestLoc.latitude, lng: effectiveDestLoc.longitude },
        ],
        geodesic: true,
        strokeColor: '#FF8C42',
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });

      routePolylineRef.current.setMap(map);

      // Fit bounds to show both markers
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: currentLoc.latitude, lng: currentLoc.longitude });
      bounds.extend({ lat: effectiveDestLoc.latitude, lng: effectiveDestLoc.longitude });
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

      // Mark as initialized
      mapInitializedRef.current = true;
      console.log('✅ Map initialized successfully');
    };

    initializeMap();
    // ✅ FIX: Include location dependencies so map can initialize when destinations are available
  }, [mapLoaded, tracking, currentLoc?.latitude, currentLoc?.longitude, destLoc?.latitude, destLoc?.longitude, rawDestLoc?.latitude, rawDestLoc?.longitude, correctedDestination]);

  // ✅ Update marker position when location changes (only if map is initialized)
  useEffect(() => {
    // Only update if map is already initialized
    if (!mapInitializedRef.current || !mapLoaded || !providerMarkerRef.current || !currentLoc?.latitude || !destLoc?.latitude) {
      return;
    }

    const newPosition = { lat: currentLoc.latitude, lng: currentLoc.longitude };
    const destPosition = { lat: destLoc.latitude, lng: destLoc.longitude };

    // Update provider marker position
    providerMarkerRef.current.setPosition(newPosition);

    // Update route line
    if (routePolylineRef.current) {
      routePolylineRef.current.setPath([
        newPosition,
        destPosition,
      ]);
    }

    // Pan map if marker goes out of view (but don't refit bounds to avoid jarring)
    if (mapInstanceRef.current) {
      const bounds = mapInstanceRef.current.getBounds();
      if (bounds && !bounds.contains(newPosition)) {
        // Smoothly pan to new position instead of refitting
        mapInstanceRef.current.panTo(newPosition);
      }
    }
    // ✅ CRITICAL: Only update when actual coordinates change, not when tracking object reference changes
  }, [mapLoaded, currentLoc?.latitude, currentLoc?.longitude, destLoc?.latitude, destLoc?.longitude]);

  // Build Google Maps embed URL - API key loaded from environment
  const getMapEmbedUrl = () => {
    if (!currentLoc?.latitude || !destLoc?.latitude) return null;
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return null;
    }
    
    // Use directions mode to show route
    const origin = `${currentLoc.latitude},${currentLoc.longitude}`;
    const destination = `${destLoc.latitude},${destLoc.longitude}`;
    
    return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${origin}&destination=${destination}&mode=driving`;
  };

  // Build static map URL - requires API key
  const getStaticMapUrl = () => {
    if (!currentLoc?.latitude || !destLoc?.latitude) return null;
    
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return null;
    }
    
    const markers = `markers=color:blue|label:V|${currentLoc.latitude},${currentLoc.longitude}&markers=color:red|label:D|${destLoc.latitude},${destLoc.longitude}`;
    const path = `path=color:0x0000ff|weight:3|${currentLoc.latitude},${currentLoc.longitude}|${destLoc.latitude},${destLoc.longitude}`;
    
    return `https://maps.googleapis.com/maps/api/staticmap?size=400x300&${markers}&${path}&key=${apiKey}`;
  };

  // ✅ CRITICAL FIX: Show error if no bookingId could be resolved (static export edge case)
  if (!bookingId) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg w-full max-w-sm mx-auto">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Tracking Link</h2>
          <p className="text-gray-500 mb-4 text-sm">No booking ID found in the URL. Please use a valid tracking link.</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition font-medium"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center px-4">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 animate-ping rounded-full bg-blue-200 opacity-75"></div>
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-lg">
              <span className="text-4xl animate-bounce">🚗</span>
            </div>
          </div>
          <p className="text-gray-600 font-medium">Loading tracking...</p>
          <p className="text-gray-400 text-sm mt-1">Finding your service provider</p>
        </div>
      </div>
    );
  }

  if (error || !tracking) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="text-center p-6 bg-white rounded-2xl shadow-lg w-full max-w-sm mx-auto">
          <div className="text-5xl mb-4">📍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Tracking Not Available</h2>
          <p className="text-gray-500 mb-4 text-sm">{error || 'Unable to load tracking data'}</p>
          <button
            onClick={() => router.back()}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition font-medium"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-100 flex flex-col w-full max-w-md mx-auto">
      {/* Header - Mobile optimized */}
      <header className="bg-white shadow-sm sticky top-0 z-50 safe-area-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 truncate">Live Tracking</h1>
            <p className="text-xs text-gray-500 truncate">{serviceName}</p>
          </div>
          <div className="flex items-center gap-2">
            {providerPhone && (
              <a 
                href={`tel:${providerPhone}`}
                className="w-10 h-10 flex items-center justify-center bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Map Section - Mobile optimized height */}
      <div className="flex-1 min-h-[45vh] bg-gray-200 relative overflow-hidden">
        {/* ✅ Actual Google Maps container */}
        <div ref={mapRef} className="absolute inset-0 w-full h-full" />
        
        {currentLoc?.latitude && destLoc?.latitude ? (
          <>
            {/* Overlay content on top of map */}
            {!mapLoaded && (
              <div className="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-blue-900/30 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-3xl animate-spin">🗺️</span>
                  </div>
                  <p className="text-gray-600 text-sm">Loading map...</p>
                </div>
              </div>
            )}
            
            {/* Open in Maps button - with destination validation */}
            <button
              onClick={async (e) => {
                e.preventDefault();
                
                // ✅ CRITICAL FIX: Validate and correct destination before opening Google Maps
                let finalDestination = destLoc;
                
                // Check if destination is in Mumbai (wrong location for Bengaluru bookings)
                const isMumbai = destLoc.latitude > 18.5 && destLoc.latitude < 19.5 && destLoc.longitude > 72.5 && destLoc.longitude < 73.5;
                const isBengaluru = destLoc.latitude > 12.8 && destLoc.latitude < 13.2 && destLoc.longitude > 77.4 && destLoc.longitude < 77.8;
                
                if (isMumbai && !isBengaluru) {
                  console.warn('⚠️ [MAPS] Destination is in Mumbai, attempting to correct...');
                  
                  // Priority 1: Use corrected destination from tracking state (already corrected by backend/frontend)
                  if (tracking?.destinationLocation && 
                      tracking.destinationLocation.latitude > 12.8 && tracking.destinationLocation.latitude < 13.2) {
                    finalDestination = tracking.destinationLocation;
                    console.log('✅ [MAPS] Using corrected destination from tracking state:', finalDestination);
                  } else {
                    // Priority 2: Get booking address from diagnostic endpoint and geocode it
                    try {
                      const diagnosticResponse = await apiClient.get<any>(`/tracking/booking/${bookingId}/diagnostic`) as any;
                      const diagnostic = diagnosticResponse?.diagnostic || diagnosticResponse;
                      const bookingAddress = diagnostic?.booking?.address;
                      
                      if (bookingAddress && typeof bookingAddress === 'string') {
                        console.log('⚠️ [MAPS] Geocoding booking address from diagnostic endpoint...');
                        const apiKeyResponse = await apiClient.get<any>('/config/google-maps-key') as any;
                        const apiKey = apiKeyResponse?.apiKey || apiKeyResponse?.key;
                        
                        if (apiKey) {
                          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(bookingAddress)}&key=${apiKey}`;
                          const geocodeResponse = await fetch(geocodeUrl);
                          const geocodeData = await geocodeResponse.json();
                          
                          if (geocodeData.status === 'OK' && geocodeData.results?.[0]?.geometry?.location) {
                            const loc = geocodeData.results[0].geometry.location;
                            finalDestination = {
                              latitude: parseFloat(loc.lat),
                              longitude: parseFloat(loc.lng),
                            };
                            console.log('✅ [MAPS] Geocoded booking address for Google Maps:', finalDestination);
                          }
                        }
                      } else {
                        console.warn('⚠️ [MAPS] No booking address found in diagnostic response');
                      }
                    } catch (err) {
                      console.error('Error getting/geocoding booking address for Google Maps:', err);
                    }
                  }
                }
                
                // Open Google Maps with corrected destination
                const mapsUrl = `https://www.google.com/maps/dir/${currentLoc.latitude},${currentLoc.longitude}/${finalDestination.latitude},${finalDestination.longitude}`;
                console.log('🗺️ [MAPS] Opening Google Maps with:', {
                  origin: { lat: currentLoc.latitude, lng: currentLoc.longitude },
                  destination: { lat: finalDestination.latitude, lng: finalDestination.longitude },
                });
                window.open(mapsUrl, '_blank');
              }}
              className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-white text-blue-600 rounded-full shadow-lg hover:bg-blue-50 transition text-sm font-medium flex items-center gap-2 z-10"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Open in Google Maps
            </button>
            
            {/* ETA & Distance Cards */}
            <div className="absolute top-3 left-3 right-3 flex justify-between gap-2">
              <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg flex-1 z-10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">ETA</p>
                <p className="text-xl font-bold text-blue-600">
                  {etaMinutes != null && !isNaN(Number(etaMinutes)) ? (() => {
                    const minutes = Math.round(Number(etaMinutes));
                    if (minutes >= 60) {
                      const hours = Math.floor(minutes / 60);
                      const remainingMinutes = minutes % 60;
                      if (remainingMinutes === 0) {
                        return `${hours}`;
                      } else {
                        return `${hours}h ${remainingMinutes}m`;
                      }
                    } else {
                      return `${minutes}`;
                    }
                  })() : '--'}
                  <span className="text-sm font-normal ml-1">
                    {etaMinutes != null && !isNaN(Number(etaMinutes)) && Math.round(Number(etaMinutes)) >= 60 ? 'hours' : 'min'}
                  </span>
                </p>
              </div>
              <div className="bg-white/95 backdrop-blur rounded-xl px-3 py-2 shadow-lg flex-1 z-10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Distance</p>
                <p className="text-xl font-bold text-gray-900">
                  {distanceKm != null && !isNaN(Number(distanceKm)) && Number(distanceKm) > 0 ? Number(distanceKm).toFixed(1) : '--'}
                  <span className="text-sm font-normal ml-1">km</span>
                </p>
              </div>
            </div>
            
            {/* Live indicator */}
            <div className="absolute top-3 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center gap-1.5 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium shadow-lg">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                LIVE
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">📍</span>
              </div>
              <p className="text-gray-500 text-sm">Waiting for location update...</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet - Mobile optimized */}
      <div className="bg-white rounded-t-3xl -mt-4 relative z-10 shadow-2xl flex-shrink-0">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
        </div>
        
        {/* Provider Info Card */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-2xl overflow-hidden shadow-lg">
                {providerPhoto ? (
                  <img src={providerPhoto} alt={providerName} className="w-full h-full object-cover" />
                ) : '👤'}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 ${
                tracking.status === 'on_way' || tracking.status === 'in_transit' || tracking.status === 'arriving' 
                  ? 'bg-green-500 animate-pulse' 
                  : tracking.status === 'arrived' || tracking.status === 'in_progress'
                  ? 'bg-green-500'
                  : 'bg-gray-400'
              } rounded-full border-2 border-white flex items-center justify-center shadow`}>
                <span className="text-[10px]">✓</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{providerName}</h3>
              <p className={`text-sm ${getStatusColor(tracking.status)} font-medium flex items-center gap-1`}>
                {(tracking.status === 'on_way' || tracking.status === 'in_transit') && (
                  <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                )}
                {getStatusMessage(tracking.status)}
              </p>
              {tracking.petName && (
                <p className="text-xs text-gray-500 mt-0.5">🐾 {tracking.petName}</p>
              )}
            </div>
            {providerPhone && (
              <a 
                href={`tel:${providerPhone}`}
                className="w-11 h-11 flex items-center justify-center bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </a>
            )}
          </div>
        </div>

        {/* Progress Steps - Compact for mobile */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between relative">
            {/* Progress line background */}
            <div className="absolute top-3 left-6 right-6 h-1 bg-gray-200 rounded-full"></div>
            {/* Progress line fill */}
            <div 
              className="absolute top-3 left-6 h-1 bg-blue-500 rounded-full transition-all duration-700 ease-out"
              style={{ 
                width: tracking.status === 'on_way' || tracking.status === 'in_transit' ? '0%' : 
                       tracking.status === 'arriving' ? 'calc(33% - 12px)' : 
                       tracking.status === 'arrived' ? 'calc(66% - 12px)' : 
                       tracking.status === 'in_progress' || tracking.status === 'completed' ? 'calc(100% - 24px)' : '0%' 
              }}
            ></div>
            
            {/* Steps */}
            {[
              { id: 'on_way', icon: '🚗', label: 'On Way' },
              { id: 'arriving', icon: '📍', label: 'Arriving' },
              { id: 'arrived', icon: '✅', label: 'Arrived' },
              { id: 'completed', icon: '🎉', label: 'Done' },
            ].map((step) => {
              const steps = ['on_way', 'in_transit', 'arriving', 'arrived', 'in_progress', 'completed'];
              const currentIdx = steps.indexOf(tracking.status);
              const stepIdx = step.id === 'on_way' ? 0 : step.id === 'arriving' ? 2 : step.id === 'arrived' ? 3 : 5;
              const isComplete = stepIdx <= currentIdx;
              const isCurrent = (step.id === 'on_way' && (tracking.status === 'on_way' || tracking.status === 'in_transit')) ||
                               step.id === tracking.status || 
                               (tracking.status === 'in_progress' && step.id === 'completed');
              
              return (
                <div key={step.id} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                    isComplete ? 'bg-blue-500 text-white shadow-md scale-110' : 
                    isCurrent ? 'bg-blue-100 text-blue-500 ring-2 ring-blue-300 ring-offset-1' : 
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium ${isComplete || isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 pb-4 safe-area-bottom space-y-2">
          {tracking.status === 'arrived' && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-200">
              <p className="text-green-700 font-medium text-center flex items-center justify-center gap-2">
                <span className="text-xl">🎉</span>
                Your provider has arrived!
              </p>
            </div>
          )}
          
          {(tracking.status === 'in_progress') && (
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-blue-700 font-medium text-center flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Service in progress...
              </p>
            </div>
          )}
          
          {tracking.status === 'completed' && (
            <button 
              onClick={() => router.push(`/bookings/${bookingId}/review`)}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-200"
            >
              ⭐ Rate & Review
            </button>
          )}
          
          {/* Update indicator */}
          {lastUpdate && (
            <p className="text-center text-[10px] text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()}
              {isPolling && <span className="ml-1">• Auto-refreshing</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

