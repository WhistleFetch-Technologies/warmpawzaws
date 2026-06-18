/**
 * Persists multi-step booking wizard state across shell screen transitions (e.g. payment).
 * Consumed once on return so remounted routers restore step + form context.
 */

const TELE_WIZARD_KEY = 'warmpawz_tele_wizard_snapshot';
const HOME_VISIT_WIZARD_KEY = 'warmpawz_home_visit_wizard_snapshot';

export type TeleWizardSnapshot = {
  step: string;
  selectedProvider: Record<string, unknown> | null;
  showBookingForm?: boolean;
  selectedDate?: string;
  selectedTime?: string;
  selectedPetId?: string;
  /** Service row ids from UniversalProviderProfile — restored after payment back */
  selectedServiceIds?: string[];
  /** Home visit address id */
  selectedAddressId?: string;
  selectedInstantVendorId?: string;
  selectedServiceId?: string;
  selectedPet?: Record<string, unknown> | null;
};

export type HomeVisitWizardSnapshot = {
  step: string;
  selectedProvider: Record<string, unknown> | null;
  showBookingForm?: boolean;
  selectedDate?: string;
  selectedTime?: string;
  selectedPetId?: string;
  selectedServiceIds?: string[];
  selectedAddressId?: string;
};

/** Fields to persist when leaving provider profile for shell payment */
export function bookingFormFieldsFromProceed(bookingData: {
  bookingDate?: string;
  bookingTime?: string;
  petId?: string;
  serviceId?: string;
  services?: Array<{ id?: string; serviceId?: string; service_id?: string }>;
  address?: { id?: string };
}): Pick<
  TeleWizardSnapshot,
  'selectedDate' | 'selectedTime' | 'selectedPetId' | 'selectedServiceIds' | 'selectedAddressId'
> {
  const services = bookingData?.services;
  let selectedServiceIds: string[] = [];
  if (Array.isArray(services) && services.length > 0) {
    selectedServiceIds = services
      .map((s) => String(s.id || s.serviceId || s.service_id || ''))
      .filter(Boolean);
  } else if (bookingData?.serviceId) {
    selectedServiceIds = [String(bookingData.serviceId)];
  }
  const addressId = bookingData?.address?.id;
  return {
    selectedDate: bookingData?.bookingDate,
    selectedTime: bookingData?.bookingTime,
    selectedPetId: bookingData?.petId,
    selectedServiceIds,
    selectedAddressId: addressId ? String(addressId) : undefined,
  };
}

function writeSnapshot(key: string, snapshot: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // quota / private mode
  }
}

function readSnapshot<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function removeSnapshot(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function saveTeleWizardSnapshot(snapshot: TeleWizardSnapshot): void {
  writeSnapshot(TELE_WIZARD_KEY, snapshot);
}

/** Read and clear — call once when remounting TeleConsultationRouter after payment back. */
export function consumeTeleWizardSnapshot(): TeleWizardSnapshot | null {
  const snap = readSnapshot<TeleWizardSnapshot>(TELE_WIZARD_KEY);
  removeSnapshot(TELE_WIZARD_KEY);
  return snap;
}

export function clearTeleWizardSnapshot(): void {
  removeSnapshot(TELE_WIZARD_KEY);
}

export function saveHomeVisitWizardSnapshot(snapshot: HomeVisitWizardSnapshot): void {
  writeSnapshot(HOME_VISIT_WIZARD_KEY, snapshot);
}

export function consumeHomeVisitWizardSnapshot(): HomeVisitWizardSnapshot | null {
  const snap = readSnapshot<HomeVisitWizardSnapshot>(HOME_VISIT_WIZARD_KEY);
  removeSnapshot(HOME_VISIT_WIZARD_KEY);
  return snap;
}

export function clearHomeVisitWizardSnapshot(): void {
  removeSnapshot(HOME_VISIT_WIZARD_KEY);
}
