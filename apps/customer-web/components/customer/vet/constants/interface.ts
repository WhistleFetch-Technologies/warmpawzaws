export interface Provider {
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

export interface PlatformService {
    id: string;
    serviceId: string;
    name: string;
    description?: string;
    price: number;
    duration: number;
}

export interface Pet {
    id: string;
    name: string;
    type: string;
    breed?: string;
    photo?: string;
}

export interface TeleConsultationRouterProps {
    phone: string;
    onBack: () => void;
    onNavigate: (screen: string, data?: any) => void;
}

export type FlowStep =
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



export interface AvailableNowVendor {
    vendorId: string;
    vendorName: string;
    photo?: string;
    phone?: string;
    city?: string;
    address?: string;
}

export interface InstantVendorListProps {
    vendors: AvailableNowVendor[];
    loading: boolean;
    onSelectVendor: (v: AvailableNowVendor) => void;
    onBack: () => void;
}


export interface ModeSelectionProps {
    onSelectScheduled: () => void;
    onSelectInstant: () => void;
    onBack: () => void;
}


export interface InstantServiceSelectionProps {
    phone: string;
    services: PlatformService[];
    loading: boolean;
    onSelectService: (service: PlatformService) => void;
    onBack: () => void;
}


export interface InstantPetSelectionProps {
    phone: string;
    selectedService: PlatformService;
    pets: Pet[];
    loading: boolean;
    onSelectPet: (pet: Pet) => void;
    onAddPet: () => void;
    onBack: () => void;
}


export interface CallingVendorScreenProps {
    bookingId: string;
    vendorName: string;
    serviceName: string;
    servicePrice: number;
    onVendorAccepted: (bookingId: string, totalAmount: number) => void;
    onVendorRejected: () => void;
    onTimeout: () => void;
    onCancel: () => void;
}