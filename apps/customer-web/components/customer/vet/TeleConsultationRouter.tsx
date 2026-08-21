'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, Clock, Zap, Calendar, ChevronRight,
  User, Star, Shield, Phone, AlertCircle, PawPrint, Plus, Stethoscope, Search,
  PhoneOff, Loader2, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { HUB_DISCOVERY_VET } from '@/lib/service-hub-discovery-config';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from '../shared/UniversalServiceProviderList';
import { UniversalProviderProfile } from '../shared/UniversalProviderProfile';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { InstantTeleQueue } from '../InstantTele/InstantTeleQueue';
import { isInstantTeleUiEnabled } from '@/lib/instant-tele-ui';
import {
  saveTeleWizardSnapshot,
  bookingFormFieldsFromProceed,
  type TeleWizardSnapshot,
} from '@/lib/navigation/wizard-session-state';
import { useServiceStyleLaunchGate } from '@/hooks/useServiceStyleLaunchGate';
import { ServiceStyleLaunchBlocked } from '../shared/ServiceStyleLaunchBlocked';
import { hasAuthenticatedCustomerSession, requestGuestAuthForInstantTele } from '@/lib/guest-auth-gate';

// ============================================================================
// TYPES
// ============================================================================

interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  photo?: string;
  photos?: string[];
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  role?: string;
  specialization?: string;
  qualifications?: string;
  degree?: string;
  bio?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isOnline?: boolean;
  nextAvailableSlot?: string;
  services: any[];
  amenities?: string[];
  languages?: string[];
  consultationFee?: number;
}

interface PlatformService {
  id: string;
  serviceId: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
}

interface Pet {
  id: string;
  name: string;
  type: string;
  breed?: string;
  photo?: string;
}

interface TeleConsultationRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  /** When true (e.g. `?service=tele` or Book Now from tele promos), skip mode selection and open instant vet list. */
  skipModeSelection?: boolean;
  /**
   * When true (e.g. Home → Veterinary Care → "Tele Consult" tile), skip mode selection and
   * open the SCHEDULED consultation provider list directly. Back from the provider list
   * returns to the parent (home) instead of the mode-selection screen.
   * `skipModeSelection` (instant) takes precedence if both are true.
   */
  skipToScheduled?: boolean;
  /** Restore step/provider/booking form after returning from shell payment. */
  restoredSnapshot?: TeleWizardSnapshot | null;
  onRestoredSnapshotConsumed?: () => void;
  /** Expose step-aware back for shell header / hardware back. */
  onInternalBackReady?: (handleBack: () => void) => void;
}

type FlowStep =
  | 'mode-selection'      // Choose Scheduled vs Instant
  | 'provider-list'       // For Scheduled: list of providers
  | 'provider-profile'    // For Scheduled: provider profile + services
  | 'instant-vendor-list' // For Instant: available-now vets (from va2)
  | 'instant-service'     // For Instant: select service (vendor's tele services)
  | 'instant-pet'         // For Instant: select pet
  | 'instant-calling'     // For Instant V3: "Calling vendor..." screen with SSE
  | 'instant-queue'       // For Instant: waiting in queue for provider to accept (legacy)
  | 'payment'             // Payment page (instant: payment first, then booking)
  | 'confirmation';       // Booking confirmed

// ============================================================================
// MODE SELECTION SCREEN
// ============================================================================

interface ModeSelectionProps {
  onSelectScheduled: () => void;
  onSelectInstant: () => void;
  onBack: () => void;
  showInstantOption: boolean;
}

function ModeSelection({ onSelectScheduled, onSelectInstant, onBack, showInstantOption }: ModeSelectionProps) {
  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader for consistent Frame UI */}
      <ServiceDashboardHeader
        serviceName="Tele Consultation"
        serviceSubtitle="Video consultation with vets"
        serviceIcon={Video}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="px-4 pt-4 pb-8">
        {/* Section Title */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">How would you like to consult?</h2>

        {showInstantOption ? (
          <button
            className="w-full p-4 mb-3 rounded-2xl text-left transition-all border-2 border-transparent hover:border-green-400 hover:shadow-md bg-green-50"
            onClick={onSelectInstant}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-base text-gray-900">Instant Consultation</h3>
                  <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium">Live Now</span>
                </div>
                <p className="text-sm text-gray-600 leading-snug">
                  Connect immediately with the next available vet
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    &lt;5 min wait
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5" />
                    Video call
                  </span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
            </div>
          </button>
        ) : null}

        {/* Scheduled Consultation */}
        <button
          className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-blue-400 hover:shadow-md bg-blue-50"
          onClick={onSelectScheduled}
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base text-gray-900 mb-1">Scheduled Consultation</h3>
              <p className="text-sm text-gray-600 leading-snug">
                Choose your preferred vet and book a time slot
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Choose your vet
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Book ahead
                </span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
          </div>
        </button>

        {/* Info Card */}
        <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> Both options include video consultation, prescription, and follow-up support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT: AVAILABLE NOW VENDOR LIST (vet-only from va2, no queue)
// ============================================================================

interface AvailableNowVendor {
  vendorId: string;
  vendorName: string;
  photo?: string;
  phone?: string;
  city?: string;
  address?: string;
}

interface InstantVendorListProps {
  vendors: AvailableNowVendor[];
  loading: boolean;
  onSelectVendor: (v: AvailableNowVendor) => void;
  onBack: () => void;
}

function InstantVendorList({ vendors, loading, onSelectVendor, onBack }: InstantVendorListProps) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? vendors.filter(
      (v) =>
        v.vendorName?.toLowerCase().includes(search.toLowerCase()) ||
        v.city?.toLowerCase().includes(search.toLowerCase())
    )
    : vendors;

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  return (
    <div className="min-h-screen bg-gray-50 max-w-customer mx-auto">
      <ServiceDashboardHeader
        serviceName="Available now"
        serviceSubtitle="Vets ready for instant video call"
        serviceIcon={Zap}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      <div className="px-4 pt-4 pb-8">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#FF8C42]/30 focus:border-[#FF8C42]"
          />
        </div>
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4" />
            <p className="text-slate-500">Loading available vets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">
              {vendors.length === 0 ? 'No vets available right now' : 'No matches'}
            </h3>
            <p className="text-slate-500 text-sm">
              {vendors.length === 0
                ? 'Try scheduled consultation or check back later.'
                : 'Try a different search.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((v) => (
              <button
                key={v.vendorId}
                onClick={() => onSelectVendor(v)}
                className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md bg-white flex items-center gap-4"
              >
                <div className="w-14 h-14 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0">
                  {v.photo ? (
                    <img src={v.photo} alt={v.vendorName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🐾</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base text-slate-900">{v.vendorName}</h3>
                  {v.city && (
                    <p className="text-sm text-slate-500 mt-0.5">{v.city}</p>
                  )}
                  <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-green-600 font-medium">
                    <Zap className="w-3.5 h-3.5" /> Available now
                  </span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT SERVICE SELECTION
// ============================================================================

interface InstantServiceSelectionProps {
  phone: string;
  services: PlatformService[];
  loading: boolean;
  onSelectService: (service: PlatformService) => void;
  onBack: () => void;
}

function InstantServiceSelection({ phone, services, loading, onSelectService, onBack }: InstantServiceSelectionProps) {
  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  return (
    <div className="min-h-screen bg-gray-50 max-w-customer mx-auto">
      {/* ✅ FIX: Add ServiceDashboardHeader for consistent UI */}
      <ServiceDashboardHeader
        serviceName="Instant Consultation"
        serviceSubtitle="Choose a service"
        serviceIcon={Zap}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="px-4 pt-4 pb-8">

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4" />
            <p className="text-slate-500">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">No Services Available</h3>
            <p className="text-slate-500 text-sm">
              No instant consultation services are currently available. Please try scheduled consultation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <button
                key={service.id}
                className="w-full p-4 rounded-2xl text-left transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md bg-slate-50"
                onClick={() => onSelectService(service)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base text-slate-900">{service.name}</h3>
                    {service.description?.trim() && (
                      <div onClick={(e) => e.stopPropagation()} className="mt-1">
                        <ServiceDescriptionInline
                          description={service.description}
                          title={service.name}
                          className="m-0 text-sm leading-snug text-slate-500"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {service.duration} mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" />
                        Video call
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-bold text-lg text-[#FF8C42]">₹{service.price}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>
                    <ChevronRight className="w-5 h-5 text-slate-400 ml-auto" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT PET SELECTION
// ============================================================================

interface InstantPetSelectionProps {
  phone: string;
  selectedService: PlatformService;
  pets: Pet[];
  loading: boolean;
  onSelectPet: (pet: Pet) => void;
  onAddPet: () => void;
  onBack: () => void;
}

function InstantPetSelection({ phone, selectedService, pets, loading, onSelectPet, onAddPet, onBack }: InstantPetSelectionProps) {
  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  return (
    <div className="min-h-screen bg-gray-50 max-w-customer mx-auto">
      {/* ✅ FIX: Add ServiceDashboardHeader for consistent UI */}
      <ServiceDashboardHeader
        serviceName="Tele-Consultation"
        serviceSubtitle={selectedService.name}
        serviceIcon={PawPrint}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="px-4 pt-4 pb-8">

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF8C42] mx-auto mb-4" />
            <p className="text-slate-500">Loading pets...</p>
          </div>
        ) : pets.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl">
            <PawPrint className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 mb-2">No Pets Added</h3>
            <p className="text-slate-500 text-sm mb-4">
              Please add your pet first to proceed with the consultation.
            </p>
            <Button onClick={onAddPet} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              Add Pet
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  className="p-4 rounded-2xl text-center transition-all border-2 border-transparent hover:border-[#FF8C42] hover:shadow-md bg-slate-50"
                  onClick={() => onSelectPet(pet)}
                >
                  <div className="w-16 h-16 bg-slate-200 rounded-full mx-auto mb-3 overflow-hidden">
                    {pet.photo ? (
                      <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">
                        {pet.type?.toLowerCase() === 'dog' ? '🐕' : '🐈'}
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900">{pet.name}</h3>
                  <p className="text-xs text-slate-500">{pet.breed || pet.type}</p>
                </button>
              ))}

              {/* Add Pet Card */}
              <button
                className="p-4 rounded-2xl text-center transition-all border-dashed border-2 border-slate-200 hover:border-[#FF8C42] hover:shadow-md flex flex-col items-center justify-center"
                onClick={onAddPet}
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                  <Plus className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="font-medium text-slate-600">Add Pet</h3>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// INSTANT V3: CALLING VENDOR SCREEN (SSE-driven)
// ============================================================================

interface CallingVendorScreenProps {
  bookingId: string;
  vendorName: string;
  serviceName: string;
  servicePrice: number;
  onVendorAccepted: (bookingId: string, totalAmount: number) => void;
  onVendorRejected: () => void;
  onTimeout: () => void;
  onCancel: () => void;
}

function CallingVendorScreen({
  bookingId,
  vendorName,
  serviceName,
  servicePrice,
  onVendorAccepted,
  onVendorRejected,
  onTimeout,
  onCancel,
}: CallingVendorScreenProps) {
  const [status, setStatus] = useState<'calling' | 'accepted' | 'rejected' | 'timeout' | 'error'>('calling');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // Set up SSE stream
    const apiBase = getApiBaseUrl();
    const sseUrl = `${apiBase}/customer/tele/instant-stream/${bookingId}`;

    console.log('[CallingVendor] 🔌 Setting up SSE connection');
    console.log('[CallingVendor] 📍 API Base URL:', apiBase);
    console.log('[CallingVendor] 🔗 SSE URL:', sseUrl);
    console.log('[CallingVendor] 📋 Booking ID:', bookingId);

    try {
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      // Log connection state changes
      eventSource.onopen = () => {
        console.log('[CallingVendor] ✅ SSE connection opened successfully');
        console.log('[CallingVendor] SSE readyState:', eventSource.readyState, '(1=OPEN)');
      };

      // Listen to all messages for debugging
      eventSource.onmessage = (event: MessageEvent) => {
        console.log('[CallingVendor] 📨 SSE message received (no event type):', {
          data: event.data,
          type: event.type,
          origin: event.origin,
        });
      };

      // Listen for vendor_accepted event
      eventSource.addEventListener('vendor_accepted', (event: MessageEvent) => {
        try {
          console.log('[CallingVendor] ✅ vendor_accepted event received!');
          console.log('[CallingVendor] Event details:', {
            data: event.data,
            type: event.type,
            origin: event.origin,
          });

          const data = JSON.parse(event.data);
          console.log('[CallingVendor] Parsed data:', data);

          setStatus('accepted');
          toast.success(`${vendorName} accepted your call!`);

          const finalBookingId = data.bookingId || bookingId;
          const finalAmount = Number(data.totalAmount) || servicePrice;

          console.log('[CallingVendor] Calling onVendorAccepted with:', {
            bookingId: finalBookingId,
            totalAmount: finalAmount,
          });

          onVendorAccepted(finalBookingId, finalAmount);
        } catch (e) {
          console.error('[CallingVendor] ❌ Parse error in vendor_accepted:', e);
          console.error('[CallingVendor] Raw event data:', event.data);
        }
      });

      // Listen for vendor_rejected event
      eventSource.addEventListener('vendor_rejected', (event: MessageEvent) => {
        console.log('[CallingVendor] ❌ vendor_rejected event received:', event.data);
        setStatus('rejected');
        toast.error(`${vendorName} is currently unavailable.`);
        onVendorRejected();
      });

      // Listen for timeout event
      eventSource.addEventListener('timeout', (event: MessageEvent) => {
        console.log('[CallingVendor] ⏱️ timeout event received:', event.data);
        setStatus('timeout');
        toast.error('Vendor did not respond in time.');
        onTimeout();
      });

      // Listen for ended event
      eventSource.addEventListener('ended', (event: MessageEvent) => {
        console.log('[CallingVendor] 🔚 ended event received:', event.data);
        setStatus('timeout');
        onTimeout();
      });

      // Listen for payment_confirmed event
      eventSource.addEventListener('payment_confirmed', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[CallingVendor] 💳 Payment confirmed via SSE:', data);
        } catch (e) {
          console.warn('[CallingVendor] Failed to parse payment_confirmed event:', e);
        }
      });

      // Listen for connection event
      eventSource.addEventListener('connection', (event: MessageEvent) => {
        console.log('[CallingVendor] 🔌 SSE connection event:', event.data);
      });

      // Listen for heartbeat event
      eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
        // Log heartbeat occasionally to confirm connection is alive
        if (elapsedSeconds % 30 === 0) {
          console.log('[CallingVendor] 💓 SSE heartbeat received');
        }
      });

      // Enhanced error handling
      eventSource.onerror = (error) => {
        console.warn('[CallingVendor] ⚠️ SSE connection error:', error);
        console.warn('[CallingVendor] SSE readyState:', eventSource.readyState, {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSED',
        }[eventSource.readyState]);

        // If connection is closed, log it but don't take action
        // The stream should automatically reconnect
        if (eventSource.readyState === EventSource.CLOSED) {
          console.warn('[CallingVendor] SSE connection closed. Stream may reconnect automatically.');
        }
      };
    } catch (err) {
      console.error('[CallingVendor] ❌ SSE setup error:', err);
    }

    return () => {
      console.log('[CallingVendor] 🧹 Cleaning up SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [bookingId, vendorName, servicePrice, onVendorAccepted, onVendorRejected, onTimeout]);


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-customer mx-auto">
      <ServiceDashboardHeader
        serviceName="Calling..."
        serviceSubtitle={`${vendorName} - ${serviceName}`}
        serviceIcon={Phone}
        iconColor="text-white"
        stats={EMPTY_SERVICE_HEADER_STATS}
        onBack={onCancel}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      <div className="px-4 pt-8 pb-8 flex flex-col items-center">
        {status === 'calling' && (
          <>
            {/* Pulsing call animation */}
            <div className="relative mb-8">
              <div className="absolute inset-0 w-32 h-32 rounded-full bg-green-400/30 animate-ping" />
              <div className="absolute inset-2 w-28 h-28 rounded-full bg-green-400/20 animate-pulse" />
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg">
                <Phone className="w-12 h-12 text-white animate-bounce" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">Calling {vendorName}...</h2>
            <p className="text-gray-500 text-sm mb-1">Waiting for the vet to accept your call</p>
            <p className="text-gray-400 text-xs mb-8">{formatTime(elapsedSeconds)}</p>

            {/* Service info */}
            <Card className="w-full p-4 mb-6 bg-white border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{serviceName}</p>
                  <p className="text-sm text-gray-500">Video Consultation</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-[#FF8C42]">₹{servicePrice}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>
                </div>
              </div>
            </Card>

            {/* Cancel button */}
            <Button
              variant="outline"
              onClick={onCancel}
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
            >
              <PhoneOff className="w-4 h-4 mr-2" />
              Cancel Call
            </Button>
          </>
        )}

        {status === 'rejected' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Call Declined</h2>
            <p className="text-gray-500 text-sm mb-6">
              {vendorName} is currently unavailable. Please try another vet.
            </p>
            <Button onClick={onVendorRejected} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              Try Another Vet
            </Button>
          </div>
        )}

        {status === 'timeout' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Response</h2>
            <p className="text-gray-500 text-sm mb-6">
              The vet did not respond in time. Please try another vet.
            </p>
            <Button onClick={onTimeout} className="bg-[#FF8C42] hover:bg-[#FF7029]">
              Try Another Vet
            </Button>
          </div>
        )}

        {status === 'accepted' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Call Accepted!</h2>
            <p className="text-gray-500 text-sm">
              Redirecting to payment...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TeleConsultationRouter({
  phone,
  onBack,
  onNavigate,
  skipModeSelection,
  skipToScheduled,
  restoredSnapshot,
  onRestoredSnapshotConsumed,
  onInternalBackReady,
}: TeleConsultationRouterProps) {
  const instantUiEnabled = isInstantTeleUiEnabled();
  const skipToInstantList = Boolean(skipModeSelection && instantUiEnabled);
  const defaultInitialStep: FlowStep = skipToInstantList
    ? 'instant-vendor-list'
    : skipToScheduled || (skipModeSelection && !instantUiEnabled)
      ? 'provider-list'
      : 'mode-selection';
  const restoredStep = restoredSnapshot?.step as FlowStep | undefined;
  const initialStep: FlowStep =
    restoredStep && restoredStep !== 'payment' && restoredStep !== 'confirmation'
      ? restoredStep
      : defaultInitialStep;
  const [step, setStep] = useState<FlowStep>(initialStep);
  const providerProfileInternalBackRef = useRef<(() => void) | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    (restoredSnapshot?.selectedProvider as Provider | null) ?? null,
  );
  const [bookingFormRestore] = useState(() => ({
    showBookingForm: restoredSnapshot?.showBookingForm,
    selectedDate: restoredSnapshot?.selectedDate,
    selectedTime: restoredSnapshot?.selectedTime,
    selectedPetId: restoredSnapshot?.selectedPetId,
    selectedServiceIds: restoredSnapshot?.selectedServiceIds,
    selectedAddressId: restoredSnapshot?.selectedAddressId,
  }));
  const [selectedService, setSelectedService] = useState<PlatformService | null>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Instant flow (available-now → vendor → service → pet → calling → payment)
  const [availableNowVendors, setAvailableNowVendors] = useState<AvailableNowVendor[]>([]);
  const [loadingAvailableNow, setLoadingAvailableNow] = useState(skipToInstantList);
  const deepLinkInstantFetchRef = useRef(false);
  const [selectedInstantVendor, setSelectedInstantVendor] = useState<AvailableNowVendor | null>(null);
  const [vendorTeleServices, setVendorTeleServices] = useState<PlatformService[]>([]);
  const [loadingVendorServices, setLoadingVendorServices] = useState(false);

  // V3 calling state
  const [callingBookingId, setCallingBookingId] = useState<string | null>(null);

  // Data (scheduled path / legacy)
  const [platformServices, setPlatformServices] = useState<PlatformService[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingPets, setLoadingPets] = useState(false);
  const launchGate = useServiceStyleLaunchGate(phone, 'vet', 'tele');

  // Load customer ID / pets only after authentication.
  useEffect(() => {
    if (!hasAuthenticatedCustomerSession() || !phone) return;
    loadCustomerId();
    loadPets();
  }, [phone]);

  useEffect(() => {
    if (restoredSnapshot) {
      onRestoredSnapshotConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume snapshot once on mount
  }, []);

  const loadCustomerId = async () => {
    if (!hasAuthenticatedCustomerSession() || !phone) return;
    try {
      const response = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      if (response?.profile?.id || response?.id) {
        setCustomerId(response?.profile?.id || response?.id);
      }
    } catch (error) {
      console.error('Error loading customer ID:', error);
    }
  };

  const loadPets = async () => {
    if (!hasAuthenticatedCustomerSession() || !phone) return;
    try {
      setLoadingPets(true);
      const response = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (response?.pets) {
        setPets(response.pets);
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    } finally {
      setLoadingPets(false);
    }
  };

  const loadPlatformServices = async () => {
    try {
      setLoadingServices(true);
      // Fetch platform-level tele services for vet role
      const response = await apiClient.get(
        '/customer/services/platform?roleId=vet&serviceStyle=tele'
      ) as any;

      if (response.success && response.services) {
        setPlatformServices(response.services);
      } else {
        // Fallback
        setPlatformServices([
          {
            id: 'instant-general',
            serviceId: 'instant-general',
            name: 'General Consultation',
            description: 'Quick video consultation for general health concerns',
            price: 399,
            duration: 15,
          },
          {
            id: 'instant-emergency',
            serviceId: 'instant-emergency',
            name: 'Emergency Consultation',
            description: 'Urgent consultation for critical health issues',
            price: 699,
            duration: 20,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading platform services:', error);
      // Fallback
      setPlatformServices([
        {
          id: 'instant-general',
          serviceId: 'instant-general',
          name: 'General Consultation',
          description: 'Quick video consultation for general health concerns',
          price: 399,
          duration: 15,
        },
      ]);
    } finally {
      setLoadingServices(false);
    }
  };

  // Handlers
  const handleSelectScheduled = () => {
    setStep('provider-list');
  };

  const loadInstantVendorsAndGo = useCallback(async (revertToModeOnError: boolean) => {
    if (requestGuestAuthForInstantTele('/?service=tele')) {
      return;
    }
    setLoadingAvailableNow(true);
    setAvailableNowVendors([]);
    setSelectedInstantVendor(null);
    setVendorTeleServices([]);
    try {
      const res = await apiClient.get<any>('/customer/tele/available-now');
      const list = res?.vendors || [];
      setAvailableNowVendors(list);
      setStep('instant-vendor-list');
    } catch (err) {
      console.error('Error loading available-now vets:', err);
      toast.error('Could not load available vets. Try again.');
      if (revertToModeOnError) setStep('mode-selection');
    } finally {
      setLoadingAvailableNow(false);
    }
  }, []);

  useEffect(() => {
    if (!skipToInstantList || deepLinkInstantFetchRef.current) return;
    deepLinkInstantFetchRef.current = true;
    void loadInstantVendorsAndGo(true);
  }, [skipToInstantList, loadInstantVendorsAndGo]);

  const handleSelectInstant = () => {
    if (!instantUiEnabled) {
      handleSelectScheduled();
      return;
    }
    void loadInstantVendorsAndGo(false);
  };

  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const loadVendorTeleServices = async (vendorId: string) => {
    setLoadingVendorServices(true);
    setVendorTeleServices([]);
    try {
      const response = await apiClient.get<any>(
        `/customer/vendor/${vendorId}/services?serviceStyle=tele&category=${HUB_DISCOVERY_VET.servicesApiCategory}`
      );
      let list = Array.isArray(response?.services)
        ? mergeCustomerVendorServicesPayload(response)
        : response?.tele?.services || [];
      if (Array.isArray(response) && response.length) list = response;
      const mapped: PlatformService[] = (list || []).map((s: any) => ({
        id: s.id || s.service_id,
        serviceId: s.id || s.service_id,
        name: s.name || s.service_name || 'Consultation',
        description: s.description || s.custom_description,
        price: Number(s.price ?? s.custom_price ?? 499),
        duration: Number(s.duration ?? s.custom_duration ?? s.duration_minutes ?? 15),
      }));
      setVendorTeleServices(mapped);
    } catch (err) {
      console.error('Error loading vendor tele services:', err);
      toast.error('Could not load services. Try another vet.');
    } finally {
      setLoadingVendorServices(false);
    }
  };

  const handleSelectInstantVendor = (v: AvailableNowVendor) => {
    setSelectedInstantVendor(v);
    loadVendorTeleServices(v.vendorId);
    setStep('instant-service');
  };

  const handleSelectInstantService = (service: PlatformService) => {
    setSelectedService(service);
    setStep('instant-pet');
  };

  const handleSelectPet = async (pet: Pet) => {
    setSelectedPet(pet);
    if (selectedInstantVendor && selectedService && customerId) {
      // V3 flow: call instant-request, then show calling screen
      try {
        const res = await apiClient.post<any>('/customer/tele/instant-request', {
          customerId,
          vendorId: selectedInstantVendor.vendorId,
          petId: pet.id,
          serviceId: selectedService.serviceId,
          serviceName: selectedService.name,
          amount: selectedService.price,
        });
        if (res?.success && res?.bookingId) {
          setCallingBookingId(res.bookingId);
          setStep('instant-calling');
        } else {
          toast.error(res?.error || 'Failed to send request to vendor');
        }
      } catch (err: any) {
        console.error('[TeleRouter] instant-request error:', err);
        toast.error(err?.message || 'Failed to connect. Please try again.');
      }
      return;
    }
    if (!customerId) toast.error('Customer ID not found. Please try again.');
  };

  // V3: Called when vendor accepts via SSE → navigate to payment
  const handleVendorAccepted = (bookingId: string, totalAmount: number) => {
    console.log('[TeleConsultationRouter] handleVendorAccepted called:', { bookingId, totalAmount, selectedInstantVendor: !!selectedInstantVendor, selectedService: !!selectedService, selectedPet: !!selectedPet, customerId: !!customerId });
    if (selectedInstantVendor && selectedService && selectedPet && customerId) {
      const paymentData = {
        flowType: 'tele-queue-accepted',
        bookingId, // Existing booking with pending_payment status
        vendorId: selectedInstantVendor.vendorId,
        vendorName: selectedInstantVendor.vendorName,
        serviceId: selectedService.serviceId,
        serviceName: selectedService.name,
        totalAmount: totalAmount || selectedService.price,
        totalDuration: selectedService.duration,
        services: [{ serviceId: selectedService.serviceId, name: selectedService.name, price: selectedService.price, duration: selectedService.duration }],
        petId: selectedPet.id,
        petName: selectedPet.name,
        customerId,
        category: 'vet',
        serviceType: 'tele',
      };
      console.log('[TeleConsultationRouter] Navigating to payment with data:', paymentData);
      saveTeleWizardSnapshot({
        step: 'instant-pet',
        selectedProvider: null,
        selectedInstantVendorId: selectedInstantVendor.vendorId,
        selectedServiceId: selectedService.serviceId,
        selectedPet: selectedPet as unknown as Record<string, unknown>,
      });
      onNavigate('payment', paymentData);
    } else {
      console.error('[TeleConsultationRouter] ❌ Missing required data for payment navigation:', {
        selectedInstantVendor: !!selectedInstantVendor,
        selectedService: !!selectedService,
        selectedPet: !!selectedPet,
        customerId: !!customerId,
      });
    }
  };

  // V3: Called when vendor rejects or timeout
  const handleVendorRejectedOrTimeout = () => {
    setCallingBookingId(null);
    setStep('instant-vendor-list');
  };

  // Legacy: Called when provider accepts from the queue - navigate to payment
  const handleQueueAccepted = (bookingId: string, meetingId?: string) => {
    if (selectedInstantVendor && selectedService && selectedPet && customerId) {
      saveTeleWizardSnapshot({
        step: 'instant-pet',
        selectedProvider: null,
        selectedInstantVendorId: selectedInstantVendor.vendorId,
        selectedServiceId: selectedService.serviceId,
        selectedPet: selectedPet as unknown as Record<string, unknown>,
      });
      onNavigate('payment', {
        flowType: 'tele-queue-accepted',
        bookingId,
        meetingId,
        vendorId: selectedInstantVendor.vendorId,
        vendorName: selectedInstantVendor.vendorName,
        serviceId: selectedService.serviceId,
        serviceName: selectedService.name,
        totalAmount: selectedService.price,
        totalDuration: selectedService.duration,
        services: [{ serviceId: selectedService.serviceId, name: selectedService.name, price: selectedService.price, duration: selectedService.duration }],
        petId: selectedPet.id,
        petName: selectedPet.name,
        customerId,
        category: 'vet',
        serviceType: 'tele',
      });
    }
  };

  const handleProceedToPayment = (bookingData: any) => {
    saveTeleWizardSnapshot({
      step: 'provider-profile',
      selectedProvider: (selectedProvider as Record<string, unknown> | null) ?? null,
      showBookingForm: true,
      ...bookingFormFieldsFromProceed(bookingData),
    });
    onNavigate('payment', {
      ...bookingData,
      vendorId: bookingData?.vendorId || selectedProvider?.vendorId || selectedProvider?.providerId,
      vendorName: bookingData?.vendorName || selectedProvider?.vendorName || selectedProvider?.name,
      serviceType: 'tele',
      serviceStyle: 'tele',
      category: 'vet',
      flowType: 'tele-scheduled',
    });
  };

  const handleAddPet = () => {
    saveTeleWizardSnapshot({
      step,
      selectedProvider: (selectedProvider as Record<string, unknown> | null) ?? null,
      selectedInstantVendorId: selectedInstantVendor?.vendorId,
      selectedServiceId: selectedService?.serviceId,
      selectedPet: (selectedPet as Record<string, unknown> | null) ?? null,
    });
    onNavigate('add-pet', { returnTo: 'tele-consultation' });
  };

  const handleProviderProfileStepBack = useCallback(() => {
    setSelectedProvider(null);
    setStep('provider-list');
  }, []);

  const handleBack = useCallback(() => {
    switch (step) {
      case 'mode-selection':
        onBack();
        break;
      case 'provider-list':
        if (skipToScheduled) {
          onBack();
        } else {
          setStep('mode-selection');
        }
        break;
      case 'provider-profile':
        if (providerProfileInternalBackRef.current) {
          providerProfileInternalBackRef.current();
        } else {
          handleProviderProfileStepBack();
        }
        break;
      case 'instant-vendor-list':
        setAvailableNowVendors([]);
        setStep('mode-selection');
        break;
      case 'instant-service':
        if (selectedInstantVendor) {
          setSelectedInstantVendor(null);
          setVendorTeleServices([]);
          setStep('instant-vendor-list');
        } else {
          setStep('mode-selection');
        }
        break;
      case 'instant-pet':
        setSelectedService(null);
        setStep('instant-service');
        break;
      case 'instant-calling':
        if (callingBookingId) {
          apiClient.post(`/customer/tele/instant-cancel/${callingBookingId}`)
            .then(() => {
              console.log('[TeleRouter] Booking cancelled successfully');
            })
            .catch((err) => {
              console.error('[TeleRouter] Failed to cancel booking:', err);
            });
        }
        setCallingBookingId(null);
        setSelectedPet(null);
        setStep('instant-pet');
        break;
      case 'instant-queue':
        setSelectedPet(null);
        setStep('instant-pet');
        break;
      default:
        onBack();
    }
  }, [
    step,
    skipToScheduled,
    onBack,
    callingBookingId,
    selectedInstantVendor,
    handleProviderProfileStepBack,
  ]);

  useEffect(() => {
    if (step !== 'provider-profile') {
      providerProfileInternalBackRef.current = null;
    }
  }, [step]);

  useEffect(() => {
    onInternalBackReady?.(handleBack);
  }, [handleBack, onInternalBackReady]);

  if (launchGate.ready && launchGate.blocked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ServiceStyleLaunchBlocked message={launchGate.blockMessage} onBack={onBack} />
      </div>
    );
  }

  // Render based on step
  switch (step) {
    case 'mode-selection':
      return (
        <ModeSelection
          onSelectScheduled={handleSelectScheduled}
          onSelectInstant={handleSelectInstant}
          onBack={onBack}
          showInstantOption={instantUiEnabled}
        />
      );

    case 'provider-list':
      return (
        <UniversalServiceProviderList
          phone={phone}
          category="vet"
          roleId="veterinarian"
          serviceStyle="tele"
          title="Tele Consultation"
          subtitle="Choose a vet for video consultation"
          compactFilterSheet
          onBack={handleBack}
          onNavigate={onNavigate}
          onSelectProvider={handleSelectProvider}
        />
      );

    case 'provider-profile':
      if (!selectedProvider) {
        setStep('provider-list');
        return null;
      }
      return (
        <UniversalProviderProfile
          phone={phone}
          provider={selectedProvider}
          category="vet"
          serviceStyle="tele"
          onBack={handleProviderProfileStepBack}
          onInternalBackReady={(fn) => { providerProfileInternalBackRef.current = fn; }}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
          initialShowBookingForm={bookingFormRestore.showBookingForm}
          initialSelectedDate={bookingFormRestore.selectedDate}
          initialSelectedTime={bookingFormRestore.selectedTime}
          initialSelectedPetId={bookingFormRestore.selectedPetId}
          initialSelectedServiceIds={bookingFormRestore.selectedServiceIds}
          initialSelectedAddressId={bookingFormRestore.selectedAddressId}
        />
      );

    case 'instant-vendor-list':
      return (
        <InstantVendorList
          vendors={availableNowVendors}
          loading={loadingAvailableNow}
          onSelectVendor={handleSelectInstantVendor}
          onBack={handleBack}
        />
      );

    case 'instant-service':
      return (
        <InstantServiceSelection
          phone={phone}
          services={selectedInstantVendor ? vendorTeleServices : platformServices}
          loading={selectedInstantVendor ? loadingVendorServices : loadingServices}
          onSelectService={handleSelectInstantService}
          onBack={handleBack}
        />
      );

    case 'instant-pet':
      if (!selectedService) {
        setStep('instant-service');
        return null;
      }
      return (
        <InstantPetSelection
          phone={phone}
          selectedService={selectedService}
          pets={pets}
          loading={loadingPets}
          onSelectPet={handleSelectPet}
          onAddPet={handleAddPet}
          onBack={handleBack}
        />
      );

    case 'instant-calling':
      if (!selectedInstantVendor || !selectedService || !callingBookingId) {
        setStep('instant-pet');
        return null;
      }
      return (
        <CallingVendorScreen
          bookingId={callingBookingId}
          vendorName={selectedInstantVendor.vendorName}
          serviceName={selectedService.name}
          servicePrice={selectedService.price}
          onVendorAccepted={handleVendorAccepted}
          onVendorRejected={handleVendorRejectedOrTimeout}
          onTimeout={handleVendorRejectedOrTimeout}
          onCancel={handleBack}
        />
      );

    case 'instant-queue':
      if (!selectedInstantVendor || !selectedService || !selectedPet || !customerId) {
        setStep('instant-pet');
        return null;
      }
      return (
        <div className="min-h-screen bg-gray-50 max-w-customer mx-auto">
          <ServiceDashboardHeader
            serviceName="Waiting in Queue"
            serviceSubtitle={`${selectedInstantVendor.vendorName} - ${selectedService.name}`}
            serviceIcon={Clock}
            iconColor="text-white"
            stats={EMPTY_SERVICE_HEADER_STATS}
            onBack={handleBack}
            showBackButton={true}
            headerColor="bg-[#FF8C42]"
          />
          <div className="px-4 pt-4 pb-8">
            <InstantTeleQueue
              customerId={customerId}
              petId={selectedPet.id}
              roleId="vet"
              category="vet"
              serviceId={selectedService.serviceId}
              preSelectedVendor={{
                vendorId: selectedInstantVendor.vendorId,
                vendorName: selectedInstantVendor.vendorName,
                serviceId: selectedService.serviceId,
                serviceName: selectedService.name,
                servicePrice: selectedService.price,
                serviceDuration: selectedService.duration,
              }}
              onBack={handleBack}
              onQueueJoined={(queueId) => {
                console.log('[TeleRouter] Joined queue:', queueId);
              }}
              onAccepted={handleQueueAccepted}
            />
          </div>
        </div>
      );

    default:
      return (
        <ModeSelection
          onSelectScheduled={handleSelectScheduled}
          onSelectInstant={handleSelectInstant}
          onBack={onBack}
          showInstantOption={instantUiEnabled}
        />
      );
  }
}

export default TeleConsultationRouter;
