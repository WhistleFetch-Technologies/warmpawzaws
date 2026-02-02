'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, MapPin, Clock, User, Phone, Calendar, Star, CheckCircle2, XCircle, AlertCircle, Navigation, Loader2, MessageSquare, FileText, RefreshCw, History, Pill, Video, Stethoscope, Printer, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
// Uses apiClient (API Gateway)
import { toast } from 'sonner';
import { authenticatedFetch } from '@/lib/session-manager'; // ✅ SECURITY FIX
import { MedicalHistoryModal } from './MedicalHistoryModal';
import { AddVetSummaryModal } from './modals/AddVetSummaryModal';
import { DiagnosticsReportUpload } from './diagnostics/DiagnosticsReportUpload';
import { CommunicationHub } from '../communication/CommunicationHub';
import dynamic from 'next/dynamic';
import { transformPrescriptionData } from './PrescriptionDocument';

// Dynamically import PrescriptionDocument for A4 view
const PrescriptionDocument = dynamic(() => import('./PrescriptionDocument'), {
  loading: () => <div className="flex items-center justify-center p-8">Loading document...</div>,
  ssr: false
});

interface AppointmentDetailModalProps {
  bookingId: string;
  vendorData?: any;
  onClose: () => void;
  onRefresh?: () => void;
}

interface Booking {
  id: string;
  petId?: string; // ✅ Added petId for medical history context
  customerId?: string; // ✅ Added for prescription creation
  time: string;
  customerName: string;
  customerPhone: string;
  petName: string;
  petType: string;
  petBreed: string;
  petAge: string;
  location: string;
  serviceType: string;
  serviceName: string;
  status: string;
  date: string;
  price: number;
  duration: number;
  createdAt: string;
  updatedAt: string;
  arrived?: boolean; // Track if vendor has arrived at location
  
  // Parent/Follow-up
  isFollowUp: boolean;
  parentBookingId?: string;
  
  // Specialized Metadata (New)
  meetingLink?: string;
  metadata?: {
    guestCount?: number;
    checkinDate?: string;
    checkoutDate?: string;
    symptoms?: string[];
    petDetails?: any;
  };
  specialInstructions?: string;
  
  // Prescription
  hasPrescription: boolean;
  prescriptionNotes?: string;
  prescriptionUrl?: string;
  prescriptionUploadedAt?: string;

  // Vendor (for prescription creation)
  vendorId?: string;
  staffId?: string;
  staff_id?: string; // snake_case version from API
  
  // Location coordinates (for GPS tracking)
  latitude?: string;
  longitude?: string;
  delivery_latitude?: string;
  delivery_longitude?: string;
  customer_latitude?: string;
  customer_longitude?: string;
  address_id?: string;
  
  // Allow any additional properties from API
  [key: string]: any;
}

interface Activity {
  id: string;
  type: 'status_change' | 'prescription' | 'chat' | 'note' | 'follow_up';
  description: string;
  timestamp: string;
  actor: string;
}

interface Prescription {
  id: string;
  bookingId: string;
  notes: string;
  medications: string;
  dosage: string;
  frequency: string;
  duration: string;
  uploadedAt: string;
  uploadedBy: string;
}

export function AppointmentDetailModal({ bookingId, vendorData, onClose, onRefresh }: AppointmentDetailModalProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'prescriptions'>('details');
  
  // Modal states
  const [communicationMode, setCommunicationMode] = useState<'video' | 'chat' | null>(null);
  const [showMedicalHistory, setShowMedicalHistory] = useState(false);
  const [showVetSummaryModal, setShowVetSummaryModal] = useState(false);
  const [showReportUploadModal, setShowReportUploadModal] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showA4Document, setShowA4Document] = useState(false);
  const [selectedPrescriptionForA4, setSelectedPrescriptionForA4] = useState<any>(null);
  
  // OTP States
  const [otp, setOtp] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'complete' | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadAppointmentDetails();
  }, [bookingId]);

  const loadAppointmentDetails = async () => {
    try {
      setLoading(true);
      
      // Load booking details
      const data = await apiClient.get(`/vendor/bookings/${bookingId}/details`) as any;
      const rawBooking = data.booking;
      
      // ✅ CRITICAL FIX: Also load booking history (includes prescriptions)
      let historyData: any = null;
      try {
        historyData = await apiClient.get(`/bookings/${bookingId}/history`) as any;
      } catch (error) {
        console.warn('Could not load booking history:', error);
      }
      
      // Map backend response to frontend Booking interface
      const mappedBooking: Booking = {
        id: rawBooking.id || rawBooking.bookingId,
        petId: rawBooking.petId,
        customerId: rawBooking.customerId, // ✅ For prescription creation
        // ✅ FIX: Map bookingDate/bookingTime to date/time
        date: rawBooking.bookingDate || rawBooking.date || new Date().toISOString(),
        time: formatBookingTime(rawBooking.bookingTime || rawBooking.time) || '09:00 AM',
        duration: rawBooking.duration || 30,
        // ✅ FIX: Map totalAmount to price
        price: rawBooking.totalAmount || rawBooking.price || 0,
        // Customer info
        customerName: rawBooking.customerName || 'Unknown Customer',
        customerPhone: rawBooking.customerPhone || '',
        // Pet info  
        petName: rawBooking.petName || 'Unknown Pet',
        petType: rawBooking.petType || rawBooking.petSpecies || '',
        petBreed: rawBooking.petBreed || '',
        petAge: rawBooking.petAge ? `${rawBooking.petAge} years` : '',
        // Service info
        serviceName: rawBooking.serviceName || 'Service',
        serviceType: rawBooking.serviceStyle || rawBooking.serviceType || 'at_center',
        // ✅ FIX: Build location from vendor address or service style
        location: rawBooking.location || rawBooking.vendorAddress || rawBooking.customerAddress || 
          (rawBooking.serviceStyle === 'at_home' ? 'Home Visit' : 'At Clinic'),
        status: rawBooking.status || 'pending',
        // Timestamps
        createdAt: rawBooking.createdAt,
        updatedAt: rawBooking.updatedAt,
        // Follow-up
        isFollowUp: rawBooking.isFollowUp || false,
        parentBookingId: rawBooking.parentBookingId,
        // Prescription
        hasPrescription: rawBooking.hasPrescription || false,
        prescriptionNotes: rawBooking.prescriptionNotes,
        prescriptionUrl: rawBooking.prescriptionUrl,
        // Metadata
        metadata: rawBooking.metadata,
        specialInstructions: rawBooking.specialInstructions || rawBooking.notes,
        meetingLink: rawBooking.meetingLink,
        // Vendor (from API – used for prescription creation)
        vendorId: rawBooking.vendorId || rawBooking.vendor_id,
        staffId: rawBooking.staffId || rawBooking.staff_id,
        // For lab/diagnostics: allow upload report
        serviceCategory: rawBooking.serviceCategory,
      };
      
      setBooking(mappedBooking);
      
      // ✅ CRITICAL FIX: Combine activities from booking details and history (which includes prescriptions)
      const activitiesFromDetails = (data.activities || []).map((a: any) => ({
        id: a.id,
        type: a.type || a.activityType,
        description: a.description,
        timestamp: a.createdAt || a.timestamp,
        actor: a.performedBy || a.actor,
      }));
      
      // Get activities from history (includes prescriptions)
      const activitiesFromHistory = (historyData?.history || []).map((h: any) => ({
        id: h.id || `history_${h.type}_${h.timestamp}`,
        type: h.type === 'prescription' ? 'prescription' : h.type || 'status_change',
        description: h.description || (h.type === 'prescription' ? `Prescription created${h.prescription_data?.diagnosis ? ` - Diagnosis: ${h.prescription_data.diagnosis}` : ''}` : ''),
        timestamp: h.created_at || h.timestamp,
        actor: h.actor || 'System',
        prescriptionData: h.prescription_data, // Include prescription data for history display
      }));
      
      // Combine and sort by timestamp
      const allActivities = [...activitiesFromDetails, ...activitiesFromHistory].sort((a, b) => {
        const aTime = new Date(a.timestamp || 0).getTime();
        const bTime = new Date(b.timestamp || 0).getTime();
        return aTime - bTime;
      });
      
      setActivities(allActivities);
      // Safely process prescriptions from details API
      const fromDetails = (data.prescriptions || []).map((prescription: any) => {
        try {
          return {
            id: String(prescription.id || ''),
            bookingId: String(prescription.bookingId || prescription.booking_id || ''),
            notes: String(prescription.notes || prescription.instructions || ''),
            medications: prescription.medications || prescription.medication_name || '',
            dosage: String(prescription.dosage || ''),
            frequency: String(prescription.frequency || ''),
            duration: String(prescription.duration || ''),
            uploadedAt: String(prescription.uploadedAt || prescription.created_at || ''),
            uploadedBy: String(prescription.uploadedBy || prescription.uploaded_by || 'Unknown'),
            ...prescription
          };
        } catch {
          return { id: String(prescription?.id || ''), bookingId: '', notes: '', medications: '', dosage: '', frequency: '', duration: '', uploadedAt: '', uploadedBy: 'Unknown', ...prescription };
        }
      });
      // Merge prescriptions from history (so History tab shows them and Prescriptions tab is complete)
      const fromHistory = (historyData?.history || [])
        .filter((h: any) => h.type === 'prescription' && h.prescription_data)
        .map((h: any) => {
          const d = h.prescription_data;
          return {
            id: d.id || `hist_${h.id || Date.now()}`,
            bookingId: bookingId,
            notes: d.instructions || d.notes || '',
            medications: d.medications || d.medication_name || '',
            dosage: d.dosage || '',
            frequency: d.frequency || '',
            duration: d.duration || '',
            uploadedAt: h.created_at || h.timestamp || '',
            uploadedBy: d.uploadedBy || d.uploaded_by || 'Vendor',
            ...d
          };
        });
      const mergedPrescriptions = [...fromDetails];
      fromHistory.forEach((ph: any) => {
        if (ph.id && !mergedPrescriptions.some((p: any) => p.id === ph.id)) mergedPrescriptions.push(ph);
      });
      const safePrescriptions = mergedPrescriptions.filter((p: any) => p && p.id);
      setPrescriptions(safePrescriptions);
    } catch (error) {
      console.error('Error loading appointment details:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Vet/nutritionist: show prescription (vet, clinic, diagnostics, nutritionist). Others (groomer, walker, trainer): no prescription.
  const isVetOrNutritionist = (() => {
    if (!booking) return false;
    const roleId = vendorData?.roleId ?? '';
    const role = vendorData?.role ?? '';
    const roleName = vendorData?.roleName ?? '';
    const capabilities = vendorData?.capabilities ?? [];
    const svcName = (booking.serviceName || booking.serviceCategory || '').toLowerCase();
    const svcType = (booking.serviceType || '').toLowerCase();
    return (
      (typeof roleId === 'string' && /vet|clinic|diagnostics|nutritionist/i.test(roleId)) ||
      (typeof role === 'string' && /vet|clinic|diagnostics|nutritionist/i.test(role)) ||
      (typeof roleName === 'string' && /vet|clinic|diagnostics|nutritionist/i.test(roleName)) ||
      (Array.isArray(capabilities) && (capabilities.includes('prescriptions') || capabilities.includes('prescription_create'))) ||
      /vet|clinic|consultation|nutritionist|diagnostic/i.test(svcName) ||
      /vet|clinic|consultation|nutritionist/i.test(svcType)
    );
  })();

  // Lab/diagnostics booking: show Upload Report when booking is lab/diagnostics AND vendor can upload reports
  const isDiagnosticsBooking = (() => {
    if (!booking) return false;
    const svcCat = (booking.serviceCategory || '').toString().toLowerCase();
    const svcName = (booking.serviceName || '').toLowerCase();
    const cap = vendorData?.capabilities ?? [];
    const isLabOrDiagnostics = svcCat === 'diagnostics' || /lab|diagnostic/.test(svcName);
    const canUploadReports = Array.isArray(cap) && cap.some((c: string) => /diagnostic_lab|diagnostic_results|diagnostics/i.test(String(c)));
    return isLabOrDiagnostics && canUploadReports;
  })();

  // Service style: tele = video call; at_home/home = start travel
  const rawStyle = (booking?.serviceType || booking?.serviceStyle || booking?.service_style || '').toString().toLowerCase();
  const isTeleStyle = ['tele', 'tele_consultation', 'video', 'online', 'instant_tele'].includes(rawStyle) ||
    (rawStyle && (rawStyle.includes('tele') || rawStyle.includes('video')));
  const isHomeStyle = ['at_home', 'home'].includes(rawStyle);

  // Helper to format booking time
  const formatBookingTime = (time: string | null | undefined): string => {
    if (!time) return '09:00 AM';
    // If already formatted like "09:00 AM", return as is
    if (time.includes('AM') || time.includes('PM')) return time;
    // Convert 24h to 12h format
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP');
      return;
    }

    setProcessing(true);
    setOtpError(null);

    try {
      // Complete the booking with OTP verification
      const data = await apiClient.post(`/vendor/bookings/${bookingId}/complete`, {
        vendorId: vendorData?.id,
        otp: otp
      }) as any;
      
      if (data.success) {
        setShowOtpModal(false);
        setOtp('');
        setOtpAction(null);
        loadAppointmentDetails(); // Refresh state
        onRefresh?.();
        toast.success('Appointment completed successfully! Earnings have been recorded.');
      } else {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      setOtpError(error.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setProcessing(false);
    }
  };

  // ✅ GPS Tracking State
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number; lng: number } | null>(null); // ✅ NEW: Destination for map
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null); // ✅ CRITICAL FIX: Store session ID for updates
  const trackingSessionIdRef = useRef<string | null>(null); // ✅ CRITICAL: Ref so watchPosition callback sees current session ID (closure fix)
  const mapRef = useRef<HTMLDivElement>(null); // ✅ NEW: Map container ref
  const mapInstanceRef = useRef<any>(null); // ✅ NEW: Google Maps instance
  const routePolylineRef = useRef<any>(null); // ✅ NEW: Route polyline

  const handleStartVideoCall = async () => {
    if (!booking?.id) return;
    setProcessing(true);
    try {
      toast.info('Starting video call...');
      const createRes = await apiClient.post('/video-call/create-meeting', {
        bookingId: booking.id,
        customerId: booking.customerId || '',
        vendorId: vendorData?.id || booking.vendorId,
      }) as any;
      if (!createRes?.success && !createRes?.meetingId) {
        toast.error('Failed to create video call');
        return;
      }
      const joinRes = await apiClient.post<any>('/video-call/join', {
        bookingId: booking.id,
        userId: vendorData?.id || booking.vendorId,
        userType: 'vendor',
      });
      if (joinRes?.success) {
        await apiClient.post('/video-call/notify-ready', {
          bookingId: booking.id,
          participantType: 'vendor',
          participantId: vendorData?.id || booking.vendorId,
        }).catch(() => {});
        toast.success('Customer notified! Opening video call...');
        window.location.href = `/video/${booking.id}`;
      } else {
        toast.error('Failed to join video call');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start video call');
    } finally {
      setProcessing(false);
    }
  };

  const handleStartTravel = async () => {
    if (!booking) return;
    
    // ✅ Request GPS permission and start tracking
    if (!navigator.geolocation) {
      toast.error('GPS is not supported on this device');
      return;
    }
    
    try {
      setProcessing(true);
      
      // Get current location first
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          
            try {
            // Start tracking session on backend
            // ✅ CRITICAL FIX: Use vendorId from props or localStorage fallback (like video call)
            const effectiveVendorId = vendorData?.id || booking.vendorId || 
              (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || localStorage.getItem('vendor_id') || '' : '');
            if (!effectiveVendorId) {
              toast.error('Please sign in to start travel tracking');
              setProcessing(false);
              return;
            }
            const trackingResponse = await apiClient.post(`/tracking/start`, {
              bookingId: booking.id,
              vendorId: effectiveVendorId,
              staffId: booking.staffId || booking.staff_id,
              startLatitude: latitude,
              startLongitude: longitude
            }) as any;
            
            // ✅ CRITICAL FIX: Get destination and session ID from tracking session response
            if (trackingResponse?.session) {
              const session = trackingResponse.session;
              
              // Store session ID in ref (so watchPosition callback sees it immediately) and state
              if (session.id) {
                trackingSessionIdRef.current = session.id;
                setTrackingSessionId(session.id);
              }
              
              // Get destination location
              if (session.destinationLocation) {
                const dest = session.destinationLocation;
                setDestinationLocation({ lat: dest.latitude, lng: dest.longitude });
              } else if (session.destination_latitude && session.destination_longitude) {
                setDestinationLocation({ 
                  lat: parseFloat(session.destination_latitude), 
                  lng: parseFloat(session.destination_longitude) 
                });
              }
            }
            
            // Start watching position (use ref in callback so session ID is available immediately)
            const id = navigator.geolocation.watchPosition(
              (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setCurrentLocation(loc);
                
                // ✅ CRITICAL FIX: Send location update using ref (closure-safe)
                const sid = trackingSessionIdRef.current;
                if (sid) {
                  apiClient.post(`/tracking/${sid}/update`, {
                    latitude: loc.lat,
                    longitude: loc.lng
                  }).catch(console.error);
                }
              },
              (error) => {
                console.error('GPS error:', error);
                toast.error('GPS tracking error: ' + error.message);
              },
              { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
            );
            
            setWatchId(id);
            setIsTracking(true);
            setShowTrackingModal(true);
            
            // ✅ CRITICAL FIX: If destination not from tracking response, try other sources
            if (!destinationLocation) {
              // Try multiple sources: booking coordinates, customer address
              let destLoc: { lat: number; lng: number } | null = null;
              
              if (booking?.latitude && booking?.longitude) {
                destLoc = { lat: parseFloat(booking.latitude), lng: parseFloat(booking.longitude) };
              } else if (booking?.delivery_latitude && booking?.delivery_longitude) {
                destLoc = { lat: parseFloat(booking.delivery_latitude), lng: parseFloat(booking.delivery_longitude) };
              } else if (booking?.address_id) {
                // Try to get from customer address
                try {
                  const addressResponse = await apiClient.get(`/customer/addresses/${booking.address_id}`) as any;
                  if (addressResponse?.address?.latitude && addressResponse?.address?.longitude) {
                    destLoc = { 
                      lat: parseFloat(addressResponse.address.latitude), 
                      lng: parseFloat(addressResponse.address.longitude) 
                    };
                  }
                } catch (err) {
                  console.warn('Could not get customer address coordinates:', err);
                }
              }
              
              // If we have destination, set it
              if (destLoc) {
                setDestinationLocation(destLoc);
              }
            }
            
            // ✅ CRITICAL FIX: Initialize map after modal opens
            // Will be triggered by useEffect when showTrackingModal and currentLocation are set
            
            toast.success('GPS tracking started! Customer can now track your location.');
            
            // Refresh booking status
            loadAppointmentDetails();
            onRefresh?.();
          } catch (apiError: any) {
            console.error('Error starting travel:', apiError);
            const msg = apiError?.response?.error || apiError?.responseData?.error || apiError?.message;
            toast.error(msg || 'Failed to start tracking session');
          } finally {
            setProcessing(false);
          }
        },
        (error) => {
          setProcessing(false);
          console.error('GPS permission error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            toast.error('Please enable GPS/location permission to start travel tracking');
          } else {
            toast.error('Could not get your location: ' + error.message);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (error) {
      console.error('Error starting travel:', error);
      setProcessing(false);
    }
  };
  
  // ✅ Stop GPS tracking when modal closes or arrives
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    trackingSessionIdRef.current = null;
    setTrackingSessionId(null);
    setIsTracking(false);
    setShowTrackingModal(false);
    // Clean up map
    if (mapInstanceRef.current) {
      mapInstanceRef.current = null;
    }
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
      routePolylineRef.current = null;
    }
  };

  // ✅ CRITICAL FIX: Initialize tracking map with Google Maps
  const initializeTrackingMap = async () => {
    if (!mapRef.current || !currentLocation) return;

    // Load Google Maps if needed
    if (!window.google?.maps) {
      await loadGoogleMaps();
    }

    if (!window.google?.maps || !mapRef.current) {
      console.warn('Google Maps not available for tracking map');
      return;
    }

    try {
      const center = destinationLocation 
        ? {
            lat: (currentLocation.lat + destinationLocation.lat) / 2,
            lng: (currentLocation.lng + destinationLocation.lng) / 2,
          }
        : currentLocation;

      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 14,
        mapTypeControl: false,
        fullscreenControl: true,
        streetViewControl: false,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Add current location marker
      if (currentLocation) {
        new window.google.maps.Marker({
          position: currentLocation,
          map,
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" fill="#10B981" stroke="white" stroke-width="3"/>
                <circle cx="16" cy="16" r="6" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(32, 32),
          },
          title: 'Your Location',
        });
      }

      // Add destination marker if available
      if (destinationLocation) {
        new window.google.maps.Marker({
          position: destinationLocation,
          map,
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" fill="#FF8C42" stroke="white" stroke-width="3"/>
                <path d="M16 10L20 22H12L16 10Z" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(32, 32),
          },
          title: 'Customer Location',
        });

        // Draw route line
        const polyline = new window.google.maps.Polyline({
          path: [currentLocation, destinationLocation],
          geodesic: true,
          strokeColor: '#FF8C42',
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });
        polyline.setMap(map);
        routePolylineRef.current = polyline;

        // Fit bounds
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(currentLocation);
        bounds.extend(destinationLocation);
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else {
        map.setCenter(currentLocation);
        map.setZoom(15);
      }
    } catch (error) {
      console.error('Error initializing tracking map:', error);
    }
  };

  // ✅ Load Google Maps script
  const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        // Try to get from backend
        apiClient.get('/config/google-maps-key').then((response: any) => {
          const key = response?.apiKey || response?.key;
          if (!key) {
            reject(new Error('Google Maps API key not configured'));
            return;
          }
          loadMapsScript(key, resolve, reject);
        }).catch(() => {
          reject(new Error('Google Maps API key not available'));
        });
      } else {
        loadMapsScript(apiKey, resolve, reject);
      }
    });
  };

  const loadMapsScript = (apiKey: string, resolve: () => void, reject: (err: Error) => void) => {
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval);
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
  };

  // ✅ Update map when location changes
  useEffect(() => {
    if (isTracking && currentLocation && mapInstanceRef.current) {
      // Recenter map on current location
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(currentLocation);
      }
    }
  }, [currentLocation, isTracking]);

  // ✅ Initialize map when modal opens
  useEffect(() => {
    if (showTrackingModal && currentLocation) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        if (destinationLocation) {
          initializeTrackingMap();
        } else {
          // Try to get destination from booking
          if (booking?.latitude && booking?.longitude) {
            setDestinationLocation({ 
              lat: parseFloat(booking.latitude), 
              lng: parseFloat(booking.longitude) 
            });
            setTimeout(() => initializeTrackingMap(), 100);
          } else {
            // Just show current location
            initializeTrackingMap();
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showTrackingModal, currentLocation, destinationLocation]);
  
  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const handleArrived = async () => {
    try {
      setProcessing(true);
      const sid = trackingSessionId ?? trackingSessionIdRef.current;

      // Stop GPS tracking locally first
      stopTracking();

      // Mark GPS session as arrived (updates gps_tracking_sessions + notifies customer)
      if (sid) {
        await apiClient.post(`/tracking/${sid}/arrived`).catch((e) => {
          console.warn('Tracking arrived endpoint failed (non-blocking):', e);
        });
      }

      // Update booking status
      await apiClient.post(`/vendor/bookings/${bookingId}/status`, {
        status: 'arrived',
        note: 'Vendor has arrived at location'
      });

      toast.success('Marked as arrived!');
      loadAppointmentDetails();
      onRefresh?.();
    } catch (error) {
      console.error('Error marking arrived:', error);
      toast.error('Failed to update status');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'completed': return 'bg-green-100 text-green-700 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'status_change': return CheckCircle2;
      case 'prescription': return Pill; // ✅ CRITICAL FIX: Use Pill icon for prescriptions
      case 'chat': return MessageSquare;
      case 'note': return FileText;
      case 'follow_up': return RefreshCw;
      default: return AlertCircle;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl w-full max-w-[430px] h-[90vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl w-full max-w-[430px] p-6">
          <p className="text-center text-gray-600">Appointment not found</p>
          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 bg-[#FF8C42] text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full max-w-[430px] rounded-t-[32px] sm:rounded-[32px] h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between rounded-t-[32px]">
            <div className="flex-1">
              <h2 className="font-bold text-white">Appointment Details</h2>
              <p className="text-xs text-white/80">{booking.petName} - {booking.customerName}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-white px-4">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setActiveTab('prescriptions')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'prescriptions'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              Prescriptions
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50">
            {activeTab === 'details' && (
              <div className="p-4 space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <div className={`px-4 py-2 rounded-lg border inline-block ${getStatusColor(booking.status)}`}>
                    <span className="text-sm font-medium capitalize">{booking.status.replace('_', ' ')}</span>
                  </div>
                  
                  {/* ✅ ACTION BUTTONS based on status */}
                  {booking.status === 'confirmed' && (
                    // ✅ FIXED: Tele consultations don't require OTP - complete via prescription or video call end
                    booking.serviceType === 'tele' || booking.serviceType === 'video_consultation' ? (
                      <button
                        onClick={async () => {
                          try {
                            setProcessing(true);
                            await apiClient.post(`/vendor/bookings/${bookingId}/complete`, { vendorId: vendorData?.id });
                            toast.success('Tele consultation marked as complete');
                            loadAppointmentDetails();
                            onRefresh?.();
                          } catch (e: any) { 
                            console.error(e);
                            toast.error(e.message || 'Failed to complete');
                          } finally { setProcessing(false); }
                        }}
                        disabled={processing}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processing ? 'Completing...' : 'Mark Complete'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setOtpAction('complete');
                          setShowOtpModal(true);
                        }}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete with OTP
                      </button>
                    )
                  )}
                  {booking.status === 'pending' && (
                    <button
                      onClick={async () => {
                        try {
                          setProcessing(true);
                          await apiClient.post(`/vendor/bookings/${bookingId}/confirm`, { vendorId: vendorData?.id });
                          loadAppointmentDetails();
                          onRefresh?.();
                        } catch (e) { console.error(e); } finally { setProcessing(false); }
                      }}
                      disabled={processing}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      Accept Booking
                    </button>
                  )}
                  {booking.status === 'in_progress' && (
                    // ✅ FIXED: For tele/video consultations, complete directly (no OTP needed)
                    booking.serviceType === 'tele' || booking.serviceType === 'video_consultation' ? (
                      <button
                        onClick={async () => {
                          try {
                            setProcessing(true);
                            await apiClient.post(`/vendor/bookings/${bookingId}/complete`, { vendorId: vendorData?.id });
                            toast.success('Consultation completed successfully');
                            loadAppointmentDetails();
                            onRefresh?.();
                          } catch (e: any) { 
                            console.error(e);
                            toast.error(e.message || 'Failed to complete');
                          } finally { setProcessing(false); }
                        }}
                        disabled={processing}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {processing ? 'Completing...' : 'Complete Consultation'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setOtpAction('complete');
                          setShowOtpModal(true);
                        }}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete
                      </button>
                    )
                  )}
                </div>

                {/* Follow-up Badge */}
                {booking.isFollowUp && (
                  <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Follow-up Appointment</span>
                  </div>
                )}

                {/* Date & Time */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Appointment Info</h3>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Date</p>
                      <p className="font-medium text-gray-900">{new Date(booking.date).toLocaleDateString('en-IN', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Time</p>
                      <p className="font-medium text-gray-900">{booking.time} ({booking.duration} min)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium text-gray-900">{booking.location}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Customer Info</h3>
                  
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Owner</p>
                      <p className="font-medium text-gray-900">{booking.customerName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <a href={`tel:${booking.customerPhone}`} className="font-medium text-[#FF8C42]">
                        {booking.customerPhone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Pet Info */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Pet Info</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">{booking.petName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium text-gray-900">{booking.petType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Breed</p>
                      <p className="font-medium text-gray-900">{booking.petBreed || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Age</p>
                      <p className="font-medium text-gray-900">{booking.petAge || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Service Info */}
                <div className="bg-white rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900">Service Info</h3>
                  
                  <div>
                    <p className="text-sm text-gray-500">Service</p>
                    <p className="font-medium text-gray-900">{booking.serviceName}</p>
                  </div>
                  
                  {/* Display Special Instructions if any */}
                  {booking.specialInstructions && (
                    <div>
                      <p className="text-sm text-gray-500">Customer Notes</p>
                      <p className="text-sm text-gray-900 italic">"{booking.specialInstructions}"</p>
                    </div>
                  )}

                  {/* Display Resort/Hotel Metadata */}
                  {booking.metadata && (
                    <>
                      {booking.metadata.guestCount && (
                        <div>
                          <p className="text-sm text-gray-500">Guests</p>
                          <p className="font-medium text-gray-900">{booking.metadata.guestCount} Pax</p>
                        </div>
                      )}
                      {booking.metadata.checkinDate && booking.metadata.checkoutDate && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                             <p className="text-sm text-gray-500">Check-in</p>
                             <p className="font-medium text-gray-900">{new Date(booking.metadata.checkinDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                             <p className="text-sm text-gray-500">Check-out</p>
                             <p className="font-medium text-gray-900">{new Date(booking.metadata.checkoutDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <p className="text-sm text-gray-500">Price</p>
                    <p className="text-xl font-bold text-green-600">₹{booking.price}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-4 space-y-3">
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  activities.map((activity) => {
                    const IconComponent = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="bg-white rounded-xl p-4 flex gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {activity.type === 'prescription' ? (
                            <Pill className="w-4 h-4 text-green-600" />
                          ) : (
                            <IconComponent className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{activity.description}</p>
                          {/* ✅ Prescription line item: details + View A4 */}
                          {activity.type === 'prescription' && (activity as any).prescriptionData && (
                            <div className="mt-2 p-2 bg-green-50 rounded-lg flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs text-green-700 font-medium">Prescription</p>
                                {(activity as any).prescriptionData.diagnosis && (
                                  <p className="text-xs text-gray-600 mt-1">Diagnosis: {(activity as any).prescriptionData.diagnosis}</p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  const pd = (activity as any).prescriptionData;
                                  setSelectedPrescriptionForA4({
                                    ...pd,
                                    id: pd.id,
                                    uploadedAt: activity.timestamp,
                                    uploadedBy: activity.actor,
                                  });
                                  setShowA4Document(true);
                                }}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                              >
                                <Printer className="w-3 h-3" />
                                View A4
                              </button>
                            </div>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(activity.timestamp).toLocaleString('en-IN')} • {activity.actor}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'prescriptions' && (
              <div className="p-4 space-y-3">
                {/* Single prescription = Consultation Summary only (all medicines in one) */}
                {isVetOrNutritionist && booking.status !== 'cancelled' && (
                  <button
                    onClick={() => setShowVetSummaryModal(true)}
                    className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
                  >
                    <Stethoscope className="w-5 h-5" />
                    Add Consultation Summary (Prescription)
                  </button>
                )}

                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Pill className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No prescriptions yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add a prescription using the button above
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-500 mb-2">
                      {prescriptions.length} prescription{prescriptions.length > 1 ? 's' : ''} for this visit
                    </div>
                    {prescriptions.map((prescription: any) => {
                      // Safely get medication name - handle both string and array/object formats
                      const getMedicationName = () => {
                        try {
                          if (prescription.medication_name && typeof prescription.medication_name === 'string') {
                            return prescription.medication_name;
                          }
                          if (prescription.medications) {
                            if (typeof prescription.medications === 'string') {
                              return prescription.medications;
                            }
                            if (Array.isArray(prescription.medications)) {
                              if (prescription.medications.length > 0) {
                                const firstMed = prescription.medications[0];
                                if (typeof firstMed === 'string') return firstMed;
                                if (typeof firstMed === 'object' && firstMed?.name) {
                                  return String(firstMed.name || '');
                                }
                              }
                            }
                            if (typeof prescription.medications === 'object' && prescription.medications !== null) {
                              if (prescription.medications.name) {
                                return String(prescription.medications.name || '');
                              }
                            }
                          }
                          return 'Prescription';
                        } catch (error) {
                          console.error('Error getting medication name:', error);
                          return 'Prescription';
                        }
                      };
                      
                      return (
                      <div key={prescription.id} className="bg-white rounded-xl p-4 space-y-3 border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <Pill className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {getMedicationName()}
                              </h4>
                              <span className="text-xs text-gray-500">
                                {new Date(prescription.uploadedAt || prescription.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {(prescription.notes || prescription.instructions) && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Instructions</p>
                            <p className="text-sm text-gray-900">{prescription.notes || prescription.instructions}</p>
                          </div>
                        )}
                        
                        {(prescription.dosage || prescription.frequency || prescription.duration) && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-blue-50 rounded-lg p-2">
                              <p className="text-xs text-blue-600 font-medium">Dosage</p>
                              <p className="text-sm text-gray-900">{prescription.dosage || '-'}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2">
                              <p className="text-xs text-green-600 font-medium">Frequency</p>
                              <p className="text-sm text-gray-900">{prescription.frequency || '-'}</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2">
                              <p className="text-xs text-orange-600 font-medium">Duration</p>
                              <p className="text-sm text-gray-900">{prescription.duration || '-'}</p>
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Prescribed by: {prescription.uploadedBy || 'Unknown'}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedPrescriptionForA4(prescription);
                              setShowA4Document(true);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                          >
                            <Printer className="w-3 h-3" />
                            View A4
                          </button>
                        </div>
                      </div>
                      );
                    })}
                    
                    {isVetOrNutritionist && booking.status !== 'cancelled' && (
                      <button
                        onClick={() => setShowVetSummaryModal(true)}
                        className="w-full px-4 py-2 bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100 transition-colors"
                      >
                        + Add Consultation Summary
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-white border-t border-gray-200 p-4 space-y-2">
            <div className="flex gap-2">
              {/* CHAT - Always available */}
              <button
                onClick={() => setCommunicationMode('chat')}
                className="flex-1 py-3 bg-white border border-[#FF8C42] text-[#FF8C42] rounded-xl font-medium flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              
              {/* Tele style: Video Call for all providers (vet, groomer, nutritionist, walker, trainer) */}
              {isTeleStyle && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <button
                  onClick={handleStartVideoCall}
                  disabled={processing}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" />
                  Video Call
                </button>
              )}
              {/* Home style: Start Travel, Mark Arrived, etc. (all providers) */}
              {isHomeStyle && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <>
                  {/* Phase 1: Start Travel (If confirmed) */}
                  {booking.status === 'confirmed' && (
                    <button
                      onClick={handleStartTravel}
                      disabled={processing}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      Start Travel
                    </button>
                  )}

                  {/* Phase 2: Arrived (If traveling/vendor_on_way/in_progress) */}
                  {(booking.status === 'traveling' || booking.status === 'vendor_on_way' || (booking.status === 'in_progress' && !(booking as any).arrived)) && (
                    <button
                      onClick={handleArrived}
                      disabled={processing}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      Mark Arrived
                    </button>
                  )}

                  {/* Phase 3: Start Session (If Arrived & Walker/Trainer) */}
                  {booking.status === 'arrived' && (vendorData?.roleId === 'pet_walker' || vendorData?.roleId === 'pet_trainer') && (
                    <button
                      onClick={() => {
                        setOtpAction('start');
                        setShowOtpModal(true);
                      }}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Start Session (OTP)
                    </button>
                  )}

                  {/* Phase 4: Complete (If In Progress or Arrived for non-session roles) */}
                  {((booking.status === 'in_progress' && booking.arrived) || (booking.status === 'arrived' && vendorData?.roleId !== 'pet_walker' && vendorData?.roleId !== 'pet_trainer')) && (
                    <button
                      onClick={() => {
                        setOtpAction('complete');
                        setShowOtpModal(true);
                      }}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Job (OTP)
                    </button>
                  )}
                </>
              )}
            </div>
            
            {/* Prescription + Medical History (Vet/Nutritionist only); single prescription = Consultation Summary only */}
            {isVetOrNutritionist && booking.status !== 'cancelled' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMedicalHistory(true)}
                    className="flex-1 py-3 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Medical History
                  </button>
                  <button
                    onClick={() => setShowVetSummaryModal(true)}
                    className="flex-1 py-3 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Stethoscope className="w-4 h-4" />
                    Consultation Summary (Prescription)
                  </button>
                </div>
                {/* Lab/diagnostics: Upload Report so customer can view/download and add to medical history */}
                {isDiagnosticsBooking && (
                  <button
                    onClick={() => setShowReportUploadModal(true)}
                    className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl font-medium flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Lab Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Medical History Modal */}
      {showMedicalHistory && booking.petId && (
        <MedicalHistoryModal
          petId={booking.petId}
          petName={(booking as any).petName || 'Pet'}
          bookingId={bookingId}
          vendorId={vendorData?.id || ''}
          onClose={() => setShowMedicalHistory(false)}
        />
      )}

      {/* Add Vet Summary Modal */}
      {showVetSummaryModal && booking && (
        <AddVetSummaryModal
          appointmentId={bookingId}
          petName={booking.petName || 'Pet'}
          vendorId={booking.vendorId || vendorData?.id || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '')}
          staffId={booking.staffId || (typeof window !== 'undefined' ? localStorage.getItem('staffId') || localStorage.getItem('staff_id') || '' : '')}
          onClose={() => setShowVetSummaryModal(false)}
          onSuccess={() => {
            setShowVetSummaryModal(false);
            loadAppointmentDetails(); // Refresh
            onRefresh?.();
          }}
        />
      )}

      {/* Communication Hub (Unified Chat/Video) - Rule 2: Video starts from chat (camera icon) */}
      {communicationMode && (
        <CommunicationHub
          mode={communicationMode}
          bookingId={booking.id}
          userId={vendorData?.phone || vendorData?.mobile || '+91'}
          userName={vendorData?.fullName || vendorData?.businessName || 'Vendor'}
          otherUserName={booking.customerName}
          userType="vendor"
          serviceStyle={isTeleStyle ? 'tele' : undefined}
          onStartVideoCall={async (bid) => {
            try {
              setProcessing(true);
              toast.info('Starting video call...');
              const createRes = await apiClient.post('/video-call/create-meeting', {
                bookingId: bid,
                customerId: booking.customerId || '',
                vendorId: vendorData?.id,
              }) as any;
              if (!createRes?.success && !createRes?.meetingId) {
                toast.error('Failed to create video call');
                return;
              }
              const joinRes = await apiClient.post<any>('/video-call/join', {
                bookingId: bid,
                userId: vendorData?.id,
                userType: 'vendor',
              });
              if (joinRes?.success) {
                await apiClient.post('/video-call/notify-ready', {
                  bookingId: bid,
                  participantType: 'vendor',
                  participantId: vendorData?.id,
                }).catch(() => {});
                toast.success('Customer notified! Opening video call...');
                window.location.href = `/video/${bid}`;
              } else {
                toast.error('Failed to join video call');
              }
            } catch (err: any) {
              toast.error(err?.message || 'Failed to start video call');
            } finally {
              setProcessing(false);
            }
          }}
          onClose={() => {
            setCommunicationMode(null);
            loadAppointmentDetails(); // Refresh to show new activity
          }}
        />
      )}

      {/* Lab Report Upload Modal (diagnostics bookings only) */}
      {showReportUploadModal && booking && (
        <div className="fixed inset-0 bg-black/60 z-[65] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            <DiagnosticsReportUpload
              vendorId={booking.vendorId || vendorData?.id || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '')}
              bookingId={bookingId}
              bookingData={{
                customerName: booking.customerName || 'Customer',
                customerPhone: booking.customerPhone || '',
                petName: booking.petName || 'Pet',
                petId: (booking as any).petId || '',
                customerId: (booking as any).customerId || '',
                serviceName: booking.serviceName || 'Lab Test',
              }}
              onSuccess={() => {
                setShowReportUploadModal(false);
                loadAppointmentDetails();
                onRefresh?.();
              }}
              onCancel={() => setShowReportUploadModal(false)}
            />
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {otpAction === 'start' ? 'Start Session' : 'Complete Appointment'}
              </h3>
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Patient Info */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-700">
                <strong>{booking?.petName || 'Pet'}</strong> • {booking?.customerName || 'Customer'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Ask the customer for their 4-digit OTP to complete this appointment
              </p>
            </div>
            
            {/* OTP Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                4-Digit OTP
              </label>
              <input
                type="text"
                maxLength={4}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="w-full text-center text-3xl tracking-[1em] font-mono border-2 border-gray-200 rounded-xl py-4 focus:border-green-500 focus:outline-none"
                autoFocus
              />
            </div>
            
            {otpError && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                {otpError}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                }}
                className="flex-1 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleOtpSubmit}
                disabled={otp.length !== 4 || processing}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ CRITICAL FIX: GPS Tracking Modal with Map View */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-green-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Live Route Tracking</h3>
                  <p className="text-sm text-gray-500">Customer can track your location</p>
                </div>
              </div>
              <button
                onClick={stopTracking}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* ✅ CRITICAL FIX: Map View */}
            <div className="flex-1 relative min-h-[400px] bg-gray-100">
              <div 
                ref={mapRef}
                className="w-full h-full"
                style={{ minHeight: '400px' }}
              />
              {!window.google?.maps && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading map...</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Info Panel */}
            <div className="p-4 border-t border-gray-200 space-y-3">
              {/* Current Location */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Your Location</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${isTracking ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-600'}`}>
                    {isTracking ? '● Live' : '○ Stopped'}
                  </span>
                </div>
                {currentLocation ? (
                  <p className="text-xs font-mono text-gray-900">
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">Getting location...</p>
                )}
              </div>
              
              {/* Destination */}
              {booking && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <span className="text-xs font-medium text-blue-600">Destination</span>
                  <p className="text-sm font-medium text-gray-900 mt-1">{booking.location || booking.customerName}</p>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (currentLocation && booking?.location) {
                      const destination = encodeURIComponent(booking.location);
                      window.open(`https://www.google.com/maps/dir/?api=1&origin=${currentLocation.lat},${currentLocation.lng}&destination=${destination}&travelmode=driving`, '_blank');
                    }
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Open in Maps
                </button>
                <button
                  onClick={handleArrived}
                  disabled={processing}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  I've Arrived
                </button>
              </div>
              
              <p className="text-xs text-center text-gray-400">
                GPS tracking will automatically stop when you mark as arrived
              </p>
            </div>
          </div>
        </div>
      )}

      {/* A4 Prescription Document Modal (vet, patient, address, license, medicines, summary, advice, follow-up) */}
      {showA4Document && selectedPrescriptionForA4 && booking && (
        <PrescriptionDocument
          prescription={transformPrescriptionData({
            ...selectedPrescriptionForA4,
            pet_name: booking.petName,
            pet_species: booking.petType,
            pet_breed: booking.petBreed,
            customer_name: booking.customerName,
            customer_phone: booking.customerPhone,
            vendor_name: vendorData?.businessName || vendorData?.business_name,
            vendor_owner_name: vendorData?.ownerName || vendorData?.owner_name,
            vendor_phone: vendorData?.phone,
            vendor_address: vendorData?.address,
            vendor_city: vendorData?.city,
            vendor_state: vendorData?.state,
            vendor_pincode: vendorData?.pincode,
            vendor_metadata: selectedPrescriptionForA4.vendor_metadata || {
              vetLicense: vendorData?.vetLicense ?? vendorData?.licenseNumber,
              vciRegistrationNumber: vendorData?.vciRegistration,
              qualification: vendorData?.qualification,
              specialization: vendorData?.specialization,
            },
            prescription_date: selectedPrescriptionForA4.prescription_date || selectedPrescriptionForA4.uploadedAt || selectedPrescriptionForA4.created_at,
            diagnosis: selectedPrescriptionForA4.diagnosis,
            instructions: selectedPrescriptionForA4.instructions || selectedPrescriptionForA4.notes,
            follow_up_date: selectedPrescriptionForA4.follow_up_date,
            medications: selectedPrescriptionForA4.medications || (selectedPrescriptionForA4.medication_name ? [{
              name: selectedPrescriptionForA4.medication_name,
              dosage: selectedPrescriptionForA4.dosage,
              frequency: selectedPrescriptionForA4.frequency,
              duration: selectedPrescriptionForA4.duration,
              instructions: selectedPrescriptionForA4.instructions || selectedPrescriptionForA4.notes
            }] : [])
          })}
          onClose={() => {
            setShowA4Document(false);
            setSelectedPrescriptionForA4(null);
          }}
        />
      )}
    </>
  );
}