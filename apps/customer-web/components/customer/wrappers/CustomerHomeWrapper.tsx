'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CustomerHomeComplete as CustomerHome } from '../homepage/CustomerHomeComplete';
import { UserAccountSidebar } from '../UserAccountSidebar';
import { CustomerPetDetails } from '../CustomerPetDetails';
import { CustomerPetProfile } from '../CustomerPetProfile';
import { WalkerService } from '../WalkerService';
import { WalkerDashboard } from '../walker/WalkerDashboard';
import { WalkerBookingRouter } from '../walker/WalkerBookingRouter';
import { WalkLiveTrackingView } from '../walker/WalkLiveTrackingView';
import { CustomerSidebar } from '../CustomerSidebar';
import { PetBookingDetails } from '../PetBookingDetails';
import { PetQuickView } from '../PetQuickView';
import { AddPetModal } from '../AddPetModal';
import { NotAvailable } from '../NotAvailable';
import { VetServiceRouter } from '../VetServiceRouter';
import { VetBookingFlow } from '../vet/VetBookingFlow';
import { VetBookingRouter } from '../vet/VetBookingRouter';
import { VetDoctorDetails } from '../vet/VetDoctorDetails';
import { ClinicListView } from '../vet/ClinicListView';
import { ClinicProfileView } from '../vet/ClinicProfileView';
import { VetServicesByStyle } from '../vet/VetServicesByStyle';
import { TeleConsultationRouter } from '../vet/TeleConsultationRouter';
import { HomeVisitRouter } from '../vet/HomeVisitRouter';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { GroomingServiceRouter } from '../GroomingServiceRouter';
import { GroomingServicesByStyle } from '../grooming/GroomingServicesByStyle';
import { TrainingServiceRouter } from '../TrainingServiceRouter';
import { TrainingBookingRouter } from '../training/TrainingBookingRouter';
import { GroomingBookingRouter } from '../grooming/GroomingBookingRouter';
import { UniversalServicesByStyle } from '../shared/UniversalServicesByStyle';
import { BoardingServiceRouter } from '../BoardingServiceRouter';
import { BoardingBookingRouter } from '../boarding/BoardingBookingRouter';
import { BoardingVendorListView } from '../boarding/BoardingVendorListView';
import { BoardingVendorProfileView } from '../boarding/BoardingVendorProfileView';
import { normalizeBoardingServiceSlug } from '@/lib/boarding-service-types';
import { PetSitterServiceRouter } from '../PetSitterServiceRouter';
import { AdoptionServiceRouter } from '../AdoptionServiceRouter';
import { SunsetServiceRouter } from '../SunsetServiceRouter';
import { CustomerProfile } from '../CustomerProfile';
import { PetProfile } from '../PetProfile';
import { PetProfileDashboard } from '../PetProfileDashboard';
import { InsuranceServicesLanding } from '../InsuranceServicesLanding';
import { PetCafeServicesLanding } from '../PetCafeServicesLanding';
import { PharmacyServicesLanding } from '../PharmacyServicesLanding';
import { PharmacyStore } from '../PharmacyStore';
import { PharmacyCheckout } from '../PharmacyCheckout';
import { PhotographyServicesLanding } from '../PhotographyServicesLanding';
import { BreederServicesLanding } from '../BreederServicesLanding';
import { AmbulanceServicesLanding } from '../AmbulanceServicesLanding';
import { RelocationServicesLanding } from '../RelocationServicesLanding';
import { ResortServicesLanding } from '../ResortServicesLanding';
import { PetHolidayServicesLanding } from '../PetHolidayServicesLanding';
import { ShopDashboard } from '../ShopDashboard';
import { ProductDetailPage } from '../ProductDetailPage';
import { ShoppingCartView } from '../ShoppingCartView';
import { CheckoutView } from '../CheckoutView';
import { OrderSuccessView } from '../OrderSuccessView';
import { OrderHistoryPage } from '../../shop/OrderHistoryPage';
import { AddressBookPage } from '../../shop/AddressBookPage';
import { WalletPage } from '../../shop/WalletPage';
import { OrderDetailView } from '../OrderDetailView';
import { ProductReviewsView } from '../ProductReviewsView';
import { VendorProfileDetail } from '../VendorProfileDetail';
import { SupportHelpCenter } from '../SupportHelpCenter';
import { OrderTrackingView } from '../OrderTrackingView';
import { ProblemCategoryMapper } from '../../admin/ProblemCategoryMapper';
import { apiClient } from '@/lib/api-client';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { readProfileCompleted, readOnboardingCompleted } from '@/lib/customer-flow-guards';
import {
  WARMPAWZ_HOME_RESUME_SCREENS,
  WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY,
  rememberPromotionsBackSpaScreen,
} from '@/lib/go-back-or-replace';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import { useNotificationService } from '../useNotificationService';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import { MyBookings } from '../booking/MyBookings';
import { AppointmentsList } from '../AppointmentsList';
import { AppointmentDetailsView } from '../AppointmentDetailsView';
import { RescheduleAppointmentView } from '../RescheduleAppointmentView';
// import { WalletView } from './WalletView';

// ✅ NEW IMPORTS FOR GAP FIXES
import { PetCafeListingZomatoStyle } from '../PetCafeListingZomatoStyle';
import { ResortBoardingBookingEnhanced } from '../ResortBoardingBookingEnhanced';
import { CafeReservationFlow } from '../CafeReservationFlow';
import { BreederCatalogView } from '../BreederCatalogView';
import { AmbulanceSOS } from '../AmbulanceSOS';
import { AmbulanceSubServiceFlow } from '../AmbulanceSubServiceFlow';
import { AdoptionQuestionnaire } from '../AdoptionQuestionnaire';
import { CustomerServicesPage } from '../CustomerServicesPage';
import { CustomerBookingsPage } from '../CustomerBookingsPage';
import { CreateBookingPage } from '../booking/CreateBookingPage';
import { CustomerPetsPage } from '../CustomerPetsPage';
import { OrderTrackingPage } from '../../shop/OrderTrackingPage';

// ✅ P2 CUSTOMER APP ENHANCEMENTS - Recently Developed UI Components
import { MultiPetBookingPage } from '../MultiPetBookingPage';
import { ReturnRequestPage } from '../ReturnRequestPage';
import { RewardsLoyaltyPage } from '../RewardsLoyaltyPage';
import { ReferralSystemPage } from '../ReferralSystemPage';
import { PackageBookingPage } from '../PackageBookingPage';
import { EmergencyBookingPage } from '../EmergencyBookingPage';
import { CheckInCheckOutPage } from '../CheckInCheckOutPage';
import { MedicalRecordsPage } from '../MedicalRecordsPage';
import { WalletPage as CustomerWalletPage } from '../WalletPage';

// ✅ MATING & DATING SERVICE - P2P Matchmaking
import { MatingDatingHub } from '../MatingDatingHub';
import { HomeServiceSelectionEnhanced } from '../HomeServiceSelectionEnhanced';
import { IntegratedServicesHub } from '../../IntegratedServicesHub';
import { ProblemGridSelector } from '../ProblemGridSelector';
import { ServicesByProblem } from '../ServicesByProblem';
import { ProblemGridFlowRouter } from '../ProblemGridFlowRouter';
import { MealPlansList } from '../nutrition/MealPlansList';
import { MealOrderCheckout } from '../nutrition/MealOrderCheckout';
import { NutritionistTeleRouter } from '../nutrition/NutritionistTeleRouter';
import { NutritionistBookingRouter } from '../nutrition/NutritionistBookingRouter';
import { DietConsultationVendors } from '../nutrition/DietConsultationVendors';
import { OrderTrackingScreen } from '../tracking/OrderTrackingScreen';
import { DiagnosticsServicesLanding } from '../DiagnosticsServicesLanding';
import { DiagnosticsReportViewer, SampleCollectionTracker } from '../diagnostics';
import { DiagnosticsBookingFlow } from '../specialized/DiagnosticsBookingFlow';
import { PharmacyOrderFlow } from '../specialized/PharmacyOrderFlow';
import { PharmacyOrderStatus } from '../pharmacy/PharmacyOrderStatus';
import { CustomerScreenWrapper } from '../CustomerScreenWrapper';
import { StandardizedHeader } from '../shared/StandardizedHeader'; // ✅ FIX: Import for consistent UI
import { TrackingPageClient } from '@/app/tracking/[bookingId]/TrackingPageClient'; // ✅ GPS Live Tracking
import dynamic from 'next/dynamic';
import { NutritionistServicesLanding } from '../nutrition/NutritionistServicesLanding';

// ✅ Dynamically import video call component to avoid SSR issues with Chime SDK
// Use default import since ChimeVideoCall is exported as default
const ChimeVideoCall = dynamic(
  () => import('../../teleCommunication/ChimeVideoCall'),
  { 
    ssr: false, 
    loading: () => <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div> 
  }
);

type ScreenType = 
  | 'home' 
  | 'user-profile' 
  | 'customer-profile'
  | 'pet-profile'
  | 'pet-profile-dashboard'
  | 'pet-quick' 
  | 'pet-details' 
  | 'add-pet' 
  | 'walker' 
  | 'walker-booking' 
  | 'vet'
  | 'category-mapper'
  | 'vet-booking'
  | 'vet-doctor-details'
  | 'vet-clinic-list'
  | 'vet-clinic-profile'
  | 'vet-clinic-booking'
  | 'vet-services-by-style'
  | 'vet-tele-consultation'
  | 'vet-home-visit'
  | 'grooming'
  | 'training'
  | 'training_center'
  | 'training_home'
  | 'boarding'
  | 'boarding_facility'
  | 'pet-boarding-vendors'
  | 'pet-boarding-profile'
  | 'pet-sitter'
  | 'pet-sitter-facility'
  | 'pet-sitter-booking'
  | 'adoption'
  | 'sunset'
  | 'insurance'
  | 'insurance_provider'
  | 'cafes'
  | 'cafe_detail'
  | 'cafe_reservation'
  | 'shop'
  | 'product_detail'
  | 'cart'
  | 'checkout'
  | 'order_success'
  | 'order_history'
  | 'order_detail'
  | 'order_tracking'
  | 'pharmacy_store'
  | 'pharmacy_checkout'
  | 'photography'
  | 'breeder'
  | 'breeder_catalog'
  | 'ambulance'
  | 'ambulance_sos'
  | 'ambulance_schedule'
  | 'ambulance_transfer'
  | 'nutritionist'
  | 'relocation'
  | 'resort'
  | 'resort_booking'
  | 'holiday'
  | 'food'
  | 'booking-details'
  | 'my-bookings'
  | 'appointments'
  | 'appointment-details'
  | 'appointment-reschedule'
  | 'wallet'
  | 'address_book'
  | 'add-address'
  | 'profile'
  | 'purchase-package'
  | 'coming-soon'
  | 'adoption_questionnaire'
  | 'services'
  | 'bookings'
  | 'create-booking'
  | 'pets'
  | 'multi-pet-booking'
  | 'return-request'
  | 'rewards-loyalty'
  | 'referral-system'
  | 'package-booking'
  | 'emergency-booking'
  | 'check-in-out'
  | 'medical-records'
  | 'customer-wallet'
  | 'mating-dating-hub'
  | 'integrated-services'
  | 'home-service-selection'
  | 'product_reviews'
  | 'vendor_profile'
  | 'support_help'
  | 'problem_grid'
  | 'problem_selected'
  | 'services_by_problem'
  | 'problem_grid_flow'
  | 'grooming_center'
  | 'grooming_home'
  | 'grooming-booking'
  | 'training-booking'
  | 'boarding-booking'
  | 'walk-live-tracking'
  | 'schedule-walk'
  | 'gps-tracking'
  | 'video-call'
  | 'payment'
  | 'pharmacy'
  | 'lab-diagnostics'
  | 'diagnostics-booking'
  | 'diagnostics-reports'
  | 'sample-collection-tracking'
  | 'nutrition-meal-plans'
  | 'meal-order-checkout'
  | 'meal-order-tracking'
  | 'nutritionist-tele'
  | 'nutritionist-booking'
  | 'diet-consultation-services'
  | 'pharmacy_order_flow'
  | 'pharmacy_order_status'
  | 'behaviorist'
  | 'instant-connecting';

export function CustomerHomeWrapper({
  phone,
  onNavigate,
  initialScreen,
  petBoardingVendorId,
  petBoardingServiceSlug,
}: {
  phone: string;
  onNavigate: (screen: string) => void;
  initialScreen?: ScreenType;
  petBoardingVendorId?: string;
  petBoardingServiceSlug?: string;
}) {
  /**
   * Entering shop from these screens must not overwrite the stored return target (nested browse/checkout).
   * Note: `cart` is intentionally excluded so Cart → Shop (e.g. Continue shopping) restores Cart on back.
   */
  const SHOP_SUBFLOW_SCREENS = new Set<ScreenType>([
    'shop',
    'product_detail',
    'product_reviews',
    'vendor_profile',
    'checkout',
    'pharmacy_store',
    'pharmacy_checkout',
  ]);

  console.log('CustomerHomeWrapper: Rendering with phone:', phone);
  const router = useRouter();
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname !== '/') return;
    if (searchParams.get('service')) return;
    if (!readProfileCompleted()) {
      router.replace('/profile');
      return;
    }
    if (!readOnboardingCompleted()) {
      router.replace('/onboarding');
    }
  }, [pathname, searchParams, router]);

  const [currentScreen, setCurrentScreen] = useState<ScreenType>(initialScreen || 'home');
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<{
    id: string;
    title: string;
    roleId?: string;
    allowedServiceStyles?: string[];
    category?: string;
  } | null>(null);
  const [currentServiceType, setCurrentServiceType] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedService, setSelectedService] = useState<string>('');
  const [vetServiceData, setVetServiceData] = useState<any>(null);
  const [walkerServiceData, setWalkerServiceData] = useState<any>(null);
  const [selectedPetData, setSelectedPetData] = useState<any>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [selectedShopCategory, setSelectedShopCategory] = useState<string | undefined>(undefined);
  /** Screen to restore when leaving Shop via header back (SPA stack is not browser history). */
  const [shopReturnScreen, setShopReturnScreen] = useState<ScreenType | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined); // For generic bookings
  const [diagnosticsPackageHint, setDiagnosticsPackageHint] = useState<{ name?: string; testLabels?: string[] } | null>(null);
  const [previousScreen, setPreviousScreen] = useState<ScreenType | null>(null); // Track previous screen for navigation back
  /** Screen to return to when leaving My Pets (embedded list), if opened via navigateToPets */
  const [screenBeforePets, setScreenBeforePets] = useState<ScreenType | null>(null);
  const [selectedAddressFromBook, setSelectedAddressFromBook] = useState<any>(null); // Address selected in address book (return to provider profile)
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(null); // ✅ GPS Tracking booking ID
  const [videoCallData, setVideoCallData] = useState<{ bookingId: string; meetingId?: string } | null>(null); // ✅ Video call data
  const [instantConnectingBookingId, setInstantConnectingBookingId] = useState<string | null>(null); // Instant tele: after payment, show connecting then video
  /** `?service=tele` / Book Now: skip TeleConsultationRouter mode selection → instant vet list */
  const [teleSkipModeSelection, setTeleSkipModeSelection] = useState(false);
  const [prescriptionOrderData, setPrescriptionOrderData] = useState<{ prescriptionId?: string; prescriptionUrl?: string } | null>(null); // ✅ Pharmacy order from My Bookings prescription
  const [currentPharmacyOrderId, setCurrentPharmacyOrderId] = useState<string | null>(null); // ✅ After PharmacyOrderFlow completes
  const { addToCart } = useCart();
  
  // ✅ FIX: User profile state for consistent header display
  const [userName, setUserName] = useState<string>('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<any | null>(null);

  /** After `/shop` or `/promotions` back: restore embedded screen (same URL `/` as home). */
  useEffect(() => {
    if (pathname !== '/' || typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY);
    if (!raw) return;
    sessionStorage.removeItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY);
    if (WARMPAWZ_HOME_RESUME_SCREENS.has(raw)) {
      const next = raw as ScreenType;
      if (next === 'shop') {
        setShopReturnScreen('home');
      }
      setCurrentScreen(next);
    }
  }, [pathname]);

  // ✅ FIX: Listen for orderMedicineFromPrescription event (fallback when onOrderMedicine not passed)
  useEffect(() => {
    const handleOrderMedicineFromPrescription = (e: CustomEvent<{ prescriptionId: string; bookingId?: string; medications?: any[]; fileUrl?: string }>) => {
      const detail = e.detail;
      if (detail?.prescriptionId) {
        setPrescriptionOrderData({
          prescriptionId: detail.prescriptionId,
          prescriptionUrl: detail.fileUrl,
        });
        setCurrentScreen('pharmacy_order_flow');
        setPreviousScreen('my-bookings');
        toast.success('Opening pharmacy order...');
      }
    };
    window.addEventListener('orderMedicineFromPrescription', handleOrderMedicineFromPrescription as EventListener);
    return () => window.removeEventListener('orderMedicineFromPrescription', handleOrderMedicineFromPrescription as EventListener);
  }, []);

  // ✅ FIX: Load user profile for header display
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        if (profileResponse?.profile || profileResponse) {
          const profile = profileResponse.profile || profileResponse;
          setUserName(profile.name || profile.fullName || profile.full_name || 'User');
          setUserProfilePhoto(
            profile.profilePhoto ||
              profile.profile_photo_url ||
              profile.profile_image_url ||
              profile.photo
          );
        }
        
        // Also load pets for header pet selector
        const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
        if (petsResponse?.pets) {
          setPets(petsResponse.pets);
          if (petsResponse.pets.length > 0 && !selectedPet) {
            setSelectedPet(petsResponse.pets[0]);
          }
        }
      } catch (error) {
        console.error('[CustomerHomeWrapper] Error loading user profile:', error);
      }
    };
    
    if (phone) {
      loadUserProfile();
    }
  }, [phone]);

  const syncTeleConsultUrl = useCallback(
    (includeServiceTele: boolean) => {
      if (typeof window === 'undefined') return;
      const sp = new URLSearchParams(window.location.search);
      if (includeServiceTele) sp.set('service', 'tele');
      else sp.delete('service');
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  // Deep link: /?service=tele → full-page tele booking with instant auto-pay (re-run when query string changes)
  const homeTeleSearchKey = searchParams.toString();
  useEffect(() => {
    const sp = new URLSearchParams(homeTeleSearchKey);
    if (sp.get('service') !== 'tele') return;
    const url = buildTeleInstantAutoPayBookingUrl();
    console.log('[CustomerHomeWrapper] service=tele in URL → redirect to instant auto-pay booking:', url);
    router.replace(url);
  }, [router, homeTeleSearchKey]);

  const prevScreenForTeleRef = useRef<ScreenType | null>(null);
  useEffect(() => {
    const prev = prevScreenForTeleRef.current;
    if (prev === 'vet-tele-consultation' && currentScreen !== 'vet-tele-consultation') {
      setTeleSkipModeSelection(false);
      syncTeleConsultUrl(false);
    }
    prevScreenForTeleRef.current = currentScreen;
  }, [currentScreen, syncTeleConsultUrl]);

  // Notification Service logic... (kept same as original)
  useNotificationService({
    phone: phone,
    enabled: !!phone,
    onNewNotification: async (notification) => {
      console.log('📬 [CUSTOMER-HOME] Notification received:', notification);
      if (notification.type === 'chat_message' && notification.bookingId) {
        try {
          const data = await apiClient.get<{ booking: { id: string; vendorId: string; vendorName: string; customerPhone: string } }>(`/customer/bookings/${notification.bookingId}`);
          if (data && data.booking) {
            setVetServiceData({
              booking: {
                bookingId: data.booking.id,
                vendorId: data.booking.vendorId,
                vendorName: data.booking.vendorName,
                customerPhone: data.booking.customerPhone
              }
            });
            setCurrentScreen('vet');
            toast.success('Opening chat...', { description: `Chat with ${data.booking.vendorName}`, duration: 2000 });
          }
        } catch (error) {
          console.error('Error fetching booking for navigation:', error);
          toast.error('Could not open chat');
        }
      }
      if (notification.type === 'prescription_generated' && notification.bookingId) {
         toast.info('New Prescription Available', {
           description: 'Tap to view details',
           action: { label: 'View', onClick: () => handleViewBooking(notification.bookingId) },
           duration: 5000
         });
      }
    }
  });
  
  // Navigation handlers (kept same mostly)
  const handleProfileClick = () => setUserSidebarOpen(true);
  const handleViewCustomerProfile = () => { setUserSidebarOpen(false); setCurrentScreen('customer-profile'); };
  /** Blue chevron on home pet chip → view/edit pet (not booking sessions quick view). */
  const handlePetClick = (petId: string) => {
    setPreviousScreen(currentScreen);
    setSelectedPetId(petId);
    setCurrentScreen('pet-details');
  };
  const handleViewPetProfile = (petData: any) => {
    setPreviousScreen(currentScreen);
    setSelectedPetData(petData);
    setSelectedPetId(petData.id);
    setCurrentScreen('pet-profile');
  };
  
  const handleViewFullPetProfile = async () => {
    if (!selectedPetId) return;
    try {
      const data = await apiClient.get<{ success: boolean; pet: any }>(`/customer/pets/${selectedPetId}`);
      if (data.success && data.pet) handleViewPetProfile(data.pet);
    } catch (error) { console.error('Error loading pet data:', error); }
  };

  const handleAddPet = () => {
    // Navigate to add-pet screen instead of opening modal
    setCurrentScreen('add-pet');
  };
  const handleAddPetSuccess = () => {
    setRefreshKey(prev => prev + 1);
    // Return to home after adding pet
    setCurrentScreen('home');
  };

  const goToShopFromParent = (opts?: { category?: string }) => {
    if (!SHOP_SUBFLOW_SCREENS.has(currentScreen)) {
      setShopReturnScreen(currentScreen);
    }
    if (opts && opts.category !== undefined) {
      setSelectedShopCategory(opts.category);
    } else {
      setSelectedShopCategory(undefined);
    }
    setCurrentScreen('shop');
  };

  const handleNavigateToService = (service: string, _data?: any) => {
    if (service === 'walker') setCurrentScreen('walker');
    else if (service === 'vet' || service === 'veterinarian') setCurrentScreen('vet');
    else if (service === 'vet-tele-consultation') {
      setVetServiceData(_data);
      setCurrentScreen('vet-tele-consultation');
      return;
    }
    else if (service === 'grooming') setCurrentScreen('grooming');
    else if (service === 'training') setCurrentScreen('training');
    else if (service === 'boarding') setCurrentScreen('boarding');
    else if (service === 'pet-sitter' || service === 'pet_sitter' || service === 'sitting') setCurrentScreen('pet-sitter');
    else if (service === 'adoption') setCurrentScreen('adoption');
    else if (service === 'adoption_questionnaire') setCurrentScreen('adoption_questionnaire');
    else if (service === 'sunset') setCurrentScreen('sunset');
    else if (service === 'insurance') setCurrentScreen('insurance');
    else if (service === 'cafes') setCurrentScreen('cafes');
    else if (service === 'shop') {
      goToShopFromParent();
    }
    else if (service === 'cart') setCurrentScreen('cart');
    else if (service === 'my-bookings' || service === 'bookings') setCurrentScreen('my-bookings');
    else if (service === 'photography') setCurrentScreen('photography');
    else if (service === 'breeder') setCurrentScreen('breeder');
    else if (service === 'ambulance') setCurrentScreen('ambulance');
    else if (service === 'nutritionist') setCurrentScreen('nutritionist');
    else if (service === 'pharmacy' || service === 'pharmacy_store') setCurrentScreen('pharmacy');
    else if (service === 'diagnostics' || service === 'lab-diagnostics' || service === 'lab') setCurrentScreen('lab-diagnostics');
    else if (service === 'behaviorist' || service === 'behavioral') setCurrentScreen('behaviorist');
    else if (service === 'home-service' || service === 'home-service-selection') setCurrentScreen('home-service-selection');
    else if (service === 'relocation') setCurrentScreen('relocation');
    else if (service === 'resort') setCurrentScreen('resort');
    else if (service === 'holiday') setCurrentScreen('holiday');
    else if (service === 'mating-dating-hub') setCurrentScreen('mating-dating-hub');
    else if (service === 'wallet') setCurrentScreen('wallet');
    else if (service === 'purchase-package') {
      setPreviousScreen(currentScreen);
      setCurrentScreen('package-booking');
    }
    else if (service === 'services') setCurrentScreen('services');
    else if (service === 'help' || service === 'support_help') setCurrentScreen('support_help');
    else if (service === 'offers' || service === 'promotions') {
      rememberPromotionsBackSpaScreen(currentScreen);
      router.push('/promotions');
    }
    else if (service === 'whats-new') router.push('/whats-new');
    else if (service === 'articles' || service === 'customer-articles') router.push('/articles');
    else if (service === 'wishlist') router.push('/wishlist');
    else if (service === 'home') {
      handleBack();
    } else {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[CustomerHomeWrapper] Unhandled navigate service:', service);
      }
      toast.message('That action is not available here. Try refreshing the page if this keeps happening.');
    }
  };

  const handleVetNavigate = (screen: string, data?: any) => {
    console.log('🔵 [handleVetNavigate] Navigating to:', screen, data);
    setVetServiceData(data);
    // ✅ FIX: Handle all navigation screens including pharmacy, lab, etc.
    if (screen === 'vet-booking') setCurrentScreen('vet-booking');
    else if (screen === 'vet-doctor-details') setCurrentScreen('vet-doctor-details');
    else if (screen === 'vet-clinic-list') setCurrentScreen('vet-clinic-list');
    else if (screen === 'vet-clinic-profile') setCurrentScreen('vet-clinic-profile');
    else if (screen === 'vet-clinic-booking') setCurrentScreen('vet-clinic-booking');
    else if (screen === 'vet-services-by-style') setCurrentScreen('vet-services-by-style');
    else if (screen === 'vet-tele-consultation') {
      setCurrentScreen('vet-tele-consultation');
      return;
    }
    else if (screen === 'vet-home-visit') setCurrentScreen('vet-home-visit');
    else if (screen === 'pharmacy') {
      console.log('🔵 [handleVetNavigate] Setting pharmacy landing (Medicine)');
      setCurrentScreen('pharmacy');
    }
    else if (screen === 'pharmacy_store') {
      setCurrentScreen('pharmacy_store');
    }
    else if (
      screen === 'lab-diagnostics' ||
      screen === 'lab-tests' ||
      screen === 'diagnostics' ||
      screen === 'lab' ||
      screen === 'vet-lab-tests'
    ) {
      console.log('🔵 [handleVetNavigate] Setting lab-diagnostics screen');
      setCurrentScreen('lab-diagnostics');
    }
    else if (screen === 'my-bookings' || screen === 'bookings') {
      setCurrentScreen('my-bookings');
    }
    else if (screen === 'home') { 
      setCurrentScreen('home'); 
      setVetServiceData(null); 
    }
    else if (screen === 'add-address') {
      // Open address book (add/select address); back returns to current vet flow (e.g. vet-home-visit)
      setPreviousScreen(currentScreen);
      setCurrentScreen('address_book');
    }
    else if (screen === 'profile') {
      setCurrentScreen('customer-profile');
    }
    else if (screen === 'purchase-package') {
      setPreviousScreen(currentScreen);
      setVetServiceData((prev: any) => ({ ...prev, ...data }));
      setCurrentScreen('package-booking');
    }
    else {
      // ✅ FIX: Fallback - try to navigate to the screen directly
      console.log('🔵 [handleVetNavigate] Unhandled screen, attempting direct navigation:', screen);
      setCurrentScreen(screen as any);
    }
  };
  
  const handleWalkerNavigate = (screen: string, data?: any) => {
    setWalkerServiceData(data);
    if (screen === 'walker-booking') {
      setCurrentScreen('walker-booking');
    } else if (screen === 'create-booking') {
      setPreviousScreen(currentScreen);
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'walking' });
      setCurrentScreen('create-booking');
    } else if (screen === 'walk-live-tracking') {
      setPreviousScreen(currentScreen);
      setWalkerServiceData({ sessionId: data?.sessionId, bookingId: data?.sessionId });
      setCurrentScreen('walk-live-tracking');
    } else if (screen === 'schedule-walk') {
      setPreviousScreen(currentScreen);
      setWalkerServiceData({ packageId: data?.packageId });
      setCurrentScreen('schedule-walk');
    } else if (screen === 'purchase-package') {
      setPreviousScreen(currentScreen);
      setWalkerServiceData(data ?? null);
      setCurrentScreen('purchase-package');
    }
  };

  const handleAccountNavigate = (path: string) => {
    setUserSidebarOpen(false);
    if (path === 'home') setCurrentScreen('home');
    else if (path === 'shop') goToShopFromParent();
    else if (path === 'account/orders') setCurrentScreen('order_history');
    else if (path === 'account/addresses') setCurrentScreen('address_book');
    else if (path === 'account/wallet' || path === 'wallet') setCurrentScreen('wallet');
    else if (path === 'rewards-loyalty') setCurrentScreen('rewards-loyalty');
    else if (path === 'referral-system') setCurrentScreen('referral-system');
    else if (path === 'appointments') setCurrentScreen('appointments');
    else if (path === 'support_help' || path === 'help') {
      setCurrentScreen('support_help');
    } else if (path === 'promotions' || path === 'offers') {
      rememberPromotionsBackSpaScreen(currentScreen);
      router.push('/promotions');
    } else if (path === 'account/settings') {
      // Navigate to settings page
      if (typeof window !== 'undefined') {
        window.location.href = '/settings';
      }
    }
  };

  const handleBottomNav = (screen: string) => {
    if (screen === 'home') {
      setUserSidebarOpen(false);
      setScreenBeforePets(null);
      setCurrentScreen('home');
      setSelectedPetId(null);
      setSelectedBookingId(null);
      setVetServiceData(null);
      setWalkerServiceData(null);
      setSelectedVendorId(undefined);
      setSelectedProblem(null);
      setCurrentServiceType(null);
    } else if (screen === 'cart') {
      setUserSidebarOpen(false);
      setCurrentScreen('cart');
    } else if (screen === 'my-bookings') {
      setUserSidebarOpen(false);
      setCurrentScreen('my-bookings');
    } else if (screen === 'profile') {
      handleProfileClick();
    }
  };

  const handleBack = () => {
    setUserSidebarOpen(false);
    setScreenBeforePets(null);
    setCurrentScreen('home');
    setSelectedPetId(null);
    setSelectedBookingId(null);
    setVetServiceData(null);
    setWalkerServiceData(null);
    setSelectedVendorId(undefined);
    setSelectedProblem(null);
    setCurrentServiceType(null);
  };

  /** Profile / account full-screen pages: Back returns to home with account sidebar open (not full shell reset). */
  const backToAccountMenu = () => {
    setCurrentScreen('home');
    setUserSidebarOpen(true);
  };

  const navigateToPets = () => {
    setScreenBeforePets(currentScreen);
    setCurrentScreen('pets');
  };

  const handleBackFromPets = () => {
    if (screenBeforePets != null) {
      setCurrentScreen(screenBeforePets);
      setScreenBeforePets(null);
      return;
    }
    handleBack();
  };

  const handlePetDeleted = () => {
    setRefreshKey(prev => prev + 1);
    setCurrentScreen('home');
    setSelectedPetId(null);
    setSelectedBookingId(null);
  };

  const handlePetProfileComplete = async (pets: any[]) => {
    setRefreshKey(prev => prev + 1);
    setCurrentScreen('home');
  };

  const handleViewBooking = (bookingId: string, petId?: string) => {
    setSelectedBookingId(bookingId);
    if (petId) setSelectedPetId(petId);
    setSidebarOpen(false);
    setUserSidebarOpen(false);
    setCurrentScreen('my-bookings');
  };

  const handleReorderMedicine = (medications: any[], prescriptionId?: string, _bookingId?: string) => {
    console.log('Reordering medicines:', medications, prescriptionId);
    // ✅ From My Bookings → vet appointment → prescription: open medicine delivery flow (prescription → address → broadcast → invoice → pay)
    if (prescriptionId) {
      setPrescriptionOrderData({ prescriptionId });
      setCurrentScreen('pharmacy_order_flow');
      toast.success('Order medicine from prescription');
      return;
    }
    if (medications && medications.length > 0) {
      medications.forEach(med => {
        addToCart({
          id: med.id || `med-${Math.random().toString(36).substr(2, 9)}`,
          name: med.name,
          price: med.price || 150,
          quantity: parseInt(med.quantity) || 1,
          prescriptionRequired: true,
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
        });
      });
      toast.success(`Added ${medications.length} medicines to cart`);
      setCurrentScreen('pharmacy_checkout');
    } else {
      toast.success('Navigating to Pharmacy...');
      setCurrentScreen('pharmacy');
    }
  };

  const accountSidebarOverlay =
    userSidebarOpen ? (
      <UserAccountSidebar
        phone={phone}
        onClose={() => setUserSidebarOpen(false)}
        onNavigateHome={handleBack}
        onViewBooking={handleViewBooking}
        onViewCustomerProfile={handleViewCustomerProfile}
        onNavigate={handleAccountNavigate}
      />
    ) : null;

  // ✅ FIX: Helper function to render screens with consistent StandardizedHeader layout
  // This ensures all service landing pages have the same header/footer as the home page
  const renderScreenWithLayout = (
    screen: ScreenType,
    component: ReactNode,
    options: {
      title: string;
      subtitle?: string;
      showBackButton?: boolean;
      showPets?: boolean;
      onBackOverride?: () => void;
      skipHeader?: boolean; // ✅ FIX: Allow skipping header for service routers that have their own frame UI
    }
  ): ReactNode => {
    return (
      <CustomerScreenWrapper 
        currentScreen={screen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        {/* Mobile-first shell: max-w-customer (fluid, see tailwind.config.js) */}
        <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
          {/* ✅ FIX: Skip StandardizedHeader for service routers that use ServiceDashboardHeader (frame UI) */}
          {!options.skipHeader && (
            <StandardizedHeader
              userName={userName}
              userProfilePhoto={userProfilePhoto}
              title={options.title}
              subtitle={options.subtitle}
              homeGreeting={false}
              showBackButton={options.showBackButton ?? true}
              showPets={options.showPets ?? false}
              pets={pets}
              selectedPet={selectedPet}
              onPetSelect={setSelectedPet}
              onBack={options.onBackOverride || handleBack}
              onNavigate={(s: string) => handleNavigateToService(s)}
              onProfileClick={handleProfileClick}
              onPetClick={handlePetClick}
              onAddPet={handleAddPet}
              customerPhone={phone}
            />
          )}
          {component}
        </div>
      </CustomerScreenWrapper>
    );
  };

  // RENDER LOGIC

  if (currentScreen === 'home') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <CustomerHome 
          phone={phone}
          refreshKey={refreshKey}
          onNavigate={(screen, data) => {
            // ✅ Handle order-tracking: meal vs ecommerce/pharmacy (Phase 5)
            if (screen === 'order-tracking') {
              const orderId = data?.orderId;
              if (data?.orderType === 'meal' && orderId) {
                setSelectedBookingId(orderId);
                setCurrentScreen('meal-order-tracking');
              } else if (orderId) {
                setSelectedOrder({ id: orderId });
                setCurrentScreen('order_tracking');
              } else {
                handleNavigateToService(screen);
              }
              return;
            }
            // ✅ Handle GPS Live Tracking navigation
            if (screen === 'gps-tracking' || screen === 'tracking') {
              setTrackingBookingId(data?.bookingId);
              setPreviousScreen(currentScreen);
              setCurrentScreen('gps-tracking');
            }
            // ✅ Handle Video Call navigation
            else if (screen === 'video-call') {
              setVideoCallData({ bookingId: data?.bookingId, meetingId: data?.meetingId });
              setPreviousScreen(currentScreen);
              setCurrentScreen('video-call');
            }
            // ✅ FIX: View Details from Upcoming & Active / notifications → open My Bookings with that booking's detail modal (by bookingId)
            else if (screen === 'booking-details' && data?.bookingId) {
              setSelectedBookingId(data.bookingId);
              setCurrentScreen('my-bookings');
              return;
            }
            // ✅ FIX: my-bookings with bookingId (e.g. from notification) → same as booking-details
            else if (screen === 'my-bookings' && data?.bookingId) {
              setSelectedBookingId(data.bookingId);
              setCurrentScreen('my-bookings');
              return;
            }
            // Handle problem-based navigation
            else if (screen === 'services_by_problem' || screen === 'problem_selected') {
              // ✅ Route through ProblemGridFlowRouter; use allowedServiceStyles from specialization so only allowed styles show
              setSelectedProblem({
                id: data?.problemId,
                title: data?.problemTitle || 'Service',
                roleId: data?.roleId,
                category: data?.category ?? data?.problem?.category,
                allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(
                  (data?.problem?.allowedServiceStyles ??
                    (data?.allowedServiceStyles
                      ? Array.isArray(data.allowedServiceStyles)
                        ? data.allowedServiceStyles
                        : [data.allowedServiceStyles]
                      : null)) as string[] | null,
                  {
                    roleId: data?.roleId,
                    specializationId: data?.problemId,
                    categoryHint: data?.category ?? data?.problem?.category,
                  }
                ),
              });
              setCurrentScreen('problem_grid_flow');
            } else if (screen === 'problem_grid') {
              setCurrentServiceType(data?.roleId || 'general');
              setCurrentScreen('problem_grid');
            } else if (screen === 'shop' && data?.category) {
              goToShopFromParent({ category: data.category });
            } else if (screen === 'support_help') {
              if (typeof window !== 'undefined' && data?.initialTab) {
                try {
                  sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, data.initialTab);
                } catch {
                  /* ignore */
                }
              }
              setCurrentScreen('support_help');
            } else if (screen === 'article-detail' && data?.article) {
              const a = data.article as { id?: string; slug?: string };
              const ref = (a.slug || a.id || '').toString();
              if (ref) router.push(`/articles/${encodeURIComponent(ref)}`);
            } else {
              handleNavigateToService(screen, data);
            }
          }}
          onProfileClick={handleProfileClick}
          onSidebarOpen={() => setSidebarOpen(true)}
          onPetClick={handlePetClick}
          onAddPet={handleAddPet}
          onViewBooking={handleViewBooking}
        />
      </CustomerScreenWrapper>
    );
  }

  // ✅ GPS Live Tracking Screen - Full screen tracking with Google Maps
  if (currentScreen === 'gps-tracking' && trackingBookingId) {
    return (
      <TrackingPageClient 
        bookingId={trackingBookingId}
        onBack={() => {
          setCurrentScreen(previousScreen || 'home');
          setTrackingBookingId(null);
        }}
      />
    );
  }

  // ✅ Video Call Screen - AWS Chime video calling
  if (currentScreen === 'video-call' && videoCallData) {
    return (
      <ChimeVideoCall
        bookingId={videoCallData.bookingId}
        participantType="customer"
        participantId={phone}
        onEndCall={() => {
          setVideoCallData(null);
          setCurrentScreen(previousScreen || 'home');
          setPreviousScreen(null);
        }}
      />
    );
  }

  // ✅ UPDATED: Customer Profile with navigation
  if (currentScreen === 'customer-profile') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <CustomerProfile phone={phone} onBack={handleBack} onNavigate={(screen: string) => setCurrentScreen(screen as ScreenType)} />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'pet-profile' && selectedPetData)
    return (
      <PetProfile
        phone={phone}
        petId={selectedPetData.id}
        petName={selectedPetData.name}
        petType={selectedPetData.type}
        petBreed={selectedPetData.breed}
        petAge={selectedPetData.age}
        petGender={selectedPetData.gender}
        petImage={selectedPetData.image}
        onBack={() => {
          if (previousScreen) {
            setCurrentScreen(previousScreen);
            setPreviousScreen(null);
            return;
          }
          handleBack();
        }}
      />
    );
  if (currentScreen === 'booking-details' && selectedBookingId && selectedPetId) return <PetBookingDetails bookingId={selectedBookingId} petId={selectedPetId} phone={phone} onBack={handleBack} onReorderMedicine={handleReorderMedicine} />;
  if (currentScreen === 'pet-quick' && selectedPetId) return <PetQuickView petId={selectedPetId} phone={phone} onBack={handleBack} onViewFullProfile={handleViewFullPetProfile} />;
  if (currentScreen === 'pet-details' && selectedPetId)
    return (
      <CustomerPetDetails
        phone={phone}
        petId={selectedPetId}
        onBack={() => {
          if (previousScreen) {
            setCurrentScreen(previousScreen);
            setPreviousScreen(null);
            return;
          }
          handleBack();
        }}
        onViewBooking={handleViewBooking}
        onDelete={handlePetDeleted}
        onViewPetProfile={(petData: any) => {
          setSelectedPetData(petData);
          setCurrentScreen('pet-profile-dashboard');
        }}
      />
    );
  if (currentScreen === 'pet-profile-dashboard' && selectedPetData)
    return (
      <PetProfileDashboard
        phone={phone}
        petData={selectedPetData}
        onBack={() => {
          setCurrentScreen('pet-details');
          setSelectedPetData(null);
        }}
        onBackToHome={() => {
          setSelectedPetData(null);
          handleBack();
        }}
      />
    );
  if (currentScreen === 'add-pet') return <CustomerPetProfile session={{ phone }} prefillData={null} onComplete={handlePetProfileComplete} onBack={handleBack} />;
  
  // Core Services
  // ✅ FIX: Walker with Frame UI (ServiceDashboardHeader only – skipHeader to avoid double header)
  if (currentScreen === 'walker') {
    return renderScreenWithLayout('walker',
      <WalkerDashboard phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
        if (screen === 'problem_grid') {
          setCurrentServiceType('walker');
          setCurrentScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Walking Service', roleId: 'walker' });
          setCurrentScreen('problem_grid_flow');
        } else {
          handleWalkerNavigate(screen, data);
        }
      }} data={walkerServiceData} />,
      { title: 'Pet Walking', subtitle: 'Professional dog walking services', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Walker booking flow – use WalkerBookingRouter (same pattern as vet/grooming/training)
  if (currentScreen === 'walker-booking') {
    return (
      <WalkerBookingRouter
        phone={phone}
        vendorId={walkerServiceData?.vendorId}
        walker={walkerServiceData?.walker}
        selectedService={walkerServiceData?.serviceId}
        serviceId={walkerServiceData?.serviceId}
        serviceName={walkerServiceData?.serviceName}
        serviceStyle={walkerServiceData?.serviceStyle || 'at_home'}
        serviceType={walkerServiceData?.serviceType || 'walking'}
        price={walkerServiceData?.price}
        duration={walkerServiceData?.duration}
        onBack={() => setCurrentScreen('walker')}
        onNavigate={(screen, data) => {
          if (screen === 'booking-details' || screen === 'booking-confirmation') {
            handleViewBooking(data?.bookingId);
          } else if (screen === 'walk-live-tracking') {
            setPreviousScreen('walker-booking');
            setWalkerServiceData({ sessionId: data?.sessionId, bookingId: data?.sessionId });
            setCurrentScreen('walk-live-tracking');
          } else if (screen === 'schedule-walk') {
            setPreviousScreen('walker-booking');
            setWalkerServiceData({ packageId: data?.packageId });
            setCurrentScreen('schedule-walk');
          } else {
            handleWalkerNavigate(screen, data);
          }
        }}
        onViewBooking={handleViewBooking}
      />
    );
  }
  if (currentScreen === 'walk-live-tracking') return <WalkLiveTrackingView bookingId={walkerServiceData?.bookingId || walkerServiceData?.sessionId || ''} onBack={() => { setCurrentScreen(previousScreen || 'walker-booking'); setPreviousScreen(null); }} />;
  if (currentScreen === 'schedule-walk') return <CreateBookingPage phone={phone} vendorId={walkerServiceData?.vendorId} serviceId={walkerServiceData?.packageId} onBack={() => { setCurrentScreen(previousScreen || 'walker-booking'); setPreviousScreen(null); }} onSuccess={(bookingId) => handleViewBooking(bookingId)} />;
  // ✅ FIX: Vet Service with Frame UI (ServiceDashboardHeader)
  if (currentScreen === 'vet') {
    return renderScreenWithLayout('vet',
      <VetServiceRouter 
        phone={phone} 
        onBack={handleBack} 
        onNavigate={(screen, data) => {
          if (screen === 'problem_grid') {
            setCurrentServiceType('veterinarian');
            setCurrentScreen('problem_grid');
          } else if (screen === 'problem_selected') {
            setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Vet Service', roleId: 'veterinarian' });
            setCurrentScreen('problem_grid_flow');
          } else {
            handleVetNavigate(screen, data);
          }
        }} 
        data={vetServiceData} 
      />,
      { title: 'Veterinary Services', subtitle: 'Professional pet healthcare', showBackButton: true, skipHeader: true }
    );
  }
  if (currentScreen === 'vet-booking') return <VetBookingRouter phone={phone} doctorId={vetServiceData?.vendorId || vetServiceData?.doctorId} vendorId={vetServiceData?.vendorId} clinicId={vetServiceData?.clinicId || vetServiceData?.id} doctor={vetServiceData?.doctor} selectedService={vetServiceData?.service} serviceType={vetServiceData?.serviceType} serviceId={vetServiceData?.serviceId} serviceName={vetServiceData?.serviceName} serviceStyle={vetServiceData?.serviceStyle} price={vetServiceData?.price} duration={vetServiceData?.duration} selectedServices={vetServiceData?.selectedServices} vendorName={vetServiceData?.vendorName} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} onViewBooking={handleViewBooking} />;
  if (currentScreen === 'vet-doctor-details') return <VetDoctorDetails phone={phone} doctorId={vetServiceData?.doctorId || ''} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} />;
  if (currentScreen === 'vet-clinic-list') return <ClinicListView phone={phone} onBack={() => setCurrentScreen('vet')} onNavigate={(screen, data) => { 
    if (screen === 'clinic-profile' || screen === 'clinic-details') { 
      setVetServiceData({ id: data?.clinicId, ...data }); 
      setCurrentScreen('vet-clinic-profile'); 
    } 
  }} />;
  if (currentScreen === 'vet-clinic-profile') return <ClinicProfileView phone={phone} clinicId={vetServiceData?.id || ''} onBack={() => setCurrentScreen('vet-clinic-list')} onNavigate={(screen, data) => {
    if (screen === 'appointment' || screen === 'vet-booking') {
      setVetServiceData({
        ...vetServiceData,
        id: data?.clinicId || vetServiceData?.id,
        vendorId: data?.vendorId || data?.clinicId || vetServiceData?.id,
        clinicId: data?.clinicId || vetServiceData?.id,
        serviceType: data?.serviceType || 'clinic',
        serviceStyle: data?.serviceStyle || 'at_center',
        service: data?.service,
        serviceId: data?.serviceId,
        serviceName: data?.serviceName,
        price: data?.price,
        duration: data?.duration,
        doctor: data?.doctor,
        clinic: data?.clinic,
      });
      setCurrentScreen('vet-booking');
    }
  }} />;
  if (currentScreen === 'vet-clinic-booking') return <VetBookingFlow phone={phone} serviceType={vetServiceData?.serviceType || 'tele'} vendorId={vetServiceData?.vendorId} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} />;

  if (currentScreen === 'pet-boarding-vendors') {
    const slug = normalizeBoardingServiceSlug(petBoardingServiceSlug ?? null);
    return (
      <BoardingVendorListView
        phone={phone}
        serviceSlug={slug}
        onBack={() => router.push('/')}
      />
    );
  }

  if (currentScreen === 'pet-boarding-profile' && petBoardingVendorId) {
    const slug = normalizeBoardingServiceSlug(petBoardingServiceSlug ?? null);
    return (
      <BoardingVendorProfileView
        phone={phone}
        vendorId={petBoardingVendorId}
        serviceSlug={slug}
        onBack={() =>
          router.push(`/pet-boarding/vendors?service=${encodeURIComponent(slug)}`)
        }
        onNavigate={(screen, data) => {
          if (screen === 'boarding-booking') {
            setPreviousScreen('pet-boarding-profile');
            setVetServiceData({
              vendorId: data?.vendorId,
              serviceType: 'boarding',
              serviceId: data?.serviceId,
              serviceName: data?.serviceName,
              price: data?.price,
              duration: data?.duration,
              serviceStyle: data?.serviceStyle,
              facility: data?.facility,
            });
            setCurrentScreen('boarding-booking');
          }
        }}
      />
    );
  }

  if (currentScreen === 'vet-services-by-style') return <VetServicesByStyle phone={phone} serviceStyle={vetServiceData?.serviceStyle || 'tele'} serviceTypeName={vetServiceData?.serviceTypeName} category={vetServiceData?.category || 'vet'} onBack={() => setCurrentScreen('vet')} onNavigate={handleVetNavigate} />;
  // ✅ FIX: Tele Consultation Router
  if (currentScreen === 'vet-tele-consultation') {
    return renderScreenWithLayout('vet-tele-consultation',
      <TeleConsultationRouter 
        phone={phone} 
        skipModeSelection={teleSkipModeSelection}
        onBack={() => setCurrentScreen('vet')} 
        onNavigate={(screen, data) => {
          // Handle navigation from TeleConsultationRouter
          if (screen === 'video-call') {
            // ✅ FIX: Navigate to video call page using router.push with path format
            // Path format /video/[bookingId] works with CloudFront rewrite rules
            if (typeof window !== 'undefined' && data?.bookingId) {
              if (phone) {
                localStorage.setItem('customerPhone', phone);
                localStorage.setItem('phone', phone);
              }
              router.push(`/video/${data.bookingId}`);
            }
          } else if (screen === 'add-pet') {
            setCurrentScreen('add-pet');
          } else if (screen === 'payment') {
            // Handle payment navigation - go directly to payment page with booking data
            setPreviousScreen('vet-tele-consultation');
            setPaymentData(data);
            setCurrentScreen('payment');
          } else {
            // Fallback to vet navigation handler
            handleVetNavigate(screen, data);
          }
        }} 
      />,
      { title: 'Tele Consultation', subtitle: 'Video consultation with vets', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Home Visit Router
  if (currentScreen === 'vet-home-visit') {
    return renderScreenWithLayout('vet-home-visit',
      <HomeVisitRouter 
        phone={phone} 
        onBack={() => setCurrentScreen('vet')} 
        onNavigate={(screen, data) => {
          // Handle navigation from HomeVisitRouter
          if (screen === 'payment') {
            // Handle payment navigation - go directly to payment page with booking data
            setPreviousScreen('vet-home-visit');
            setPaymentData(data);
            setCurrentScreen('payment');
          } else if (screen === 'add-pet') {
            setCurrentScreen('add-pet');
          } else {
            // Fallback to vet navigation handler
            handleVetNavigate(screen, data);
          }
        }}
        initialAddressFromBook={selectedAddressFromBook}
        onConsumeInitialAddress={() => setSelectedAddressFromBook(null)}
      />,
      { title: 'Home Visit', subtitle: 'Vet comes to your doorstep', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Payment Screen - Universal payment page for all service booking flows
  if (currentScreen === 'payment' && paymentData) {
    const bookingData = paymentData;
    const servicesArray = bookingData.services && Array.isArray(bookingData.services) 
      ? bookingData.services 
      : [];
    const firstService = servicesArray[0] || bookingData;
    
    // Normalize selectedServices for UniversalPaymentPage (supports both camelCase and snake_case)
    const selectedServices = servicesArray.length > 0 ? servicesArray.map((s: any) => ({
      id: s.id || s.serviceId || s.service_id,
      serviceId: s.serviceId || s.service_id || s.id,
      name: s.name || s.serviceName || s.service_name || 'Service',
      serviceName: s.serviceName || s.name || s.service_name,
      price: Number(s.price) || 0,
      duration: s.duration != null ? Number(s.duration) : 0,
      serviceStyle: s.serviceStyle || s.service_style || bookingData.serviceType || bookingData.serviceStyle,
      description: s.description,
    })) : undefined;
    
    const baseAmount = Number(bookingData.totalAmount) 
      || (selectedServices ? selectedServices.reduce((sum: number, s: any) => sum + (s.price || 0), 0) : 0)
      || Number(firstService?.price) || Number(bookingData?.price) || 0;
    const duration = bookingData.totalDuration ?? firstService?.duration ?? bookingData?.duration;
    const serviceName = firstService?.name || firstService?.serviceName || firstService?.service_name || bookingData.serviceName || 'Service';
    
    return renderScreenWithLayout(
      'payment',
      <UniversalPaymentPage
        type="booking"
        layoutVariant="appShell"
        bookingId={bookingData.bookingId}
        vendorId={bookingData.vendorId || bookingData.provider?.id || ''}
        vendorName={bookingData.provider?.name || bookingData.vendorName || 'Service Provider'}
        serviceId={bookingData.serviceId || firstService?.serviceId || firstService?.service_id || firstService?.id}
        serviceName={serviceName}
        serviceDescription={firstService?.description || bookingData.description}
        serviceStyle={bookingData.serviceType || bookingData.serviceStyle || 'tele'}
        category={bookingData.category || 'vet'}
        bookingDate={bookingData.bookingDate}
        bookingTime={bookingData.bookingTime}
        petId={bookingData.petId}
        petName={bookingData.petName}
        petBreed={bookingData.petBreed}
        address={bookingData.address}
        baseAmount={baseAmount}
        duration={duration}
        selectedServices={selectedServices}
        customerPhone={phone}
        customerId={bookingData.customerId}
        flowType={bookingData.flowType}
        onBack={() => {
          // Go back to provider profile or tele consultation
          if (bookingData.category === 'nutritionist') {
            setCurrentScreen(previousScreen || 'nutritionist-tele');
            setPreviousScreen(null);
          } else if (bookingData.flowType === 'tele-scheduled' || bookingData.flowType === 'tele-instant' || bookingData.flowType === 'tele-queue-accepted') {
            setCurrentScreen(previousScreen || 'vet-tele-consultation');
            setPreviousScreen(null);
          } else if (bookingData.flowType === 'home-visit') {
            setCurrentScreen('vet-home-visit');
          } else {
            setCurrentScreen('vet');
          }
          setPaymentData(null);
        }}
        onSuccess={(bookingId, orderId, otpCode, meta) => {
          setSelectedBookingId(bookingId);
          setSelectedAppointmentId(bookingId);
          setPaymentData(null);
          if (meta?.isInstantTele) {
            setInstantConnectingBookingId(bookingId);
            setCurrentScreen('instant-connecting');
            toast.success('Payment successful! Connecting to vet...');
            return;
          }
          setCurrentScreen('my-bookings');
          toast.success('Booking confirmed successfully!');
        }}
      />,
      { title: 'Payment', subtitle: 'Secure checkout', showBackButton: false, skipHeader: true }
    );
  }
  // ✅ Instant tele: connecting screen (after payment) → auto-join video call after 3s
  if (currentScreen === 'instant-connecting' && instantConnectingBookingId) {
    return (
      <InstantConnectingScreen
        bookingId={instantConnectingBookingId}
        onJoinVideoCall={() => {
          localStorage.removeItem('activeTeleQueueId');
                setVideoCallData({ bookingId: instantConnectingBookingId });
                setInstantConnectingBookingId(null);
                setCurrentScreen('video-call');
              }}
      />
    );
  }
  // ✅ FIX: Grooming Service with Frame UI (ServiceDashboardHeader)
  if (currentScreen === 'grooming') {
    return renderScreenWithLayout('grooming',
      <GroomingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => { 
        console.log('🟢 [CustomerHomeWrapper] Grooming navigation:', screen, data);
        if (screen === 'appointment-details') { 
          setSelectedAppointmentId(data?.appointmentId); 
          setCurrentScreen('appointment-details'); 
        } else if (screen === 'create-booking') {
          setPreviousScreen('grooming');
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          setCurrentScreen('create-booking');
        } else if (screen === 'problem_grid') {
          console.log('🟢 [CustomerHomeWrapper] Setting problem_grid screen');
          setCurrentServiceType('groomer');
          setCurrentScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          console.log('🟢 [CustomerHomeWrapper] Setting problem_selected screen:', data);
          if (data?.problemId && !data?.problemTitle) {
            setSelectedProblem({ id: data.problemId, title: 'Loading...', roleId: 'groomer' });
          } else {
            setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Grooming Service', roleId: 'groomer' });
          }
          setCurrentScreen('problem_grid_flow');
        } else if (screen === 'grooming_center' || screen === 'at_center') {
          console.log('🟢 [CustomerHomeWrapper] Setting grooming_center screen');
          setCurrentScreen('grooming_center');
        } else if (screen === 'grooming_home' || screen === 'at_home') {
          console.log('🟢 [CustomerHomeWrapper] Setting grooming_home screen');
          setCurrentScreen('grooming_home');
        } else if (screen === 'add-address') {
          setPreviousScreen(currentScreen);
          setCurrentScreen('address_book');
        } else if (screen === 'profile') {
          setCurrentScreen('customer-profile');
        } else if (screen === 'purchase-package') {
          setPreviousScreen(currentScreen);
          setVetServiceData((prev: any) => ({ ...prev, ...data }));
          setCurrentScreen('purchase-package');
        } else {
          console.warn('🟡 [CustomerHomeWrapper] Unhandled grooming navigation:', screen, data);
          setCurrentScreen(screen as any);
        }
      }} />,
      { title: 'Grooming', subtitle: 'Premium pet grooming services', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Training Service with Frame UI (ServiceDashboardHeader)
  if (currentScreen === 'training') {
    return renderScreenWithLayout('training',
      <TrainingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        console.log('🟢 [CustomerHomeWrapper] Training navigation:', screen, data);
        if (screen === 'create-booking' || screen === 'training-booking' || screen === 'booking') {
          setPreviousScreen('training');
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'training', trainer: data?.trainer, service: data?.service, serviceId: data?.serviceId, vendorName: data?.vendorName, price: data?.price, duration: data?.duration });
          setCurrentScreen('training-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('trainer');
          setCurrentScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Training Service', roleId: 'trainer' });
          setCurrentScreen('problem_grid_flow');
        } else if (screen === 'training_center') {
          // ✅ FIX: Handle training center service style navigation
          setCurrentScreen('training_center');
        } else if (screen === 'training_home' || screen === 'at_home') {
          // ✅ FIX: Handle training home service style navigation  
          setCurrentScreen('training_home');
        } else if (screen === 'training-trial-booking' || screen === 'training-progress' || screen === 'training-skill-matrix') {
          handleBack();
          toast.info('Not available.');
        } else if (screen === 'add-address') {
          setPreviousScreen(currentScreen);
          setCurrentScreen('address_book');
        } else if (screen === 'profile') {
          setCurrentScreen('customer-profile');
        } else if (screen === 'purchase-package') {
          setPreviousScreen(currentScreen);
          setVetServiceData((prev: any) => ({ ...prev, ...data }));
          setCurrentScreen('purchase-package');
        } else {
          console.warn('🟡 [CustomerHomeWrapper] Unhandled training navigation:', screen, data);
          setCurrentScreen(screen as any);
        }
      }} />,
      { title: 'Training', subtitle: 'Professional pet training', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ Behaviorist: Problem-grid–driven flow (same pattern as vet/grooming/training; no separate dashboard router)
  if (currentScreen === 'behaviorist') {
    return (
      <ProblemGridSelector
        roleId="behaviorist"
        roleName="Behaviorist"
        customerId={phone}
        phone={phone}
        onBack={handleBack}
        onProblemSelect={(problem) => {
          setSelectedProblem({
            id: problem.id || problem.problemId,
            title: problem.displayName || problem.name || problem.title,
            roleId: 'behaviorist',
            category: 'behavioral',
            allowedServiceStyles: sanitizeCustomerAllowedServiceStyles((problem as any).allowedServiceStyles, {
              roleId: 'behaviorist',
              specializationId: problem.id || problem.problemId,
              categoryHint: 'behavioral',
            }),
          });
          setCurrentScreen('problem_grid_flow');
        }}
      />
    );
  }
  // ✅ FIX: Boarding Service with Frame UI (ServiceDashboardHeader – skipHeader to match vet/grooming/training)
  if (currentScreen === 'boarding') {
    return renderScreenWithLayout('boarding',
      <BoardingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        if (screen === 'boarding-booking') {
          setPreviousScreen('boarding');
          setVetServiceData({ vendorId: data?.vendorId, serviceType: 'boarding', facility: data?.facility });
          setCurrentScreen('boarding-booking');
        } else if (screen === 'create-booking') {
          setPreviousScreen('boarding');
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          setCurrentScreen('create-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('boarding');
          setCurrentScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Boarding Service', roleId: 'boarding' });
          setCurrentScreen('problem_grid_flow');
        } else if (screen === 'boarding_facility') {
          setCurrentScreen('boarding_facility');
        } else {
          setCurrentScreen(screen as ScreenType);
        }
      }} />,
      { title: 'Pet Boarding', subtitle: 'Safe & comfortable pet stay', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ Boarding Facility list (View all facilities) – same frame UI
  if (currentScreen === 'boarding_facility') {
    return renderScreenWithLayout('boarding_facility',
      <BoardingServiceRouter phone={phone} onBack={() => setCurrentScreen('boarding')} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        if (screen === 'boarding-booking') {
          setPreviousScreen('boarding_facility');
          setVetServiceData({ vendorId: data?.vendorId, serviceType: 'boarding', facility: data?.facility });
          setCurrentScreen('boarding-booking');
        } else if (screen === 'create-booking') {
          setPreviousScreen('boarding_facility');
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          setCurrentScreen('create-booking');
        } else if (screen === 'boarding_facility') {
          setCurrentScreen('boarding_facility');
        } else if (screen) {
          setCurrentScreen(screen as ScreenType);
        } else {
          setCurrentScreen('boarding');
        }
      }} />,
      { title: 'Boarding Facilities', subtitle: 'Select a facility', showBackButton: true, skipHeader: true }
    );
  }
  if (currentScreen === 'pet-sitter') {
    return renderScreenWithLayout('pet-sitter',
      <PetSitterServiceRouter
        phone={phone}
        onBack={handleBack}
        onNavigate={(screen, data) => {
          if (screen === 'pet-sitter-booking') {
            setPreviousScreen('pet-sitter');
            setVetServiceData({
              vendorId: data?.vendorId,
              serviceType: 'sitting',
              facility: data?.facility,
            });
            setCurrentScreen('pet-sitter-booking');
          } else if (screen === 'create-booking') {
            setPreviousScreen('pet-sitter');
            setSelectedVendorId(data?.vendorId);
            setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'sitting' });
            setCurrentScreen('create-booking');
          } else if (screen === 'pet-sitter-facility') {
            setCurrentScreen('pet-sitter-facility');
          } else if (screen) {
            setCurrentScreen(screen as ScreenType);
          } else {
            handleBack();
          }
        }}
      />,
      { title: 'Pet Sitting', subtitle: 'Trusted in-home care', showBackButton: true, skipHeader: true }
    );
  }
  if (currentScreen === 'pet-sitter-facility') {
    return renderScreenWithLayout('pet-sitter-facility',
      <PetSitterServiceRouter
        hubMode={false}
        phone={phone}
        onBack={() => setCurrentScreen('pet-sitter')}
        onNavigate={(screen, data) => {
          if (screen === 'pet-sitter-booking') {
            setPreviousScreen('pet-sitter-facility');
            setVetServiceData({
              vendorId: data?.vendorId,
              serviceType: 'sitting',
              facility: data?.facility,
            });
            setCurrentScreen('pet-sitter-booking');
          } else if (screen === 'create-booking') {
            setPreviousScreen('pet-sitter-facility');
            setSelectedVendorId(data?.vendorId);
            setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'sitting' });
            setCurrentScreen('create-booking');
          } else if (screen === 'pet-sitter') {
            setCurrentScreen('pet-sitter');
          } else if (screen) {
            setCurrentScreen(screen as ScreenType);
          } else {
            setCurrentScreen('pet-sitter');
          }
        }}
      />,
      { title: 'Pet Sitters', subtitle: 'Choose a sitter', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Adoption Service with StandardizedHeader layout
  if (currentScreen === 'adoption') {
    return renderScreenWithLayout('adoption',
      <AdoptionServiceRouter phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
        if (screen === 'adoption_questionnaire') {
          setCurrentScreen('adoption_questionnaire');
        } else if (screen === 'create-booking') {
          setPreviousScreen('adoption');
          setSelectedVendorId(data?.vendorId);
          setCurrentScreen('create-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('adoption');
          setCurrentScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Adoption Service', roleId: 'adoption' });
          setCurrentScreen('problem_grid_flow');
        } else if (screen) {
          setCurrentScreen(screen as ScreenType);
        } else {
          handleBack();
        }
      }} />,
      { title: 'Pet Adoption', subtitle: 'Find your new family member', showBackButton: true }
    );
  }
  // ✅ FIX: Sunset Care with StandardizedHeader layout
  if (currentScreen === 'sunset') {
    return renderScreenWithLayout('sunset',
      <SunsetServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        if (screen === 'create-booking') {
          setPreviousScreen('sunset');
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          setCurrentScreen('create-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('sunset');
          setCurrentScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Sunset Care Service', roleId: 'sunset' });
          setCurrentScreen('problem_grid_flow');
        } else if (screen) {
          setCurrentScreen(screen as ScreenType);
        } else {
          handleBack();
        }
      }} />,
      { title: 'Sunset Care', subtitle: 'Compassionate end-of-life care', showBackButton: true }
    );
  }
  // ✅ FIX: Insurance Services with StandardizedHeader layout
  if (currentScreen === 'insurance') {
    return renderScreenWithLayout('insurance',
      <InsuranceServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
        if (screen === 'insurance_policy_purchase') {
          setSelectedVendorId(data?.vendorId);
          setCurrentScreen('insurance_provider');
        } else if (screen === 'create-booking') {
          setSelectedVendorId(data?.vendorId);
          setCurrentScreen('create-booking');
        } else if (screen) {
          setCurrentScreen(screen as ScreenType);
        } else {
          handleBack();
        }
      }} />,
      { title: 'Pet Insurance', subtitle: 'Protect your furry friend', showBackButton: true }
    );
  }
  
  // ✅ UPDATED LANDING PAGES & FLOWS
  if (currentScreen === 'resort') return <ResortServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'resort_booking') { setSelectedVendorId(data?.vendorId); setCurrentScreen('resort_booking'); } else if (screen) setCurrentScreen(screen as ScreenType); }} />;
  if (currentScreen === 'resort_booking') return <ResortBoardingBookingEnhanced phone={phone} preSelectedVendorId={selectedVendorId} onBack={() => setCurrentScreen('resort')} onSuccess={() => setCurrentScreen('my-bookings')} />;
  
  if (currentScreen === 'cafes') return <PetCafeServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
      if (screen === 'cafe_reservation') { setSelectedVendorId(data?.vendorId); setCurrentScreen('cafe_reservation'); }
      else if (screen === 'cafe_detail') { setSelectedVendorId(data?.vendorId); setCurrentScreen('cafe_detail'); }
      else if (screen) { setCurrentScreen(screen as ScreenType); }
  }} />;
  if (currentScreen === 'cafe_detail') return <PetCafeListingZomatoStyle cafeId={selectedVendorId || ''} onBack={() => setCurrentScreen('cafes')} />;
  if (currentScreen === 'cafe_reservation') return <CafeReservationFlow phone={phone} preSelectedVendorId={selectedVendorId} onBack={() => setCurrentScreen('cafes')} />;
  
  if (currentScreen === 'breeder') return <BreederServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'breeder_catalog') setCurrentScreen('breeder_catalog'); else if (screen) setCurrentScreen(screen as ScreenType); }} />;
  if (currentScreen === 'breeder_catalog') return <BreederCatalogView phone={phone} onBack={() => setCurrentScreen('breeder')} />;

  if (currentScreen === 'ambulance') return <AmbulanceServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'ambulance_sos') setCurrentScreen('ambulance_sos'); else if (screen) setCurrentScreen(screen as ScreenType); }} />;
  if (currentScreen === 'ambulance_sos') return <AmbulanceSOS phone={phone} onBack={() => setCurrentScreen('ambulance')} />;

  if (currentScreen === 'ambulance_schedule') {
    return (
      <AmbulanceSubServiceFlow
        phone={phone}
        mode="schedule"
        onBack={() => setCurrentScreen('ambulance')}
        onSuccess={(id) => handleViewBooking(id)}
      />
    );
  }
  if (currentScreen === 'ambulance_transfer') {
    return (
      <AmbulanceSubServiceFlow
        phone={phone}
        mode="transfer"
        onBack={() => setCurrentScreen('ambulance')}
        onSuccess={(id) => handleViewBooking(id)}
      />
    );
  }
  
  if (currentScreen === 'photography') return <PhotographyServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen) {
      setCurrentScreen(screen as ScreenType);
    } else {
      handleBack();
    }
  }} />;
  if (currentScreen === 'relocation') return <RelocationServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen) {
      setCurrentScreen(screen as ScreenType);
    } else {
      handleBack();
    }
  }} />;
  
  // Nutritionist & Holiday
  // ✅ Nutritionist Tele - Video consultation flow (scheduled or instant)
  if (currentScreen === 'nutritionist-tele') {
    return (
      <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <NutritionistTeleRouter
          phone={phone}
          onBack={() => { setCurrentScreen(previousScreen || 'nutritionist'); setPreviousScreen(null); }}
          onNavigate={(screen, data) => {
            if (screen === 'payment' && data) {
              setPaymentData(data);
              setPreviousScreen('nutritionist-tele');
              setCurrentScreen('payment');
            } else if (screen === 'video-call' && data?.bookingId) {
              setVideoCallData({ bookingId: data.bookingId, meetingId: data.meetingId });
              setPreviousScreen('nutritionist-tele');
              setCurrentScreen('video-call');
            } else if (screen === 'add-pet' || screen === 'pets') {
              navigateToPets();
            } else if (screen === 'nutritionist-booking') {
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceId || 'pet_nutritionist', nutritionist: data?.nutritionist });
              setPreviousScreen('nutritionist-tele');
              setCurrentScreen('nutritionist-booking');
            } else {
              handleNavigateToService(screen);
            }
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  // ✅ Nutritionist Booking Router - step-by-step consultation booking (service → datetime → pet → payment → confirmation)
  if (currentScreen === 'nutritionist-booking') {
    return (
      <NutritionistBookingRouter
        phone={phone}
        vendorId={vetServiceData?.vendorId}
        nutritionist={vetServiceData?.nutritionist}
        selectedService={vetServiceData?.serviceId}
        serviceType={vetServiceData?.serviceType || 'pet_nutritionist'}
        serviceId={vetServiceData?.serviceId}
        serviceName={vetServiceData?.service?.name}
        serviceStyle={vetServiceData?.serviceStyle}
        price={vetServiceData?.price}
        duration={vetServiceData?.duration}
        onBack={() => setCurrentScreen(previousScreen || 'nutritionist')}
        onNavigate={(screen, data) => {
          if (screen === 'booking-details' || screen === 'booking-confirmation') {
            handleViewBooking(data?.bookingId);
          } else {
            handleNavigateToService(screen);
          }
        }}
        onViewBooking={handleViewBooking}
      />
    );
  }
  if (currentScreen === 'nutritionist') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <NutritionistServicesLanding 
          phone={phone} 
          onBack={handleBack} 
          onNavigate={(screen, data) => {
            if (screen === 'nutrition-meal-plans') {
              setCurrentScreen('nutrition-meal-plans');
            } else if (screen === 'diet-consultation-services') {
              setPreviousScreen('nutritionist');
              setCurrentScreen('diet-consultation-services');
            } else if (screen === 'nutritionist-tele') {
              setPreviousScreen('nutritionist');
              setCurrentScreen('nutritionist-tele');
            } else if (screen === 'nutritionist-booking') {
              setPreviousScreen('nutritionist');
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceId || 'pet_nutritionist', nutritionist: data?.nutritionist });
              setCurrentScreen('nutritionist-booking');
            } else if (screen === 'create-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
              setCurrentScreen('create-booking');
            } else if (screen === 'pets') {
              navigateToPets();
            } else if (screen === 'problem_grid') {
              setCurrentServiceType('pet_nutritionist');
              setCurrentScreen('problem_grid');
            } else if (screen === 'problem_selected') {
              setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Nutrition', roleId: 'pet_nutritionist' });
              setCurrentScreen('problem_grid_flow');
            } else if (screen) {
              setCurrentScreen(screen as ScreenType);
            } else {
              handleBack();
            }
          }} 
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'diet-consultation-services') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <DietConsultationVendors 
          phone={phone} 
          onBack={() => setCurrentScreen('nutritionist')} 
          onNavigate={(screen, data) => {
            if (screen === 'nutritionist-booking') {
              setPreviousScreen('diet-consultation-services');
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ 
                vendorId: data?.vendorId, 
                serviceId: data?.serviceId,
                serviceType: data?.serviceType || 'pet_nutritionist',
                serviceName: data?.serviceName,
                price: data?.price,
                duration: data?.duration
              });
              setCurrentScreen('nutritionist-booking');
            } else if (screen === 'pets') {
              navigateToPets();
            } else {
              handleBack();
            }
          }} 
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'nutrition-meal-plans') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <MealPlansList 
          phone={phone} 
          onBack={() => setCurrentScreen('nutritionist')} 
          onNavigate={(screen, data) => {
            if (screen === 'meal-order-checkout') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, mealPlanId: data?.mealPlanId });
              setCurrentScreen('meal-order-checkout');
            } else if (screen === 'create-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType, mealPlanId: data?.mealPlanId });
              setCurrentScreen('create-booking');
            } else if (screen === 'pets') {
              navigateToPets();
            } else {
              setCurrentScreen(screen as any);
            }
          }} 
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'meal-order-checkout') {
    return (
      <MealOrderCheckout
        phone={phone}
        mealPlanId={vetServiceData?.mealPlanId || ''}
        vendorId={vetServiceData?.vendorId || selectedVendorId || ''}
        onBack={() => setCurrentScreen('nutrition-meal-plans')}
        onSuccess={(orderId) => {
          toast.success('Order placed successfully');
          setSelectedBookingId(orderId);
          setCurrentScreen('meal-order-tracking');
        }}
      />
    );
  }
  if (currentScreen === 'meal-order-tracking' && selectedBookingId) {
    return (
      <OrderTrackingScreen
        orderId={selectedBookingId}
        orderType="meal"
        onBack={() => setCurrentScreen('nutrition-meal-plans')}
      />
    );
  }
  if (currentScreen === 'holiday') return <PetHolidayServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      setCurrentScreen('create-booking');
    } else if (screen) {
      setCurrentScreen(screen as ScreenType);
    } else {
      handleBack();
    }
  }} />;

  // Pharmacy Landing - Entry point for pharmacy (Medicine): Order medicine flow or Browse shop
  if (currentScreen === 'pharmacy') return <PharmacyServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'pharmacy_order_flow') {
      if (data?.prescriptionId || data?.prescriptionUrl) setPrescriptionOrderData({ prescriptionId: data.prescriptionId, prescriptionUrl: data.prescriptionUrl });
      setCurrentScreen('pharmacy_order_flow');
    }
    else if (screen === 'pharmacy_store') setCurrentScreen('pharmacy_store'); 
    else if (screen === 'pharmacy_checkout') setCurrentScreen('pharmacy_checkout');
    else if (screen) setCurrentScreen(screen as ScreenType);
  }} />;

  // Pharmacy Order Flow: prescription → address → broadcast (5/10/20km) → pharmacy accept → invoice → pay → OTP → track
  if (currentScreen === 'pharmacy_order_flow') return (
    <PharmacyOrderFlow
      customerPhone={phone}
      customerId={phone}
      prescriptionId={prescriptionOrderData?.prescriptionId}
      prescriptionUrl={prescriptionOrderData?.prescriptionUrl}
      onBack={() => { setPrescriptionOrderData(null); handleBack(); }}
      onComplete={(orderId) => {
        setCurrentPharmacyOrderId(orderId);
        setPrescriptionOrderData(null);
        setCurrentScreen('pharmacy_order_status');
      }}
    />
  );

  // Pharmacy Order Status: track order, OTP, delivery (Zomato-like)
  if (currentScreen === 'pharmacy_order_status' && currentPharmacyOrderId) return (
    <PharmacyOrderStatus
      orderId={currentPharmacyOrderId}
      phone={phone}
      onBack={() => { setCurrentPharmacyOrderId(null); handleBack(); }}
    />
  );

  // Lab Diagnostics Landing - Entry point for lab tests and diagnostics
  if (currentScreen === 'lab-diagnostics') return <DiagnosticsServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'lab-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: 'diagnostics' });
      setDiagnosticsPackageHint(
        data?.packageName || (data?.packageTestLabels && data.packageTestLabels.length)
          ? { name: data?.packageName, testLabels: data?.packageTestLabels ?? [] }
          : null
      );
      setPreviousScreen('lab-diagnostics');
      setCurrentScreen('diagnostics-booking');
    } else if (screen === 'diagnostics-reports') {
      setSelectedBookingId(data?.bookingId);
      setPreviousScreen('lab-diagnostics');
      setCurrentScreen('diagnostics-reports');
    } else if (screen === 'sample-collection-tracking') {
      setSelectedBookingId(data?.bookingId);
      setPreviousScreen('lab-diagnostics');
      setCurrentScreen('sample-collection-tracking');
    } else if (screen) {
      setCurrentScreen(screen as ScreenType);
    }
  }} />;

  // Diagnostics Booking Flow - Test selection, home/center, payment (uses DiagnosticsBookingFlow, NOT CreateBookingPage)
  // Fallback: use vetServiceData?.vendorId if selectedVendorId not set (wireframe stitching / alternate navigation)
  const diagnosticsVendorId = selectedVendorId || vetServiceData?.vendorId;
  if (currentScreen === 'diagnostics-booking' && diagnosticsVendorId) return <DiagnosticsBookingFlow 
    vendorId={diagnosticsVendorId} 
    customerPhone={phone} 
    packageHint={diagnosticsPackageHint ?? undefined}
    onBack={() => { setCurrentScreen(previousScreen || 'lab-diagnostics'); setPreviousScreen(null); setSelectedVendorId(undefined); setDiagnosticsPackageHint(null); }} 
    onSuccess={(bookingId) => { setDiagnosticsPackageHint(null); handleViewBooking(bookingId); setCurrentScreen('my-bookings'); }} 
    onCancel={() => { setCurrentScreen(previousScreen || 'lab-diagnostics'); setPreviousScreen(null); setSelectedVendorId(undefined); setDiagnosticsPackageHint(null); }} 
  />;

  // Diagnostics Report Viewer - View and download lab reports (Phase 3: Order medicine, Book physio)
  if (currentScreen === 'diagnostics-reports' && selectedBookingId) return <DiagnosticsReportViewer 
    bookingId={selectedBookingId} 
    customerPhone={phone} 
    onBack={() => { setCurrentScreen(previousScreen || 'lab-diagnostics'); setPreviousScreen(null); }} 
    onShareWithVet={(reportId, vetId) => { toast.success('Report shared with vet'); }}
    onNavigate={(screen, data) => {
      if (screen === 'pharmacy_store' || screen === 'pharmacy') setCurrentScreen('pharmacy');
      else if (screen === 'pharmacy_order_flow') {
        if (data?.prescriptionId || data?.prescriptionUrl) setPrescriptionOrderData({ prescriptionId: data.prescriptionId, prescriptionUrl: data.prescriptionUrl });
        setCurrentScreen('pharmacy_order_flow');
      }
      else if (screen === 'my-bookings') setCurrentScreen('my-bookings');
      else if (screen === 'vet' || screen === 'vet-services') setCurrentScreen('vet');
      else if (screen === 'booking-details' && data?.bookingId) {
        setSelectedBookingId(data.bookingId);
        setCurrentScreen('booking-details');
      }
    }}
  />;

  // Sample Collection Tracker - Track phlebotomist for home collection
  if (currentScreen === 'sample-collection-tracking' && selectedBookingId) return <SampleCollectionTracker 
    bookingId={selectedBookingId} 
    customerPhone={phone} 
    onBack={() => { setCurrentScreen(previousScreen || 'lab-diagnostics'); setPreviousScreen(null); }} 
    onComplete={() => { toast.success('Sample collection completed'); setCurrentScreen('lab-diagnostics'); }}
  />;

  // Shop & Orders
  if (currentScreen === 'shop') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <ShopDashboard
          phone={phone}
          category={selectedShopCategory}
          onBack={() => {
            setUserSidebarOpen(false);
            setSelectedShopCategory(undefined);
            const back = shopReturnScreen;
            setShopReturnScreen(null);
            if (back != null) {
              setCurrentScreen(back);
            } else {
              handleBack();
            }
          }}
          onNavigate={(screen, data) => { if (screen === 'pharmacy_store') setCurrentScreen('pharmacy_store'); else if (screen === 'pharmacy_checkout') setCurrentScreen('pharmacy_checkout'); else if (screen === 'product_detail') { setSelectedProduct(data?.product); setCurrentScreen('product_detail'); } else if (screen === 'cart') setCurrentScreen('cart'); else handleNavigateToService(screen); }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'product_detail' && selectedProduct) return (
    <ProductDetailPage 
      product={selectedProduct} 
      phone={phone}
      onBack={() => setCurrentScreen('shop')} 
      onReviewsClick={() => {
        setCurrentScreen('product_reviews');
      }} 
      onVendorClick={() => {
        if (selectedProduct.vendorId) {
          setSelectedVendorId(selectedProduct.vendorId);
          setCurrentScreen('vendor_profile');
        } else {
          toast.info('Vendor information not available');
        }
      }} 
    />
  );
  if (currentScreen === 'product_reviews' && selectedProduct) return <ProductReviewsView productId={selectedProduct.id || selectedProduct.productId} productName={selectedProduct.name} onBack={() => setCurrentScreen('product_detail')} />;
  if (currentScreen === 'vendor_profile' && selectedVendorId) return <VendorProfileDetail vendorId={selectedVendorId} phone={phone} onBack={() => setCurrentScreen(selectedProduct ? 'product_detail' : 'shop')} onNavigate={(screen, data) => { if (screen === 'product_detail') { setSelectedProduct(data?.product); setCurrentScreen('product_detail'); } }} />;
  if (currentScreen === 'cart') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <ShoppingCartView
          onBack={() => {
            setShopReturnScreen((prev) => (prev != null ? prev : currentScreen));
            setCurrentScreen('shop');
          }}
          onCheckout={() => setCurrentScreen('checkout')}
          onContinueShopping={() => {
            setShopReturnScreen((prev) => (prev != null ? prev : currentScreen));
            setCurrentScreen('shop');
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'checkout') return <CheckoutView phone={phone} onBack={() => setCurrentScreen('shop')} onSuccess={(orderId) => { setCurrentOrderId(orderId); setCurrentScreen('order_success'); }} />;
  if (currentScreen === 'order_success' && currentOrderId) return <OrderSuccessView orderId={currentOrderId} onTrackOrder={() => { setSelectedOrder({ id: currentOrderId }); setCurrentScreen('order_tracking'); }} onBackToHome={() => { setCurrentOrderId(null); setCurrentScreen('home'); }} onViewOrders={() => { setCurrentOrderId(null); setCurrentScreen('order_history'); }} />;
  if (currentScreen === 'order_history')
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <OrderHistoryPage
          onBack={backToAccountMenu}
          onCloseToHome={handleBack}
          onNavigate={handleAccountNavigate}
          spaShopReturnScreen="order_history"
        />
      </CustomerScreenWrapper>
    );
  if (currentScreen === 'address_book')
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AddressBookPage
          phone={phone}
          onCloseToHome={handleBack}
          onBack={
            previousScreen
              ? () => {
                  setCurrentScreen(previousScreen);
                  setPreviousScreen(null);
                }
              : backToAccountMenu
          }
          onSelect={(address) => {
            toast.success('Address selected');
            setSelectedAddressFromBook(address);
            if (previousScreen) {
              setCurrentScreen(previousScreen);
              setPreviousScreen(null);
            } else handleBack();
          }}
        />
      </CustomerScreenWrapper>
    );
  // Add Address: must show address book, not fall through to default fallback
  if (currentScreen === 'add-address')
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AddressBookPage
          phone={phone}
          onCloseToHome={handleBack}
          onBack={
            previousScreen
              ? () => {
                  setCurrentScreen(previousScreen);
                  setPreviousScreen(null);
                }
              : backToAccountMenu
          }
          onSelect={(address) => {
            toast.success('Address selected');
            setSelectedAddressFromBook(address);
            if (previousScreen) {
              setCurrentScreen(previousScreen);
              setPreviousScreen(null);
            } else handleBack();
          }}
        />
      </CustomerScreenWrapper>
    );
  if (currentScreen === 'wallet') return (
    <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
      <WalletPage onBack={backToAccountMenu} onCloseToHome={handleBack} onNavigate={handleAccountNavigate} />
    </CustomerScreenWrapper>
  );
  // if (currentScreen === 'order_history') return <OrderHistoryView phone={phone} onBack={handleBack} onOrderClick={(order) => { setSelectedOrder(order); setCurrentScreen('order_detail'); }} />;
  if (currentScreen === 'order_detail' && selectedOrder) return <OrderDetailView order={selectedOrder} onBack={() => setCurrentScreen('order_history')} onTrackOrder={() => setCurrentScreen('order_tracking')} onReorder={() => { toast.success('Items added to cart'); goToShopFromParent(); }} onHelp={() => setCurrentScreen('support_help')} />;
  if (currentScreen === 'order_tracking' && selectedOrder) return <OrderTrackingPage orderId={selectedOrder.id || selectedOrder.orderId} onBack={() => setCurrentScreen('order_detail')} />;
  
  if (currentScreen === 'pharmacy_store') return <PharmacyStore phone={phone} onBack={() => setCurrentScreen('shop')} onNavigate={(screen) => { if (screen === 'pharmacy_checkout') setCurrentScreen('pharmacy_checkout'); else if (screen === 'cart') setCurrentScreen('cart'); }} />;
  if (currentScreen === 'pharmacy_checkout') return <PharmacyCheckout phone={phone} onBack={() => setCurrentScreen('pharmacy_store')} onSuccess={() => setCurrentScreen('home')} />;

  // Other Screens
  if (currentScreen === 'my-bookings') {
    return (
      <CustomerScreenWrapper 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <MyBookings 
          phone={phone} 
          onBack={backToAccountMenu}
          onCloseToHome={handleBack}
          initialBookingId={selectedBookingId || undefined} 
          onReorderMedicine={handleReorderMedicine} 
          onNavigate={(screen, data) => { 
            if (data?.bookingId) setSelectedBookingId(data.bookingId); 
            if (screen === 'diagnostics-reports' || screen === 'sample-collection-tracking') setPreviousScreen('my-bookings');
            if (screen === 'video-call' && data?.bookingId) {
              const payload = data as { bookingId: string; meetingId?: string };
              setVideoCallData({ bookingId: payload.bookingId, meetingId: payload.meetingId });
              setPreviousScreen('my-bookings');
              setCurrentScreen('video-call');
            } else if (screen === 'gps-tracking' || screen === 'tracking') {
              setTrackingBookingId(data?.bookingId ?? null);
              setPreviousScreen('my-bookings');
              setCurrentScreen('gps-tracking');
            } else {
              setCurrentScreen(screen as ScreenType);
            }
          }} 
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'appointments') {
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AppointmentsList
          phone={phone}
          onBack={backToAccountMenu}
          onCloseToHome={handleBack}
          onSelectAppointment={(appointmentId) => {
            setSelectedAppointmentId(appointmentId);
            setCurrentScreen('appointment-details');
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'appointment-details' && selectedAppointmentId) {
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AppointmentDetailsView
          appointmentId={selectedAppointmentId}
          phone={phone}
          onBack={() => setCurrentScreen('appointments')}
          onReschedule={(appointmentId) => {
            setSelectedAppointmentId(appointmentId);
            setCurrentScreen('appointment-reschedule');
          }}
          onCancel={() => {
            setCurrentScreen('appointments');
            setSelectedAppointmentId(null);
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'appointment-reschedule' && selectedAppointmentId) {
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <RescheduleAppointmentView
          appointmentId={selectedAppointmentId}
          phone={phone}
          onBack={() => setCurrentScreen('appointment-details')}
          onSuccess={() => {
            setCurrentScreen('appointment-details');
            toast.success('Rescheduled successfully');
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  
  // if (currentScreen === 'wallet') return <WalletView phone={phone} onBack={handleBack} />;
  if (currentScreen === 'category-mapper') return <ProblemCategoryMapper />;
  
  // ✅ NEW: Adoption Questionnaire
  if (currentScreen === 'adoption_questionnaire') return <AdoptionQuestionnaire onBack={() => setCurrentScreen('adoption')} onComplete={() => { toast.success('Preferences saved'); setCurrentScreen('adoption'); }} />;

  // ✅ NEW: Services Browser
  if (currentScreen === 'services') return <CustomerServicesPage onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'create-booking') { 
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      setCurrentScreen('create-booking');
    } else {
      handleNavigateToService(screen);
    }
  }} />;
  
  // ✅ Grooming Service Style Screens - Frame UI (CustomerScreenWrapper for bottom nav, back → grooming)
  const groomingCenterNavigate = (screen: string, data?: any) => {
    if (screen === 'grooming-booking' || screen === 'create-booking') {
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({
        vendorId: data?.vendorId,
        serviceType: 'grooming',
        serviceStyle: 'at_center',
        groomer: data?.vendor || data?.groomer || (data?.vendorName ? { name: data.vendorName } : undefined),
        service: data?.service,
        serviceId: data?.serviceId,
        selectedServices: data?.selectedServices, // ✅ FIX: Pass multiple selected services
        vendorName: data?.vendorName,
        price: data?.price,
        duration: data?.duration,
      });
      setCurrentScreen('grooming-booking');
    } else {
      handleNavigateToService(screen);
    }
  };
  const groomingHomeNavigate = (screen: string, data?: any) => {
    if (screen === 'grooming-booking' || screen === 'create-booking') {
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({
        vendorId: data?.vendorId,
        serviceType: 'grooming',
        serviceStyle: 'at_home',
        groomer: data?.vendor || data?.groomer || (data?.vendorName ? { name: data.vendorName } : undefined),
        service: data?.service,
        serviceId: data?.serviceId,
        selectedServices: data?.selectedServices, // ✅ FIX: Pass multiple selected services
        vendorName: data?.vendorName,
        price: data?.price,
        duration: data?.duration,
      });
      setCurrentScreen('grooming-booking');
    } else {
      handleNavigateToService(screen);
    }
  };
  if (currentScreen === 'grooming_center') {
    return (
      <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
          <GroomingServicesByStyle
            phone={phone}
            serviceStyle="at_center"
            serviceTypeName="Grooming Center"
            category="grooming"
            onBack={() => setCurrentScreen('grooming')}
            onNavigate={groomingCenterNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'grooming_home') {
    return (
      <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
          <GroomingServicesByStyle
            phone={phone}
            serviceStyle="at_home"
            serviceTypeName="At Home Grooming"
            category="grooming"
            onBack={() => setCurrentScreen('grooming')}
            onNavigate={groomingHomeNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }

  // ✅ Training Service Style Screens - Frame UI (CustomerScreenWrapper for bottom nav, back → training)
  const trainingCenterNavigate = (screen: string, data?: any) => {
    if (screen === 'training-booking' || screen === 'booking' || screen === 'create-booking') {
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({
        vendorId: data?.vendorId,
        serviceType: 'training',
        serviceStyle: 'at_center',
        trainer: data?.vendor || data?.trainer,
        service: data?.service,
        serviceId: data?.serviceId,
        selectedServices: data?.selectedServices,
        vendorName: data?.vendorName,
        price: data?.price,
        duration: data?.duration,
      });
      setCurrentScreen('training-booking');
    } else {
      handleNavigateToService(screen);
    }
  };
  const trainingHomeNavigate = (screen: string, data?: any) => {
    if (screen === 'training-booking' || screen === 'booking' || screen === 'create-booking') {
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({
        vendorId: data?.vendorId,
        serviceType: 'training',
        serviceStyle: 'at_home',
        trainer: data?.vendor || data?.trainer,
        service: data?.service,
        serviceId: data?.serviceId,
        selectedServices: data?.selectedServices,
        vendorName: data?.vendorName,
        price: data?.price,
        duration: data?.duration,
      });
      setCurrentScreen('training-booking');
    } else {
      handleNavigateToService(screen);
    }
  };
  if (currentScreen === 'training_center') {
    return (
      <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
          <UniversalServicesByStyle
            phone={phone}
            roleId="trainer"
            serviceStyle="at_center"
            serviceTypeName="Training Center"
            category="training"
            bookingScreen="training-booking"
            onBack={() => setCurrentScreen('training')}
            onNavigate={trainingCenterNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'training_home') {
    return (
      <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen bg-gray-50 w-full max-w-customer mx-auto">
          <UniversalServicesByStyle
            phone={phone}
            roleId="trainer"
            serviceStyle="at_home"
            serviceTypeName="At Home Training"
            category="training"
            bookingScreen="training-booking"
            onBack={() => setCurrentScreen('training')}
            onNavigate={trainingHomeNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }

  // ✅ Grooming Booking Router
  if (currentScreen === 'grooming-booking') return <GroomingBookingRouter 
    phone={phone}
    vendorId={vetServiceData?.vendorId}
    groomer={vetServiceData?.groomer}
    selectedService={vetServiceData?.service}
    serviceId={vetServiceData?.serviceId}
    serviceName={vetServiceData?.service?.name}
    serviceStyle={vetServiceData?.serviceStyle || 'at_center'}
    selectedServices={vetServiceData?.selectedServices}
    vendorName={vetServiceData?.vendorName}
    price={vetServiceData?.price}
    duration={vetServiceData?.duration}
    onBack={() => setCurrentScreen('grooming')} 
    onNavigate={(screen, data) => {
      if (screen === 'booking-details' || screen === 'booking-confirmation') {
        handleViewBooking(data?.bookingId);
      } else {
        handleNavigateToService(screen);
      }
    }}
    onViewBooking={handleViewBooking}
  />;
  
  // ✅ Training Booking Router
  if (currentScreen === 'training-booking') return <TrainingBookingRouter 
    phone={phone}
    vendorId={vetServiceData?.vendorId}
    trainer={vetServiceData?.trainer}
    selectedService={vetServiceData?.service}
    serviceId={vetServiceData?.serviceId}
    serviceName={vetServiceData?.service?.name}
    serviceStyle={vetServiceData?.serviceStyle || 'at_center'}
    selectedServices={vetServiceData?.selectedServices}
    price={vetServiceData?.price}
    duration={vetServiceData?.duration}
    onBack={() => setCurrentScreen('training')} 
    onNavigate={(screen, data) => {
      if (screen === 'booking-details' || screen === 'booking-confirmation') {
        handleViewBooking(data?.bookingId);
      } else {
        handleNavigateToService(screen);
      }
    }}
    onViewBooking={handleViewBooking}
  />;

  // ✅ Boarding Booking Router - step-by-step boarding flow (service → datetime → pet → room → payment → confirmation)
  if (currentScreen === 'boarding-booking' || currentScreen === 'pet-sitter-booking') {
    const sittingBooking = currentScreen === 'pet-sitter-booking';
    return (
      <CustomerScreenWrapper
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <div className="min-h-0 w-full bg-gray-50">
          <BoardingBookingRouter
            flowVariant={sittingBooking ? 'pet_sitting' : 'boarding'}
            phone={phone}
            vendorId={vetServiceData?.vendorId}
            facility={vetServiceData?.facility}
            selectedService={vetServiceData?.serviceId}
            serviceType={vetServiceData?.serviceType || (sittingBooking ? 'sitting' : 'boarding')}
            serviceId={vetServiceData?.serviceId}
            serviceName={vetServiceData?.serviceName || vetServiceData?.service?.name}
            serviceStyle={vetServiceData?.serviceStyle}
            price={vetServiceData?.price}
            duration={vetServiceData?.duration}
            onBack={() => setCurrentScreen(previousScreen || (sittingBooking ? 'pet-sitter' : 'boarding'))}
            onNavigate={(screen, data) => {
              if (screen === 'booking-details' || screen === 'booking-confirmation') {
                handleViewBooking(data?.bookingId);
              } else {
                handleNavigateToService(screen);
              }
            }}
            onViewBooking={handleViewBooking}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }

  // ✅ NEW: Bookings List
  if (currentScreen === 'bookings') return <CustomerBookingsPage phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'booking-details') handleViewBooking(data.bookingId);
    else if (screen === 'services') setCurrentScreen('services');
  }} />;
  
  // Support & Help Center
  if (currentScreen === 'support_help')
    return <SupportHelpCenter phone={phone} onBack={backToAccountMenu} />;

  // ✅ NEW: Create Booking
  if (currentScreen === 'create-booking') return <CreateBookingPage phone={phone} serviceId={selectedService} vendorId={selectedVendorId} onBack={() => { setCurrentScreen(previousScreen || 'walker'); setPreviousScreen(null); }} onSuccess={(bookingId) => handleViewBooking(bookingId)} />;

  // ✅ NEW: Pets
  if (currentScreen === 'pets') return <CustomerPetsPage 
    phone={phone} 
    onBack={handleBackFromPets} 
    onNavigate={(screen, data) => {
      if (screen === 'pet-details') {
        if (!data?.petId) {
          console.error('Pet ID is missing in navigation data');
          return;
        }
        setPreviousScreen('pets');
        setSelectedPetId(data.petId);
        setCurrentScreen('pet-details');
      }
    }} 
    onAddPet={() => setCurrentScreen('add-pet')} 
  />;

  // ✅ P2 CUSTOMER APP ENHANCEMENTS - Recently Developed Features

  // Multi-Pet Booking
  if (currentScreen === 'multi-pet-booking') return <MultiPetBookingPage 
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
  />;

  // Return Request
  if (currentScreen === 'return-request' && selectedOrder) return <ReturnRequestPage
    customerPhone={phone}
    customerId={phone}
    orderId={selectedOrder.id}
    onBack={() => setCurrentScreen('order_detail')}
  />;

  // Rewards & Loyalty
  if (currentScreen === 'rewards-loyalty')
    return (
      <RewardsLoyaltyPage
        customerPhone={phone}
        onBack={backToAccountMenu}
        onCloseToHome={handleBack}
      />
    );

  // Referral System
  if (currentScreen === 'referral-system')
    return (
      <ReferralSystemPage
        customerPhone={phone}
        customerId={phone}
        onBack={backToAccountMenu}
        onCloseToHome={handleBack}
      />
    );

  // Package Booking
  if (currentScreen === 'package-booking') return <PackageBookingPage
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
  />;
  // purchase-package: same as package-booking (e.g. from VetBookingRouter/GroomingBookingRouter package cards)
  if (currentScreen === 'purchase-package') return <PackageBookingPage
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
    onBack={() => { setCurrentScreen(previousScreen || 'home'); setPreviousScreen(null); }}
  />;
  // profile: map to customer-profile (e.g. from VetBookingRouter tab)
  if (currentScreen === 'profile') return (
    <CustomerScreenWrapper currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
      <CustomerProfile phone={phone} onBack={handleBack} onNavigate={(screen: string) => setCurrentScreen(screen as ScreenType)} />
    </CustomerScreenWrapper>
  );

  // Emergency Booking
  if (currentScreen === 'emergency-booking') return <EmergencyBookingPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;

  // Check-In/Check-Out
  if (currentScreen === 'check-in-out') return <CheckInCheckOutPage
    customerPhone={phone}
    customerId={phone}
    bookingId={selectedBookingId || undefined}
    onBack={handleBack}
  />;

  // Medical Records
  if (currentScreen === 'medical-records' && selectedPetId) return <MedicalRecordsPage
    phone={phone}
    petId={selectedPetId}
    onBack={() => setCurrentScreen('pet-details')}
  />;

  // Customer Wallet (Enhanced)
  if (currentScreen === 'customer-wallet') return <CustomerWalletPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
    onNavigate={handleAccountNavigate}
  />;

  // ✅ MATING & DATING SERVICE - P2P Matchmaking
  if (currentScreen === 'mating-dating-hub') return <MatingDatingHub
    phone={phone}
    onBack={handleBack}
  />;

  // ✅ GAP FIXES: Rule 2 & 6
  if (currentScreen === 'integrated-services')
    return (
      <IntegratedServicesHub
        onBack={() => setCurrentScreen('home')}
        onNavigate={(service) => handleNavigateToService(service)}
      />
    );

  if (currentScreen === 'home-service-selection') return <HomeServiceSelectionEnhanced
    customerId={phone}
    customerPhone={phone}
    petId={selectedPetId || 'pet_default'}
    onBack={handleBack}
    onNavigate={(screen) => {
      if (screen === 'pet-sitter') setCurrentScreen('pet-sitter');
    }}
    onSuccess={(bookingId) => bookingId && handleViewBooking(bookingId)}
  />;

  // ✅ Problem Grid Navigation Handlers
  if (currentScreen === 'problem_grid') {
    // Determine roleId and roleName from currentServiceType or default to general
    const roleMap: Record<string, { roleId: string; roleName: string }> = {
      'groomer': { roleId: 'groomer', roleName: 'Groomer' },
      'trainer': { roleId: 'trainer', roleName: 'Trainer' },
      'veterinarian': { roleId: 'veterinarian', roleName: 'Veterinarian' },
      'walker': { roleId: 'walker', roleName: 'Walker' },
      'boarding': { roleId: 'boarding', roleName: 'Boarding' },
      'adoption': { roleId: 'adoption', roleName: 'Adoption' },
      'sunset': { roleId: 'sunset', roleName: 'Sunset Care' },
      'nutritionist': { roleId: 'nutritionist', roleName: 'Nutritionist' },
      'pet_nutritionist': { roleId: 'nutritionist', roleName: 'Nutritionist' },
      'behaviorist': { roleId: 'behaviorist', roleName: 'Behaviorist' },
      'general': { roleId: 'all', roleName: 'All Services' },
    };
    const roleInfo = currentServiceType 
      ? (roleMap[currentServiceType] || { roleId: currentServiceType, roleName: currentServiceType })
      : roleMap['general'];
    
    return (
      <ProblemGridSelector
        roleId={roleInfo.roleId}
        roleName={roleInfo.roleName}
        customerId={phone}
        phone={phone}
        onBack={() => {
          // Go back to the service that opened problem grid
          if (currentServiceType === 'groomer') setCurrentScreen('grooming');
          else if (currentServiceType === 'trainer') setCurrentScreen('training');
          else if (currentServiceType === 'veterinarian') setCurrentScreen('vet');
          else if (currentServiceType === 'walker') setCurrentScreen('walker');
          else if (currentServiceType === 'boarding') setCurrentScreen('boarding');
          else if (currentServiceType === 'adoption') setCurrentScreen('adoption');
          else if (currentServiceType === 'sunset') setCurrentScreen('sunset');
          else if (currentServiceType === 'nutritionist' || currentServiceType === 'pet_nutritionist') setCurrentScreen('nutritionist');
          else if (currentServiceType === 'behaviorist') setCurrentScreen('behaviorist');
          else if (pathname === '/services/all') {
            router.push('/');
          } else {
            setCurrentScreen('home');
          }
          setCurrentServiceType(null);
        }}
        onProblemSelect={(problem) => {
          const p = problem as any;
          const problemRole =
            roleInfo.roleId === 'all'
              ? (p.roleId || p.role_id || undefined)
              : roleInfo.roleId;
          setSelectedProblem({
            id: problem.id || problem.problemId,
            title: problem.displayName || problem.name || problem.title,
            roleId: problemRole,
            category: p.category,
            allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(
              p.allowedServiceStyles?.length ? p.allowedServiceStyles : null,
              {
                roleId: problemRole,
                specializationId: problem.id || problem.problemId,
                categoryHint: p.category,
              }
            ),
          });
          // ✅ Route to ProblemGridFlowRouter for service style selection (only allowed styles shown)
          setCurrentScreen('problem_grid_flow');
        }}
      />
    );
  }

  // ✅ NEW: Problem Grid Flow Router - Service Style Selection after Problem Grid
  if (currentScreen === 'problem_grid_flow' && selectedProblem) {
    return (
      <ProblemGridFlowRouter
        initialProblem={{
          id: selectedProblem.id,
          name: selectedProblem.title,
          icon: '🐾',
          description: `Services for ${selectedProblem.title}`,
          allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(
            selectedProblem.allowedServiceStyles?.length ? selectedProblem.allowedServiceStyles : null,
            {
              roleId: selectedProblem.roleId,
              specializationId: selectedProblem.id,
              categoryHint: selectedProblem.category,
            }
          ) as ('at_home' | 'at_center' | 'tele')[],
          linkedServiceRoles: selectedProblem.roleId ? [selectedProblem.roleId] : ['veterinarian', 'groomer', 'trainer'],
          category: selectedProblem.category || selectedProblem.roleId || 'general',
        }}
        customerId={phone}
        onClose={() => {
          if (currentServiceType) {
            setCurrentScreen('problem_grid');
          } else if (pathname === '/services/all') {
            setCurrentScreen('problem_grid');
          } else {
            setCurrentScreen('home');
          }
          setSelectedProblem(null);
        }}
        onBookingComplete={(bookingId) => {
          // Navigate to booking details after successful booking
          handleViewBooking(bookingId);
          setSelectedProblem(null);
          setCurrentServiceType(null);
        }}
      />
    );
  }

  if (currentScreen === 'services_by_problem' && selectedProblem) {
    return (
      <ServicesByProblem
        problemId={selectedProblem.id}
        problemTitle={selectedProblem.title}
        onBack={() => {
          // ✅ Go back to problem_grid_flow for service style selection
          setCurrentScreen('problem_grid_flow');
        }}
        onServiceSelect={(service) => {
          // Handle service selection - navigate to booking flow
          const vendorId = (service as any).vendorId || (service as any).id;
          const serviceId = (service as any).serviceId || (service as any).id;
          
          setSelectedVendorId(vendorId);
          setSelectedService(serviceId);
          setVetServiceData({ 
            vendorId: vendorId, 
            serviceType: selectedProblem.roleId,
            service: service
          });
          setCurrentScreen('create-booking');
        }}
      />
    );
  }

  return <NotAvailable onBack={handleBack} />;
}

/** Small component with proper useEffect for auto-redirect */
function InstantConnectingScreen({ bookingId, onJoinVideoCall }: { bookingId: string; onJoinVideoCall: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onJoinVideoCall, 3000);
    return () => clearTimeout(timer);
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8 w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Payment Confirmed!</h1>
        <p className="text-gray-600 mb-2">Connecting to vet now...</p>
        <p className="text-sm text-gray-400 mb-6">You'll be redirected to the video call automatically.</p>
        <button
          onClick={onJoinVideoCall}
          className="w-full py-3 px-4 bg-[#FF8C42] hover:bg-[#e67a35] text-white font-medium rounded-xl transition-colors"
        >
          Join video call now
        </button>
      </div>
    </div>
  );
}
