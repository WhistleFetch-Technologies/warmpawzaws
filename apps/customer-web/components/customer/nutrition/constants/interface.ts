export interface NutritionistBookingRouterProps {
    phone: string;
    vendorId?: string;
    nutritionist?: any;
    selectedService?: string;
    serviceType?: string;
    serviceId?: string;
    serviceName?: string;
    serviceStyle?: string;
    price?: number;
    duration?: number;
    appointmentsMode?: boolean;
    onBack: () => void;
    onNavigate: (screen: string, data?: any) => void;
    onViewBooking?: (bookingId: string) => void;
    onInternalBackReady?: (handleBack: () => void) => void;
}

export type BookingStep = 'service' | 'datetime' | 'pet' | 'address' | 'payment' | 'confirmation';

export interface TimeSlot {
    time: string;
    available: boolean;
}

export interface Pet {
    id: string;
    name: string;
    species: string;
    breed: string;
}


export interface Vendor {
    id: string;
    vendorId: string;
    providerId: string;
    name: string;
    businessName?: string;
    rating?: number;
    reviewCount?: number;
    address?: string;
    city?: string;
    distance?: number;
    distanceText?: string;
    photoUrl?: string;
    priceMin?: number;
    priceMax?: number;
    nextAvailable: {
        date: string,
        time: string,
        display: string
    }
}


export interface DietConsultationVendorsProps {
    phone: string;
    onBack: () => void;
    onNavigate?: (screen: string, data?: any) => void;
}



export interface NutritionistServicesLandingProps {
    phone: string;
    onBack: () => void;
    onNavigate?: (screen: string, data?: any) => void;
}


