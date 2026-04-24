"use client";

/**
 * BoardingBookingRouter - Complete Boarding Service Booking Flow
 * 
 * Based on VetBookingRouter pattern - complete booking lifecycle:
 * - Service selection (Overnight, Daycare)
 * - Date range selection (check-in/check-out)
 * - Pet selection
 * - Payment integration (UniversalPaymentPage)
 * - Confirmation
 */

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Moon, Sun, Calendar, Clock, MapPin, User, 
  CheckCircle2, Package, Plus, X, Upload, Building2, Home, Dog, Cat, CalendarRange
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import { BookingConfirmationPage } from '../payment/BookingConfirmationPage';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { serviceOptionColorChipClass } from '@/lib/hub-service-option-styles';

interface BoardingBookingRouterProps {
  phone: string;
  vendorId?: string;
  facility?: any;
  selectedService?: string;
  serviceType?: string;
  serviceId?: string;
  serviceName?: string;
  serviceStyle?: string;
  price?: number;
  duration?: number;
  /** When set, loads `sitting` vendor services and uses at-home booking semantics (no facility rooms). */
  flowVariant?: "boarding" | "pet_sitting";
  /** Hub tile id (`overnight_sitting`, `day_visits`, …) — best-effort match to vendor_services after load. */
  presetSittingOptionId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

/** Map Pet Sitting hub tile ids to default router slugs (see `defaultPetSittingOptions`). */
function mapHubSittingPresetToDefaultSlug(preset: string | undefined): string | undefined {
  if (!preset) return undefined;
  if (preset === "day_visits") return "day_sitting";
  return preset;
}

function vendorServiceTextBlob(s: Record<string, unknown>): string {
  return `${s.serviceName || s.service_name || s.name || ""} ${s.serviceStyle || s.service_style || ""} ${s.description || s.shortDescription || ""}`.toLowerCase();
}

function rowId(s: Record<string, unknown>): string {
  return String(s.id || s.serviceId || s.service_id || "");
}

/** Pick vendor_services row id from hub preset (keyword heuristics). */
function matchPresetToVendorServiceRowId(
  preset: string | undefined,
  services: Record<string, unknown>[]
): string | undefined {
  if (!preset || !Array.isArray(services) || services.length === 0) return undefined;
  const tests: { preset: string; test: (t: string) => boolean }[] = [
    {
      preset: "overnight_sitting",
      test: (t) =>
        (/overnight|night|stay/.test(t) && !/day\s*visit|daytime|check-?in/.test(t)) ||
        t.includes("overnight_sitting"),
    },
    {
      preset: "day_visits",
      test: (t) =>
        (/day|visit|daytime|check-?in|walking|walk/.test(t) && !/overnight|extended|multi/.test(t)) ||
        t.includes("day_sitting"),
    },
    {
      preset: "extended_home",
      test: (t) => /extend|multi|week|long/.test(t) || t.includes("extended_home"),
    },
    {
      preset: "drop_in",
      test: (t) => /drop|quick|feeding|30\s*min|45\s*min/.test(t) || t.includes("drop_in"),
    },
  ];
  const rule = tests.find((x) => x.preset === preset)?.test;
  if (rule) {
    for (const s of services) {
      const t = vendorServiceTextBlob(s);
      if (rule(t)) {
        const id = rowId(s);
        if (id) return id;
      }
    }
  }
  return undefined;
}

type BookingStep = 'service' | 'datetime' | 'pet' | 'payment' | 'confirmation';

/** Matches server pet-sitting pricing (bookings-enhanced). */
const PET_SITTING_BILLING_SLOT_MINUTES = 30;
const BOARDING_NIGHT_MINUTES = 24 * 60;

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
}

export function BoardingBookingRouter({ 
  phone, 
  vendorId, 
  facility, 
  selectedService, 
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  flowVariant = "boarding",
  presetSittingOptionId,
  onBack, 
  onNavigate, 
  onViewBooking 
}: BoardingBookingRouterProps) {
  const isPetSitting = flowVariant === "pet_sitting";
  const apiCategory = isPetSitting ? "sitting" : "boarding";
  const packageServiceType = isPetSitting ? "sitting" : "boarding";
  const flowTitle = isPetSitting ? "Pet Sitting" : "Pet Boarding";
  const priceSuffix = isPetSitting ? "/visit" : "/night";

  // Service context logic
  const hasServiceContext = (serviceType || serviceStyle) && (serviceId || selectedService);
  const initialStep: BookingStep = hasServiceContext ? 'datetime' : 'service';
  const [step, setStep] = useState<BookingStep>(initialStep);
  
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && hasServiceContext && step === 'service') {
      setStep('datetime');
      initializedRef.current = true;
    }
  }, [serviceId, serviceType, serviceStyle, step, hasServiceContext]);

  const [loading, setLoading] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState(() => {
    if (serviceId) return serviceId;
    if (serviceStyle && serviceStyle !== "sitting" && serviceStyle !== "boarding") {
      return serviceStyle;
    }
    if (isPetSitting) {
      const fromHub = mapHubSittingPresetToDefaultSlug(presetSittingOptionId);
      return fromHub || "overnight_sitting";
    }
    if (serviceType === "daycare" || serviceType === "full-day") return "full-day";
    return "overnight";
  });
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('10:00');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [selectedVendorService, setSelectedVendorService] = useState<any>(
    serviceId ? {
      id: serviceId,
      serviceId: serviceId,
      name: serviceName,
      price: price,
      duration: duration,
      serviceStyle: serviceStyle || serviceType
    } : null
  );
  
  // Package awareness
  const [activePackage, setActivePackage] = useState<any>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [usePackageSession, setUsePackageSession] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bookingIdempotencyKey, setBookingIdempotencyKey] = useState<string | null>(null);
  
  // Modal states
  const [showAddPetModal, setShowAddPetModal] = useState(false);

  // Default boarding service options (no vendor / offline demo only — real bookings need vendor UUID rows)
  const defaultServiceTypeOptions = [
    { id: 'overnight', name: 'Overnight Boarding', icon: Moon, price: 999, duration: 1440, desc: 'Full night accommodation', color: 'indigo' },
    { id: 'full-day', name: 'Full Day Boarding', icon: Sun, price: 499, duration: 480, desc: 'All-day care & supervision', color: 'amber' },
    { id: 'half-day', name: 'Half Day Boarding', icon: Clock, price: 349, duration: 240, desc: 'Flexible daytime stay', color: 'rose' },
    { id: 'weekend', name: 'Weekend Boarding', icon: CalendarRange, price: 2499, duration: 4320, desc: 'Fri–Sun packages', color: 'purple' },
    { id: 'weekly', name: 'Weekly Boarding', icon: Calendar, price: 5999, duration: 10080, desc: '7-day stay packages', color: 'orange' },
  ];

  const defaultPetSittingOptions = [
    { id: 'overnight_sitting', name: 'Overnight sitting', icon: Moon, price: 899, duration: 1440, desc: 'Sitter stays overnight at your home', color: 'indigo' },
    { id: 'day_sitting', name: 'Day visits', icon: Sun, price: 549, duration: 480, desc: 'Scheduled daytime check-ins', color: 'amber' },
    { id: 'extended_home', name: 'Extended home stay', icon: Calendar, price: 1499, duration: 2880, desc: 'Multi-day in-home care', color: 'orange' },
    { id: 'drop_in', name: 'Drop-in visits', icon: Clock, price: 249, duration: 45, desc: 'Quick feeding & potty breaks', color: 'rose' },
  ];

  const pickVendorServiceIcon = (styleRaw: string | undefined) => {
    const st = (styleRaw || '').toLowerCase();
    if (st.includes('overnight') || st.includes('night')) return Moon;
    if (st.includes('weekend')) return CalendarRange;
    if (st.includes('weekly') || /\bweek\b/.test(st)) return Calendar;
    if (st.includes('half')) return Clock;
    if (st.includes('day')) return Sun;
    if (st.includes('drop') || st.includes('visit') || st.includes('check')) return Clock;
    if (st.includes('extend')) return Calendar;
    return isPetSitting ? Home : Sun;
  };

  const pickVendorServiceColor = (styleRaw: string | undefined): string => {
    const st = (styleRaw || '').toLowerCase();
    if (st.includes('overnight') || st.includes('night')) return 'indigo';
    if (st.includes('weekend')) return 'purple';
    if (st.includes('weekly') || (/\bweek\b/.test(st) && !st.includes('weekend'))) return 'orange';
    if (st.includes('half')) return 'rose';
    if (st.includes('drop')) return 'rose';
    if (st.includes('extend')) return 'orange';
    if (st.includes('day')) return 'amber';
    if (st.includes('visit')) return 'rose';
    return 'orange';
  };

  const fallbackDefaults = isPetSitting ? defaultPetSittingOptions : defaultServiceTypeOptions;

  /** With a vendor, only list API services — defaults are UI placeholders and have no bookable UUID. */
  const serviceOptions =
    vendorServices.length > 0
      ? vendorServices.map((s) => {
          const styleVal = s.serviceStyle || s.service_style;
          return {
            id: s.id || s.serviceId,
            /** Catalog / legacy FK; may be null while vs.id is always the bookable vendor_services row. */
            serviceId: s.serviceId || s.service_id,
            name: s.serviceName || s.service_name || s.name,
            price: s.price || 0,
            duration: s.duration || 1440,
            desc: s.description || s.shortDescription || '',
            serviceStyle: styleVal,
            icon: pickVendorServiceIcon(styleVal),
            color: pickVendorServiceColor(styleVal),
          };
        })
      : vendorId
        ? []
        : fallbackDefaults;

  const selectedServiceOption = serviceOptions.find((s) => s.id === selectedServiceType) as
    | { id: string; name: string; serviceStyle?: string; desc?: string; price?: number; duration?: number }
    | undefined;
  const sittingStyleLower = String(selectedServiceOption?.serviceStyle || '').toLowerCase();

  /** Overnight / extended: multi-night dates + times (e.g. 1440+ min unit). */
  const sittingMultiNight =
    isPetSitting &&
    (['overnight_sitting', 'extended_home'].includes(selectedServiceType) ||
      sittingStyleLower === 'overnight_sitting' ||
      sittingStyleLower === 'extended_home' ||
      /overnight|extended|multi[\s-]?day/.test((selectedServiceOption?.name || '').toLowerCase()));

  /**
   * Short visits: same-day or few-hour window (30 min, 2 hr, etc.) — "Pet Sitting Visit" and similar.
   * Checkout can be the same calendar day as check-in; not overnight/extended.
   */
  const sittingSameDay = isPetSitting && !sittingMultiNight;

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: formatLocalDateYYYYMMDD(date),
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  };

  const [dates] = useState(generateDates());

  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [hRaw, mRaw = '00'] = String(time24).split(':');
    const hour = Number(hRaw);
    const minute = String(mRaw).slice(0, 2);
    if (Number.isNaN(hour)) return time24;
    if (hour === 0) return `12:${minute} AM`;
    if (hour === 12) return `12:${minute} PM`;
    if (hour < 12) return `${hour}:${minute} AM`;
    return `${hour - 12}:${minute} PM`;
  };

  const getIstNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const isTodayInIst = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr === toDateKey(getIstNow());
  };

  const getCurrentIstMinutes = () => {
    const now = getIstNow();
    return now.getHours() * 60 + now.getMinutes();
  };

  const SLOT_INTERVAL_MINUTES = 30;
  const generateHalfHourSlots = () => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += SLOT_INTERVAL_MINUTES) {
        slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    }
    return slots;
  };
  const allHalfHourSlots = generateHalfHourSlots();

  useEffect(() => {
    loadCustomerData();
    if (vendorId) {
      loadVendorServices();
    }
  }, [phone, vendorId, apiCategory]);

  useEffect(() => {
    if (vendorServices.length === 0) return;
    const ids = vendorServices
      .map((s) => s.id || s.serviceId)
      .filter(Boolean) as string[];
    if (ids.length === 0) return;

    if (isPetSitting && presetSittingOptionId) {
      const matched = matchPresetToVendorServiceRowId(
        presetSittingOptionId,
        vendorServices as Record<string, unknown>[]
      );
      if (matched && ids.includes(matched)) {
        setSelectedServiceType(matched);
        return;
      }
    }

    setSelectedServiceType((prev) => (ids.includes(prev) ? prev : ids[0]));
  }, [vendorServices, isPetSitting, presetSittingOptionId]);

  useEffect(() => {
    if (!vendorId || loading) return;
    if (vendorServices.length === 0) {
      setSelectedServiceType('');
    }
  }, [vendorId, loading, vendorServices.length]);

  useEffect(() => {
    if (step !== 'datetime' || !isPetSitting || sittingSameDay || !checkInDate) return;
    if (checkOutDate && checkOutDate > checkInDate) return;
    const next = new Date(checkInDate);
    next.setDate(next.getDate() + 1);
    setCheckOutDate(formatLocalDateYYYYMMDD(next));
  }, [step, isPetSitting, sittingSameDay, checkInDate, checkOutDate]);

  /** Same-day visits: checkout stays on the selected calendar day; duration comes from start/end time. */
  useEffect(() => {
    if (!isPetSitting || !sittingSameDay || !checkInDate) return;
    setCheckOutDate(checkInDate);
  }, [isPetSitting, sittingSameDay, checkInDate]);

  const loadVendorServices = async () => {
    if (!vendorId) return;

    const filterAtHomeForSitting = (list: any[]) => {
      if (!isPetSitting || !Array.isArray(list)) return list;
      return list.filter((s: any) => {
        const st = String(s.serviceStyle || s.service_style || '').toLowerCase();
        return st === 'at_home' || st === '';
      });
    };

    try {
      setLoading(true);
      const servicesResponse = (await apiClient.get(
        `/customer/vendor/${vendorId}/services?category=${apiCategory}`
      )) as any;

      let list: any[] =
        servicesResponse?.success && Array.isArray(servicesResponse.services)
          ? servicesResponse.services
          : [];

      /** If sitting filter returns nothing, refetch without category and keep at_home rows (DB category/style quirks). */
      if (isPetSitting && list.length === 0) {
        try {
          const fallback = (await apiClient.get(`/customer/vendor/${vendorId}/services`)) as any;
          if (fallback?.success && Array.isArray(fallback.services)) {
            list = filterAtHomeForSitting(fallback.services);
          }
        } catch {
          /* keep empty */
        }
      }

      setVendorServices(list);
    } catch (error) {
      console.error('Error loading vendor services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerData = async () => {
    try {
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        })));
      }
      
      try {
        const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        if (profileResponse?.profile?.id || profileResponse?.id) {
          setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
        }
      } catch (profileErr) {
        console.log('Could not get customer ID');
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      setPets([]);
    }
  };
  
  const refreshPets = async () => {
    try {
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        const mappedPets = petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        }));
        setPets(mappedPets);
        if (mappedPets.length > 0) {
          setSelectedPet(mappedPets[mappedPets.length - 1]);
        }
      }
    } catch (err) {
      console.error('Error refreshing pets:', err);
    }
  };

  const checkForActivePackages = async () => {
    if (!customerId || !vendorId) return;
    
    try {
      const response = await apiClient.get<any>(
        `/packages/check-for-booking?customerId=${customerId}&vendorId=${vendorId}&serviceType=${packageServiceType}`
      );

      if (response?.hasActivePackage && response?.package) {
        setActivePackage(response.package);
        setShowPackageModal(true);
      }
    } catch (error: any) {
      console.log('No active packages found');
    }
  };

  useEffect(() => {
    if (customerId && vendorId && step === 'service') {
      checkForActivePackages();
    }
  }, [customerId, vendorId, step]);

  const handleUsePackageSession = async () => {
    if (!activePackage) return;
    setUsePackageSession(true);
    setShowPackageModal(false);
    toast.success('Using package session - No payment required!');
    setStep('datetime');
  };

  const handleBookNew = () => {
    setShowPackageModal(false);
    setUsePackageSession(false);
  };

  const parseLocalDateTime = (dateStr: string, timeStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = (timeStr || '0:0').split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0).getTime();
  };

  /** Minutes between check-in and check-out (handles next-day end when checkout time is after midnight). */
  const getBilledMinutes = () => {
    if (!checkInDate || !checkOutDate || !checkInTime || !checkOutTime) return 0;
    const start = parseLocalDateTime(checkInDate, checkInTime);
    let end = parseLocalDateTime(checkOutDate, checkOutTime);
    if (end <= start) {
      if (sittingSameDay && checkInDate === checkOutDate) return 0;
      end += 24 * 60 * 60 * 1000;
    }
    return Math.round((end - start) / 60000);
  };

  /** Unit window for ₹ price (vendor `duration` minutes, else overnight = 1440, extended = 2880). */
  const getPetSittingPricingBaseMinutes = (): number => {
    const optDur = Number(selectedServiceOption?.duration);
    if (Number.isFinite(optDur) && optDur >= 15) return optDur;
    const name = (selectedServiceOption?.name || '').toLowerCase();
    if (/extended|multi[\s-]?day/.test(name)) return 2880;
    if (/overnight|night/.test(name)) return 1440;
    if (sittingMultiNight) return 1440;
    if (sittingSameDay) return Math.max(15, Number(selectedServiceOption?.duration) || 60);
    return 1440;
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    if (isPetSitting && sittingSameDay && checkInDate === checkOutDate) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  /** Boarding: list price = per 24h; match server (ceil of stay length in minutes / 24h, min 1). */
  const getBoardingBilledUnits = () => {
    const mins = getBilledMinutes();
    if (mins < 1) return 0;
    return Math.max(1, Math.ceil(mins / BOARDING_NIGHT_MINUTES));
  };

  const calculateTotalPrice = () => {
    const opt = selectedServiceOption;
    const unitPrice = Number(opt?.price ?? price ?? 0);

    /** Pet sitting: price uses 30-minute billing slots; list price applies to the sitter’s base duration. */
    if (isPetSitting) {
      const baseMins = getPetSittingPricingBaseMinutes();
      const mins = getBilledMinutes();
      if (mins < 1) return unitPrice;
      const slots = Math.max(1, Math.ceil(mins / PET_SITTING_BILLING_SLOT_MINUTES));
      const pricePerSlot = (unitPrice * PET_SITTING_BILLING_SLOT_MINUTES) / baseMins;
      const proportional = Math.round(slots * pricePerSlot);
      const floor = Math.min(unitPrice, Math.max(49, Math.round(unitPrice * 0.3)));
      return Math.max(proportional, floor);
    }

    const units = getBoardingBilledUnits();
    if (units < 1) return unitPrice;
    return Math.round(units * unitPrice);
  };

  const handleNext = () => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);

    if (step === 'pet') {
      handleCreateBookingForPayment();
      return;
    }

    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleCreateBookingForPayment = async () => {
    if (processing) return;
    
    if (!selectedPet || !checkInDate || !checkOutDate) {
      toast.error('Please complete all required fields');
      return;
    }

    if (isPetSitting) {
      const bm = getBilledMinutes();
      if (bm < 15) {
        toast.error(
          sittingSameDay
            ? 'This visit could not be priced. Pick another check-in date or a different sitting service.'
            : 'Stay must be at least 15 minutes. Adjust check-in and check-out date & time.'
        );
        return;
      }
    } else {
      const bm = getBilledMinutes();
      if (bm < 1) {
        toast.error('Set check-in and check-out date and time to calculate your stay.');
        return;
      }
    }

    if (!customerId) {
      toast.error('Customer ID not found. Please try again.');
      return;
    }

    if (!vendorId) {
      toast.error('Vendor ID is required');
      return;
    }

    setProcessing(true);
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const opt = selectedServiceOption as any;
      /** Bookings FK uses vendor_services.id; API exposes it as `id`. `serviceId` is vs.service_id and is often null. */
      let serviceIdValue =
        opt?.id ||
        opt?.serviceId ||
        selectedVendorService?.id ||
        selectedVendorService?.serviceId ||
        serviceId;

      if (!serviceIdValue || !uuidRegex.test(String(serviceIdValue))) {
        const fromVendor =
          vendorServices.find((vs: any) => {
            const rowId = vs.id;
            return rowId && String(rowId) === String(selectedServiceType);
          }) ||
          vendorServices.find((vs: any) => {
            const sid = vs.serviceId || vs.service_id;
            return sid && String(sid) === String(selectedServiceType);
          }) ||
          vendorServices.find((vs: any) => {
            const id = vs.id || vs.serviceId || vs.service_id;
            return id && uuidRegex.test(String(id));
          });
        const fallback = fromVendor?.id || fromVendor?.serviceId || fromVendor?.service_id;
        if (fallback && uuidRegex.test(String(fallback))) {
          serviceIdValue = fallback;
          toast.info('Using your sitter’s service plan for this booking.');
        } else {
          const noPublished =
            vendorId && vendorServices.length === 0;
          toast.error(
            noPublished
              ? isPetSitting
                ? 'This sitter has no published sitting services to book. Ask them to publish sitting services, or try another sitter.'
                : 'This provider has no published boarding services to book.'
              : isPetSitting
                ? 'Please select a sitting option from your sitter.'
                : 'Service ID is required. Please select a boarding option.'
          );
          setProcessing(false);
          return;
        }
      }

      const totalAmount = calculateTotalPrice();
      
      // Generate idempotency key
      let idempotencyKey = bookingIdempotencyKey;
      if (!idempotencyKey) {
        idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        setBookingIdempotencyKey(idempotencyKey);
      }

      // CreateBookingRequestSchema.serviceType must be an API enum — never a vendor_services.id UUID.
      // After load, selectedServiceType is usually the bookable row id (UUID), not 'overnight' / 'daycare'.
      const selectedVsRow =
        vendorServices.find((vs: any) => String(vs.id) === String(selectedServiceType)) ||
        vendorServices.find((vs: any) => String(vs.serviceId || vs.service_id) === String(selectedServiceType)) ||
        selectedVendorService;
      const vsStyle = String(
        selectedVsRow?.serviceStyle || selectedVsRow?.service_style || ''
      ).toLowerCase();
      const bookingServiceType = isPetSitting
        ? 'at_home'
        : vsStyle === 'tele'
          ? 'tele'
          : vsStyle === 'at_home'
            ? 'at_home'
            : 'at_center';

      const bookingData: any = {
        customerId: customerId,
        vendorId: vendorId,
        serviceId: serviceIdValue,
        bookingDate: checkInDate,
        bookingTime: checkInTime,
        serviceType: bookingServiceType,
        petId: selectedPet?.id,
        customerPhone: phone || undefined,
        notes: notes || undefined,
        idempotencyKey,
        // Boarding-specific fields
        checkInDate,
        checkOutDate,
        checkInTime,
        checkOutTime,
        numberOfNights:
          isPetSitting && sittingSameDay
            ? 0
            : isPetSitting
              ? Math.max(1, Math.ceil(getBilledMinutes() / 1440))
              : getBoardingBilledUnits(),
      };

      if (isPetSitting) {
        bookingData.totalDurationMinutes = getBilledMinutes();
        bookingData.flowVariant = 'pet_sitting';
      } else {
        bookingData.flowVariant = 'boarding';
      }

      if (!usePackageSession && totalAmount > 0) {
        bookingData.amount = totalAmount;
      }

      console.log(isPetSitting ? '📤 Creating pet sitting booking:' : '📤 Creating boarding booking:', bookingData);

      const endpoints = ['/bookings/create', '/booking/create'];
      let response: any;
      let lastError: any = null;

      for (const endpoint of endpoints) {
        try {
          response = await apiClient.post(endpoint, bookingData) as any;
          break;
        } catch (error: any) {
          lastError = error;
          if (error?.statusCode !== 404) throw error;
        }
      }

      if (!response) {
        throw lastError || new Error('Booking creation failed');
      }

      const newBookingId = response.data?.bookingId || response.bookingId || response.booking?.id || 'BK-' + Date.now();
      setPaymentBookingId(newBookingId);
      setBookingIdempotencyKey(null);
      setStep('payment');
    } catch (err: any) {
      console.error('Error creating booking:', err);
      const apiErr = err?.response?.data?.error;
      const errorMessage =
        (typeof apiErr === 'string' ? apiErr : apiErr?.message) ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create booking';
      toast.error(errorMessage);
      setBookingIdempotencyKey(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleBack = () => {
    if (step === 'confirmation') {
      onBack();
      return;
    }
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);

    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    } else {
      onBack();
    }
  };

  const handlePaymentSuccess = (paidBookingId: string) => {
    setBookingId(paidBookingId);
    setStep('confirmation');
    toast.success(isPetSitting ? 'Pet sitting booked successfully!' : 'Boarding booked successfully!');
  };

  const renderStepIndicator = () => {
    const stepLabels = ['Service', 'Dates', 'Pet', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      service: 0, datetime: 1, pet: 2, payment: 3, confirmation: 4
    };
    const currentIdx = currentStepMap[step];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {stepLabels.map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              idx <= currentIdx ? 'bg-[#FF8C42] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {idx < currentIdx ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
            </div>
            {idx < stepLabels.length - 1 && (
              <div className={`w-8 h-0.5 ${idx < currentIdx ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Payment step - use UniversalPaymentPage
  if (step === 'payment' && paymentBookingId) {
    const opt = selectedServiceOption as { id?: string } | undefined;
    const vsId = opt?.id;
    const paymentVendorServiceId =
      vsId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(vsId))
        ? String(vsId)
        : undefined;

    return (
      <UniversalPaymentPage
        type="booking"
        category="boarding"
        serviceStyle={isPetSitting ? 'at_home' : 'at_center'}
        layoutVariant="appShell"
        customerPhone={phone}
        customerId={customerId ?? undefined}
        bookingId={paymentBookingId}
        serviceId={paymentVendorServiceId}
        baseAmount={calculateTotalPrice()}
        priceIncludesTax={catalogPriceIncludesTax(selectedServiceOption)}
        serviceName={selectedServiceOption?.name || (isPetSitting ? 'Pet Sitting' : 'Boarding Service')}
        vendorId={vendorId || ''}
        vendorName={isPetSitting ? 'Pet sitter' : 'Boarding Provider'}
        onBack={handleBack}
        onSuccess={handlePaymentSuccess}
      />
    );
  }

  // Confirmation step
  if (step === 'confirmation' && bookingId) {
    return (
      <BookingConfirmationPage
        bookingId={bookingId}
        type="booking"
        serviceName={selectedServiceOption?.name || (isPetSitting ? 'Pet Sitting' : 'Boarding')}
        vendorName={isPetSitting ? 'Pet sitter' : 'Boarding Provider'}
        serviceStyle={selectedServiceType as 'at_home' | 'at_center' | 'tele'}
        bookingDate={checkInDate}
        bookingTime={checkInTime}
        checkOutDate={checkOutDate}
        checkOutTime={checkOutTime}
        petName={selectedPet?.name || ''}
        totalAmount={calculateTotalPrice()}
        onViewDetails={() => onViewBooking?.(bookingId)}
        onBackToHome={onBack}
        onBack={handleBack}
      />
    );
  }

  const dateSummaryValue =
    !checkInDate
      ? '—'
      : isPetSitting && sittingSameDay
        ? `${checkInDate} · ${checkInTime}–${checkOutTime}`
        : checkInDate && checkOutDate
          ? `${checkInDate} ${checkInTime} → ${checkOutDate} ${checkOutTime}`
          : `${checkInDate} → ${checkOutDate || '—'}`;

  const boardingStats = [
    { value: selectedServiceOption?.name || flowTitle, label: 'Type', icon: (isPetSitting ? <Home className="w-4 h-4" /> : <Building2 className="w-4 h-4" />) },
    { value: dateSummaryValue, label: 'Dates' },
    { value: selectedPet?.name || '—', label: 'Pet', icon: <Dog className="w-4 h-4" /> }
  ];
  const stepLabels = ['Service', 'Dates', 'Pet', 'Payment'];
  const stepIdx = ['service', 'datetime', 'pet', 'payment'].indexOf(step);
  const stepIndicators = stepLabels.map((label, idx) => ({
    label,
    isCompleted: idx < stepIdx,
    isCurrent: idx === stepIdx,
  }));

  return (
    <div className="min-h-[calc(100dvh-6rem-env(safe-area-inset-bottom,0px))] max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom,0px))] bg-gray-50 flex flex-col overflow-hidden">
      <ServiceDashboardHeader
        serviceName={flowTitle}
        serviceSubtitle={selectedServiceOption?.name || (isPetSitting ? 'Select sitting type' : 'Select boarding type')}
        serviceIcon={isPetSitting ? Home : Building2}
        iconColor="text-white"
        stats={boardingStats}
        steps={stepIndicators}
        onBack={handleBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-md mx-auto px-4 py-4">
        {/* Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{isPetSitting ? 'Select sitting type' : 'Select Boarding Type'}</h2>
            {vendorId && loading ? (
              <p className="text-center py-10 text-gray-500">Loading services…</p>
            ) : serviceOptions.length === 0 ? (
              <p className="text-center py-10 text-gray-600 text-sm px-2">
                {vendorId
                  ? isPetSitting
                    ? 'This sitter has no published sitting services to book yet. Ask them to add and publish a sitting service in their dashboard, or try another sitter.'
                    : 'This provider has no published boarding services to book yet.'
                  : isPetSitting
                    ? 'No sitting services to display. Open this flow from a sitter’s profile.'
                    : 'No boarding services to display.'}
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {serviceOptions.map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedServiceType === service.id;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => {
                          setSelectedServiceType(service.id);
                          const raw = vendorServices.find(
                            (vs) => String(vs.id || vs.serviceId) === String(service.id)
                          );
                          if (raw) {
                            setSelectedVendorService({
                              id: raw.id,
                              serviceId: raw.serviceId || raw.service_id,
                              name: raw.serviceName || raw.service_name || raw.name,
                              price: raw.price,
                              duration: raw.duration,
                              serviceStyle: raw.serviceStyle || raw.service_style,
                            });
                          }
                        }}
                        className={`w-full p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? 'border-[#FF8C42] bg-orange-50'
                            : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 rounded-xl flex items-center justify-center ${serviceOptionColorChipClass(
                              service.color
                            )}`}
                          >
                            <Icon className="w-7 h-7" />
                          </div>
                          <div className="flex-1 text-left">
                            <h3 className="font-semibold text-gray-900">{service.name}</h3>
                            <p className="text-sm text-gray-500">{service.desc}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">₹{service.price}</p>
                            <p className="text-xs text-gray-500">{priceSuffix}</p>
                            {isSelected && (
                              <CheckCircle2 className="w-6 h-6 text-orange-500 mt-1 ml-auto" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Button
                  onClick={handleNext}
                  className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] mt-4"
                  disabled={!selectedServiceType}
                >
                  Continue
                </Button>
              </>
            )}
          </div>
        )}

        {/* Date Selection */}
        {step === 'datetime' && (
          <div className="space-y-6">
            {isPetSitting && sittingSameDay ? (
              <>
                <div>
                  <h2 className="mb-3 text-lg font-bold text-gray-900">Visit date</h2>
                  <p className="mb-2 text-xs text-gray-500">
                    Pick the day, then choose start and end time. Price is based on 30-minute blocks; your
                    sitter’s listed rate applies to their base visit length (
                    {getPetSittingPricingBaseMinutes()} minutes).
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dates.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => setCheckInDate(d.date)}
                        className={`w-16 flex-shrink-0 rounded-xl p-3 text-center transition-all ${
                          checkInDate === d.date
                            ? 'bg-[#FF8C42] text-white'
                            : 'border border-gray-200 bg-white hover:border-[#FF8C42]/50'
                        }`}
                      >
                        <p className="text-xs opacity-75">{d.day}</p>
                        <p className="text-xl font-bold">{d.dayNum}</p>
                        <p className="text-xs opacity-75">{d.month}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {checkInDate && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Visit time</h2>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-600">Start time</label>
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allHalfHourSlots.map((slotTime) => {
                          const [h, m] = slotTime.split(':').map(Number);
                          const slotMinutes = h * 60 + m;
                          const istNowMinutes = getCurrentIstMinutes();
                          const isPastIst = isTodayInIst(checkInDate) && slotMinutes < istNowMinutes;
                          const isSelected = checkInTime === slotTime;
                          return (
                            <button
                              key={`start-${slotTime}`}
                              type="button"
                              onClick={() => {
                                if (isPastIst) return;
                                setCheckInTime(slotTime);
                                const startTs = parseLocalDateTime(checkInDate, slotTime);
                                const endTs = parseLocalDateTime(checkOutDate || checkInDate, checkOutTime);
                                if (endTs <= startTs) {
                                  const [slotHour, slotMin] = slotTime.split(':').map(Number);
                                  const nextDate = new Date(2000, 0, 1, slotHour, slotMin + SLOT_INTERVAL_MINUTES);
                                  const nextTime = `${String(nextDate.getHours()).padStart(2, '0')}:${String(
                                    nextDate.getMinutes()
                                  ).padStart(2, '0')}`;
                                  setCheckOutTime(nextTime);
                                }
                              }}
                              disabled={isPastIst}
                              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                                  : isPastIst
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                              }`}
                            >
                              {formatTime12Hour(slotTime)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-600">End time</label>
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allHalfHourSlots.map((slotTime) => {
                          const [h, m] = slotTime.split(':').map(Number);
                          const slotMinutes = h * 60 + m;
                          const [startH, startM] = checkInTime.split(':').map(Number);
                          const startMinutes = (startH || 0) * 60 + (startM || 0);
                          const isInvalid = slotMinutes <= startMinutes;
                          const isSelected = checkOutTime === slotTime;
                          return (
                            <button
                              key={`end-${slotTime}`}
                              type="button"
                              onClick={() => !isInvalid && setCheckOutTime(slotTime)}
                              disabled={isInvalid}
                              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                                  : isInvalid
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                              }`}
                            >
                              {formatTime12Hour(slotTime)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {checkInDate && checkOutDate && getBilledMinutes() >= 15 && (
                  <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Estimated price</p>
                        <p className="text-2xl font-bold text-gray-900">₹{calculateTotalPrice()}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {Math.floor(getBilledMinutes() / 60)}h {getBilledMinutes() % 60}m ·{' '}
                          {Math.ceil(getBilledMinutes() / PET_SITTING_BILLING_SLOT_MINUTES)} ×{' '}
                          {PET_SITTING_BILLING_SLOT_MINUTES}-min blocks
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-[#FF8C42]" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div>
                  <h2 className="mb-3 text-lg font-bold text-gray-900">Check-in date</h2>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dates.map((d) => (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setCheckInDate(d.date);
                          if (
                            !sittingSameDay &&
                            (!checkOutDate || new Date(d.date) >= new Date(checkOutDate))
                          ) {
                            const nextDay = new Date(d.date);
                            nextDay.setDate(nextDay.getDate() + 1);
                            setCheckOutDate(formatLocalDateYYYYMMDD(nextDay));
                          }
                        }}
                        className={`w-16 flex-shrink-0 rounded-xl p-3 text-center transition-all ${
                          checkInDate === d.date
                            ? 'bg-orange-500 text-white'
                            : 'border border-gray-200 bg-white hover:border-orange-300'
                        }`}
                      >
                        <p className="text-xs opacity-75">{d.day}</p>
                        <p className="text-xl font-bold">{d.dayNum}</p>
                        <p className="text-xs opacity-75">{d.month}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {checkInDate && (
                  <div>
                    <h2 className="mb-3 text-lg font-bold text-gray-900">Check-out date</h2>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {dates
                        .filter((d) => new Date(d.date) > new Date(checkInDate))
                        .map((d) => (
                          <button
                            key={d.date}
                            type="button"
                            onClick={() => setCheckOutDate(d.date)}
                            className={`w-16 flex-shrink-0 rounded-xl p-3 text-center transition-all ${
                              checkOutDate === d.date
                                ? 'bg-orange-500 text-white'
                                : 'border border-gray-200 bg-white hover:border-orange-300'
                            }`}
                          >
                            <p className="text-xs opacity-75">{d.day}</p>
                            <p className="text-xl font-bold">{d.dayNum}</p>
                            <p className="text-xs opacity-75">{d.month}</p>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {checkInDate && checkOutDate && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-bold text-gray-900">Check-in & check-out time</h2>
                    {isPetSitting ? (
                      <p className="text-xs text-gray-500">
                        Price follows your visit length in 30-minute blocks. Your sitter’s rate applies to their
                        base duration ({getPetSittingPricingBaseMinutes()} minutes) unless they set a different
                        length on the service.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Price is based on your full stay (check-in to check-out). The package rate is per 24
                        hours; we bill the number of 24-hour units your stay covers (minimum one unit).
                      </p>
                    )}
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-600">Check-in time</label>
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allHalfHourSlots.map((slotTime) => {
                          const [h, m] = slotTime.split(':').map(Number);
                          const slotMinutes = h * 60 + m;
                          const istNowMinutes = getCurrentIstMinutes();
                          const isPastIst = isTodayInIst(checkInDate) && slotMinutes < istNowMinutes;
                          const isSelected = checkInTime === slotTime;
                          return (
                            <button
                              key={`multi-start-${slotTime}`}
                              type="button"
                              onClick={() => !isPastIst && setCheckInTime(slotTime)}
                              disabled={isPastIst}
                              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                                  : isPastIst
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                              }`}
                            >
                              {formatTime12Hour(slotTime)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-gray-600">Check-out time</label>
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allHalfHourSlots.map((slotTime) => {
                          const isSelected = checkOutTime === slotTime;
                          return (
                            <button
                              key={`multi-end-${slotTime}`}
                              type="button"
                              onClick={() => setCheckOutTime(slotTime)}
                              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                              }`}
                            >
                              {formatTime12Hour(slotTime)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {isPetSitting && !sittingSameDay && checkInDate && checkOutDate && getBilledMinutes() >= 15 && (
                  <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Stay length & price</p>
                        <p className="text-lg font-bold text-gray-900">
                          {Math.floor(getBilledMinutes() / 60)}h {getBilledMinutes() % 60}m
                        </p>
                        <p className="text-xs text-gray-600">
                          {Math.max(1, calculateNights())} calendar day(s) · billed vs{' '}
                          {getPetSittingPricingBaseMinutes()} min unit
                        </p>
                        <p className="text-sm font-semibold text-[#FF8C42]">
                          ₹{calculateTotalPrice()} total
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-[#FF8C42]" />
                    </div>
                  </div>
                )}

                {!isPetSitting && checkInDate && checkOutDate && getBilledMinutes() >= 1 && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Stay length & price</p>
                        <p className="text-lg font-bold text-gray-900">
                          {Math.floor(getBilledMinutes() / 60)}h {getBilledMinutes() % 60}m
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          {getBoardingBilledUnits()} × 24h @ ₹{Number(selectedServiceOption?.price ?? price ?? 0)} / 24h · Check-in{' '}
                          {formatTime12Hour(checkInTime)} · Check-out {formatTime12Hour(checkOutTime)}
                        </p>
                        <p className="text-sm font-semibold text-[#FF8C42] mt-1">₹{calculateTotalPrice()} total</p>
                      </div>
                      <Calendar className="h-8 w-8 text-orange-500" />
                    </div>
                  </div>
                )}
              </>
            )}

            <Button
              onClick={handleNext}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={
                !checkInDate ||
                !checkOutDate ||
                (isPetSitting && getBilledMinutes() < 15) ||
                (!isPetSitting && getBilledMinutes() < 1)
              }
            >
              Continue
            </Button>
          </div>
        )}

        {/* Pet Selection */}
        {step === 'pet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Select Your Pet</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <Dog className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                {isPetSitting ? 'A pet profile is required for pet sitting.' : 'A pet profile is required for boarding services.'}
              </p>
            </div>
            
            <div className="space-y-3">
              {pets.length > 0 ? (
                pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                      selectedPet?.id === pet.id 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                      {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog') ? (
                        <Dog className="w-7 h-7 text-orange-600" />
                      ) : pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat') ? (
                        <Cat className="w-7 h-7 text-orange-600" />
                      ) : (
                        <User className="w-7 h-7 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                    </div>
                    {selectedPet?.id === pet.id && (
                      <CheckCircle2 className="w-6 h-6 text-orange-500" />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Dog className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">No pets added yet</p>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
                  >
                    + Add Your First Pet
                  </button>
                </div>
              )}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!selectedPet}
            >
              {selectedPet ? 'Continue to payment' : 'Select a Pet to Continue'}
            </Button>
          </div>
        )}

        {/* Package Modal */}
        {showPackageModal && activePackage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Active Package Found!</h2>
                  <p className="text-sm text-gray-500">You have sessions available</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold mb-2">{activePackage.packageName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sessions Remaining</span>
                    <span className="font-medium text-green-600">
                      {activePackage.isUnlimited ? 'Unlimited' : `${activePackage.remainingSessions} of ${activePackage.totalSessions}`}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleUsePackageSession}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Use Package Session (Free)
                </Button>
                <Button 
                  onClick={handleBookNew}
                  variant="outline"
                  className="w-full"
                >
                  Book New (Pay ₹{calculateTotalPrice()})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Pet Modal - Enhanced with Photo & Vaccinations */}
        <EnhancedAddPetModal
          phone={phone}
          isOpen={showAddPetModal}
          onClose={() => setShowAddPetModal(false)}
          onSuccess={() => {
            refreshPets();
            setShowAddPetModal(false);
          }}
        />
        </div>
      </div>
    </div>
  );
}

// Inline Add Pet Modal Component
function AddPetModalInline({ phone, onClose, onSuccess }: { phone: string; onClose: () => void; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  
  const [petData, setPetData] = useState({
    id: `pet_${Date.now()}`,
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    color: '',
    photo: '',
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setPetData({ ...petData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePet = async () => {
    if (!petData.name || !petData.type || !petData.breed || !petData.age) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      const getPetsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      let existingPets = [];
      if (Array.isArray(getPetsData.pets)) {
        existingPets = getPetsData.pets;
      }
      
      const updatedPets = [...existingPets, petData];
      
      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets
      });
      
      toast.success(`${petData.name} added successfully!`);
      onSuccess();
    } catch (error) {
      console.error('Error saving pet:', error);
      toast.error('Failed to save pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-white" />
              <h3 className="text-lg font-bold text-white">Add New Pet</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 border-4 border-white shadow-lg"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-8 h-8 text-orange-500" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <p className="text-xs text-gray-500 mt-1">Upload photo (Optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.name}
              onChange={(e) => setPetData({ ...petData, name: e.target.value })}
              placeholder="e.g., Oreo, Max, Bella"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {['Dog', 'Cat', 'Other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPetData({ ...petData, type })}
                  className={`py-2.5 px-3 border-2 rounded-xl transition font-medium text-sm ${
                    petData.type === type ? 'border-[#FF8C42] bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {type === 'Dog' ? <Dog className="w-4 h-4" /> : type === 'Cat' ? <Cat className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    {type}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breed <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.breed}
              onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
              placeholder="e.g., Golden Retriever"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age (years) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={petData.age}
                onChange={(e) => setPetData({ ...petData, age: e.target.value })}
                placeholder="e.g., 3"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={petData.gender}
                onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePet}
              disabled={loading}
              className="flex-1 py-3 bg-[#FF8C42] hover:bg-[#FF7A35] rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Pet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
