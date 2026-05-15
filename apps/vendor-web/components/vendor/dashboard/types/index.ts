export interface VendorDashboardProps {
    vendorId: string;
    vendorData?: any;
    onNavigateToConsultation?: () => void;
    onNavigateToServiceManagement?: () => void;
    onNavigateToBookingManagement?: () => void;
    onNavigateToTeleConsultation?: () => void;
    onNavigateToScheduleManagement?: () => void; // ⚠️ DEPRECATED: Use onNavigateToAdvancedAvailability instead
    onNavigateToAdvancedAvailability?: () => void; // ✅ STANDARD: Navigate to Advanced Availability Manager
    onNavigateToProfile?: () => void; // ✅ RENAMED: Navigate to Profile Manager (works for both center and solo)
    onNavigateToFacilityManagement?: () => void;
    onNavigateToBusinessHub?: () => void;
    onNavigateToLiveTracking?: () => void;
    onNavigateToSpecializedServices?: () => void; // ✅ NEW: Navigate to Vet Specialized Services (Pharmacy, Diagnostics, Ambulance)
    // ✅ NEW: Additional navigation handlers for all capabilities
    onNavigateToGallery?: () => void;
    onNavigateToPortfolio?: () => void;
    onNavigateToCCTV?: () => void;
    onNavigateToControlledSubstances?: () => void;
    onNavigateToPrescription?: () => void;
    onNavigateToPrescriptionList?: () => void; // ✅ NEW: Navigate to prescription list
    onNavigateToDiagnostics?: () => void; // ✅ NEW: Navigate to diagnostic management
    onNavigateToPricing?: () => void; // ✅ NEW: Navigate to service pricing
    onNavigateToProgressTracking?: () => void;
    onNavigateToPackages?: () => void;
    onNavigateToCustomServices?: () => void;
    onNavigateToAdoptionSystem?: () => void;
    onNavigateToMemorialServices?: () => void;
    onNavigateToExpiryManagement?: () => void;
    onNavigateToDonationManagement?: () => void;
    onNavigateToEventManagement?: () => void;
    onNavigateToPatientMonitoring?: () => void;
    onNavigateToCafeMenuManagement?: () => void;
    onNavigateToCafeTables?: () => void; // ✅ NEW: Navigate to Cafe Table Management
    // ✅ NEW: Additional capability navigation handlers (Phase 2)
    onNavigateToPrescriptionVerification?: () => void;
    onNavigateToDeliveryManagement?: () => void;
    onNavigateToDietCharts?: () => void;
    onNavigateToCounseling?: () => void;
    onNavigateToDistancePricing?: () => void;
    onNavigateToMultiDoctorManagement?: () => void;
    onNavigateToPolicyManagement?: () => void;
    onNavigateToSupport?: () => void; // ✅ NEW: Navigate to Support Tickets
    onNavigateToMedicalRecords?: () => void; // ✅ Added for compatibility
    onNavigateToDashboard?: () => void; // ✅ Added for dashboard navigation from LandingPage
    onNavigateToServicePromotions?: () => void; // ✅ NEW: Navigate to Service Promotions Management
}

export interface Dashboardstats {
    appointments: number;
    consultations: number;
    earnings: number;
    pendingEarnings: number;
    completedServices: number;
    /** Average from approved reviews only; null when there is no aggregate (e.g. zero reviews). */
    rating: number | null;
    totalReviews: number;
    activeOrders?: number;
}

export interface ScheduleItem {
    id: string;
    bookingId: string;
    time: string;
    duration: number;
    petName: string;
    petBreed?: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    serviceType: string;
    status: string;
    price: number;
    address: string;
    specialInstructions?: string;
    prescriptionUrl?: string;
    prescriptionNotes?: string;
    hasPrescription?: boolean;
    hasUnreadMessages?: boolean;
    unreadMessageCount?: number;
    chatEnabled?: boolean;
    isFollowUp?: boolean;
    isRescheduled?: boolean; // Indicates if booking was rescheduled from original time/date
    rescheduledAt?: string | null; // Timestamp when booking was rescheduled
    /** Package session tracking (from enriched vendor bookings API) */
    packagePurchaseId?: string;
    packageSessionNumber?: number;
    packageTotalSessions?: number;
    /** True when this booking row is a scheduled package session (not the purchase-level parent placeholder). */
    isPackageSession?: boolean;
}

export interface WatchlistItem {
    watchlistId: string;
    petName: string;
    customerName: string;
    issue: string;
    lastUpdated: string;
}

export interface NotificationItem {
    notificationId: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
}
export interface DashboardWarnings {
    profileIncomplete: boolean;
    bankNotVerified: boolean;
    servicesNotConfigured: boolean;
    reasonProfileIncomplete?: string;
}


export interface VendorDashboardScreenProps {
    vendorId: string;
    vendorData: any;
    onNavigate: (screen: string, data?: any) => void;
  }
  
 export interface SoloProviderDashboardProps {
    session: {
      vendorId: string;
      centerId: string;
      staffId: string;
      isSoloProvider: boolean;
      ownerName: string;
      businessName?: string;
      roleName: string;
      defaultMode?: 'CENTER' | 'STAFF';
    };
    vendorData: any;
  }
