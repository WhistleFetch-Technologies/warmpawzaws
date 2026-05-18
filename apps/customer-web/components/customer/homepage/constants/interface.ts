export interface Pet {
    id: string;
    name: string;
    type: string;
    breed: string;
    age: number | string;
    weight?: number | string;
    lastCheckup?: string;
    mood?: string;
    image?: string;
    color?: string;
    photo?: string;
}

export interface UserData {
    name: string;
    phone: string;
    pets: Pet[];
    journeyType?: string;
}

export interface CustomerHomeCompleteProps {
    phone: string;
    refreshKey?: number;
    onRefresh?: () => void;
    onNavigate?: (screen: string, data?: any) => void;
    onProfileClick?: () => void;
    onSidebarOpen?: () => void;
    onPetClick?: (petId: string) => void;
    onAddPet?: () => void;
    onViewBooking?: (bookingId: string, petId?: string) => void;
    onOpenMenu?: () => void;
    onOpenCategoryMapper?: () => void;
    hideHeaderFooter?: boolean; // ✅ NEW: Option to hide header/footer when using standardized layout
    /** When true (e.g. account sidebar open), skip home polling and heavy background fetches. */
    backgroundTasksPaused?: boolean;
}


export interface ActiveVideoCall {
    sessionId: string;
    bookingId: string;
    vendorName: string;
    serviceName: string;
    petName?: string;
}

export interface TeleTrackerProps {
    hasActiveCall: boolean;
    activeVideoCalls: ActiveVideoCall[];
    joinCall: (call: ActiveVideoCall) => void;
}
