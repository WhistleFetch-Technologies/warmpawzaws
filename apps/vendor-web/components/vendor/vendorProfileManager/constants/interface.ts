export interface TimeSlot {
    start: string;
    end: string;
}

export interface DayAvailability {
    enabled: boolean;
    slots: TimeSlot[];
}

export interface AvailabilitySchedule {
    monday?: DayAvailability;
    tuesday?: DayAvailability;
    wednesday?: DayAvailability;
    thursday?: DayAvailability;
    friday?: DayAvailability;
    saturday?: DayAvailability;
    sunday?: DayAvailability;
}

export interface ProfessionalProfile {
    id: string;
    owner_name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    photo_url?: string;
    qualifications?: string;
    specializations: string[]; // Changed to array for multi-select
    experience_years?: number;
    service_area?: string;
    operating_hours?: string;
    availability?: AvailabilitySchedule; // Enhanced scheduling
    role_name?: string;
    /** Default home-visit radius (km) on vendor row; also fallback when saving availability slots */
    service_radius?: number | null;
    /** When true, vendor can appear in customer “instant tele” lists (requires tele service + identity join, etc.) */
    available_for_instant_tele?: boolean;
}

export interface ProfessionalProfileManagerProps {
    vendorId: string;
    profile: any; // Initial profile data from parent
    onBack?: () => void;
}


export interface ProfileManagerProps {
    vendorId: string;
    vendorData?: any;
    onBack: () => void;
    /** When set (e.g. from VendorLandingPage), "Get started" opens gallery; otherwise `/profile` uses home + session flag. */
    onNavigateToGallery?: () => void;
}

// Alias for backward compatibility
export type CenterProfileManagerProps = ProfileManagerProps;

export interface CenterProfile {
    // Basic Info
    centerName: string;
    description: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    latitude?: number;
    longitude?: number;

    // Operating Hours - Day by Day
    operatingHours: {
        [key: string]: {
            isOpen: boolean;
            open: string;
            close: string;
        };
    };

    // Amenities
    amenities: string[];
    customAmenities: string[];

    // Specializations (Problem Grid)
    specializations: string[];

    // Photos
    photos: string[];

    // Emergency Services
    emergencyServices: {
        ambulance: boolean;
        ambulanceAvailable247: boolean;
        consultationAvailable247: boolean;
        diagnosticsAvailable247: boolean;
    };
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
