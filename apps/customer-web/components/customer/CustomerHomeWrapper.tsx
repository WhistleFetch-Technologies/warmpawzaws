import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { useCart } from '../../context/CartContext';
import { apiClient } from '@/lib/api-client';
import { isLegacyMockDiagnosticVendorId } from '@/lib/diagnostics-vendor-id';
import { SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';
import { useNotificationService } from './useNotificationService';

// ============================================================================
// PERFORMANCE OPTIMIZATION: Lazy Loading with Dynamic Imports
// ============================================================================
// Components are split into categories:
// 1. CRITICAL PATH - loaded immediately (home screen essentials)
// 2. LAZY LOADED - loaded on demand when user navigates to specific screens
// ============================================================================

// Loading component for lazy-loaded components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
  </div>
);

// ============================================================================
// CRITICAL PATH COMPONENTS - Loaded immediately (needed for home screen)
// ============================================================================
import { CustomerHomeComplete as CustomerHome } from './homepage/CustomerHomeComplete';
import { UserAccountSidebar } from './UserAccountSidebar';
import { NotAvailable } from './NotAvailable';

// ============================================================================
// LAZY LOADED COMPONENTS - Loaded on demand
// ============================================================================

// Pet Management
const CustomerPetDetails = dynamic(() => import('./CustomerPetDetails').then(mod => ({ default: mod.CustomerPetDetails })), { loading: LoadingSpinner });
const CustomerPetProfile = dynamic(() => import('./CustomerPetProfile').then(mod => ({ default: mod.CustomerPetProfile })), { loading: LoadingSpinner });
const PetBookingDetails = dynamic(() => import('./PetBookingDetails').then(mod => ({ default: mod.PetBookingDetails })), { loading: LoadingSpinner });
const PetQuickView = dynamic(() => import('./PetQuickView').then(mod => ({ default: mod.PetQuickView })), { loading: LoadingSpinner });
const AddPetModal = dynamic(() => import('./AddPetModal').then(mod => ({ default: mod.AddPetModal })), { loading: LoadingSpinner });
const CustomerProfile = dynamic(() => import('./CustomerProfile').then(mod => ({ default: mod.CustomerProfile })), { loading: LoadingSpinner });
const PetProfile = dynamic(() => import('./PetProfile').then(mod => ({ default: mod.PetProfile })), { loading: LoadingSpinner });
const PetProfileDashboard = dynamic(() => import('./PetProfileDashboard').then(mod => ({ default: mod.PetProfileDashboard })), { loading: LoadingSpinner });

// Walker Service
const WalkerService = dynamic(() => import('./WalkerService').then(mod => ({ default: mod.WalkerService })), { loading: LoadingSpinner });
const WalkerDashboard = dynamic(() => import('./walker/WalkerDashboard').then(mod => ({ default: mod.WalkerDashboard })), { loading: LoadingSpinner });

// Vet Service
const VetServiceRouter = dynamic(() => import('./VetServiceRouter').then(mod => ({ default: mod.VetServiceRouter })), { loading: LoadingSpinner });
const VetBookingFlow = dynamic(() => import('./vet/VetBookingFlow').then(mod => ({ default: mod.VetBookingFlow })), { loading: LoadingSpinner });
const VetBookingRouter = dynamic(() => import('./vet/VetBookingRouter').then(mod => ({ default: mod.VetBookingRouter })), { loading: LoadingSpinner });
const VetDoctorDetails = dynamic(() => import('./vet/VetDoctorDetails').then(mod => ({ default: mod.VetDoctorDetails })), { loading: LoadingSpinner });
const ClinicListView = dynamic(() => import('./vet/ClinicListView').then(mod => ({ default: mod.ClinicListView })), { loading: LoadingSpinner });
const ClinicProfileView = dynamic(() => import('./vet/ClinicProfileView').then(mod => ({ default: mod.ClinicProfileView })), { loading: LoadingSpinner });
const VetServicesByStyle = dynamic(() => import('./vet/VetServicesByStyle').then(mod => ({ default: mod.VetServicesByStyle })), { loading: LoadingSpinner });

// Other Core Services
const GroomingServiceRouter = dynamic(() => import('./GroomingServiceRouter').then(mod => ({ default: mod.GroomingServiceRouter })), { loading: LoadingSpinner });
const TrainingServiceRouter = dynamic(() => import('./TrainingServiceRouter').then(mod => ({ default: mod.TrainingServiceRouter })), { loading: LoadingSpinner });
const TrainingBookingRouter = dynamic(() => import('./training/TrainingBookingRouter').then(mod => ({ default: mod.TrainingBookingRouter })), { loading: LoadingSpinner, ssr: false });
const UniversalServicesByStyle = dynamic(() => import('./shared/UniversalServicesByStyle').then(mod => ({ default: mod.UniversalServicesByStyle })), { loading: LoadingSpinner });
const BoardingServiceRouter = dynamic(() => import('./BoardingServiceRouter').then(mod => ({ default: mod.BoardingServiceRouter })), { loading: LoadingSpinner });
const InsuranceProvider = dynamic(() => import('./insurance/InsuranceProvider').then(mod => ({ default: mod.InsuranceProvider })), { loading: LoadingSpinner });
const AdoptionServiceRouter = dynamic(() => import('./AdoptionServiceRouter').then(mod => ({ default: mod.AdoptionServiceRouter })), { loading: LoadingSpinner });
const SunsetServiceRouter = dynamic(() => import('./SunsetServiceRouter').then(mod => ({ default: mod.SunsetServiceRouter })), { loading: LoadingSpinner });

// Landing Pages
const InsuranceServicesLanding = dynamic(() => import('./InsuranceServicesLanding').then(mod => ({ default: mod.InsuranceServicesLanding })), { loading: LoadingSpinner });
const PetCafeServicesLanding = dynamic(() => import('./PetCafeServicesLanding').then(mod => ({ default: mod.PetCafeServicesLanding })), { loading: LoadingSpinner });
const PharmacyServicesLanding = dynamic(() => import('./PharmacyServicesLanding').then(mod => ({ default: mod.PharmacyServicesLanding })), { loading: LoadingSpinner });
const PhotographyServicesLanding = dynamic(() => import('./PhotographyServicesLanding').then(mod => ({ default: mod.PhotographyServicesLanding })), { loading: LoadingSpinner });
const BreederServicesLanding = dynamic(() => import('./BreederServicesLanding').then(mod => ({ default: mod.BreederServicesLanding })), { loading: LoadingSpinner });
const AmbulanceServicesLanding = dynamic(() => import('./AmbulanceServicesLanding').then(mod => ({ default: mod.AmbulanceServicesLanding })), { loading: LoadingSpinner });
const NutritionistServicesLanding = dynamic(() => import('./nutrition/NutritionistServicesLanding').then(mod => ({ default: mod.NutritionistServicesLanding })), { loading: LoadingSpinner });
const RelocationServicesLanding = dynamic(() => import('./RelocationServicesLanding').then(mod => ({ default: mod.RelocationServicesLanding })), { loading: LoadingSpinner });
const ResortServicesLanding = dynamic(() => import('./ResortServicesLanding').then(mod => ({ default: mod.ResortServicesLanding })), { loading: LoadingSpinner });
const PetHolidayServicesLanding = dynamic(() => import('./PetHolidayServicesLanding').then(mod => ({ default: mod.PetHolidayServicesLanding })), { loading: LoadingSpinner });
const DiagnosticsServicesLanding = dynamic(() => import('./DiagnosticsServicesLanding').then(mod => ({ default: mod.DiagnosticsServicesLanding })), { loading: LoadingSpinner });
const DiagnosticsBookingFlow = dynamic(() => import('./specialized/DiagnosticsBookingFlow').then(mod => ({ default: mod.DiagnosticsBookingFlow })), { loading: LoadingSpinner });
const DiagnosticsReportViewer = dynamic(() => import('./diagnostics/DiagnosticsReportViewer').then(mod => ({ default: mod.DiagnosticsReportViewer })), { loading: LoadingSpinner });
const SampleCollectionTracker = dynamic(() => import('./diagnostics/SampleCollectionTracker').then(mod => ({ default: mod.SampleCollectionTracker })), { loading: LoadingSpinner });

// Shop & E-commerce
const ShopDashboard = dynamic(() => import('./ShopDashboard').then(mod => ({ default: mod.ShopDashboard })), { loading: LoadingSpinner });
const ProductDetailPage = dynamic(() => import('./ProductDetailPage').then(mod => ({ default: mod.ProductDetailPage })), { loading: LoadingSpinner });
const ShoppingCartView = dynamic(() => import('./ShoppingCartView').then(mod => ({ default: mod.ShoppingCartView })), { loading: LoadingSpinner });
const CheckoutView = dynamic(() => import('./CheckoutView').then(mod => ({ default: mod.CheckoutView })), { loading: LoadingSpinner });
const OrderSuccessView = dynamic(() => import('./OrderSuccessView').then(mod => ({ default: mod.OrderSuccessView })), { loading: LoadingSpinner });
const OrderHistoryPage = dynamic(() => import('../shop/OrderHistoryPage').then(mod => ({ default: mod.OrderHistoryPage })), { loading: LoadingSpinner });
const AddressBookPage = dynamic(() => import('../shop/AddressBookPage').then(mod => ({ default: mod.AddressBookPage })), { loading: LoadingSpinner });
const WalletPage = dynamic(() => import('../shop/WalletPage').then(mod => ({ default: mod.WalletPage })), { loading: LoadingSpinner });
const OrderDetailView = dynamic(() => import('./OrderDetailView').then(mod => ({ default: mod.OrderDetailView })), { loading: LoadingSpinner });
const OrderTrackingView = dynamic(() => import('./OrderTrackingView').then(mod => ({ default: mod.OrderTrackingView })), { loading: LoadingSpinner });
const PharmacyStore = dynamic(() => import('./PharmacyStore').then(mod => ({ default: mod.PharmacyStore })), { loading: LoadingSpinner });
const PharmacyCheckout = dynamic(() => import('./PharmacyCheckout').then(mod => ({ default: mod.PharmacyCheckout })), { loading: LoadingSpinner });
const PharmacyOrderStatus = dynamic(() => import('./pharmacy/PharmacyOrderStatus').then(mod => ({ default: mod.PharmacyOrderStatus })), { loading: LoadingSpinner });
const PharmacyOrderFlow = dynamic(() => import('./specialized/PharmacyOrderFlow').then(mod => ({ default: mod.PharmacyOrderFlow })), { loading: LoadingSpinner });

// Bookings & Appointments
const MyBookings = dynamic(() => import('./booking/MyBookings').then(mod => ({ default: mod.MyBookings })), { loading: LoadingSpinner });
const AppointmentsList = dynamic(() => import('./AppointmentsList').then(mod => ({ default: mod.AppointmentsList })), { loading: LoadingSpinner });
const AppointmentDetailsView = dynamic(() => import('./AppointmentDetailsView').then(mod => ({ default: mod.AppointmentDetailsView })), { loading: LoadingSpinner });
const RescheduleAppointmentView = dynamic(() => import('./RescheduleAppointmentView').then(mod => ({ default: mod.RescheduleAppointmentView })), { loading: LoadingSpinner });

// Admin Components
const ProblemCategoryMapper = dynamic(() => import('../admin/ProblemCategoryMapper').then(mod => ({ default: mod.ProblemCategoryMapper })), { loading: LoadingSpinner });

// Gap Fixes
const PetCafeListingZomatoStyle = dynamic(() => import('./PetCafeListingZomatoStyle').then(mod => ({ default: mod.PetCafeListingZomatoStyle })), { loading: LoadingSpinner });
const ResortBoardingBookingEnhanced = dynamic(() => import('./ResortBoardingBookingEnhanced').then(mod => ({ default: mod.ResortBoardingBookingEnhanced })), { loading: LoadingSpinner });
const CafeReservationFlow = dynamic(() => import('./CafeReservationFlow').then(mod => ({ default: mod.CafeReservationFlow })), { loading: LoadingSpinner });
const BreederCatalogView = dynamic(() => import('./BreederCatalogView').then(mod => ({ default: mod.BreederCatalogView })), { loading: LoadingSpinner });
const AmbulanceSOS = dynamic(() => import('./AmbulanceSOS').then(mod => ({ default: mod.AmbulanceSOS })), { loading: LoadingSpinner });
const AmbulanceSubServiceFlow = dynamic(() => import('./AmbulanceSubServiceFlow').then(mod => ({ default: mod.AmbulanceSubServiceFlow })), { loading: LoadingSpinner });
const AdoptionQuestionnaire = dynamic(() => import('./AdoptionQuestionnaire').then(mod => ({ default: mod.AdoptionQuestionnaire })), { loading: LoadingSpinner });
const CustomerServicesPage = dynamic(() => import('./CustomerServicesPage').then(mod => ({ default: mod.CustomerServicesPage })), { loading: LoadingSpinner });
const CustomerBookingsPage = dynamic(() => import('./CustomerBookingsPage').then(mod => ({ default: mod.CustomerBookingsPage })), { loading: LoadingSpinner });
const CreateBookingPage = dynamic(() => import('./booking/CreateBookingPage').then(mod => ({ default: mod.CreateBookingPage })), { loading: LoadingSpinner });
const CustomerPetsPage = dynamic(() => import('./CustomerPetsPage').then(mod => ({ default: mod.CustomerPetsPage })), { loading: LoadingSpinner });
const OrderTrackingPage = dynamic(() => import('../shop/OrderTrackingPage').then(mod => ({ default: mod.OrderTrackingPage })), { loading: LoadingSpinner });

// P2 Customer App Enhancements
const MultiPetBookingPage = dynamic(() => import('./MultiPetBookingPage').then(mod => ({ default: mod.MultiPetBookingPage })), { loading: LoadingSpinner });
const ReturnRequestPage = dynamic(() => import('./ReturnRequestPage').then(mod => ({ default: mod.ReturnRequestPage })), { loading: LoadingSpinner });
const RewardsLoyaltyPage = dynamic(() => import('./RewardsLoyaltyPage').then(mod => ({ default: mod.RewardsLoyaltyPage })), { loading: LoadingSpinner });
const ReferralSystemPage = dynamic(() => import('./ReferralSystemPage').then(mod => ({ default: mod.ReferralSystemPage })), { loading: LoadingSpinner });
const PackageBookingPage = dynamic(() => import('./PackageBookingPage').then(mod => ({ default: mod.PackageBookingPage })), { loading: LoadingSpinner });
const EmergencyBookingPage = dynamic(() => import('./EmergencyBookingPage').then(mod => ({ default: mod.EmergencyBookingPage })), { loading: LoadingSpinner });
const SupportHelpCenter = dynamic(() => import('./SupportHelpCenter').then(mod => ({ default: mod.SupportHelpCenter })), { loading: LoadingSpinner });
const CheckInCheckOutPage = dynamic(() => import('./CheckInCheckOutPage').then(mod => ({ default: mod.CheckInCheckOutPage })), { loading: LoadingSpinner });
const MedicalRecordsPage = dynamic(() => import('./MedicalRecordsPage').then(mod => ({ default: mod.MedicalRecordsPage })), { loading: LoadingSpinner });
const CustomerWalletPage = dynamic(() => import('./WalletPage').then(mod => ({ default: mod.WalletPage })), { loading: LoadingSpinner });

// Mating & Dating Service
const MatingDatingHub = dynamic(() => import('./MatingDatingHub').then(mod => ({ default: mod.MatingDatingHub })), { loading: LoadingSpinner });
const HomeServiceSelectionEnhanced = dynamic(() => import('./HomeServiceSelectionEnhanced').then(mod => ({ default: mod.HomeServiceSelectionEnhanced })), { loading: LoadingSpinner });
const UniversalHomeServiceRouter = dynamic(() => import('./home-services/UniversalHomeServiceRouter').then(mod => ({ default: mod.UniversalHomeServiceRouter })), { loading: LoadingSpinner });
const IntegratedServicesHub = dynamic(() => import('../IntegratedServicesHub').then(mod => ({ default: mod.IntegratedServicesHub })), { loading: LoadingSpinner });

// Sidebar (loaded for home screen interactions)
const CustomerSidebar = dynamic(() => import('./CustomerSidebar').then(mod => ({ default: mod.CustomerSidebar })), { loading: LoadingSpinner });

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
  | 'grooming'
  | 'training'
  | 'training_center'
  | 'training_home'
  | 'training-booking'
  | 'boarding'
  | 'boarding_facility'
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
  | 'pharmacy_order_status'
  | 'pharmacy_order_flow'
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
  | 'universal-home-booking'
  | 'pharmacy'
  | 'lab-diagnostics'
  | 'diagnostics-booking'
  | 'diagnostics-reports'
  | 'sample-collection-tracking';

export function CustomerHomeWrapper({ phone, onNavigate, initialScreen }: { phone: string; onNavigate: (screen: string) => void; initialScreen?: ScreenType }) {
  console.log('CustomerHomeWrapper: Rendering with phone:', phone);
  const router = useRouter();

  // ✅ NAVIGATION HISTORY STACK - Fixes back/forward navigation issues
  const [navigationHistory, setNavigationHistory] = useState<ScreenType[]>([initialScreen || 'home']);
  const currentScreen = navigationHistory[navigationHistory.length - 1];
  
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
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
  const [currentPharmacyOrderId, setCurrentPharmacyOrderId] = useState<string | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined); // For generic bookings
  const [diagnosticsLabBookingHint, setDiagnosticsLabBookingHint] = useState<{ name?: string; testLabels?: string[] } | null>(null);
  const [selectedHomeServiceType, setSelectedHomeServiceType] = useState<string>('walker'); // For universal home booking: walker | grooming | training | veterinary | behaviourist | sitter | diagnostics
  // Prescription order flow state
  const [prescriptionOrderData, setPrescriptionOrderData] = useState<{
    prescriptionId?: string;
    prescriptionUrl?: string;
    bookingId?: string;
    medications?: any[];
  } | null>(null);
  const { addToCart } = useCart();

  // ✅ Navigate to a screen (push to history)
  const navigateToScreen = (screen: ScreenType) => {
    if (screen === currentScreen) return; // Don't push if already on this screen
    setNavigationHistory(prev => [...prev, screen]);
  };

  // ✅ Wrapper for components that use (screen: string, data?: any) signature
  const handleNavigate = (screen: string, data?: any) => {
    if (screen === 'help') {
      if (typeof window !== 'undefined' && data?.initialTab) {
        try {
          sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, data.initialTab);
        } catch {
          /* ignore */
        }
      }
      navigateToScreen('support_help');
      return;
    }
    if (screen === 'offers' || screen === 'promotions') {
      if (typeof window !== 'undefined') window.location.href = '/promotions';
      return;
    }
    navigateToScreen(screen as ScreenType);
    // Handle data if needed (e.g., set vetServiceData, etc.)
    if (data) {
      if (screen === 'vet-booking' || screen === 'appointment') {
        setVetServiceData(data);
      }
    }
  };

  // Notification Service logic... (kept same as original)
  useNotificationService({
    phone: phone,
    enabled: !!phone,
    onNewNotification: async (notification) => {
      console.log('📬 [CUSTOMER-HOME] Notification received:', notification);
      if (notification.type === 'chat_message' && notification.bookingId) {
        try {
          const data = await apiClient.get(`/bookings/${notification.bookingId}`) as any;
          const booking = data?.booking || data;
          if (booking) {
            setVetServiceData({
              booking: {
                bookingId: booking.id,
                vendorId: booking.vendorId,
                vendorName: booking.vendorName,
                customerPhone: booking.customerPhone
              }
            });
            navigateToScreen('vet');
            toast.success('Opening chat...', { description: `Chat with ${booking.vendorName}`, duration: 2000 });
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
  /** Blue chevron on home pet chip → view/edit pet (not booking sessions quick view). */
  const handlePetClick = (petId: string) => { setSelectedPetId(petId); navigateToScreen('pet-details'); };
  const handleViewPetProfile = (petData: any) => { setSelectedPetData(petData); setSelectedPetId(petData.id); navigateToScreen('pet-profile'); };
  
  const handleViewFullPetProfile = async () => {
    if (!selectedPetId) return;
    try {
      const data = await apiClient.get(`/pets/${selectedPetId}`) as any;
      if (data?.success && data?.pet) {
        handleViewPetProfile(data.pet);
      } else if (data?.pet) {
        handleViewPetProfile(data.pet);
      }
    } catch (error) { console.error('Error loading pet data:', error); }
  };

  const handleAddPet = () => setShowAddPetModal(true);
  const handleAddPetSuccess = () => setRefreshKey(prev => prev + 1);

  const handleNavigateToService = (service: string, data?: any) => {
    if (service === 'walker') navigateToScreen('walker');
    else if (service === 'vet' || service === 'veterinarian') navigateToScreen('vet');
    else if (service === 'grooming') navigateToScreen('grooming');
    else if (service === 'training') navigateToScreen('training');
    else if (service === 'boarding') navigateToScreen('boarding');
    else if (service === 'adoption') navigateToScreen('adoption');
    else if (service === 'sunset') navigateToScreen('sunset');
    else if (service === 'insurance') navigateToScreen('insurance');
    else if (service === 'cafes') navigateToScreen('cafes');
    else if (service === 'shop') navigateToScreen('shop');
    else if (service === 'cart') navigateToScreen('shop'); // Navigate to shop then cart logic handles
    else if (service === 'photography') navigateToScreen('photography');
    else if (service === 'breeder') navigateToScreen('breeder');
    else if (service === 'ambulance') navigateToScreen('ambulance');
    else if (service === 'nutritionist') navigateToScreen('nutritionist');
    else if (service === 'pharmacy' || service === 'pharmacy_store') navigateToScreen('pharmacy');
    else if (service === 'diagnostics' || service === 'lab-diagnostics' || service === 'lab') navigateToScreen('lab-diagnostics');
    else if (service === 'home-service') navigateToScreen('home-service-selection');
    else if (service === 'relocation') navigateToScreen('relocation');
    else if (service === 'resort') navigateToScreen('resort');
    else if (service === 'holiday') navigateToScreen('holiday');
    else if (service === 'mating-dating-hub') navigateToScreen('mating-dating-hub');
    else if (service === 'help' || service === 'support_help') {
      if (typeof window !== 'undefined' && data?.initialTab) {
        try {
          sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, data.initialTab);
        } catch {
          /* ignore */
        }
      }
      navigateToScreen('support_help');
    }
    else if (service === 'offers' || service === 'promotions') {
      if (typeof window !== 'undefined') window.location.href = '/promotions';
    }
    else {
      setSelectedService(service);
      navigateToScreen('home');
    }
  };

  const handleSupportHelpChatbotNavigate = (dest: string, data?: any) => {
    const d = (dest || '').trim();
    if (!d) return;
    if (d.startsWith('/')) {
      router.push(d);
      return;
    }
    handleNavigateToService(d, data);
  };

  const handleVetNavigate = (screen: string, data?: any) => {
    if (screen === 'purchase-package') {
      setWalkerServiceData(data);
      navigateToScreen('package-booking');
      return;
    }
    setVetServiceData(data);
    if (screen === 'vet-booking') navigateToScreen('vet-booking');
    else if (screen === 'vet-doctor-details') navigateToScreen('vet-doctor-details');
    else if (screen === 'vet-clinic-list') navigateToScreen('vet-clinic-list');
    else if (screen === 'vet-clinic-profile') navigateToScreen('vet-clinic-profile');
    else if (screen === 'vet-clinic-booking') navigateToScreen('vet-clinic-booking');
    else if (screen === 'vet-services-by-style') navigateToScreen('vet-services-by-style');
    else if (screen === 'home') { navigateToScreen('home'); setVetServiceData(null); }
  };
  
  const handleWalkerNavigate = (screen: string, data?: any) => {
    setWalkerServiceData(data);
    if (screen === 'walker-booking') navigateToScreen('walker-booking');
    else if (screen === 'purchase-package') navigateToScreen('package-booking');
  };

  const handleAccountNavigate = (path: string) => {
    if (path === 'shop') navigateToScreen('shop');
    else if (path === 'account/orders') navigateToScreen('order_history');
    else if (path === 'account/addresses') navigateToScreen('address_book');
    else if (path === 'account/wallet' || path === 'wallet') navigateToScreen('wallet');
    else if (path === 'rewards-loyalty') navigateToScreen('rewards-loyalty');
    else if (path === 'referral-system') navigateToScreen('referral-system');
    else if (path === 'appointments') navigateToScreen('appointments');
    else if (path === 'support_help' || path === 'help') navigateToScreen('support_help');
    else if (path === 'promotions' || path === 'offers') {
      if (typeof window !== 'undefined') window.location.href = '/promotions';
    }
    else if (path === 'account/settings') toast.info('Settings not available.');
  };

  // Back arrow: go to previous screen in stack; if already at root, go to home
  const handleBack = () => {
    setNavigationHistory(prev => {
      if (prev.length > 1) {
        const next = prev.slice(0, -1);
        const newCurrent = next[next.length - 1];
        if (newCurrent === 'home') {
          setSelectedPetId(null);
          setSelectedBookingId(null);
          setVetServiceData(null);
          setWalkerServiceData(null);
          setSelectedVendorId(undefined);
          setSelectedHomeServiceType('walker');
        }
        return next;
      }
      setSelectedPetId(null);
      setSelectedBookingId(null);
      setVetServiceData(null);
      setWalkerServiceData(null);
      setSelectedVendorId(undefined);
      setSelectedHomeServiceType('walker');
      return ['home'];
    });
  };

  // Go to home and reset stack (for "Back to Home" / "Done" actions)
  const goToHome = () => {
    setCurrentOrderId(null);
    setCurrentPharmacyOrderId(null);
    setSelectedPetId(null);
    setSelectedBookingId(null);
    setVetServiceData(null);
    setWalkerServiceData(null);
    setSelectedVendorId(undefined);
    setSelectedHomeServiceType('walker');
    setPrescriptionOrderData(null);
    setNavigationHistory(['home']);
  };

  const handlePetDeleted = () => {
    setRefreshKey(prev => prev + 1);
    navigateToScreen('home');
    setSelectedPetId(null);
    setSelectedBookingId(null);
  };

  const handlePetProfileComplete = async (pets: any[]) => {
    setRefreshKey(prev => prev + 1);
    navigateToScreen('home');
  };

  const handleViewBooking = (bookingId: string, petId?: string) => {
    setSelectedBookingId(bookingId);
    if (petId) setSelectedPetId(petId);
    setSidebarOpen(false);
    setUserSidebarOpen(false);
    navigateToScreen('my-bookings');
  };

  // ✅ FIX: Handle prescription ordering - Navigate to PharmacyOrderFlow instead of cart
  const handleReorderMedicine = (medications: any[], prescriptionId?: string, bookingId?: string) => {
    console.log('Ordering medicine from prescription:', { medications, prescriptionId, bookingId });
    
    // Set prescription order data for the flow
    setPrescriptionOrderData({
      prescriptionId: prescriptionId,
      bookingId: bookingId,
      medications: medications || [],
    });
    
    // Navigate to pharmacy order flow with broadcast UI
    toast.success('Opening pharmacy order...');
    navigateToScreen('pharmacy_order_flow');
  };

  // RENDER LOGIC
  // ✅ FIX: Use key prop to ensure proper unmounting of components when switching screens
  // This prevents duplicate footer rendering issues during navigation transitions

  if (currentScreen === 'home') {
    return (
      <div key="screen-home">
        <CustomerHome 
          phone={phone}
          refreshKey={refreshKey}
          onNavigate={handleNavigateToService}
          onProfileClick={handleProfileClick}
          onSidebarOpen={() => setSidebarOpen(true)}
          onPetClick={handlePetClick}
          onAddPet={handleAddPet}
          onViewBooking={handleViewBooking}
        />
        {userSidebarOpen && (
          <UserAccountSidebar 
            phone={phone}
            onClose={() => setUserSidebarOpen(false)}
            onViewBooking={handleViewBooking}
            onNavigate={handleAccountNavigate}
          />
        )}
      </div>
    );
  }

  // ... (Existing Render Logic for CustomerProfile, PetProfile, etc.)
  // I will paste the new screens here and keep the existing ones implicitly or explicitly if I knew them all perfectly. 
  // Given the truncation, I'll focus on the modifications and the structure.
  
  // ✅ UPDATED: Customer Profile with navigation
  if (currentScreen === 'customer-profile') return <CustomerProfile phone={phone} onBack={handleBack} onNavigate={handleNavigate} />;
  if (currentScreen === 'pet-profile' && selectedPetData) return <PetProfile phone={phone} petId={selectedPetData.id} petName={selectedPetData.name} petType={selectedPetData.type} petBreed={selectedPetData.breed} petAge={selectedPetData.age} petGender={selectedPetData.gender} petImage={selectedPetData.image} onBack={handleBack} />;
  if (currentScreen === 'booking-details' && selectedBookingId && selectedPetId) return <PetBookingDetails bookingId={selectedBookingId} petId={selectedPetId} phone={phone} onBack={handleBack} onReorderMedicine={handleReorderMedicine} />;
  if (currentScreen === 'pet-quick' && selectedPetId) return <PetQuickView petId={selectedPetId} phone={phone} onBack={handleBack} onViewFullProfile={handleViewFullPetProfile} />;
  if (currentScreen === 'pet-details' && selectedPetId) return <CustomerPetDetails phone={phone} petId={selectedPetId} onBack={handleBack} onViewBooking={handleViewBooking} onDelete={handlePetDeleted} onViewPetProfile={(petData: any) => { setSelectedPetData(petData); navigateToScreen('pet-profile-dashboard'); }} />;
  if (currentScreen === 'pet-profile-dashboard' && selectedPetData)
    return (
      <PetProfileDashboard
        phone={phone}
        petData={selectedPetData}
        onBack={() => {
          setSelectedPetData(null);
          handleBack();
        }}
        onBackToHome={() => {
          setSelectedPetData(null);
          goToHome();
        }}
      />
    );
  if (currentScreen === 'add-pet') return <CustomerPetProfile session={{ phone }} prefillData={null} onComplete={handlePetProfileComplete} onBack={handleBack} />;
  
  // Core Services
  // ✅ FIX: Add keys to service components for proper unmounting during navigation
  if (currentScreen === 'walker') return <WalkerDashboard key="screen-walker" phone={phone} onBack={handleBack} onNavigate={handleWalkerNavigate} data={walkerServiceData} />;
  if (currentScreen === 'walker-booking') return <WalkerService key="screen-walker-booking" phone={phone} onBack={handleBack} />;
  if (currentScreen === 'vet') return <VetServiceRouter key="screen-vet" phone={phone} onBack={handleBack} onNavigate={handleVetNavigate} data={vetServiceData} />;
  if (currentScreen === 'vet-booking') return <VetBookingRouter 
    phone={phone} 
    doctorId={vetServiceData?.doctorId} 
    doctor={vetServiceData?.doctor} 
    selectedService={vetServiceData?.service} 
    serviceType={vetServiceData?.serviceType || 'at_center'}
    serviceStyle={vetServiceData?.serviceStyle || vetServiceData?.serviceType || 'at_center'}
    serviceId={vetServiceData?.serviceId}
    serviceName={vetServiceData?.serviceName}
    price={vetServiceData?.price}
    duration={vetServiceData?.duration}
    vendorId={vetServiceData?.vendorId || vetServiceData?.clinicId}
    clinicId={vetServiceData?.clinicId}
    onBack={handleBack} 
    onNavigate={handleVetNavigate} 
    onViewBooking={handleViewBooking} 
  />;
  if (currentScreen === 'vet-doctor-details') return <VetDoctorDetails phone={phone} doctorId={vetServiceData?.doctorId || ''} onBack={handleBack} onNavigate={handleVetNavigate} />;
  if (currentScreen === 'vet-clinic-list') return <ClinicListView phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'vet-services-by-style') {
      setVetServiceData(data);
      navigateToScreen('vet-services-by-style');
    } else if (screen === 'clinic-details' || screen === 'clinic-profile') {
      setVetServiceData({
        ...data,
        id: data?.id || data?.clinicId,
        clinicProfileBackScreen: data?.clinicProfileBackScreen ?? 'vet-clinic-list',
      });
      navigateToScreen('vet-clinic-profile');
    } else if (screen === 'purchase-package') {
      handleVetNavigate(screen, data);
    } else if (screen === 'appointment' || screen === 'vet-booking') {
      setVetServiceData({
        vendorId: data?.vendorId || data?.clinicId,
        clinicId: data?.clinicId || data?.vendorId,
        vendorName: data?.vendorName,
        serviceType: data?.serviceType || 'at_center',
        serviceStyle: data?.serviceStyle || 'at_center',
        service: data?.service,
        serviceId: data?.serviceId,
        serviceName: data?.serviceName,
        price: data?.price,
        duration: data?.duration,
        clinic: data?.clinic,
      });
      navigateToScreen('vet-booking');
    }
  }} />;
  if (currentScreen === 'vet-clinic-profile') return <ClinicProfileView phone={phone} clinicId={vetServiceData?.id || ''} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'purchase-package') {
      handleVetNavigate(screen, data);
    } else if (screen === 'appointment' || screen === 'vet-booking') {
      setVetServiceData({
        vendorId: data?.clinicId || data?.vendorId || vetServiceData?.id,
        clinicId: data?.clinicId || vetServiceData?.id,
        vendorName: data?.vendorName || vetServiceData?.vendorName,
        serviceType: data?.serviceType || 'at_center',
        serviceStyle: data?.serviceStyle || 'at_center',
        service: data?.service,
        serviceId: data?.serviceId,
        serviceName: data?.serviceName,
        price: data?.price,
        duration: data?.duration,
        clinic: data?.clinic,
      });
      navigateToScreen('vet-booking');
    }
  }} />;
  if (currentScreen === 'vet-clinic-booking') return <VetBookingFlow phone={phone} serviceType={vetServiceData?.serviceType || 'tele'} vendorId={vetServiceData?.vendorId} onBack={handleBack} onNavigate={handleVetNavigate} />;
  if (currentScreen === 'vet-services-by-style')
    return (
      <VetServicesByStyle
        phone={phone}
        vendorId={vetServiceData?.vendorId}
        serviceStyle={vetServiceData?.serviceStyle || 'at_center'}
        serviceTypeName={vetServiceData?.serviceTypeName}
        category={vetServiceData?.category || 'vet'}
        onBack={handleBack}
        onNavigate={handleVetNavigate}
      />
    );
  if (currentScreen === 'grooming') return <GroomingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} />;
  if (currentScreen === 'training') return <TrainingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => { if (screen === 'training_center' || screen === 'training_home') navigateToScreen(screen as ScreenType); else navigateToScreen('home'); }} />;
  if (currentScreen === 'boarding') return <BoardingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => { if (screen === 'boarding-booking') { setSelectedVendorId(data?.vendorId); setSelectedService(data?.serviceType || 'boarding'); navigateToScreen('create-booking'); } else if (screen === 'boarding_facility') navigateToScreen('boarding_facility'); else navigateToScreen('home'); }} />;
  if (currentScreen === 'adoption') return <AdoptionServiceRouter phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'adoption_questionnaire') navigateToScreen('adoption_questionnaire'); else navigateToScreen('home'); }} />;
  if (currentScreen === 'sunset') return <SunsetServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={() => navigateToScreen('home')} />;
  if (currentScreen === 'insurance') return <InsuranceServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'insurance_provider' || screen === 'insurance_policy_purchase') { setSelectedVendorId(data?.vendorId || data?.provider?.id); navigateToScreen('insurance_provider'); } else if (screen === 'pets') navigateToScreen('pets'); else navigateToScreen(screen as ScreenType); }} />;

  // Built flows: user-profile = CustomerProfile; training/boarding/insurance wired to existing components
  if (currentScreen === 'user-profile') return <CustomerProfile phone={phone} onBack={handleBack} onNavigate={(s: string) => navigateToScreen(s as ScreenType)} />;
  const trainingCenterNavigate = (screen: string, data?: any) => {
    if (screen === 'training-booking' || screen === 'booking' || screen === 'create-booking') {
      setVetServiceData({ vendorId: data?.vendorId, serviceType: 'training', serviceStyle: 'at_center', trainer: data?.vendor || data?.trainer, service: data?.service, serviceId: data?.serviceId, selectedServices: data?.selectedServices, vendorName: data?.vendorName, price: data?.price, duration: data?.duration });
      navigateToScreen('training-booking');
    } else handleNavigateToService(screen);
  };
  const trainingHomeNavigate = (screen: string, data?: any) => {
    if (screen === 'training-booking' || screen === 'booking' || screen === 'create-booking') {
      setVetServiceData({ vendorId: data?.vendorId, serviceType: 'training', serviceStyle: 'at_home', trainer: data?.vendor || data?.trainer, service: data?.service, serviceId: data?.serviceId, selectedServices: data?.selectedServices, vendorName: data?.vendorName, price: data?.price, duration: data?.duration });
      navigateToScreen('training-booking');
    } else handleNavigateToService(screen);
  };
  if (currentScreen === 'training_center') return (
    <UniversalServicesByStyle phone={phone} roleId="trainer" serviceStyle="at_center" serviceTypeName="Training Center" category="training" bookingScreen="training-booking" onBack={handleBack} onNavigate={trainingCenterNavigate} />
  );
  if (currentScreen === 'training_home') return (
    <UniversalServicesByStyle phone={phone} roleId="trainer" serviceStyle="at_home" serviceTypeName="At Home Training" category="training" bookingScreen="training-booking" onBack={handleBack} onNavigate={trainingHomeNavigate} />
  );
  if (currentScreen === 'training-booking') return (
    <TrainingBookingRouter phone={phone} vendorId={vetServiceData?.vendorId} trainer={vetServiceData?.trainer} selectedService={vetServiceData?.serviceId} serviceId={vetServiceData?.serviceId} serviceName={vetServiceData?.service?.name} serviceStyle={vetServiceData?.serviceStyle || 'at_center'} selectedServices={vetServiceData?.selectedServices} price={vetServiceData?.price} duration={vetServiceData?.duration} onBack={() => navigateToScreen('training')} onNavigate={(screen, data) => { if (screen === 'my-bookings' && data?.bookingId) handleViewBooking(data.bookingId); else handleNavigateToService(screen); }} onViewBooking={handleViewBooking} />
  );
  if (currentScreen === 'boarding_facility') return <BoardingServiceRouter phone={phone} onBack={() => navigateToScreen('boarding')} onViewBooking={handleViewBooking} onNavigate={(screen, data) => { if (screen === 'boarding-booking') { setSelectedVendorId(data?.vendorId); setSelectedService(data?.serviceType || 'boarding'); navigateToScreen('create-booking'); } else handleNavigateToService(screen); }} />;
  if (currentScreen === 'insurance_provider') return <InsuranceProvider phone={phone} vendorId={selectedVendorId} onBack={() => navigateToScreen('insurance')} onNavigate={(screen) => handleNavigateToService(screen)} />;
  if (currentScreen === 'food') return <NotAvailable label="Food" onBack={handleBack} />;
  
  // ✅ UPDATED LANDING PAGES & FLOWS
  if (currentScreen === 'resort') return <ResortServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'resort_booking') { setSelectedVendorId(data?.vendorId); navigateToScreen('resort_booking'); } }} />;
  if (currentScreen === 'resort_booking') return <ResortBoardingBookingEnhanced phone={phone} preSelectedVendorId={selectedVendorId} onBack={handleBack} onSuccess={() => navigateToScreen('my-bookings')} />;
  
  if (currentScreen === 'cafes') return <PetCafeServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
      if (screen === 'cafe_reservation') { setSelectedVendorId(data?.vendorId); navigateToScreen('cafe_reservation'); }
      else if (screen === 'cafe_detail') { setSelectedVendorId(data?.vendorId); navigateToScreen('cafe_detail'); }
  }} />;
  if (currentScreen === 'cafe_detail') return <PetCafeListingZomatoStyle cafeId={selectedVendorId || ''} onBack={handleBack} />;
  if (currentScreen === 'cafe_reservation') return <CafeReservationFlow phone={phone} preSelectedVendorId={selectedVendorId} onBack={handleBack} />;
  
  if (currentScreen === 'breeder') return <BreederServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'breeder_catalog') navigateToScreen('breeder_catalog'); }} />;
  if (currentScreen === 'breeder_catalog') return <BreederCatalogView phone={phone} onBack={handleBack} />;

  if (currentScreen === 'ambulance') {
    return (
      <AmbulanceServicesLanding
        phone={phone}
        onBack={handleBack}
        onNavigate={(screen) => {
          if (screen === 'ambulance_sos') navigateToScreen('ambulance_sos');
          else if (screen === 'ambulance_schedule' || screen === 'ambulance_transfer') navigateToScreen(screen as ScreenType);
        }}
      />
    );
  }
  if (currentScreen === 'ambulance_sos') return <AmbulanceSOS phone={phone} onBack={handleBack} />;
  if (currentScreen === 'ambulance_schedule') {
    return (
      <AmbulanceSubServiceFlow
        phone={phone}
        mode="schedule"
        onBack={handleBack}
        onSuccess={(id) => handleViewBooking(id)}
      />
    );
  }
  if (currentScreen === 'ambulance_transfer') {
    return (
      <AmbulanceSubServiceFlow
        phone={phone}
        mode="transfer"
        onBack={handleBack}
        onSuccess={(id) => handleViewBooking(id)}
      />
    );
  }
  
  if (currentScreen === 'photography') return <PhotographyServicesLanding phone={phone} onBack={handleBack} onNavigate={() => navigateToScreen('home')} />;
  if (currentScreen === 'relocation') return <RelocationServicesLanding phone={phone} onBack={handleBack} onNavigate={() => navigateToScreen('home')} />;
  
  // Nutritionist: create-booking and pets; other screens → home
  if (currentScreen === 'nutritionist') return <NutritionistServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') { setSelectedService(data?.serviceId || data?.serviceType); setSelectedVendorId(data?.vendorId); navigateToScreen('create-booking'); }
    else if (screen === 'pets') navigateToScreen('pets');
    else navigateToScreen('home');
  }} />;
  if (currentScreen === 'holiday') return <PetHolidayServicesLanding phone={phone} onBack={handleBack} onNavigate={() => navigateToScreen('home')} />;

  // Pharmacy Landing - Entry point: Order medicine (prescription flow) or Shop
  if (currentScreen === 'pharmacy') return <PharmacyServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'pharmacy_order_flow') navigateToScreen('pharmacy_order_flow');
    else if (screen === 'pharmacy_store') navigateToScreen('pharmacy_store'); 
    else if (screen === 'pharmacy_checkout') navigateToScreen('pharmacy_checkout');
  }} />;

  // Lab Diagnostics Landing - Entry point for lab tests and diagnostics
  if (currentScreen === 'lab-diagnostics') return <DiagnosticsServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'lab-booking') {
      if (isLegacyMockDiagnosticVendorId(data?.vendorId)) {
        toast.error('This lab is not available. Refresh the page or pick another lab.');
        return;
      }
      setSelectedVendorId(data?.vendorId);
      setDiagnosticsLabBookingHint(
        data?.packageName || (data?.packageTestLabels && data.packageTestLabels.length)
          ? { name: data?.packageName, testLabels: data?.packageTestLabels ?? [] }
          : null
      );
      navigateToScreen('diagnostics-booking');
    } else if (screen === 'diagnostics-reports') {
      setSelectedBookingId(data?.bookingId);
      navigateToScreen('diagnostics-reports');
    } else if (screen === 'sample-collection-tracking') {
      setSelectedBookingId(data?.bookingId);
      navigateToScreen('sample-collection-tracking');
    }
  }} />;

  // Diagnostics Report Viewer - View and download lab reports
  if (currentScreen === 'diagnostics-reports') {
    if (selectedBookingId) return <DiagnosticsReportViewer 
      bookingId={selectedBookingId} 
      customerPhone={phone} 
      onBack={handleBack} 
      onShareWithVet={(reportId, vetId) => { toast.success('Report shared with vet'); }}
    />;
    return <NotAvailable label="Diagnostics reports" onBack={handleBack} />;
  }

  // Sample Collection Tracker - Track phlebotomist for home collection
  if (currentScreen === 'sample-collection-tracking') {
    if (selectedBookingId) return <SampleCollectionTracker 
      bookingId={selectedBookingId} 
      customerPhone={phone} 
      onBack={handleBack} 
      onComplete={() => { toast.success('Sample collection completed'); handleBack(); }}
    />;
    return <NotAvailable label="Sample collection tracking" onBack={handleBack} />;
  }

  // Diagnostics lab booking (published test catalog + payment) — same flow as wrappers/CustomerHomeWrapper
  if (currentScreen === 'diagnostics-booking' && selectedVendorId) {
    return (
      <DiagnosticsBookingFlow
        vendorId={selectedVendorId}
        customerPhone={phone}
        packageHint={diagnosticsLabBookingHint ?? undefined}
        onBack={() => {
          setDiagnosticsLabBookingHint(null);
          setSelectedVendorId(undefined);
          handleBack();
        }}
        onSuccess={(bookingId) => {
          setDiagnosticsLabBookingHint(null);
          setSelectedVendorId(undefined);
          handleViewBooking(bookingId);
        }}
        onCancel={() => {
          setDiagnosticsLabBookingHint(null);
          setSelectedVendorId(undefined);
          handleBack();
        }}
      />
    );
  }

  // Shop & Orders
  if (currentScreen === 'shop') return <ShopDashboard phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'pharmacy_store') navigateToScreen('pharmacy_store'); else if (screen === 'pharmacy_checkout') navigateToScreen('pharmacy_checkout'); else if (screen === 'product_detail') { setSelectedProduct(data?.product); navigateToScreen('product_detail'); } else if (screen === 'cart') navigateToScreen('cart'); else handleNavigateToService(screen); }} />;
  if (currentScreen === 'product_detail') {
    if (selectedProduct) return <ProductDetailPage product={selectedProduct} onBack={handleBack} onReviewsClick={() => toast.info('Reviews not available.')} onVendorClick={() => toast.info('Vendor profile not available.')} />;
    return <NotAvailable label="Product detail" onBack={handleBack} />;
  }
  if (currentScreen === 'cart') return <ShoppingCartView onBack={handleBack} onNavigateHome={goToHome} onCheckout={() => navigateToScreen('checkout')} onContinueShopping={handleBack} />;
  if (currentScreen === 'checkout') return <CheckoutView phone={phone} onBack={handleBack} onSuccess={(orderId) => { setCurrentOrderId(orderId); navigateToScreen('order_success'); }} />;
  if (currentScreen === 'order_success') {
    if (currentOrderId) return <OrderSuccessView orderId={currentOrderId} onTrackOrder={() => { setSelectedOrder({ id: currentOrderId }); navigateToScreen('order_tracking'); }} onBackToHome={goToHome} onViewOrders={() => { setCurrentOrderId(null); navigateToScreen('order_history'); }} />;
    return <NotAvailable label="Order success" onBack={handleBack} />;
  }
  if (currentScreen === 'order_history') return <OrderHistoryPage onBack={handleBack} onNavigate={handleAccountNavigate} />;
  if (currentScreen === 'address_book')
    return (
      <AddressBookPage
        phone={phone}
        onBack={handleBack}
        onNavigate={handleAccountNavigate}
        layoutVariant="fullscreen"
      />
    );
  if (currentScreen === 'wallet') return <WalletPage onBack={handleBack} onNavigate={handleAccountNavigate} />;
  // if (currentScreen === 'order_history') return <OrderHistoryView phone={phone} onBack={handleBack} onOrderClick={(order) => { setSelectedOrder(order); navigateToScreen('order_detail'); }} />;
  if (currentScreen === 'order_detail') {
    if (selectedOrder) return <OrderDetailView order={selectedOrder} onBack={handleBack} onTrackOrder={() => navigateToScreen('order_tracking')} onReorder={() => { toast.success('Items added to cart'); navigateToScreen('shop'); }} onHelp={() => toast.info('Support not available.')} />;
    return <NotAvailable label="Order detail" onBack={handleBack} />;
  }
  if (currentScreen === 'order_tracking') {
    if (selectedOrder) return <OrderTrackingPage orderId={selectedOrder.id || selectedOrder.orderId} onBack={handleBack} />;
    return <NotAvailable label="Order tracking" onBack={handleBack} />;
  }
  
  if (currentScreen === 'pharmacy_store') return <PharmacyStore onBack={handleBack} onNavigate={(screen) => { if (screen === 'pharmacy_checkout') navigateToScreen('pharmacy_checkout'); }} />;
  if (currentScreen === 'pharmacy_checkout') return <PharmacyCheckout phone={phone} onBack={handleBack} onSuccess={(orderId) => { setCurrentPharmacyOrderId(orderId || null); navigateToScreen('pharmacy_order_status'); }} />;
  if (currentScreen === 'pharmacy_order_status') {
    if (currentPharmacyOrderId) return <PharmacyOrderStatus orderId={currentPharmacyOrderId} phone={phone} onBack={() => { setCurrentPharmacyOrderId(null); handleBack(); }} />;
    return <NotAvailable label="Pharmacy order status" onBack={handleBack} />;
  }
  
  // ✅ Pharmacy Order Flow: prescription → address → broadcast (5/10/20km, expand every 2 min) → pharmacy accept → invoice → pay → OTP → track
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
        navigateToScreen('pharmacy_order_status');
      }}
    />
  );

  // Other Screens - onNavigate wires View Lab Reports / Track Sample Collection from booking detail
  if (currentScreen === 'my-bookings') return <MyBookings phone={phone} onBack={handleBack} initialBookingId={selectedBookingId || undefined} onReorderMedicine={handleReorderMedicine} onNavigate={(screen, data) => {
    if (screen === 'booking-details' && data?.bookingId) handleViewBooking(data.bookingId);
    else if (screen === 'diagnostics-reports' && data?.bookingId) { setSelectedBookingId(data.bookingId); navigateToScreen('diagnostics-reports'); }
    else if (screen === 'sample-collection-tracking' && data?.bookingId) { setSelectedBookingId(data.bookingId); navigateToScreen('sample-collection-tracking'); }
    else handleNavigateToService(screen);
  }} />;
  if (currentScreen === 'appointments') return <AppointmentsList phone={phone} onBack={handleBack} onSelectAppointment={(appointmentId) => { setSelectedAppointmentId(appointmentId); navigateToScreen('appointment-details'); }} />;
  if (currentScreen === 'appointment-details') {
    if (selectedAppointmentId) return <AppointmentDetailsView appointmentId={selectedAppointmentId} phone={phone} onBack={() => navigateToScreen('appointments')} onReschedule={(appointmentId) => { setSelectedAppointmentId(appointmentId); navigateToScreen('appointment-reschedule'); }} onCancel={() => { setSelectedAppointmentId(null); navigateToScreen('appointments'); }} />;
    return <NotAvailable label="Appointment details" onBack={handleBack} />;
  }
  if (currentScreen === 'appointment-reschedule') {
    if (selectedAppointmentId) return <RescheduleAppointmentView appointmentId={selectedAppointmentId} phone={phone} onBack={() => navigateToScreen('appointment-details')} onSuccess={() => { navigateToScreen('appointment-details'); toast.success('Rescheduled successfully'); }} />;
    return <NotAvailable label="Appointment reschedule" onBack={handleBack} />;
  }
  
  // if (currentScreen === 'wallet') return <WalletView phone={phone} onBack={handleBack} />;
  if (currentScreen === 'category-mapper') return <ProblemCategoryMapper onBack={handleBack} />;
  
  // ✅ NEW: Adoption Questionnaire
  if (currentScreen === 'adoption_questionnaire') return <AdoptionQuestionnaire onBack={handleBack} onComplete={() => { toast.success('Preferences saved'); handleBack(); }} />;

  // ✅ NEW: Services Browser
  if (currentScreen === 'services') return <CustomerServicesPage onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'create-booking') { 
      setSelectedService(data?.serviceId);
      setSelectedVendorId(data?.vendorId);
      navigateToScreen('create-booking');
    } else {
      handleNavigateToService(screen);
    }
  }} />;

  // ✅ NEW: Bookings List
  if (currentScreen === 'bookings') return <CustomerBookingsPage phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'booking-details') handleViewBooking(data.bookingId);
    else if (screen === 'services') navigateToScreen('services');
  }} />;

  // ✅ NEW: Create Booking
  if (currentScreen === 'create-booking') return <CreateBookingPage phone={phone} serviceId={selectedService} vendorId={selectedVendorId} onBack={handleBack} onSuccess={(bookingId) => handleViewBooking(bookingId)} />;

  // ✅ NEW: Pets
  if (currentScreen === 'pets') return <CustomerPetsPage 
    phone={phone} 
    onBack={handleBack} 
    onNavigate={(screen, data) => {
      if (screen === 'pet-details') {
         setSelectedPetId(data?.petId);
         navigateToScreen('pet-details');
      }
    }} 
    onAddPet={() => setShowAddPetModal(true)} 
  />;

  // ✅ P2 CUSTOMER APP ENHANCEMENTS - Recently Developed Features

  // Multi-Pet Booking
  if (currentScreen === 'multi-pet-booking') return <MultiPetBookingPage 
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
    onCancel={handleBack}
  />;

  // Return Request
  if (currentScreen === 'return-request') {
    if (selectedOrder) return <ReturnRequestPage
      customerPhone={phone}
      customerId={phone}
      orderId={selectedOrder.id}
      onBack={handleBack}
    />;
    return <NotAvailable label="Return request" onBack={handleBack} />;
  }

  // Rewards & Loyalty
  if (currentScreen === 'rewards-loyalty') return <RewardsLoyaltyPage
    customerPhone={phone}
    onBack={handleBack}
  />;

  // Referral System
  if (currentScreen === 'referral-system') return <ReferralSystemPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
  />;

  // Package Booking (includes purchase-package from WalkerService via same screen + walkerServiceData)
  if (currentScreen === 'package-booking') {
    const walkSession = walkerServiceData?.walkSession ?? null;
    const w = walkerServiceData;
    const vendorPackageIntent =
      w?.vendorServiceId && w?.vendorId
        ? {
            vendorId: String(w.vendorId),
            vendorServiceId: String(w.vendorServiceId),
            serviceName: String(w.serviceName || 'Package'),
            totalSessions: Math.max(1, Number(w.totalSessions) || 1),
            price: Number(w.price) || 0,
            duration: w.duration != null ? Number(w.duration) : 60,
            serviceType: w.serviceType ? String(w.serviceType) : undefined,
            serviceStyle: w.serviceStyle ? String(w.serviceStyle) : undefined,
            description: w.description != null ? String(w.description) : undefined,
            vendorName: w.walker?.name || w.vendorName,
          }
        : null;
    return (
      <PackageBookingPage
        customerPhone={phone}
        customerId={phone}
        petId={selectedPetId || undefined}
        vendorPackageIntent={vendorPackageIntent}
        walkSessionIntent={walkSession}
        onContinueToChooseWalker={
          walkSession
            ? () => {
                setWalkerServiceData({ pendingWalkSession: walkSession });
                navigateToScreen('walker');
              }
            : undefined
        }
        onBack={() => {
          setWalkerServiceData(null);
          handleBack();
        }}
      />
    );
  }

  // Emergency Booking
  if (currentScreen === 'support_help')
    return (
      <SupportHelpCenter
        phone={phone}
        onBack={handleBack}
        onChatbotNavigate={handleSupportHelpChatbotNavigate}
      />
    );

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
  if (currentScreen === 'medical-records') {
    if (selectedPetId) return <MedicalRecordsPage
      phone={phone}
      petId={selectedPetId}
      onBack={handleBack}
    />;
    return <NotAvailable label="Medical records" onBack={handleBack} />;
  }

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
  if (currentScreen === 'integrated-services') return <IntegratedServicesHub onBack={handleBack} onNavigate={handleNavigateToService} />;

  if (currentScreen === 'home-service-selection') return <HomeServiceSelectionEnhanced
    customerPhone={phone}
    customerId={phone}
    petId={selectedPetId || undefined}
    onBack={handleBack}
    onNavigate={(screen, data) => {
      if (screen === 'create-booking' && data?.homeService) {
        // Map HomeServiceSelectionEnhanced ids to UniversalHomeServiceRouter HomeServiceType
        const map: Record<string, string> = { vet: 'veterinary', walking: 'walker', sitting: 'sitter' };
        const serviceType = (map[data?.serviceType || data?.serviceId] || data?.serviceType || data?.serviceId || 'walker') as 'walker' | 'grooming' | 'training' | 'veterinary' | 'behaviourist' | 'sitter' | 'diagnostics';
        setSelectedHomeServiceType(serviceType);
        setSelectedVendorId(data?.vendorId);
        navigateToScreen('universal-home-booking');
      } else if (screen === 'create-booking') {
        setSelectedService(data?.serviceType ?? data?.serviceId);
        setSelectedVendorId(data?.vendorId);
        navigateToScreen('create-booking');
      }
    }}
    onSuccess={(bookingId) => bookingId && handleViewBooking(bookingId)}
  />;

  // Full home service flow: provider list → profile → slots → pet → address → pay
  if (currentScreen === 'universal-home-booking') return (
    <UniversalHomeServiceRouter
      phone={phone}
      serviceType={selectedHomeServiceType as 'walker' | 'grooming' | 'training' | 'veterinary' | 'behaviourist' | 'sitter' | 'diagnostics'}
      preSelectedVendorId={selectedVendorId}
      onBack={handleBack}
      onNavigate={(screen, data) => {
        if (screen === 'my-bookings' && data?.bookingId) handleViewBooking(data.bookingId);
      }}
      onViewBooking={handleViewBooking}
    />
  );

  return <NotAvailable onBack={handleBack} />;
}