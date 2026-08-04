'use client';

import { useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useCustomerShellAnalytics } from '@/hooks/useCustomerShellAnalytics';
import { setClientShellScreenForErrors } from '@/lib/client-error-reporting';
import dynamic from 'next/dynamic';
import { NotAvailable } from '../NotAvailable';
import { CustomerScreenWrapper } from '../CustomerScreenWrapper';
import { SERVICE_CONFIGS } from '@/lib/home/service-configs';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
  isPackagePurchaseTransitScreen,
  markSkipPackageAutoRedirect,
  stripPackagePurchaseOverlayFields,
} from '@/lib/vendor-package-purchase-nav';
import { pickWalkerVendorId } from '@warmpawz/shared-types';
import { normalizeBoardingServiceSlug } from '@/lib/boarding-service-types';
import type { VendorProfileFromProblemContext } from '../ProblemGridFlowRouter';
import { apiClient } from '@/lib/api-client';
import { readCachedPetsFromStorage, readCachedProfileName } from '../home/hooks/useHomePageData';
import {
  ensureCustomerProfileAndPets,
  getHomeBootstrapReady,
  readCachedCustomerPets,
  readCachedCustomerProfile,
} from '@/lib/customer-home-bootstrap';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import {
  registerMealShellTrack,
  unregisterMealShellTrack,
} from '@/lib/meal-shell-track-bridge';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { isEmergencyProblemTileLocked } from '@/lib/problem-grid-emergency-lock';
import { readProfileCompleted, readOnboardingCompleted } from '@/lib/customer-flow-guards';
import {
  WARMPAWZ_HOME_RESUME_SCREENS,
  WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY,
  consumeOpenAccountMenuAfterNav,
  rememberMyPackagesBackFromAccountMenu,
  rememberPromotionsBackSpaScreen,
  rememberAccountSidebarActiveView,
  rememberShopBackToSpaScreen,
  clearShopBackIntent,
  clearWishlistOpenedFromShopMark,
  rememberHelpBackSpaScreen,
} from '@/lib/go-back-or-replace';
import {
  navigateToArticleFromHome,
  navigateToArticlesList,
} from '@/lib/articles-back-nav';
import { useShellNavigationStack, popShellEntry } from '@/lib/navigation/shell-stack';
import {
  resolveAccountHubRootBack,
  resolveWalletHubChildBack,
  WALLET_HUB_CHILDREN,
} from '@/lib/navigation/account-shell-back';
import { createShellNavigationService } from '@/lib/navigation/shell-navigation-service';
import {
  completeEmbeddedCheckoutSuccess,
  completeEmbeddedCheckoutViewOrders,
  createCustomerNavigation,
} from '@/lib/navigation/navigation-service';
import { routeKey } from '@/lib/navigation/route-registry';
import {
  consumeMealTrackSupportBack,
  MEAL_TRACK_RESUME_BACK_SCREEN_KEY,
  MEAL_TRACK_RESUME_ORDER_ID_KEY,
  rememberMealTrackSupportBack,
} from '@/lib/meal-order-tracking-nav';
import {
  clearBoardingProfileContext,
  peekBoardingProfileContext,
  rememberBoardingProfileContext,
  vendorIdFromRouteKey,
} from '@/lib/boarding-profile-nav';
import {
  clearProviderProfileContext,
  peekProviderProfileContext,
  rememberProviderProfileContext,
} from '@/lib/provider-profile-nav';
import {
  syncIosShellScreenReplace,
  syncIosShellStackDepth,
} from '@/lib/navigation/ios-shell-history';
import { resolveServiceBookingCommerceRouteForNavigation } from '@/lib/commerce-switch-routing';
import {
  BACK_HANDLER_PRIORITY,
  registerBackHandler,
} from '@/lib/navigation/back-handler-registry';
import { registerLeaveGuard, requestLeave } from '@/lib/navigation/leave-guard';
import {
  consumeHomeVisitWizardSnapshot,
  consumeTeleWizardSnapshot,
  type HomeVisitWizardSnapshot,
  type TeleWizardSnapshot,
} from '@/lib/navigation/wizard-session-state';
import {
  SUPPORT_INITIAL_TAB_KEY,
  readSupportBookingContext,
  readSupportMealOrderContext,
  resolveSupportContactContext,
  storeSupportMealOrderContext,
} from '@/lib/support-contact';
import { buildTeleInstantAutoPayBookingUrl } from '@/lib/tele-direct-booking';
import {
  isBannerNavigationPayload,
  mergeBannerNavigationPayload,
  getBannerReturnScreen,
} from '@/lib/banner-navigation-origin';
import type { InitialBannerNavigation } from '@/lib/banner-cta-navigation';
import {
  getWebCustomerVendorStyleListingNavTarget,
  normalizeLegacyVetVendorProfilePayload,
} from '@/lib/customer-vendor-profile-navigation';
import { pickCustomerVendorAccountId, firstNonEmptyString } from '@warmpawz/shared-types';
import { useNotificationService } from '../useNotificationService';
import { EcommerceRouteRedirect } from '@/components/ecommerce/EcommerceRouteRedirect';
import { ProfileOrdersRedirect } from '@/components/ecommerce/ProfileOrdersRedirect';
import {
  CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE,
  isCustomerEcommerceEnabled,
  isCustomerEcommerceScreen,
} from '@/lib/customer-ecommerce-flag';
import {
  isLoyaltyUiVisibleForAccount,
  isReviewBlockedScreen,
  isShopUiVisibleForAccount,
} from '@/lib/app-review-demo-account';
import { ReviewDemoShellRedirect } from '@/lib/app-review-demo-route-guard';
import { isLegacyMockDiagnosticVendorId } from '@/lib/diagnostics-vendor-id';
import { useCart } from '@/context/CartContext';
import { useCustomerBookingMessagesModal } from '../messaging/CustomerBookingMessagesModalProvider';
import { isNewHomeUiEnabled } from '@/lib/customer-new-home-ui-flag';
import { gateStyleLaunchScreenNavigation, resolveStyleLaunchTargetForScreen } from '@/lib/customer-style-screen-launch';
import { openVendorProfileChat } from '@/lib/open-vendor-profile-chat';

// ============================================================================
// Lazy-loaded shell screens
// ============================================================================
const LoadingSpinner = () => (
  <div className="flex min-h-[200px] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-500" />
  </div>
);

const CustomerHome = dynamic(
  () =>
    import('../homepage/CustomerHomeComplete').then((m) => ({ default: m.CustomerHomeComplete })),
  { loading: LoadingSpinner, ssr: false }
);

const UserAccountSidebar = dynamic(
  () => import('../UserAccountSidebar').then((m) => ({ default: m.UserAccountSidebar })),
  { ssr: false }
);

const CustomerPetDetails = dynamic(() => import('../CustomerPetDetails').then((m) => ({ default: m.CustomerPetDetails })), { loading: LoadingSpinner });
const EnhancedAddPetModal = dynamic(() => import('../EnhancedAddPetModal').then((m) => ({ default: m.EnhancedAddPetModal })), { loading: LoadingSpinner, ssr: false });
const WalkerService = dynamic(() => import('../WalkerService').then((m) => ({ default: m.WalkerService })), { loading: LoadingSpinner });
const WalkerDashboard = dynamic(() => import('../walker/WalkerDashboard').then((m) => ({ default: m.WalkerDashboard })), { loading: LoadingSpinner });
const WalkerBookingRouter = dynamic(() => import('../walker/WalkerBookingRouter').then((m) => ({ default: m.WalkerBookingRouter })), { loading: LoadingSpinner });
const WalkLiveTrackingView = dynamic(() => import('../walker/WalkLiveTrackingView').then((m) => ({ default: m.WalkLiveTrackingView })), { loading: LoadingSpinner });
const CustomerSidebar = dynamic(() => import('../CustomerSidebar').then((m) => ({ default: m.CustomerSidebar })), { loading: LoadingSpinner });
const PetBookingDetails = dynamic(() => import('../PetBookingDetails').then((m) => ({ default: m.PetBookingDetails })), { loading: LoadingSpinner });
const PetQuickView = dynamic(() => import('../PetQuickView').then((m) => ({ default: m.PetQuickView })), { loading: LoadingSpinner });
const AddPetModal = dynamic(() => import('../AddPetModal').then((m) => ({ default: m.AddPetModal })), { loading: LoadingSpinner });
const VetServiceRouter = dynamic(() => import('../VetServiceRouter').then((m) => ({ default: m.VetServiceRouter })), { loading: LoadingSpinner });
const VetBookingFlow = dynamic(() => import('../vet/VetBookingFlow').then((m) => ({ default: m.VetBookingFlow })), { loading: LoadingSpinner });
const VetBookingRouter = dynamic(() => import('../vet/VetBookingRouter').then((m) => ({ default: m.VetBookingRouter })), { loading: LoadingSpinner });
const VetDoctorDetails = dynamic(() => import('../vet/VetDoctorDetails').then((m) => ({ default: m.VetDoctorDetails })), { loading: LoadingSpinner });
const ClinicListView = dynamic(() => import('../vet/ClinicListView').then((m) => ({ default: m.ClinicListView })), { loading: LoadingSpinner });
const ClinicProfileView = dynamic(() => import('../vet/ClinicProfileView').then((m) => ({ default: m.ClinicProfileView })), { loading: LoadingSpinner });
const VetServicesByStyle = dynamic(() => import('../vet/VetServicesByStyle').then((m) => ({ default: m.VetServicesByStyle })), { loading: LoadingSpinner });
const TeleConsultationRouter = dynamic(() => import('../vet/TeleConsultationRouter').then((m) => ({ default: m.TeleConsultationRouter })), { loading: LoadingSpinner, ssr: false });
const HomeVisitRouter = dynamic(() => import('../vet/HomeVisitRouter').then((m) => ({ default: m.HomeVisitRouter })), { loading: LoadingSpinner });
const UniversalPaymentPage = dynamic(() => import('../payment/UniversalPaymentPage').then((m) => ({ default: m.UniversalPaymentPage })), { loading: LoadingSpinner });
const GroomingServiceRouter = dynamic(() => import('../GroomingServiceRouter').then((m) => ({ default: m.GroomingServiceRouter })), { loading: LoadingSpinner });
const GroomingServicesByStyle = dynamic(() => import('../grooming/GroomingServicesByStyle').then((m) => ({ default: m.GroomingServicesByStyle })), { loading: LoadingSpinner });
const TrainingServiceRouter = dynamic(() => import('../TrainingServiceRouter').then((m) => ({ default: m.TrainingServiceRouter })), { loading: LoadingSpinner });
const GroomingBookingRouter = dynamic(() => import('../grooming/GroomingBookingRouter').then((m) => ({ default: m.GroomingBookingRouter })), { loading: LoadingSpinner });
const UniversalServicesByStyle = dynamic(() => import('../shared/UniversalServicesByStyle').then((m) => ({ default: m.UniversalServicesByStyle })), { loading: LoadingSpinner });
const BoardingServiceRouter = dynamic(() => import('../BoardingServiceRouter').then((m) => ({ default: m.BoardingServiceRouter })), { loading: LoadingSpinner });
const BoardingBookingRouter = dynamic(() => import('../boarding/BoardingBookingRouter').then((m) => ({ default: m.BoardingBookingRouter })), { loading: LoadingSpinner });
const BoardingVendorListView = dynamic(() => import('../boarding/BoardingVendorListView').then((m) => ({ default: m.BoardingVendorListView })), { loading: LoadingSpinner });
const PetSittingVendorListView = dynamic(() => import('../boarding/PetSittingVendorListView').then((m) => ({ default: m.PetSittingVendorListView })), { loading: LoadingSpinner });
const BoardingVendorProfileView = dynamic(() => import('../boarding/BoardingVendorProfileView').then((m) => ({ default: m.BoardingVendorProfileView })), { loading: LoadingSpinner });
const HomeServiceProviderProfile = dynamic(() => import('../home-services/HomeServiceProviderProfile').then((m) => ({ default: m.HomeServiceProviderProfile })), { loading: LoadingSpinner });
const PetSitterServiceRouter = dynamic(() => import('../PetSitterServiceRouter').then((m) => ({ default: m.PetSitterServiceRouter })), { loading: LoadingSpinner });
const AdoptionServiceRouter = dynamic(() => import('../AdoptionServiceRouter').then((m) => ({ default: m.AdoptionServiceRouter })), { loading: LoadingSpinner });
const SunsetServiceRouter = dynamic(() => import('../SunsetServiceRouter').then((m) => ({ default: m.SunsetServiceRouter })), { loading: LoadingSpinner });
const CustomerProfileView = dynamic(() => import('../CustomerProfileView').then((m) => ({ default: m.CustomerProfileView })), { loading: LoadingSpinner });
const PetProfile = dynamic(() => import('../PetProfile').then((m) => ({ default: m.PetProfile })), { loading: LoadingSpinner });
const PetProfileDashboard = dynamic(() => import('../PetProfileDashboard').then((m) => ({ default: m.PetProfileDashboard })), { loading: LoadingSpinner });
const InsuranceServicesLanding = dynamic(() => import('../InsuranceServicesLanding').then((m) => ({ default: m.InsuranceServicesLanding })), { loading: LoadingSpinner });
const InsuranceProvider = dynamic(() => import('../insurance/InsuranceProvider').then((m) => ({ default: m.InsuranceProvider })), { loading: LoadingSpinner });
const PetCafeServicesLanding = dynamic(() => import('../PetCafeServicesLanding').then((m) => ({ default: m.PetCafeServicesLanding })), { loading: LoadingSpinner });
const PharmacyServicesLanding = dynamic(() => import('../PharmacyServicesLanding').then((m) => ({ default: m.PharmacyServicesLanding })), { loading: LoadingSpinner });
const PharmacyStore = dynamic(() => import('../PharmacyStore').then((m) => ({ default: m.PharmacyStore })), { loading: LoadingSpinner });
const PharmacyCheckout = dynamic(() => import('../PharmacyCheckout').then((m) => ({ default: m.PharmacyCheckout })), { loading: LoadingSpinner });
const PhotographyServicesLanding = dynamic(() => import('../PhotographyServicesLanding').then((m) => ({ default: m.PhotographyServicesLanding })), { loading: LoadingSpinner });
const BreederServicesLanding = dynamic(() => import('../BreederServicesLanding').then((m) => ({ default: m.BreederServicesLanding })), { loading: LoadingSpinner });
const AmbulanceServicesLanding = dynamic(() => import('../AmbulanceServicesLanding').then((m) => ({ default: m.AmbulanceServicesLanding })), { loading: LoadingSpinner });
const RelocationServicesLanding = dynamic(() => import('../RelocationServicesLanding').then((m) => ({ default: m.RelocationServicesLanding })), { loading: LoadingSpinner });
const ResortServicesLanding = dynamic(() => import('../ResortServicesLanding').then((m) => ({ default: m.ResortServicesLanding })), { loading: LoadingSpinner });
const PetHolidayServicesLanding = dynamic(() => import('../PetHolidayServicesLanding').then((m) => ({ default: m.PetHolidayServicesLanding })), { loading: LoadingSpinner });
const ProductDetailPage = dynamic(() => import('../ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })), { loading: LoadingSpinner });
const OrderHistoryPage = dynamic(() => import('../../shop/OrderHistoryPage').then((m) => ({ default: m.OrderHistoryPage })), { loading: LoadingSpinner });
const AddressBookPage = dynamic(() => import('../../shop/AddressBookPage').then((m) => ({ default: m.AddressBookPage })), { loading: LoadingSpinner });
const WalletPage = dynamic(() => import('../../shop/WalletPage').then((m) => ({ default: m.WalletPage })), { loading: LoadingSpinner });
const OrderDetailView = dynamic(() => import('../OrderDetailView').then((m) => ({ default: m.OrderDetailView })), { loading: LoadingSpinner });
const ProductReviewsView = dynamic(() => import('../ProductReviewsView').then((m) => ({ default: m.ProductReviewsView })), { loading: LoadingSpinner });
const VendorProfileDetail = dynamic(() => import('../VendorProfileDetail').then((m) => ({ default: m.VendorProfileDetail })), { loading: LoadingSpinner });
const SupportHelpCenter = dynamic(() => import('../SupportHelpCenter').then((m) => ({ default: m.SupportHelpCenter })), { loading: LoadingSpinner });
const OrderTrackingView = dynamic(() => import('../OrderTrackingView').then((m) => ({ default: m.OrderTrackingView })), { loading: LoadingSpinner });
const ProblemCategoryMapper = dynamic(() => import('../../admin/ProblemCategoryMapper').then((m) => ({ default: m.ProblemCategoryMapper })), { loading: LoadingSpinner });
const MyBookings = dynamic(() => import('../booking/MyBookings').then((m) => ({ default: m.MyBookings })), { loading: LoadingSpinner });
const AppointmentsList = dynamic(() => import('../AppointmentsList').then((m) => ({ default: m.AppointmentsList })), { loading: LoadingSpinner });
const AppointmentDetailsView = dynamic(() => import('../AppointmentDetailsView').then((m) => ({ default: m.AppointmentDetailsView })), { loading: LoadingSpinner });
const RescheduleAppointmentView = dynamic(() => import('../RescheduleAppointmentView').then((m) => ({ default: m.RescheduleAppointmentView })), { loading: LoadingSpinner });
const PetCafeListingZomatoStyle = dynamic(() => import('../PetCafeListingZomatoStyle').then((m) => ({ default: m.PetCafeListingZomatoStyle })), { loading: LoadingSpinner });
const ResortBoardingBookingEnhanced = dynamic(() => import('../ResortBoardingBookingEnhanced').then((m) => ({ default: m.ResortBoardingBookingEnhanced })), { loading: LoadingSpinner });
const CafeReservationFlow = dynamic(() => import('../CafeReservationFlow').then((m) => ({ default: m.CafeReservationFlow })), { loading: LoadingSpinner });
const BreederCatalogView = dynamic(() => import('../BreederCatalogView').then((m) => ({ default: m.BreederCatalogView })), { loading: LoadingSpinner });
const AmbulanceSOS = dynamic(() => import('../AmbulanceSOS').then((m) => ({ default: m.AmbulanceSOS })), { loading: LoadingSpinner });
const AmbulanceSubServiceFlow = dynamic(() => import('../AmbulanceSubServiceFlow').then((m) => ({ default: m.AmbulanceSubServiceFlow })), { loading: LoadingSpinner });
const AdoptionQuestionnaire = dynamic(() => import('../AdoptionQuestionnaire').then((m) => ({ default: m.AdoptionQuestionnaire })), { loading: LoadingSpinner });
const CustomerServicesPage = dynamic(() => import('../CustomerServicesPage').then((m) => ({ default: m.CustomerServicesPage })), { loading: LoadingSpinner });
const CreateBookingPage = dynamic(() => import('../booking/CreateBookingPage').then((m) => ({ default: m.CreateBookingPage })), { loading: LoadingSpinner });
const CustomerPetsPage = dynamic(() => import('../CustomerPetsPage').then((m) => ({ default: m.CustomerPetsPage })), { loading: LoadingSpinner });
const OrderTrackingPage = dynamic(() => import('../../shop/OrderTrackingPage').then((m) => ({ default: m.OrderTrackingPage })), { loading: LoadingSpinner });
const MultiPetBookingPage = dynamic(() => import('../MultiPetBookingPage').then((m) => ({ default: m.MultiPetBookingPage })), { loading: LoadingSpinner });
const ReturnRequestPage = dynamic(() => import('../ReturnRequestPage').then((m) => ({ default: m.ReturnRequestPage })), { loading: LoadingSpinner });
const RewardsLoyaltyPage = dynamic(() => import('../RewardsLoyaltyPage').then((m) => ({ default: m.RewardsLoyaltyPage })), { loading: LoadingSpinner });
const ReferralSystemPage = dynamic(() => import('../ReferralSystemPage').then((m) => ({ default: m.ReferralSystemPage })), { loading: LoadingSpinner });
const PackageBookingPage = dynamic(() => import('../PackageBookingPage').then((m) => ({ default: m.PackageBookingPage })), { loading: LoadingSpinner });
const EmergencyBookingPage = dynamic(() => import('../EmergencyBookingPage').then((m) => ({ default: m.EmergencyBookingPage })), { loading: LoadingSpinner });
const CheckInCheckOutPage = dynamic(() => import('../CheckInCheckOutPage').then((m) => ({ default: m.CheckInCheckOutPage })), { loading: LoadingSpinner });
const MedicalRecordsPage = dynamic(() => import('../MedicalRecordsPage').then((m) => ({ default: m.MedicalRecordsPage })), { loading: LoadingSpinner });
const CustomerWalletPage = dynamic(() => import('../WalletPage').then((m) => ({ default: m.WalletPage })), { loading: LoadingSpinner });
const MatingDatingHub = dynamic(() => import('../MatingDatingHub').then((m) => ({ default: m.MatingDatingHub })), { loading: LoadingSpinner });
const HomeServiceSelectionEnhanced = dynamic(() => import('../HomeServiceSelectionEnhanced'), { loading: LoadingSpinner });
const IntegratedServicesHub = dynamic(() => import('../../IntegratedServicesHub').then((m) => ({ default: m.IntegratedServicesHub })), { loading: LoadingSpinner });
const ProblemGridSelector = dynamic(() => import('../ProblemGridSelector').then((m) => ({ default: m.ProblemGridSelector })), { loading: LoadingSpinner });
const AllServicesScreen = dynamic(() => import('../home/all-services/AllServicesScreen').then((m) => ({ default: m.AllServicesScreen })), { loading: LoadingSpinner });
const CustomerPlacementBanners = dynamic(() => import('../shared/CustomerPlacementBanners').then((m) => ({ default: m.CustomerPlacementBanners })), { loading: LoadingSpinner });
const ServicesByProblem = dynamic(() => import('../ServicesByProblem').then((m) => ({ default: m.ServicesByProblem })), { loading: LoadingSpinner });
const ProblemGridFlowRouter = dynamic(() => import('../ProblemGridFlowRouter').then((m) => ({ default: m.ProblemGridFlowRouter })), { loading: LoadingSpinner });
const MealPlansList = dynamic(() => import('../nutrition/MealPlansList').then((m) => ({ default: m.MealPlansList })), { loading: LoadingSpinner });
const ExpertNutritionistsList = dynamic(() => import('../nutrition/ExpertNutritionistsList').then((m) => ({ default: m.ExpertNutritionistsList })), { loading: LoadingSpinner });
const MealOrderCheckout = dynamic(() => import('../nutrition/MealOrderCheckout').then((m) => ({ default: m.MealOrderCheckout })), { loading: LoadingSpinner });
const MealPlanOrdersPanel = dynamic(() => import('../meal-plans/MealPlanOrdersPanel').then((m) => ({ default: m.MealPlanOrdersPanel })), { loading: LoadingSpinner });
const NutritionistTeleRouter = dynamic(() => import('../nutrition/NutritionistTeleRouter').then((m) => ({ default: m.NutritionistTeleRouter })), { loading: LoadingSpinner });
const NutritionistBookingRouter = dynamic(() => import('../nutrition/NutritionistBookingRouter').then((m) => ({ default: m.NutritionistBookingRouter })), { loading: LoadingSpinner });
const DietConsultationVendors = dynamic(() => import('../nutrition/DietConsultationVendors').then((m) => ({ default: m.DietConsultationVendors })), { loading: LoadingSpinner });
const OrderTrackingScreen = dynamic(() => import('../tracking/OrderTrackingScreen').then((m) => ({ default: m.OrderTrackingScreen })), { loading: LoadingSpinner });
const DiagnosticsServicesLanding = dynamic(() => import('../DiagnosticsServicesLanding').then((m) => ({ default: m.DiagnosticsServicesLanding })), { loading: LoadingSpinner });
const DiagnosticsReportViewer = dynamic(() => import('../diagnostics/DiagnosticsReportViewer').then((m) => ({ default: m.DiagnosticsReportViewer })), { loading: LoadingSpinner });
const SampleCollectionTracker = dynamic(() => import('../diagnostics/SampleCollectionTracker').then((m) => ({ default: m.SampleCollectionTracker })), { loading: LoadingSpinner });
const DiagnosticsBookingFlow = dynamic(() => import('../specialized/DiagnosticsBookingFlow').then((m) => ({ default: m.DiagnosticsBookingFlow })), { loading: LoadingSpinner });
const PharmacyOrderFlow = dynamic(() => import('../specialized/PharmacyOrderFlow').then((m) => ({ default: m.PharmacyOrderFlow })), { loading: LoadingSpinner });
const PharmacyOrderStatus = dynamic(() => import('../pharmacy/PharmacyOrderStatus').then((m) => ({ default: m.PharmacyOrderStatus })), { loading: LoadingSpinner });
const StandardizedHeader = dynamic(() => import('../shared/StandardizedHeader').then((m) => ({ default: m.StandardizedHeader })), { loading: LoadingSpinner });
const TrackingPageClient = dynamic(() => import('@/app/tracking/[bookingId]/TrackingPageClient').then((m) => ({ default: m.TrackingPageClient })), { loading: LoadingSpinner, ssr: false });
const NutritionistServicesLanding = dynamic(() => import('../nutrition/NutritionistServicesLanding').then((m) => ({ default: m.NutritionistServicesLanding })), { loading: LoadingSpinner });
const ChimeVideoCall = dynamic(() => import('../../teleCommunication/ChimeVideoCall'), { ssr: false, loading: LoadingSpinner });
const TrainingBookingRouter = dynamic(() => import('../training/TrainingBookingRouter').then((m) => ({ default: m.TrainingBookingRouter })), { ssr: false, loading: LoadingSpinner });
const UniversalHomeServiceRouter = dynamic(() => import('../home-services/UniversalHomeServiceRouter').then((m) => ({ default: m.UniversalHomeServiceRouter })), { ssr: false, loading: LoadingSpinner });
const TeleConsultationHub = dynamic(() => import('../tele-consultation/TeleConsultationHub').then((m) => ({ default: m.TeleConsultationHub })), { loading: LoadingSpinner });

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
  | 'walker-provider-profile'
  | 'vet'
  | 'category-mapper'
  | 'vet-booking'
  | 'vet-doctor-details'
  | 'vet-clinic-list'
  | 'vet-clinic-profile'
  | 'vet-clinic-booking'
  | 'vet-services-by-style'
  | 'tele-consultation-hub'
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
  | 'pet-sitter-vendors'
  | 'pet-sitter-provider-profile'
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
  | 'package-tracking'
  | 'emergency-booking'
  | 'check-in-out'
  | 'medical-records'
  | 'customer-wallet'
  | 'mating-dating-hub'
  | 'integrated-services'
  | 'home-service-selection'
  | 'universal-home-booking'
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
  | 'meal-plan-orders'
  | 'nutritionist-tele'
  | 'nutritionist-booking'
  | 'diet-consultation-services'
  | 'expert-nutritionists'
  | 'pharmacy_order_flow'
  | 'pharmacy_order_status'
  | 'behaviorist'
  | 'behaviorist-provider-profile'
  | 'instant-connecting';

function customerBoardingProfileVendorIdFromNavigateData(data: unknown): string | undefined {
  if (data == null || typeof data !== 'object') return undefined;
  const d = data as Record<string, unknown>;
  return firstNonEmptyString(d.vendorId, d.vendor_id);
}

/**
 * Coerce walkerServiceData from purchase-package navigations — prod APIs sometimes use snake_case
 * (`vendor_service_id`), and walkers previously stored payloads raw without normalization.
 */
function normalizeWalkerServiceDataForPackagePurchase(data: unknown): Record<string, unknown> | null {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) return null;
  const src = data as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  const vid = firstNonEmptyString(src.vendorId, src.vendor_id, src.doctorId);
  const vsid = firstNonEmptyString(src.vendorServiceId, src.vendor_service_id);
  if (vid) out.vendorId = vid;
  if (vsid) out.vendorServiceId = vsid;
  return out;
}

/** Legacy shell screen `package-tracking` → full URL package progress or My Bookings hub. */
function PackageTrackingShellRedirect() {
  const r = useRouter();
  useEffect(() => {
    r.replace('/bookings');
  }, [r]);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 bg-gray-50 px-6 text-center text-sm text-gray-600">
      <p>Redirecting to My Bookings…</p>
      <p className="text-xs text-gray-400">Use “My packages and tracking” to open session progress.</p>
    </div>
  );
}

export function CustomerHomeWrapper({
  phone,
  onNavigate,
  initialScreen,
  petBoardingVendorId,
  petBoardingServiceSlug,
  initialBannerNavigation,
}: {
  phone: string;
  onNavigate: (screen: string) => void;
  initialScreen?: ScreenType;
  petBoardingVendorId?: string;
  petBoardingServiceSlug?: string;
  initialBannerNavigation?: InitialBannerNavigation;
}) {
  /**
   * Entering shop from these screens must not overwrite the stored return target (nested browse/checkout).
   * Note: `cart` is intentionally excluded so Cart → Shop (e.g. Continue shopping) restores Cart on back.
   */
  const SHOP_SUBFLOW_SCREENS = new Set<ScreenType>([
    'product_detail',
    'product_reviews',
    'vendor_profile',
    'checkout',
    'pharmacy_store',
    'pharmacy_checkout',
  ]);

  const router = useRouter();
  const customerNav = useMemo(() => createCustomerNavigation(router), [router]);
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

  const {
    currentScreen,
    setCurrentScreen,
    resetStack,
    popOrReset,
    replaceTop,
    canPop,
    navigationHistory,
    history,
    setHistory,
  } = useShellNavigationStack<ScreenType>(initialScreen || 'home');

  const shellStackDepthRef = useRef(navigationHistory.length);
  const shellScreenRef = useRef(currentScreen);
  useEffect(() => {
    const prevDepth = shellStackDepthRef.current;
    const nextDepth = navigationHistory.length;
    const prevScreen = shellScreenRef.current;

    if (prevDepth !== nextDepth) {
      syncIosShellStackDepth(prevDepth, nextDepth, currentScreen);
      shellStackDepthRef.current = nextDepth;
    } else if (prevScreen !== currentScreen && pathname === '/') {
      syncIosShellScreenReplace(currentScreen);
    }

    shellScreenRef.current = currentScreen;
  }, [navigationHistory.length, currentScreen, pathname]);

  /** Allyticas: URL + in-app `currentScreen` (e.g. `Home · Vet care` when path is still `/`). */
  useCustomerShellAnalytics(currentScreen, pathname, searchParams);

  useEffect(() => {
    setClientShellScreenForErrors(currentScreen);
    return () => setClientShellScreenForErrors(null);
  }, [currentScreen]);

  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [mealTrackNav, setMealTrackNav] = useState<{
    orderId: string;
    backScreen: ScreenType;
  } | null>(null);
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
  /** `vet` → Diagnostic Labs: header back should return here, not home (set only from `handleVetNavigate` lab path). */
  const [labDiagnosticsReturnScreen, setLabDiagnosticsReturnScreen] = useState<ScreenType | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(undefined); // For generic bookings
  /** Meal plans drill-down: vendor catalog (`GET /meal-plans/vendor/:id`) */
  const [mealPlanVendorFocus, setMealPlanVendorFocus] = useState<{
    vendorId: string;
    vendorSnapshot?: Record<string, unknown>;
  } | null>(null);
  /** Home Services hub → {@link UniversalHomeServiceRouter} (training, walker, grooming at home, etc.). */
  const [selectedHomeServiceType, setSelectedHomeServiceType] = useState<
    'walker' | 'grooming' | 'training' | 'veterinary' | 'behaviourist' | 'sitter' | 'diagnostics'
  >('walker');
  const [diagnosticsPackageHint, setDiagnosticsPackageHint] = useState<{ name?: string; testLabels?: string[] } | null>(null);
  /** Banner CTA flows: any Back returns to home until cleared by handleBack. */
  const bannerReturnHomeRef = useRef(false);
  const initialBannerNavAppliedRef = useRef(false);
  /** Screen to return to when leaving My Pets (embedded list), if opened via navigateToPets */
  /** Pet Sitting hub: back returns here when opened from another in-app screen (not a full `handleBack` reset). */
  const [petSitterOriginScreen, setPetSitterOriginScreen] = useState<ScreenType | null>(null);
  /** Pre-selected sitting tile when opening `pet-sitter-vendors` from hub (same shell as boarding vendor list). */
  const [petSitterFacilityOptionId, setPetSitterFacilityOptionId] = useState<string | null>(null);
  /** Featured / list chevron → full sitter profile (HomeServiceProviderProfile). */
  const [petSitterProfileVendorId, setPetSitterProfileVendorId] = useState<string | null>(null);
  const [selectedAddressFromBook, setSelectedAddressFromBook] = useState<any>(null); // Address selected in address book (return to provider profile)
  const [trackingBookingId, setTrackingBookingId] = useState<string | null>(null); // ✅ GPS Tracking booking ID
  const [videoCallData, setVideoCallData] = useState<{ bookingId: string; meetingId?: string } | null>(null); // ✅ Video call data
  const [instantConnectingBookingId, setInstantConnectingBookingId] = useState<string | null>(null); // Instant tele: after payment, show connecting then video
  /** `?service=tele` / Book Now: skip TeleConsultationRouter mode selection → instant vet list */
  const [teleSkipModeSelection, setTeleSkipModeSelection] = useState(false);
  /** Home → Veterinary Care → "Tele Consult" tile: skip mode selection → scheduled provider list (back returns to home) */
  const [teleSkipToScheduled, setTeleSkipToScheduled] = useState(false);
  /** Home → Veterinary Care → "Vet at Home" tile: deep link into HomeVisitRouter (back returns to home, not vet hub) */
  const [vetHomeFromHome, setVetHomeFromHome] = useState(false);
  /** Home → Veterinary Care → "Clinic Visit" tile: deep link into ClinicListView (back returns to home, not vet hub) */
  const [vetClinicFromHome, setVetClinicFromHome] = useState(false);
  /** Grooming/training style lists: chevron opens embedded vendor profile (`vendorId` on *ServicesByStyle / Universal). */
  const [groomingCenterProfileVendorId, setGroomingCenterProfileVendorId] = useState<string | null>(null);
  const [groomingHomeProfileVendorId, setGroomingHomeProfileVendorId] = useState<string | null>(null);
  const [trainingCenterProfileVendorId, setTrainingCenterProfileVendorId] = useState<string | null>(null);
  const [trainingHomeProfileVendorId, setTrainingHomeProfileVendorId] = useState<string | null>(null);
  /** Problem-grid discovery chevron → full behaviourist profile (HomeServiceProviderProfile). */
  const [behavioristProfileVendorId, setBehavioristProfileVendorId] = useState<string | null>(null);
  /**
   * When true, `training_center` / `training_home` was opened with `embedVendorId` (e.g. hub chevron).
   * Back from embedded profile must return to the Training hub, not the empty by-style list.
   */
  const trainingCenterOpenedWithEmbedRef = useRef(false);
  const trainingHomeOpenedWithEmbedRef = useRef(false);
  /** My Profile from account sidebar: back reopens menu instead of generic handleBack. */
  const profileFromAccountMenuRef = useRef(false);
  /** My Bookings from bottom tab: back pops stack (e.g. to home). From account menu: back reopens sidebar. */
  const bookingsFromAccountMenuRef = useRef(false);
  /** Account hub screens (orders, wallet, appointments) opened from profile menu. */
  const accountHubFromMenuRef = useRef(false);
  /** Rewards/referrals/help opened from wallet tile (belt-and-suspenders if stack parent is wrong). */
  const walletPushedFromWalletRef = useRef(false);
  /** Hardware back delegate for nested profile overlay views. */
  const overlayBackRef = useRef<(() => boolean) | null>(null);
  const groomingBookingInternalBackRef = useRef<(() => void) | null>(null);
  const trainingBookingInternalBackRef = useRef<(() => void) | null>(null);
  const vetBookingInternalBackRef = useRef<(() => void) | null>(null);
  const nutritionistBookingInternalBackRef = useRef<(() => void) | null>(null);
  const packageBookingInternalBackRef = useRef<(() => void) | null>(null);
  const supportHelpInternalBackRef = useRef<(() => void) | null>(null);
  const teleInternalBackRef = useRef<(() => void) | null>(null);
  const homeVisitInternalBackRef = useRef<(() => void) | null>(null);
  const walkerBookingInternalBackRef = useRef<(() => void) | null>(null);
  const boardingBookingInternalBackRef = useRef<(() => void) | null>(null);
  const diagnosticsBookingInternalBackRef = useRef<(() => void) | null>(null);
  const handleMyBookingsBackRef = useRef<() => void>(() => {});
  const handleCustomerProfileBackRef = useRef<() => void>(() => {});
  const handleAccountHubBackRef = useRef<() => void>(() => {});
  const handleShellAccountBackRef = useRef<() => void>(() => {});
  const currentScreenForBackRef = useRef(currentScreen);
  currentScreenForBackRef.current = currentScreen;
  /** After opening grooming/training style hub from problem-grid discovery, full back returns here instead of the service hub. */
  const [returnToProblemGridFromStyleHub, setReturnToProblemGridFromStyleHub] = useState(false);
  /**
   * The specialization slug (e.g. "bath_only", "vaccination") from the most recently tapped problem tile.
   * Passed to all discovery screens so specialization is preserved even when the user reaches them outside
   * of ProblemGridFlowRouter (e.g. grooming hub → At Salon tile).
   * Cleared when the user navigates directly to a hub or home without a problem context.
   */
  const [problemGridSpecialization, setProblemGridSpecialization] = useState<string | undefined>(undefined);
  /** Problem grid → boarding vendor profile when URL props do not supply `petBoardingVendorId`. */
  const [problemFlowBoardingVendorId, setProblemFlowBoardingVendorId] = useState<string | null>(null);
  const [problemFlowBoardingSlug, setProblemFlowBoardingSlug] = useState<string | null>(null);
  /** Boarding hub / vendor list chevron → profile while staying in the home shell (`onNavigate`). */
  const [embeddedBoardingProfileVendorId, setEmbeddedBoardingProfileVendorId] = useState<string | null>(null);
  const [embeddedBoardingProfileSlug, setEmbeddedBoardingProfileSlug] = useState<string | null>(null);
  /**
   * Boarding hub “Boarding Options” / View all → `pet-boarding-vendors` without full-page navigation.
   * Deep links still use `petBoardingServiceSlug` from `CustomerApp` props when URL is `/pet-boarding/vendors`.
   */
  const [spaBoardingVendorsSlug, setSpaBoardingVendorsSlug] = useState<string | null>(null);
  /** Where to return when leaving embedded `pet-boarding-vendors` (SPA); avoids `previousScreen` being overwritten by booking flows. */
  const [boardingVendorsReturnScreen, setBoardingVendorsReturnScreen] = useState<'boarding' | 'boarding_facility' | null>(null);
  const [prescriptionOrderData, setPrescriptionOrderData] = useState<{ prescriptionId?: string; prescriptionUrl?: string } | null>(null); // ✅ Pharmacy order from My Bookings prescription
  const [currentPharmacyOrderId, setCurrentPharmacyOrderId] = useState<string | null>(null); // ✅ After PharmacyOrderFlow completes
  const [teleWizardRestore, setTeleWizardRestore] = useState<TeleWizardSnapshot | null>(null);
  const [homeVisitWizardRestore, setHomeVisitWizardRestore] = useState<HomeVisitWizardSnapshot | null>(null);
  const { addToCart } = useCart();
  const { openMessages, openBookingChat } = useCustomerBookingMessagesModal();

  // ✅ FIX: User profile state for consistent header display
  const [userName, setUserName] = useState<string>(() => readCachedProfileName(phone).name);
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(
    () => readCachedProfileName(phone).photo
  );
  const [pets, setPets] = useState<any[]>(() => readCachedPetsFromStorage());
  const [selectedPet, setSelectedPet] = useState<any | null>(() => {
    const cached = readCachedPetsFromStorage();
    return cached[0] ?? null;
  });

  /** Clear transient drill-down state when landing on home or popping to root. */
  const clearShellTransientState = useCallback(() => {
    setSelectedPetId(null);
    setSelectedBookingId(null);
    setVetServiceData(null);
    setWalkerServiceData(null);
    setSelectedVendorId(undefined);
    setSelectedProblem(null);
    setCurrentServiceType(null);
    setProblemGridSpecialization(undefined);
  }, []);

  const shellNav = useMemo(
    () =>
      createShellNavigationService<ScreenType>({
        currentScreen,
        history,
        setCurrentScreen,
        setHistory,
        resetStack,
        popOrReset,
        replaceTop,
        onBeforeBack: () => {
          bannerReturnHomeRef.current = false;
          setUserSidebarOpen(false);
          setPetSitterOriginScreen(null);
          setPetSitterFacilityOptionId(null);
          setSpaBoardingVendorsSlug(null);
          setBoardingVendorsReturnScreen(null);
          setLabDiagnosticsReturnScreen(null);
        },
        onResetHome: () => {
          clearShellTransientState();
        },
      }),
    [
      currentScreen,
      history,
      setCurrentScreen,
      setHistory,
      resetStack,
      popOrReset,
      replaceTop,
      clearShellTransientState,
    ],
  );

  /** Reset shell stack to home and clear cross-route shop intents (tab Home / Done actions). */
  const goToHome = useCallback(() => {
    bannerReturnHomeRef.current = false;
    clearShopBackIntent();
    setUserSidebarOpen(false);
    setPetSitterOriginScreen(null);
    setPetSitterFacilityOptionId(null);
    setSpaBoardingVendorsSlug(null);
    setBoardingVendorsReturnScreen(null);
    setLabDiagnosticsReturnScreen(null);
    shellNav.resetTo('home');
  }, [shellNav]);

  /** Forward navigation — registry-driven policy (hub focus-root, entity push, overlay replace). */
  const navigateToScreen = useCallback(
    (screen: ScreenType, key?: string) => {
      const target = screen === 'bookings' ? 'my-bookings' : screen;
      shellNav.navigateToScreen(target, key);
    },
    [shellNav],
  );

  const openEmbeddedPetBoardingProfile = useCallback(
    (vendorId: string, slug: string | null) => {
      const bid = String(vendorId || '').trim();
      if (!bid) return;
      const normalizedSlug = normalizeBoardingServiceSlug(slug);
      setProblemFlowBoardingVendorId(null);
      setProblemFlowBoardingSlug(null);
      setEmbeddedBoardingProfileVendorId(bid);
      setEmbeddedBoardingProfileSlug(normalizedSlug);
      rememberBoardingProfileContext(bid, normalizedSlug);
      navigateToScreen('pet-boarding-profile', routeKey.vendor(bid));
    },
    [navigateToScreen],
  );

  const openProblemFlowPetBoardingProfile = useCallback(
    (vendorId: string, slug: string | null = 'all') => {
      const bid = String(vendorId || '').trim();
      if (!bid) return;
      const normalizedSlug = normalizeBoardingServiceSlug(slug);
      setEmbeddedBoardingProfileVendorId(null);
      setEmbeddedBoardingProfileSlug(null);
      setProblemFlowBoardingVendorId(bid);
      setProblemFlowBoardingSlug(normalizedSlug);
      rememberBoardingProfileContext(bid, normalizedSlug);
      navigateToScreen('pet-boarding-profile', routeKey.vendor(bid));
    },
    [navigateToScreen],
  );

  const openPetSitterProviderProfile = useCallback(
    (vendorId: string) => {
      const bid = String(vendorId || '').trim();
      if (!bid) return;
      setPetSitterProfileVendorId(bid);
      rememberProviderProfileContext('pet-sitter', bid);
      navigateToScreen('pet-sitter-provider-profile', routeKey.vendor(bid));
    },
    [navigateToScreen],
  );

  const openBehavioristProviderProfile = useCallback(
    (vendorId: string) => {
      const bid = String(vendorId || '').trim();
      if (!bid) return;
      setBehavioristProfileVendorId(bid);
      rememberProviderProfileContext('behaviorist', bid);
      navigateToScreen('behaviorist-provider-profile', routeKey.vendor(bid));
    },
    [navigateToScreen],
  );

  /** Push onto shell stack (preserves wallet parent for rewards/referrals/help). */
  const pushShellScreen = useCallback(
    (screen: ScreenType, key?: string) => {
      const target = screen === 'bookings' ? 'my-bookings' : screen;
      shellNav.forward(target, { key, policyOverride: 'push' });
    },
    [shellNav],
  );

  /** Legacy shell id `bookings` → canonical tab root `my-bookings`. */
  useEffect(() => {
    if (currentScreen === 'bookings') {
      shellNav.focusTabRoot('bookings');
    }
  }, [currentScreen, shellNav]);

  /** Overlay / auto-forward surfaces — swap stack top (e.g. purchase-package). */
  const replaceShellScreen = useCallback(
    (screen: ScreenType, key?: string) => {
      shellNav.replaceTop(screen, key);
    },
    [shellNav],
  );

  /**
   * Open Service Packages checkout. From booking wizards (walker-booking, etc.) replace the
   * transit screen so back returns to provider profile — not an extra wizard step.
   */
  const openPurchasePackageScreen = useCallback(
    (
      payload: Record<string, unknown> | null,
      options?: { mergeWalkerData?: boolean; alsoMergeVetData?: boolean },
    ) => {
      const vsid = String(
        payload?.vendorServiceId ?? (payload as { vendor_service_id?: string })?.vendor_service_id ?? '',
      ).trim();
      const key = vsid ? routeKey.packagePurchase(vsid) : undefined;

      if (options?.mergeWalkerData) {
        setWalkerServiceData((prev: Record<string, unknown> | null) => {
          const merged = { ...(prev || {}), ...(payload || {}) };
          return Object.keys(merged).length ? merged : null;
        });
      } else if (payload) {
        setWalkerServiceData(payload);
      }

      if (options?.alsoMergeVetData && payload) {
        setVetServiceData((prev: Record<string, unknown> | null) => ({ ...(prev || {}), ...payload }));
      }

      if (isPackagePurchaseTransitScreen(currentScreen)) {
        replaceShellScreen('purchase-package', key);
      } else {
        pushShellScreen('purchase-package', key);
      }
    },
    [currentScreen, pushShellScreen, replaceShellScreen],
  );

  /** Hub/vendor-card boarding booking — preserve preselected plan (skip in-router service step). */
  const openBoardingBookingScreen = useCallback((data?: unknown) => {
    setVetServiceData(
      mergeBannerNavigationPayload(null, {
        ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
        serviceType: 'boarding',
      }),
    );
    navigateToScreen('boarding-booking');
  }, [navigateToScreen]);

  /** After `/shop` or `/promotions` back: restore embedded screen (same URL `/` as home). */
  useEffect(() => {
    if (pathname !== '/' || typeof window === 'undefined') return;
    const raw = sessionStorage.getItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY);
    if (!raw) return;
    sessionStorage.removeItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY);
    if (WARMPAWZ_HOME_RESUME_SCREENS.has(raw)) {
      if (raw === 'booking-messages') {
        openMessages();
        return;
      }
      if (raw === 'meal-order-checkout') {
        try {
          const draftRaw = sessionStorage.getItem('meal_one_time_pay_draft_v1');
          if (draftRaw) {
            const draft = JSON.parse(draftRaw) as { vendorId?: string; mealPlanId?: string };
            if (draft.vendorId) setSelectedVendorId(String(draft.vendorId));
            setVetServiceData({
              vendorId: draft.vendorId,
              mealPlanId: draft.mealPlanId,
            });
          }
        } catch {
          /* ignore corrupt draft */
        }
        shellNav.navigateToScreen('meal-order-checkout');
        return;
      }
      if (raw === 'meal-order-tracking') {
        const resumeOrderId = sessionStorage.getItem(MEAL_TRACK_RESUME_ORDER_ID_KEY)?.trim();
        const resumeBack =
          sessionStorage.getItem(MEAL_TRACK_RESUME_BACK_SCREEN_KEY)?.trim() || 'meal-plan-orders';
        sessionStorage.removeItem(MEAL_TRACK_RESUME_ORDER_ID_KEY);
        sessionStorage.removeItem(MEAL_TRACK_RESUME_BACK_SCREEN_KEY);
        if (resumeOrderId) {
          setMealTrackNav({ orderId: resumeOrderId, backScreen: resumeBack as ScreenType });
          shellNav.navigateToScreen('meal-order-tracking', routeKey.order(resumeOrderId));
        }
        return;
      }
      const next = raw as ScreenType;
      if (next === 'shop') {
        router.push('/shop');
        return;
      }
      shellNav.navigateToScreen(next);
    }
  }, [pathname, openMessages, shellNav]);

  /** After My Packages Back with account-menu intent: reopen profile sidebar on home. */
  useEffect(() => {
    if (pathname !== '/') return;
    if (consumeOpenAccountMenuAfterNav()) {
      setUserSidebarOpen(true);
    }
  }, [pathname]);

  /** Clear embedded boarding profile only when leaving that context — not when opening child flows (back must restore profile). */
  const PET_BOARDING_PROFILE_CHILD_SCREENS = useMemo(
    () =>
      new Set<ScreenType>([
        'boarding-booking',
        'pet-sitter-booking',
        'purchase-package',
        'package-booking',
      ]),
    [],
  );

  useEffect(() => {
    if (currentScreen === 'pet-boarding-profile') return;
    if (PET_BOARDING_PROFILE_CHILD_SCREENS.has(currentScreen)) return;
    if (embeddedBoardingProfileVendorId || embeddedBoardingProfileSlug) {
      setEmbeddedBoardingProfileVendorId(null);
      setEmbeddedBoardingProfileSlug(null);
      clearBoardingProfileContext();
    }
  }, [
    currentScreen,
    embeddedBoardingProfileVendorId,
    embeddedBoardingProfileSlug,
    PET_BOARDING_PROFILE_CHILD_SCREENS,
  ]);

  const resolvedBoardingProfileVendorId = useMemo((): string | null => {
    if (embeddedBoardingProfileVendorId) return embeddedBoardingProfileVendorId;
    if (problemFlowBoardingVendorId) return problemFlowBoardingVendorId;
    if (petBoardingVendorId) return petBoardingVendorId;
    if (currentScreen !== 'pet-boarding-profile') return null;
    const top = history[history.length - 1];
    const fromKey = vendorIdFromRouteKey(top?.key);
    if (fromKey) return fromKey;
    return peekBoardingProfileContext()?.vendorId ?? null;
  }, [
    embeddedBoardingProfileVendorId,
    problemFlowBoardingVendorId,
    petBoardingVendorId,
    currentScreen,
    history,
  ]);

  const resolvedBoardingProfileSlug = useMemo(() => {
    return normalizeBoardingServiceSlug(
      problemFlowBoardingSlug ??
        embeddedBoardingProfileSlug ??
        petBoardingServiceSlug ??
        peekBoardingProfileContext()?.slug ??
        null,
    );
  }, [
    problemFlowBoardingSlug,
    embeddedBoardingProfileSlug,
    petBoardingServiceSlug,
  ]);

  useEffect(() => {
    if (currentScreen !== 'pet-boarding-profile') return;
    if (embeddedBoardingProfileVendorId || problemFlowBoardingVendorId || petBoardingVendorId) {
      return;
    }
    const top = history[history.length - 1];
    const vid =
      vendorIdFromRouteKey(top?.key) ?? peekBoardingProfileContext()?.vendorId ?? null;
    if (!vid) return;
    setEmbeddedBoardingProfileVendorId(vid);
    const slug = peekBoardingProfileContext()?.slug;
    if (slug != null) {
      setEmbeddedBoardingProfileSlug(normalizeBoardingServiceSlug(slug));
    }
  }, [currentScreen, embeddedBoardingProfileVendorId, problemFlowBoardingVendorId, petBoardingVendorId, history]);

  /** Child flows opened from home-service provider profiles — keep profile vendor id for back. */
  const PROVIDER_PROFILE_CHILD_SCREENS = useMemo(
    () =>
      new Set<ScreenType>([
        'pet-sitter-booking',
        'boarding-booking',
        'purchase-package',
        'package-booking',
        'universal-home-booking',
        'walker-booking',
        'create-booking',
      ]),
    [],
  );

  useEffect(() => {
    if (currentScreen === 'pet-sitter-provider-profile') return;
    if (PROVIDER_PROFILE_CHILD_SCREENS.has(currentScreen)) return;
    if (petSitterProfileVendorId) {
      setPetSitterProfileVendorId(null);
      clearProviderProfileContext('pet-sitter');
    }
  }, [currentScreen, petSitterProfileVendorId, PROVIDER_PROFILE_CHILD_SCREENS]);

  useEffect(() => {
    if (currentScreen === 'behaviorist-provider-profile') return;
    if (PROVIDER_PROFILE_CHILD_SCREENS.has(currentScreen)) return;
    if (behavioristProfileVendorId) {
      setBehavioristProfileVendorId(null);
      clearProviderProfileContext('behaviorist');
    }
  }, [currentScreen, behavioristProfileVendorId, PROVIDER_PROFILE_CHILD_SCREENS]);

  const resolvedPetSitterProfileVendorId = useMemo((): string | null => {
    if (petSitterProfileVendorId) return petSitterProfileVendorId;
    if (currentScreen !== 'pet-sitter-provider-profile') return null;
    const top = history[history.length - 1];
    const fromKey = vendorIdFromRouteKey(top?.key);
    if (fromKey) return fromKey;
    return peekProviderProfileContext('pet-sitter')?.vendorId ?? null;
  }, [petSitterProfileVendorId, currentScreen, history]);

  const resolvedBehavioristProfileVendorId = useMemo((): string | null => {
    if (behavioristProfileVendorId) return behavioristProfileVendorId;
    if (currentScreen !== 'behaviorist-provider-profile') return null;
    const top = history[history.length - 1];
    const fromKey = vendorIdFromRouteKey(top?.key);
    if (fromKey) return fromKey;
    return peekProviderProfileContext('behaviorist')?.vendorId ?? null;
  }, [behavioristProfileVendorId, currentScreen, history]);

  useEffect(() => {
    if (currentScreen !== 'pet-sitter-provider-profile') return;
    if (petSitterProfileVendorId) return;
    const top = history[history.length - 1];
    const vid =
      vendorIdFromRouteKey(top?.key) ?? peekProviderProfileContext('pet-sitter')?.vendorId ?? null;
    if (!vid) return;
    setPetSitterProfileVendorId(vid);
  }, [currentScreen, petSitterProfileVendorId, history]);

  useEffect(() => {
    if (currentScreen !== 'behaviorist-provider-profile') return;
    if (behavioristProfileVendorId) return;
    const top = history[history.length - 1];
    const vid =
      vendorIdFromRouteKey(top?.key) ?? peekProviderProfileContext('behaviorist')?.vendorId ?? null;
    if (!vid) return;
    setBehavioristProfileVendorId(vid);
  }, [currentScreen, behavioristProfileVendorId, history]);

  // ✅ FIX: Listen for orderMedicineFromPrescription event (fallback when onOrderMedicine not passed)
  useEffect(() => {
    const handleOrderMedicineFromPrescription = (e: CustomEvent<{ prescriptionId: string; bookingId?: string; medications?: any[]; fileUrl?: string }>) => {
      const detail = e.detail;
      if (detail?.prescriptionId) {
        setPrescriptionOrderData({
          prescriptionId: detail.prescriptionId,
          prescriptionUrl: detail.fileUrl,
        });
        navigateToScreen('pharmacy_order_flow');
        toast.success('Opening pharmacy order...');
      }
    };
    window.addEventListener('orderMedicineFromPrescription', handleOrderMedicineFromPrescription as EventListener);
    return () => window.removeEventListener('orderMedicineFromPrescription', handleOrderMedicineFromPrescription as EventListener);
  }, [navigateToScreen]);

  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;

  const openMealOrderTracking = useCallback((orderId: string, backScreen?: ScreenType) => {
    const id = orderId.trim();
    if (!id) return;
    if (!isCustomerMealPlansEnabled()) {
      toast.info('Meal order tracking is coming soon.');
      return;
    }
    const back = backScreen ?? currentScreenRef.current;
    flushSync(() => {
      setMealTrackNav({ orderId: id, backScreen: back });
    });
    navigateToScreen('meal-order-tracking', routeKey.order(id));
  }, [navigateToScreen]);

  useEffect(() => {
    registerMealShellTrack((orderId, backScreen) => {
      openMealOrderTracking(orderId, backScreen as ScreenType | undefined);
    });
    return () => unregisterMealShellTrack();
  }, [openMealOrderTracking]);

  // Header profile/pets: cache only on home (CustomerHomeComplete bootstrap owns the network refresh).
  useEffect(() => {
    if (!phone) return;

    const rehydrateFromCache = () => {
      const cachedPets = readCachedCustomerPets();
      if (cachedPets.length > 0) {
        setPets(cachedPets);
        setSelectedPet((prev: typeof cachedPets[0] | null) => prev ?? cachedPets[0]);
      }
      const profile = readCachedCustomerProfile();
      if (profile) {
        setUserName(
          String(
            profile.name ||
              profile.fullName ||
              profile.full_name ||
              profile.firstName ||
              readCachedProfileName(phone).name
          )
        );
        const photo = String(
          profile.profilePhoto ||
            profile.profile_photo_url ||
            profile.profile_image_url ||
            profile.photo ||
            ''
        );
        if (photo) setUserProfilePhoto(photo);
      } else {
        const cachedProfile = readCachedProfileName(phone);
        setUserName(cachedProfile.name);
        if (cachedProfile.photo) setUserProfilePhoto(cachedProfile.photo);
      }
    };

    rehydrateFromCache();

    if (currentScreen === 'home') {
      void getHomeBootstrapReady().then(rehydrateFromCache);
      return;
    }

    void ensureCustomerProfileAndPets(phone).refreshPromise.then(rehydrateFromCache);
  }, [phone, currentScreen]);

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

  // Deep link: /?service=tele → instant auto-pay when enabled; otherwise scheduled vet tele
  const homeTeleSearchKey = searchParams.toString();
  useEffect(() => {
    const sp = new URLSearchParams(homeTeleSearchKey);
    if (sp.get('service') !== 'tele') return;
    const url = buildTeleInstantAutoPayBookingUrl();
    if (url) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[CustomerHomeWrapper] service=tele in URL → redirect to instant auto-pay booking:', url);
      }
      router.replace(url);
      return;
    }
    setTeleSkipToScheduled(true);
    navigateToScreen('vet-tele-consultation');
    sp.delete('service');
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, homeTeleSearchKey, navigateToScreen]);

  const prevScreenForTeleRef = useRef<ScreenType | null>(null);
  useEffect(() => {
    const prev = prevScreenForTeleRef.current;
    if (prev === 'vet-tele-consultation' && currentScreen !== 'vet-tele-consultation') {
      setTeleSkipModeSelection(false);
      setTeleSkipToScheduled(false);
      syncTeleConsultUrl(false);
    }
    if (prev === 'vet-home-visit' && currentScreen !== 'vet-home-visit') {
      setVetHomeFromHome(false);
    }
    if (prev === 'vet-clinic-list' && currentScreen !== 'vet-clinic-list') {
      setVetClinicFromHome(false);
    }
    prevScreenForTeleRef.current = currentScreen;
  }, [currentScreen, syncTeleConsultUrl]);

  // Notification Service logic... (kept same as original)
  useNotificationService({
    phone: phone,
    enabled: !!phone,
    onNewNotification: async (notification) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('📬 [CUSTOMER-HOME] Notification received:', notification);
      }
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
            navigateToScreen('vet');
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
  /** Blue chevron on home pet chip → view/edit pet (not booking sessions quick view). */
  const handlePetClick = (petId: string) => {
    setSelectedPetId(petId);
    navigateToScreen('pet-details', routeKey.pet(petId));
  };
  const handleViewPetProfile = (petData: any) => {
    setSelectedPetData(petData);
    setSelectedPetId(petData.id);
    navigateToScreen('pet-profile', routeKey.pet(String(petData.id)));
  };
  
  const handleViewFullPetProfile = async () => {
    if (!selectedPetId) return;
    try {
      const data = await apiClient.get<{ success: boolean; pet: any }>(`/customer/pets/${selectedPetId}`);
      if (data.success && data.pet) handleViewPetProfile(data.pet);
    } catch (error) { console.error('Error loading pet data:', error); }
  };

  const handleAddPet = () => {
    navigateToScreen('add-pet');
  };
  const handleAddPetSuccess = () => {
    setRefreshKey(prev => prev + 1);
    goToHome();
  };

  const goToShopFromParent = (opts?: { category?: string }) => {
    if (!isShopUiVisibleForAccount(phone)) {
      return;
    }
    if (!isCustomerEcommerceEnabled()) {
      toast.info(CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE);
      return;
    }
    if (pathname === '/' && !SHOP_SUBFLOW_SCREENS.has(currentScreen)) {
      rememberShopBackToSpaScreen(currentScreen);
    }
    setUserSidebarOpen(false);
    const category = opts?.category?.trim();
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    router.push(`/shop${qs}`);
  };

  const captureBannerNavigationOrigin = (data?: unknown) => {
    if (isBannerNavigationPayload(data as Record<string, unknown> | null)) {
      bannerReturnHomeRef.current = true;
    }
  };

  const shouldBannerReturnHome = (...contexts: Array<Record<string, unknown> | null | undefined>) =>
    bannerReturnHomeRef.current ||
    contexts.some((ctx) => isBannerNavigationPayload(ctx ?? null));

  const backFromBannerOr = (fallback: () => void, ...contexts: Array<Record<string, unknown> | null | undefined>) => {
    const returnScreen = getBannerReturnScreen(...contexts);
    if (shouldBannerReturnHome(...contexts) && returnScreen) {
      bannerReturnHomeRef.current = false;
      setUserSidebarOpen(false);
      setPetSitterOriginScreen(null);
      setPetSitterFacilityOptionId(null);
      setSpaBoardingVendorsSlug(null);
      setBoardingVendorsReturnScreen(null);
      setLabDiagnosticsReturnScreen(null);
      shellNav.resetTo(returnScreen as ScreenType);
      setSelectedPetId(null);
      setSelectedBookingId(null);
      setVetServiceData(null);
      setWalkerServiceData(null);
      setSelectedVendorId(undefined);
      setSelectedProblem(null);
      setCurrentServiceType(null);
      return;
    }
    fallback();
  };

  const handleNavigateToService = (service: string, _data?: any) => {
    const data = _data;
    if (isReviewBlockedScreen(service, phone)) {
      return;
    }
    if (phone && resolveStyleLaunchTargetForScreen(service, data)) {
      void gateStyleLaunchScreenNavigation(phone, service, data, (msg) => toast.info(msg)).then(
        (allowed) => {
          if (allowed) executeNavigateToService(service, data);
        }
      );
      return;
    }
    executeNavigateToService(service, data);
  };

  const shouldOpenHomeVisitLandingHub = (data?: Record<string, unknown> | null): boolean => {
    if (data?.fromHomeVisitLanding === true) return false;
    if (currentScreen === 'home-service-selection') return false;
    if (currentScreen === 'vet') return false;
    const returnScreen = String(data?.returnScreen ?? '').toLowerCase();
    if (returnScreen === 'home') return true;
    if (currentScreen === 'home') return true;
    if (bannerReturnHomeRef.current) return true;
    return false;
  };

  const resolveHomeVisitEntryScreen = (
    data?: Record<string, unknown> | null
  ): 'home-service-selection' | 'vet-home-visit' =>
    shouldOpenHomeVisitLandingHub(data) ? 'home-service-selection' : 'vet-home-visit';

  const executeNavigateToService = (service: string, _data?: any) => {
    const data = _data;
    resolveServiceBookingCommerceRouteForNavigation({
      serviceKey: service,
      category: typeof data?.category === 'string' ? data.category : undefined,
      serviceStyle:
        typeof data?.serviceStyle === 'string'
          ? data.serviceStyle
          : typeof data?.service_style === 'string'
            ? data.service_style
            : undefined,
      serviceType: typeof data?.serviceType === 'string' ? data.serviceType : undefined,
    });
    captureBannerNavigationOrigin(data);
    const vendorRow: Record<string, unknown> =
      data && typeof data === 'object' ? { ...(data as Record<string, unknown>) } : {};
    const featuredVendorId = pickCustomerVendorAccountId(vendorRow);
    const vid = featuredVendorId.trim() !== '' ? featuredVendorId.trim() : undefined;

    /** Home / promos pass `{ vendorId, vendorName?, … }` — open profile hub, not only the service landing. */
    if (vid && service === 'walker') {
      setWalkerServiceData({
        vendorId: vid,
        walker: { name: String(data?.vendorName || data?.walker?.name || 'Walker') },
        walkerProfileBackScreen: 'home',
        serviceType: 'walking',
        serviceStyle: 'at_home',
      });
      navigateToScreen('walker-provider-profile');
      return;
    }
    if (vid && (service === 'vet' || service === 'veterinarian')) {
      const st = String(data?.serviceStyle || data?.service_style || 'tele').toLowerCase();
      const serviceStyle =
        st === 'at_center' || st === 'center' || st === 'clinic'
          ? 'at_center'
          : st === 'at_home' || st === 'home'
            ? 'at_home'
            : 'tele';
      setVetServiceData({
        vendorId: vid,
        serviceStyle,
        serviceTypeName: String(data?.serviceTypeName || data?.vendorName || 'Veterinary Services'),
        category: 'vet',
        returnScreen: 'home',
      });
      navigateToScreen('vet-services-by-style');
      return;
    }
    if (vid && service === 'grooming') {
      const st = String(data?.serviceStyle || data?.service_style || 'at_center').toLowerCase();
      if (st === 'at_home' || st === 'home') {
        setGroomingHomeProfileVendorId(vid);
        navigateToScreen('grooming_home');
      } else {
        setGroomingCenterProfileVendorId(vid);
        navigateToScreen('grooming_center');
      }
      return;
    }
    if (vid && service === 'training') {
      const st = String(data?.serviceStyle || data?.service_style || 'at_center').toLowerCase();
      if (st === 'at_home' || st === 'home') {
        setTrainingHomeProfileVendorId(vid);
        navigateToScreen('training_home');
      } else {
        setTrainingCenterProfileVendorId(vid);
        navigateToScreen('training_center');
      }
      return;
    }
    const serviceKey = String(service ?? '')
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');
    const boardingLikeScreens = new Set(['boarding', 'pet_boarding', 'petboarding']);
    if (vid && boardingLikeScreens.has(serviceKey)) {
      openEmbeddedPetBoardingProfile(
        vid,
        normalizeBoardingServiceSlug(String(data?.serviceSlug ?? data?.service_slug ?? null)),
      );
      return;
    }
    if (vid && (service === 'behaviorist' || service === 'behaviourist' || serviceKey === 'behaviorist')) {
      openBehavioristProviderProfile(vid);
      return;
    }
    if (
      vid &&
      (service === 'pet-sitter' ||
        service === 'pet_sitter' ||
        service === 'sitter' ||
        serviceKey === 'sitter' ||
        serviceKey === 'pet_sitter')
    ) {
      openPetSitterProviderProfile(vid);
      return;
    }
    if (
      vid &&
      (service === 'nutritionist' ||
        service === 'pet_nutritionist' ||
        serviceKey === 'nutritionist' ||
        serviceKey === 'pet_nutritionist')
    ) {
      setVetServiceData({
        vendorId: vid,
        vendorName: data?.vendorName,
        serviceStyle: String(data?.serviceStyle || 'tele').toLowerCase(),
        serviceType: 'pet_nutritionist',
        category: 'nutritionist',
      });
      navigateToScreen('nutritionist-tele');
      return;
    }

    if (service === 'walker') navigateToScreen('walker');
    else if (service === 'vet' || service === 'veterinarian') {
      const st = String(data?.serviceStyle || data?.service_style || '').toLowerCase();
      if (st === 'tele' || st === 'online') navigateToScreen('vet-tele-consultation');
      else if (st === 'at_home' || st === 'home') navigateToScreen(resolveHomeVisitEntryScreen(data));
      else navigateToScreen('vet');
    }
    else if (service === 'vet-tele-consultation') {
      setVetServiceData(_data);
      if ((data as any)?.startStep === 'scheduled') setTeleSkipToScheduled(true);
      else setTeleSkipToScheduled(false);
      navigateToScreen('vet-tele-consultation');
      return;
    }
    else if (service === 'tele-consultation-hub') {
      navigateToScreen('tele-consultation-hub');
      return;
    }
    else if (service === 'vet-home-visit') {
      const homeVisitTarget = resolveHomeVisitEntryScreen(data);
      if (homeVisitTarget === 'home-service-selection') {
        navigateToScreen('home-service-selection');
        return;
      }
      setVetServiceData(_data);
      if ((data as any)?.startStep === 'home') setVetHomeFromHome(true);
      else setVetHomeFromHome(false);
      navigateToScreen('vet-home-visit');
      return;
    }
    else if (service === 'vet-clinic-list') {
      setVetServiceData(_data);
      if ((data as any)?.startStep === 'home') setVetClinicFromHome(true);
      else setVetClinicFromHome(false);
      navigateToScreen('vet-clinic-list');
      return;
    }
    else if (
      service === 'grooming_home' ||
      service === 'grooming_center' ||
      service === 'training_home' ||
      service === 'training_center'
    ) {
      navigateToScreen(service as ScreenType);
      return;
    }
    else if (service === 'grooming') {
      const st = String(data?.serviceStyle || data?.service_style || '').toLowerCase();
      if (st === 'at_home' || st === 'home') navigateToScreen('grooming_home');
      else if (st === 'at_center' || st === 'center' || st === 'clinic') navigateToScreen('grooming_center');
      else navigateToScreen('grooming');
    }
    else if (service === 'training') {
      const st = String(data?.serviceStyle || data?.service_style || '').toLowerCase();
      if (st === 'at_home' || st === 'home') navigateToScreen('training_home');
      else if (st === 'at_center' || st === 'center' || st === 'clinic') navigateToScreen('training_center');
      else navigateToScreen('training');
    }
    else if (service === 'boarding' || boardingLikeScreens.has(serviceKey)) navigateToScreen('boarding');
    else if (service === 'pet-sitter' || service === 'pet_sitter' || service === 'sitting') {
      setPetSitterOriginScreen(currentScreen);
      setPetSitterFacilityOptionId(null);
      navigateToScreen('pet-sitter');
    }
    else if (service === 'adoption') navigateToScreen('adoption');
    else if (service === 'adoption_questionnaire') navigateToScreen('adoption_questionnaire');
    else if (service === 'sunset') navigateToScreen('sunset');
    else if (service === 'insurance') navigateToScreen('insurance');
    else if (service === 'cafes') navigateToScreen('cafes');
    else if (service === 'shop') {
      const raw =
        data && typeof data === 'object'
          ? (data as { category?: string; categoryId?: string }).category ??
            (data as { category?: string; categoryId?: string }).categoryId
          : undefined;
      const cat = raw != null ? String(raw).trim() : '';
      goToShopFromParent(cat ? { category: cat } : undefined);
    }
    else if (service === 'cart') {
      if (!isCustomerEcommerceEnabled()) {
        toast.info(CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE);
        return;
      }
      if (pathname === '/') {
        rememberShopBackToSpaScreen(currentScreen);
      }
      router.push('/cart');
    }
    else if (service === 'my-bookings' || service === 'bookings') {
      bookingsFromAccountMenuRef.current = false;
      navigateToScreen('my-bookings');
    }
    else if (service === 'photography') navigateToScreen('photography');
    else if (service === 'breeder') navigateToScreen('breeder');
    else if (service === 'ambulance') navigateToScreen('ambulance');
    else if (service === 'nutritionist') navigateToScreen('nutritionist');
    else if (service === 'pharmacy' || service === 'pharmacy_store') navigateToScreen('pharmacy');
    else if (service === 'diagnostics' || service === 'lab-diagnostics' || service === 'lab') {
      setLabDiagnosticsReturnScreen(null);
      navigateToScreen('lab-diagnostics');
    }
    else if (service === 'behaviorist' || service === 'behavioral') navigateToScreen('behaviorist');
    else if (service === 'home-service' || service === 'home-service-selection') navigateToScreen('home-service-selection');
    else if (service === 'relocation') navigateToScreen('relocation');
    else if (service === 'resort') navigateToScreen('resort');
    else if (service === 'holiday') navigateToScreen('holiday');
    else if (service === 'mating-dating-hub') navigateToScreen('mating-dating-hub');
    else if (service === 'wallet') navigateToScreen('wallet');
    else if (service === 'booking-messages') openMessages();
    else if (service === 'purchase-package') {
      const vid = String((data as any)?.vendorId ?? '').trim();
      const vsid = String(
        (data as any)?.vendorServiceId ?? (data as any)?.vendor_service_id ?? ''
      ).trim();
      const payload =
        typeof data === 'object' && data != null && !Array.isArray(data)
          ? { ...(data as Record<string, unknown>) }
          : {};
      if (vid) (payload as any).vendorId = vid;
      if (vsid) (payload as any).vendorServiceId = vsid;
      if (vsid && vid) {
        openPurchasePackageScreen(Object.keys(payload).length ? payload : null);
      } else if (vid) {
        setWalkerServiceData(Object.keys(payload).length ? payload : { vendorId: vid, vendorName: (data as any)?.vendorName });
        navigateToScreen('package-booking');
      } else {
        navigateToScreen('package-booking');
      }
    }
    else if (service === 'package-tracking') {
      const pid = data?.packagePurchaseId ?? data?.package_purchase_id;
      const id = pid != null && String(pid).trim() !== '' ? String(pid).trim() : '';
      if (id) router.push(`/packages/${encodeURIComponent(id)}`);
      else router.push('/bookings');
    }
    else if (service === 'services') navigateToScreen('services');
    else if (service === 'help' || service === 'support_help') navigateToScreen('support_help');
    else if (service === 'offers' || service === 'promotions') {
      rememberPromotionsBackSpaScreen(currentScreen);
      router.push('/promotions');
    }
    else if (service === 'whats-new') router.push('/whats-new');
    else if (service === 'articles' || service === 'customer-articles') navigateToArticlesList(router, '/');
    else if (service === 'wishlist') {
      if (!isCustomerEcommerceEnabled()) {
        toast.info(CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE);
        return;
      }
      clearWishlistOpenedFromShopMark();
      router.push('/wishlist');
    }
    else if (service === 'home') {
      handleBack();
    } else if (service === 'vet-booking') {
      setVetServiceData(mergeBannerNavigationPayload(null, data));
      navigateToScreen('vet-booking');
    } else if (service === 'vet-services-by-style') {
      setVetServiceData(mergeBannerNavigationPayload(null, data));
      navigateToScreen('vet-services-by-style');
    } else if (service === 'training-booking') {
      setVetServiceData(
        mergeBannerNavigationPayload(null, {
          ...(data && typeof data === 'object' ? data : {}),
          serviceType: 'training',
        })
      );
      navigateToScreen('training-booking');
    } else if (service === 'create-booking') {
      const st = String(data?.serviceStyle || data?.service_style || '').toLowerCase();
      const persona = String(data?.serviceType || data?.service_type || '').toLowerCase();
      if (persona === 'grooming') {
        setVetServiceData(
          mergeBannerNavigationPayload(null, {
            ...(data && typeof data === 'object' ? data : {}),
            serviceType: 'grooming',
            serviceStyle: st === 'at_home' || st === 'home' ? 'at_home' : 'at_center',
          })
        );
        navigateToScreen('grooming-booking');
      } else if (persona === 'training') {
        setVetServiceData(
          mergeBannerNavigationPayload(null, {
            ...(data && typeof data === 'object' ? data : {}),
            serviceType: 'training',
            serviceStyle: st === 'at_home' || st === 'home' ? 'at_home' : 'at_center',
          })
        );
        navigateToScreen('training-booking');
      } else {
        setSelectedService(data?.serviceId);
        setSelectedVendorId(data?.vendorId);
        setVetServiceData(mergeBannerNavigationPayload(null, data));
        navigateToScreen('create-booking');
      }
    } else if (service === 'grooming-booking') {
      setVetServiceData(
        mergeBannerNavigationPayload(null, {
          ...(data && typeof data === 'object' ? data : {}),
          serviceType: 'grooming',
        })
      );
      navigateToScreen('grooming-booking');
    } else if (service === 'boarding-booking') {
      if (vid) {
        setEmbeddedBoardingProfileVendorId(vid);
        setEmbeddedBoardingProfileSlug(
          normalizeBoardingServiceSlug(String(data?.serviceSlug ?? data?.service_slug ?? 'overnight'))
        );
      }
      setVetServiceData(
        mergeBannerNavigationPayload(null, {
          ...(data && typeof data === 'object' ? data : {}),
          vendorId: vid ?? data?.vendorId,
          serviceType: 'boarding',
          serviceId: data?.serviceId,
        })
      );
      navigateToScreen('boarding-booking');
    } else if (service === 'walker-booking') {
      setWalkerServiceData(
        mergeBannerNavigationPayload(null, {
          ...(data && typeof data === 'object' ? data : {}),
          vendorId: vid ?? data?.vendorId,
          serviceId: data?.serviceId,
          serviceType: 'walking',
        })
      );
      navigateToScreen('walker-booking');
    } else if (service === 'pet-sitter-booking') {
      setVetServiceData(
        mergeBannerNavigationPayload(null, {
          ...(data && typeof data === 'object' ? data : {}),
          vendorId: vid ?? data?.vendorId,
          serviceType: 'pet_sitter',
          serviceId: data?.serviceId,
        })
      );
      navigateToScreen('pet-sitter-booking');
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CustomerHomeWrapper] Unhandled navigate service:', service);
      }
      toast.message('That action is not available here. Try refreshing the page if this keeps happening.');
    }
  };

  /** Deep link / banner entry: open resolved vendor or booking screen once on mount. */
  useEffect(() => {
    if (initialBannerNavAppliedRef.current || !initialBannerNavigation?.screen) return;
    initialBannerNavAppliedRef.current = true;
    const { screen, data } = initialBannerNavigation;
    captureBannerNavigationOrigin(data);
    handleNavigateToService(screen, data);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for deep link entry
  }, [initialBannerNavigation]);

  const handleSupportHelpChatbotNavigate = (dest: string, data?: any) => {
    const d = (dest || '').trim();
    if (!d) return;
    if (d.startsWith('/')) {
      router.push(d);
      return;
    }
    if (d === 'support_help') {
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
    handleNavigateToService(d, data);
  };

  const handleVetNavigate = (screen: string, data?: any) => {
    captureBannerNavigationOrigin(data);
    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [handleVetNavigate] Navigating to:', screen, data);
    }
    if (screen === 'vet-vendor-profile' && data) {
      const legacy = normalizeLegacyVetVendorProfilePayload(data as Record<string, unknown>);
      if (!legacy.id) {
        toast.error('Profile unavailable — missing vendor id.');
        return;
      }
      const { screen: nextScreen, data: nextData } = getWebCustomerVendorStyleListingNavTarget({
        vertical: 'vet',
        serviceStyle: String(data.serviceStyle ?? 'tele'),
        category: data.category,
        serviceTypeName: data.serviceTypeName,
        vendor: legacy,
      });
      return handleVetNavigate(nextScreen, nextData);
    }
    // Clinic Visit (at_center) should always use the dedicated clinic list with filters.
    // Keep vet-services-by-style only for vendor/profile mode.
    if (
      screen === 'vet-services-by-style' &&
      data?.serviceStyle === 'at_center' &&
      !data?.vendorId
    ) {
      setVetServiceData((prev: any) => ({
        ...(prev || {}),
        ...(data || {}),
        returnScreen: data?.returnScreen || 'vet-clinic-list',
      }));
      navigateToScreen('vet-clinic-list');
      return;
    }
    // Merge listing context when opening profiles or drilling into the same style browser (chevron / View All).
    if (screen === 'vet-clinic-profile' || screen === 'vet-doctor-details' || screen === 'vet-services-by-style') {
      setVetServiceData((prev: any) => mergeBannerNavigationPayload(prev, data || {}));
      navigateToScreen(screen as ScreenType);
      return;
    }
    if (screen === 'vet-all-doctors') {
      setVetServiceData({
        serviceStyle: 'tele',
        serviceTypeName: 'All veterinarians',
        category: 'vet',
      });
      navigateToScreen('vet-services-by-style');
      return;
    }
    setVetServiceData((prev: any) => mergeBannerNavigationPayload(prev, data || {}));
    // ✅ FIX: Handle all navigation screens including pharmacy, lab, etc.
    if (screen === 'vet-booking') navigateToScreen('vet-booking');
    else if (screen === 'vet-clinic-list') {
      if ((data as any)?.startStep === 'home') setVetClinicFromHome(true);
      else setVetClinicFromHome(false);
      navigateToScreen('vet-clinic-list');
    }
    else if (screen === 'vet-clinic-booking') navigateToScreen('vet-clinic-booking');
    else if (screen === 'vet-tele-consultation') {
      if ((data as any)?.startStep === 'scheduled') setTeleSkipToScheduled(true);
      else setTeleSkipToScheduled(false);
      navigateToScreen('vet-tele-consultation');
      return;
    }
    else if (screen === 'tele-consultation-hub') {
      navigateToScreen('tele-consultation-hub');
      return;
    }
    else if (screen === 'vet-home-visit') {
      if ((data as any)?.startStep === 'home') setVetHomeFromHome(true);
      else setVetHomeFromHome(false);
      navigateToScreen('vet-home-visit');
    }
    else if (screen === 'pharmacy') {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [handleVetNavigate] Setting pharmacy landing (Medicine)');
      }
      navigateToScreen('pharmacy');
    }
    else if (screen === 'pharmacy_store') {
      navigateToScreen('pharmacy_store');
    }
    else if (
      screen === 'lab-diagnostics' ||
      screen === 'lab-tests' ||
      screen === 'diagnostics' ||
      screen === 'lab' ||
      screen === 'vet-lab-tests'
    ) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [handleVetNavigate] Setting lab-diagnostics screen');
      }
      setLabDiagnosticsReturnScreen('vet');
      navigateToScreen('lab-diagnostics');
    }
    else if (screen === 'my-bookings' || screen === 'bookings') {
      bookingsFromAccountMenuRef.current = false;
      navigateToScreen('my-bookings');
    }
    else if (screen === 'home') { 
      goToHome(); 
    }
    else if (screen === 'add-address') {
      navigateToScreen('address_book');
    }
    else if (screen === 'profile') {
      navigateToScreen('customer-profile');
    }
    else if (screen === 'shop') {
      goToShopFromParent();
    }
    else if (screen === 'purchase-package') {
      const vid = String(data?.vendorId ?? data?.doctorId ?? '').trim();
      const vsid = String(data?.vendorServiceId ?? (data as any)?.vendor_service_id ?? '').trim();
      const payload =
        typeof data === 'object' && data != null && !Array.isArray(data)
          ? { ...(data as Record<string, unknown>) }
          : {};
      if (vid) (payload as any).vendorId = vid;
      if (vsid) (payload as any).vendorServiceId = vsid;
      if (vsid && vid) {
        openPurchasePackageScreen(Object.keys(payload).length ? payload : null, {
          alsoMergeVetData: true,
        });
      } else if (vid) {
        setWalkerServiceData(Object.keys(payload).length ? payload : { vendorId: vid, vendorName: data?.vendorName });
        setVetServiceData((prev: any) => ({ ...prev, ...data }));
        navigateToScreen('package-booking');
      } else {
        setVetServiceData((prev: any) => ({ ...prev, ...data }));
        navigateToScreen('package-booking');
      }
    }
    else if (screen === 'package-tracking') {
      const pid = data?.packagePurchaseId ?? data?.package_purchase_id;
      const id = pid != null && String(pid).trim() !== '' ? String(pid).trim() : '';
      if (id) router.push(`/packages/${encodeURIComponent(id)}`);
      else router.push('/bookings');
    }
    else {
      // ✅ FIX: Fallback - try to navigate to the screen directly
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [handleVetNavigate] Unhandled screen, attempting direct navigation:', screen);
      }
      navigateToScreen(screen as ScreenType);
    }
  };

  const handleProblemGridVendorProfile = (ctx: VendorProfileFromProblemContext) => {
    const { vendorId, vendorName, serviceStyle } = ctx;
    if (!vendorId || String(vendorId).trim() === '') {
      toast.error('Profile unavailable — missing vendor id.');
      return;
    }

    const category = String(ctx.problemCategory || selectedProblem?.category || '').toLowerCase();
    const hubRole = String(selectedProblem?.roleId || '').toLowerCase();
    const allRoleSlugs = [
      ...(Array.isArray(ctx.roleIds) ? ctx.roleIds : []),
      selectedProblem?.roleId,
    ]
      .filter((x): x is string => x != null && String(x).trim() !== '')
      .map((x) => String(x).toLowerCase());
    const roleRaw = ctx.roleIds?.find(Boolean) || selectedProblem?.roleId;
    const role = String(roleRaw || '').toLowerCase();

    /** Problem-grid tiles that are behavioral (same ids as BEHAVIORAL_ISSUES; do not include training-only ids like aggression). */
    const behavioralSpecializationIds = new Set([
      'barking',
      'destructive',
      'fear_phobia',
      'resource_guarding',
      'separation_anxiety',
      'separation',
    ]);
    const problemTileId = String(selectedProblem?.id || '').toLowerCase();
    const ctxProblemTile = String(ctx.problemId || '').toLowerCase();
    const categoryIsBehavior =
      category === 'behavior' || category === 'behavioral' || category === 'sub_behavior';
    const openedFromTrainerHub =
      hubRole === 'trainer' ||
      hubRole === 'training' ||
      (hubRole === 'pet_trainer' && !categoryIsBehavior);
    const openedFromBehaviorHub = hubRole === 'behaviorist' || hubRole === 'behaviourist';
    const anySlugMatches = (set: Set<string>) => allRoleSlugs.some((r) => set.has(r));
    const anySlugMatchesBehaviorRole = allRoleSlugs.some((r) =>
      /behav|behaviorist|behaviourist|pet_behavior|behaviorist_solo|behaviorist_center/.test(r),
    );

    const looksBehavioralFlow =
      openedFromBehaviorHub ||
      (!openedFromTrainerHub &&
        (behavioralSpecializationIds.has(problemTileId) ||
          behavioralSpecializationIds.has(ctxProblemTile) ||
          categoryIsBehavior ||
          anySlugMatchesBehaviorRole));

    if (looksBehavioralFlow) {
      setReturnToProblemGridFromStyleHub(true);
      openBehavioristProviderProfile(String(vendorId));
      return;
    }

    const vetRoles = new Set(['veterinarian', 'vet', 'veterinary']);
    const groomingRoles = new Set(['groomer', 'grooming']);
    const trainingRoles = new Set(['trainer', 'training', 'pet_trainer', 'dog_trainer']);
    const walkerRoles = new Set(['dog_walker', 'walker', 'walking']);
    const boardingRoles = new Set(['boarding', 'pet_boarding', 'petboarding']);

    if (anySlugMatches(vetRoles) || vetRoles.has(role)) {
      if (serviceStyle === 'at_center') {
        handleVetNavigate('vet-clinic-profile', {
          id: vendorId,
          clinicProfileBackScreen: 'problem_grid_flow',
        });
      } else {
        handleVetNavigate('vet-doctor-details', {
          doctorId: vendorId,
          doctorProfileBackScreen: 'problem_grid_flow',
        });
      }
      return;
    }

    if (anySlugMatches(groomingRoles) || groomingRoles.has(role)) {
      setReturnToProblemGridFromStyleHub(true);
      if (serviceStyle === 'at_center') {
        setGroomingCenterProfileVendorId(vendorId);
        navigateToScreen('grooming_center');
      } else {
        setGroomingHomeProfileVendorId(vendorId);
        navigateToScreen('grooming_home');
      }
      return;
    }

    if (anySlugMatches(trainingRoles) || trainingRoles.has(role)) {
      setReturnToProblemGridFromStyleHub(true);
      if (serviceStyle === 'at_center') {
        setTrainingCenterProfileVendorId(vendorId);
        navigateToScreen('training_center');
      } else {
        setTrainingHomeProfileVendorId(vendorId);
        navigateToScreen('training_home');
      }
      return;
    }

    if (anySlugMatches(walkerRoles) || walkerRoles.has(role)) {
      setWalkerServiceData({
        vendorId,
        walker: { name: vendorName },
        walkerProfileBackScreen: 'problem_grid_flow',
      });
      navigateToScreen('walker-provider-profile');
      return;
    }

    if (anySlugMatches(boardingRoles) || boardingRoles.has(role)) {
      openProblemFlowPetBoardingProfile(vendorId, 'all');
      return;
    }

    const behavioristRoles = new Set([
      'behaviorist',
      'behaviourist',
      'pet_behaviourist',
      'pet_behaviorist',
      'pet_behavior',
      'behaviorist_solo',
      'behaviorist_center',
    ]);
    if (anySlugMatches(behavioristRoles) || behavioristRoles.has(role)) {
      setReturnToProblemGridFromStyleHub(true);
      openBehavioristProviderProfile(String(vendorId));
      return;
    }

    toast.message(
      'Use View Services to see everything this provider offers. Open their full profile from the matching service on the home screen.'
    );
  };

  const handleWalkerNavigate = (screen: string, data?: any) => {
    if (screen === 'purchase-package') {
      const normalized = normalizeWalkerServiceDataForPackagePurchase(data ?? null);
      openPurchasePackageScreen(normalized);
      return;
    }
    setWalkerServiceData(data);
    if (screen === 'walker-booking') {
      navigateToScreen('walker-booking');
    } else if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'walking' });
      navigateToScreen('create-booking');
    } else if (screen === 'walk-live-tracking') {
      const bid = data?.bookingId ?? data?.sessionId;
      setWalkerServiceData({ sessionId: bid, bookingId: bid });
      navigateToScreen('walk-live-tracking');
    } else if (screen === 'schedule-walk') {
      setWalkerServiceData({ packageId: data?.packageId });
      navigateToScreen('schedule-walk');
    } else if (screen === 'walker-provider-profile') {
      navigateToScreen('walker-provider-profile');
    }
  };

  const handleVendorProfileChat = useCallback(
    (data?: { vendorId?: string; vendorName?: string }) => {
      void openVendorProfileChat({
        phone,
        vendorId: String(data?.vendorId ?? '').trim(),
        vendorName: String(data?.vendorName ?? '').trim() || undefined,
        openBookingChat,
      });
    },
    [phone, openBookingChat]
  );

  const handleAccountNavigate = (path: string) => {
    setUserSidebarOpen(false);
    if (
      !isShopUiVisibleForAccount(phone) &&
      (path === 'shop' ||
        path === 'cart' ||
        path === 'account/orders' ||
        path === 'orders' ||
        path === 'promotions' ||
        path === 'offers')
    ) {
      return;
    }
    if (
      !isLoyaltyUiVisibleForAccount(phone) &&
      (path === 'rewards-loyalty' || path === 'referral-system')
    ) {
      return;
    }
    if (path === 'home') goToHome();
    else if (path === 'shop') goToShopFromParent();
    else if (path === 'cart') {
      openAccountHubFromMenu('cart');
    } else if (path === 'account/orders') {
      if (!isCustomerEcommerceEnabled()) {
        toast.info(CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE);
        return;
      }
      openAccountHubFromMenu('order_history');
    } else if (path === 'account/addresses') {
      openAccountHubFromMenu('address_book');
    } else if (path === 'account/wallet' || path === 'wallet') {
      openAccountHubFromMenu('wallet');
    } else if (path === 'my-packages') {
      rememberMyPackagesBackFromAccountMenu();
      router.push('/my-packages');
    } else if (path === 'rewards-loyalty') {
      if (currentScreen === 'wallet') {
        pushWalletHubChild('rewards-loyalty');
      } else {
        openAccountHubFromMenu('rewards-loyalty');
      }
    } else if (path === 'referral-system') {
      if (currentScreen === 'wallet') {
        pushWalletHubChild('referral-system');
      } else {
        openAccountHubFromMenu('referral-system');
      }
    } else if (path === 'appointments') {
      openAccountHubFromMenu('appointments');
    } else if (path === 'support_help' || path === 'help') {
      if (currentScreen === 'wallet') {
        pushWalletHubChild('support_help');
      } else {
        openAccountHubFromMenu('support_help');
      }
    } else if (path === 'promotions' || path === 'offers') {
      rememberPromotionsBackSpaScreen(currentScreen);
      router.push('/promotions');
    } else if (path === 'orders') {
      if (!isCustomerEcommerceEnabled()) {
        toast.info(CUSTOMER_ECOMMERCE_UNAVAILABLE_MESSAGE);
        return;
      }
      openAccountHubFromMenu('order_history');
    }
  };

  const handlePetSitterHubBack = () => {
    setUserSidebarOpen(false);
    if (petSitterOriginScreen) {
      const dest = petSitterOriginScreen;
      setPetSitterOriginScreen(null);
      navigateToScreen(dest);
      return;
    }
    handleBack();
  };

  const handleBottomNav = (screen: string) => {
    if (screen === 'home') {
      goToHome();
    } else if (screen === 'shop') {
      goToShopFromParent();
    } else if (screen === 'my-bookings') {
      bookingsFromAccountMenuRef.current = false;
      setUserSidebarOpen(false);
      setPetSitterOriginScreen(null);
      setPetSitterFacilityOptionId(null);
      setSpaBoardingVendorsSlug(null);
      setBoardingVendorsReturnScreen(null);
      shellNav.focusTabRoot('bookings');
    } else if (screen === 'profile') {
      setPetSitterOriginScreen(null);
      setPetSitterFacilityOptionId(null);
      setSpaBoardingVendorsSlug(null);
      setBoardingVendorsReturnScreen(null);
      handleProfileClick();
    }
  };

  const handleBack = () => {
    shellNav.back();
  };

  /** Profile / account full-screen pages: pop one level and reopen sidebar. */
  const backToAccountMenu = () => {
    profileFromAccountMenuRef.current = false;
    bookingsFromAccountMenuRef.current = false;
    accountHubFromMenuRef.current = false;
    goToHome();
    setUserSidebarOpen(true);
  };

  const returnToAccountMenuBookings = () => {
    if (!bookingsFromAccountMenuRef.current) {
      setSelectedBookingId(null);
      return;
    }
    setSelectedBookingId(null);
    rememberAccountSidebarActiveView('bookings');
    backToAccountMenu();
  };

  const openAccountHubFromMenu = (screen: ScreenType) => {
    accountHubFromMenuRef.current = true;
    setUserSidebarOpen(false);
    navigateToScreen(screen);
  };

  const pushWalletHubChild = (screen: ScreenType) => {
    walletPushedFromWalletRef.current = true;
    setUserSidebarOpen(false);
    pushShellScreen(screen);
  };

  const handleAccountHubBack = () => {
    resolveAccountHubRootBack({
      accountHubFromMenu: accountHubFromMenuRef.current,
      pop: handleBack,
      backToAccountMenu,
      clearMenuRef: () => {
        accountHubFromMenuRef.current = false;
      },
    });
  };

  const backFromWalletHubChild = () => {
    resolveWalletHubChildBack({
      navigationHistory,
      pushedFromWallet: walletPushedFromWalletRef.current,
      accountHubFromMenu: accountHubFromMenuRef.current,
      pop: () => {
        walletPushedFromWalletRef.current = false;
        handleBack();
      },
      backToAccountMenu,
    });
  };

  const handleShellAccountBack = () => {
    const screen = currentScreenForBackRef.current;
    if (screen === 'customer-profile' && profileFromAccountMenuRef.current) {
      handleCustomerProfileBackRef.current();
      return;
    }
    if (screen === 'my-bookings' && bookingsFromAccountMenuRef.current) {
      handleMyBookingsBackRef.current();
      return;
    }
    if (WALLET_HUB_CHILDREN.has(screen)) {
      backFromWalletHubChild();
      return;
    }
    if (
      accountHubFromMenuRef.current &&
      (screen === 'wallet' ||
        screen === 'order_history' ||
        screen === 'appointments' ||
        screen === 'address_book' ||
        screen === 'cart')
    ) {
      handleAccountHubBack();
      return;
    }
    handleBack();
  };

  /** Embedded shop order tracking — keyed so repeat Track does not stack duplicates. */
  const goToEmbeddedOrderTracking = (orderId: string) => {
    const id = String(orderId || '').trim();
    if (!id) return;
    setSelectedOrder({ id });
    navigateToScreen('order_tracking', routeKey.order(id));
  };

  /** Android hardware back: overlays → shell pop on `/` (URL back handled globally). */
  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;

  useEffect(() => {
    if (currentScreen !== 'grooming-booking') {
      groomingBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'training-booking') {
      trainingBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'vet-booking') {
      vetBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'nutritionist-booking') {
      nutritionistBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'purchase-package' && currentScreen !== 'package-booking') {
      packageBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'support_help') {
      supportHelpInternalBackRef.current = null;
    }
    if (currentScreen !== 'vet-tele-consultation') {
      teleInternalBackRef.current = null;
    }
    if (currentScreen !== 'vet-home-visit') {
      homeVisitInternalBackRef.current = null;
    }
    if (currentScreen !== 'walker-booking') {
      walkerBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'boarding-booking' && currentScreen !== 'pet-sitter-booking') {
      boardingBookingInternalBackRef.current = null;
    }
    if (currentScreen !== 'diagnostics-booking') {
      diagnosticsBookingInternalBackRef.current = null;
    }
  }, [currentScreen]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (pathname !== '/') return false;
      const screen = currentScreenForBackRef.current;
      if (screen === 'grooming-booking' && groomingBookingInternalBackRef.current) {
        groomingBookingInternalBackRef.current();
        return true;
      }
      if (screen === 'training-booking' && trainingBookingInternalBackRef.current) {
        trainingBookingInternalBackRef.current();
        return true;
      }
      if (screen === 'vet-booking' && vetBookingInternalBackRef.current) {
        vetBookingInternalBackRef.current();
        return true;
      }
      if (screen === 'nutritionist-booking' && nutritionistBookingInternalBackRef.current) {
        nutritionistBookingInternalBackRef.current();
        return true;
      }
      if (
        (screen === 'purchase-package' || screen === 'package-booking') &&
        packageBookingInternalBackRef.current
      ) {
        packageBookingInternalBackRef.current();
        return true;
      }
      if (screen === 'support_help' && supportHelpInternalBackRef.current) {
        supportHelpInternalBackRef.current();
        return true;
      }
      if (screen === 'vet-tele-consultation' && teleInternalBackRef.current) {
        teleInternalBackRef.current();
        return true;
      }
      if (screen === 'vet-home-visit' && homeVisitInternalBackRef.current) {
        homeVisitInternalBackRef.current();
        return true;
      }
      if (screen === 'walker-booking' && walkerBookingInternalBackRef.current) {
        walkerBookingInternalBackRef.current();
        return true;
      }
      if (
        (screen === 'boarding-booking' || screen === 'pet-sitter-booking') &&
        boardingBookingInternalBackRef.current
      ) {
        boardingBookingInternalBackRef.current();
        return true;
      }
      if (screen === 'diagnostics-booking' && diagnosticsBookingInternalBackRef.current) {
        diagnosticsBookingInternalBackRef.current();
        return true;
      }
      return false;
    }, BACK_HANDLER_PRIORITY.shellWizardStep);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/' || currentScreen !== 'payment') return;
    return registerLeaveGuard({
      id: 'shell-booking-payment',
      canLeave: () => false,
      confirmLeave: () =>
        window.confirm('Leave payment? Your selected slot may be released.'),
    });
  }, [pathname, currentScreen]);

  useEffect(() => {
    return registerBackHandler(() => {
      if (showAddPetModal) {
        setShowAddPetModal(false);
        return true;
      }
      if (userSidebarOpen) {
        if (overlayBackRef.current?.()) {
          return true;
        }
        setUserSidebarOpen(false);
        return true;
      }
      if (sidebarOpen) {
        setSidebarOpen(false);
        return true;
      }
      if (pathname !== '/') return false;
      if (currentScreenForBackRef.current === 'payment') {
        void (async () => {
          if (await requestLeave()) {
            handleShellAccountBackRef.current();
          }
        })();
        return true;
      }
      if (canPop) {
        handleShellAccountBackRef.current();
        return true;
      }
      return false;
    }, BACK_HANDLER_PRIORITY.shellOverlay);
  }, [showAddPetModal, userSidebarOpen, sidebarOpen, pathname, canPop]);

  /** Diagnostic Labs: back to Veterinary hub when opened from vet; otherwise same reset as `handleBack` (e.g. home). */
  const handleBackFromLabDiagnostics = () => {
    const back = labDiagnosticsReturnScreen;
    if (back != null) {
      setLabDiagnosticsReturnScreen(null);
      setUserSidebarOpen(false);
      setSelectedVendorId(undefined);
      setDiagnosticsPackageHint(null);
      navigateToScreen(back);
      return;
    }
    handleBack();
  };

  /** Package flows: pop returns to provider profile; strip package overlay so profile can render. */
  const handleBackFromPackageBooking = () => {
    if (shouldBannerReturnHome(vetServiceData, walkerServiceData)) {
      bannerReturnHomeRef.current = false;
      setWalkerServiceData(null);
      handleBack();
      return;
    }
    const pkgVid = String(
      walkerServiceData?.vendorId ?? vetServiceData?.vendorId ?? '',
    ).trim();
    const pkgSid = String(
      walkerServiceData?.vendorServiceId ??
        (walkerServiceData as { vendor_service_id?: string } | null)?.vendor_service_id ??
        vetServiceData?.serviceId ??
        '',
    ).trim();
    if (pkgVid && pkgSid) {
      markSkipPackageAutoRedirect(pkgVid, pkgSid);
    }
    setWalkerServiceData((prev: Record<string, unknown> | null) =>
      stripPackagePurchaseOverlayFields(prev),
    );
    setVetServiceData((prev: Record<string, unknown> | null) =>
      stripPackagePurchaseOverlayFields(prev),
    );

    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      const belowTop = prev[prev.length - 2]?.screen;
      if (isPackagePurchaseTransitScreen(belowTop)) {
        return prev.slice(0, -2);
      }
      return popShellEntry(prev);
    });
  };

  const handleMyBookingsBack = () => {
    if (bookingsFromAccountMenuRef.current) {
      bookingsFromAccountMenuRef.current = false;
      rememberAccountSidebarActiveView('bookings');
      backToAccountMenu();
      return;
    }
    handleBack();
  };

  const handleCustomerProfileBack = () => {
    if (profileFromAccountMenuRef.current) {
      profileFromAccountMenuRef.current = false;
      backToAccountMenu();
      return;
    }
    handleBack();
  };

  handleMyBookingsBackRef.current = handleMyBookingsBack;
  handleCustomerProfileBackRef.current = handleCustomerProfileBack;
  handleAccountHubBackRef.current = handleAccountHubBack;
  handleShellAccountBackRef.current = handleShellAccountBack;

  const navigateToPets = () => {
    navigateToScreen('pets');
  };

  const handleBackFromPets = () => {
    handleBack();
  };

  const handlePetDeleted = () => {
    setRefreshKey(prev => prev + 1);
    goToHome();
  };

  const handlePetProfileComplete = async (pets: any[]) => {
    setRefreshKey(prev => prev + 1);
    goToHome();
  };

  const handleViewBooking = (bookingId: string, petId?: string) => {
    setSelectedBookingId(bookingId);
    if (petId) setSelectedPetId(petId);
    const fromAccountMenu = userSidebarOpen;
    setSidebarOpen(false);
    setUserSidebarOpen(false);
    bookingsFromAccountMenuRef.current = fromAccountMenu;
    if (fromAccountMenu) {
      rememberAccountSidebarActiveView('bookings');
    }
    navigateToScreen('my-bookings');
  };

  const handleReorderMedicine = (medications: any[], prescriptionId?: string, _bookingId?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Reordering medicines:', medications, prescriptionId);
    }
    // ✅ From My Bookings → vet appointment → prescription: open medicine delivery flow (prescription → address → broadcast → invoice → pay)
    if (prescriptionId) {
      setPrescriptionOrderData({ prescriptionId });
      navigateToScreen('pharmacy_order_flow');
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
      navigateToScreen('pharmacy_checkout');
    } else {
      toast.success('Navigating to Pharmacy...');
      navigateToScreen('pharmacy');
    }
  };

  const accountSidebarOverlay =
    userSidebarOpen ? (
      <UserAccountSidebar
        phone={phone}
        onClose={() => setUserSidebarOpen(false)}
        onNavigateHome={goToHome}
        onRegisterOverlayBack={(handler) => {
          overlayBackRef.current = handler;
        }}
        onViewBooking={handleViewBooking}
        onViewMyPackages={() => {
          rememberMyPackagesBackFromAccountMenu();
          router.push('/my-packages');
        }}
        onViewProfile={() => {
          setUserSidebarOpen(false);
          profileFromAccountMenuRef.current = true;
          navigateToScreen('customer-profile');
        }}
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
      /** Payment only: no inner layout shell — UniversalPaymentPage uses fixed viewport fill. */
      bareContent?: boolean;
    }
  ): ReactNode => {
    if (options.bareContent) {
      return (
        <CustomerScreenWrapper customerPhone={phone}
          currentScreen={screen}
          onNavigate={handleBottomNav}
          onProfileClick={handleProfileClick}
          accountSidebar={accountSidebarOverlay}
        >
          {component}
        </CustomerScreenWrapper>
      );
    }

    const contentClass = screen === 'payment' ? 'bg-[#FAF6F0]' : 'bg-gray-50';
    return (
      <CustomerScreenWrapper customerPhone={phone} 
        currentScreen={screen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <div className={`min-h-screen min-h-[100dvh] w-full ${contentClass}`}>
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
              onNavigate={(s: string, navData?: unknown) => handleNavigateToService(s, navData)}
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

  if (currentScreen === 'meal-order-tracking' && mealTrackNav?.orderId) {
    return (
      <OrderTrackingScreen
        orderId={mealTrackNav.orderId}
        orderType="meal"
        onBack={() => {
          setMealTrackNav(null);
          handleBack();
        }}
        onNeedHelp={(ctx) => {
          storeSupportMealOrderContext(ctx);
          if (mealTrackNav?.orderId) {
            rememberMealTrackSupportBack(mealTrackNav.orderId, mealTrackNav.backScreen ?? 'meal-plan-orders');
          }
          rememberHelpBackSpaScreen('meal-order-tracking');
          navigateToScreen('support_help');
        }}
      />
    );
  }

  if (currentScreen === 'home') {
    return (
      <CustomerScreenWrapper customerPhone={phone} 
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
                if (!isCustomerMealPlansEnabled()) {
                  toast.info('Meal order tracking is coming soon.');
                  return;
                }
                openMealOrderTracking(orderId, 'home');
              } else if (orderId) {
                goToEmbeddedOrderTracking(orderId);
              } else {
                handleNavigateToService(screen, data);
              }
              return;
            }
            // ✅ Handle GPS Live Tracking navigation
            if (screen === 'gps-tracking' || screen === 'tracking') {
              setTrackingBookingId(data?.bookingId);
              navigateToScreen('gps-tracking');
            }
            // ✅ Handle Video Call navigation
            else if (screen === 'video-call') {
              setVideoCallData({ bookingId: data?.bookingId, meetingId: data?.meetingId });
              navigateToScreen('video-call');
            }
            // ✅ FIX: View Details from Upcoming & Active / notifications → open My Bookings with that booking's detail modal (by bookingId)
            else if (screen === 'booking-details' && data?.bookingId) {
              setSelectedBookingId(data.bookingId);
              bookingsFromAccountMenuRef.current = false;
              navigateToScreen('my-bookings');
              return;
            }
            // ✅ FIX: my-bookings with bookingId (e.g. from notification) → same as booking-details
            else if (screen === 'my-bookings' && data?.bookingId) {
              setSelectedBookingId(data.bookingId);
              bookingsFromAccountMenuRef.current = false;
              navigateToScreen('my-bookings');
              return;
            }
            // Handle problem-based navigation
            else if (screen === 'services_by_problem' || screen === 'problem_selected') {
              if (
                isEmergencyProblemTileLocked({
                  id: data?.problemId,
                  name: data?.problemTitle,
                  displayName: data?.problemTitle,
                })
              ) {
                toast.info('Emergency care is coming soon on the app.');
                return;
              }
              const categoryStored = data?.category ?? data?.problem?.category;
              const rawCategory = String(categoryStored ?? '').toLowerCase();
              const isBehaviorCategory =
                rawCategory === 'behavioral' ||
                rawCategory === 'behavior' ||
                rawCategory === 'sub_behavior';
              let roleIdForFlow = String(data?.roleId ?? data?.problem?.roleId ?? '').trim();
              if (isBehaviorCategory && roleIdForFlow && !/behav/i.test(roleIdForFlow)) {
                roleIdForFlow = 'behaviorist';
              }
              if (isBehaviorCategory && !roleIdForFlow) {
                roleIdForFlow = 'behaviorist';
              }
              // ✅ Route through ProblemGridFlowRouter; use allowedServiceStyles from specialization so only allowed styles show
              setSelectedProblem({
                id: data?.problemId,
                title: data?.problemTitle || 'Service',
                roleId: roleIdForFlow || data?.roleId,
                category: categoryStored ?? (isBehaviorCategory ? 'behavioral' : undefined),
                allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(
                  (data?.problem?.allowedServiceStyles ??
                    (data?.allowedServiceStyles
                      ? Array.isArray(data.allowedServiceStyles)
                        ? data.allowedServiceStyles
                        : [data.allowedServiceStyles]
                      : null)) as string[] | null,
                  {
                    roleId: roleIdForFlow || data?.roleId,
                    specializationId: data?.problemId,
                    categoryHint: categoryStored ?? (isBehaviorCategory ? 'behavioral' : undefined),
                  }
                ),
              });
              setProblemGridSpecialization(data?.problemId || undefined);
              navigateToScreen('problem_grid_flow');
            } else if (screen === 'problem_grid') {
              setCurrentServiceType(data?.roleId || 'general');
              navigateToScreen('problem_grid');
            } else if (screen === 'shop') {
              const raw =
                data && typeof data === 'object'
                  ? (data as { category?: string; categoryId?: string }).category ??
                    (data as { category?: string; categoryId?: string }).categoryId
                  : undefined;
              const cat = raw != null ? String(raw).trim() : '';
              if (cat) goToShopFromParent({ category: cat });
              else goToShopFromParent();
            } else if (screen === 'support_help') {
              if (typeof window !== 'undefined' && data?.initialTab) {
                try {
                  sessionStorage.setItem(SUPPORT_INITIAL_TAB_KEY, data.initialTab);
                } catch {
                  /* ignore */
                }
              }
              navigateToScreen('support_help');
            } else if (screen === 'booking-messages') {
              openMessages();
              return;
            } else if (screen === 'article-detail' && data?.article) {
              const a = data.article as { id?: string; slug?: string };
              const ref = (a.slug || a.id || '').toString();
              if (ref) navigateToArticleFromHome(router, ref);
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
          setTrackingBookingId(null);
          handleBack();
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
          handleBack();
        }}
      />
    );
  }

  if (currentScreen === 'customer-profile') {
    return (
      <CustomerProfileView
        phone={phone}
        onBack={handleCustomerProfileBack}
        onCloseToHome={goToHome}
        ordersBackSpaScreen="customer-profile"
      />
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
          handleBack();
        }}
        onViewBooking={handleViewBooking}
        onDelete={handlePetDeleted}
        onViewPetProfile={(petData: any) => {
          setSelectedPetData(petData);
          navigateToScreen('pet-profile-dashboard');
        }}
      />
    );
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
          handleBack();
        }}
      />
    );
  if (currentScreen === 'add-pet')
    return (
      <EnhancedAddPetModal
        key="screen-add-pet"
        variant="fullscreen"
        phone={phone}
        isOpen
        onBack={handleBack}
        onClose={handleBack}
        onSuccess={() => {
          void handlePetProfileComplete([]);
        }}
      />
    );
  
  // Core Services
  // ✅ FIX: Walker with Frame UI (ServiceDashboardHeader only – skipHeader to avoid double header)
  if (currentScreen === 'walker') {
    return renderScreenWithLayout('walker',
      <WalkerDashboard phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
        if (screen === 'problem_grid') {
          setCurrentServiceType('walker');
          navigateToScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Walking Service', roleId: 'walker' });
          setProblemGridSpecialization(data?.problemId || undefined);
          navigateToScreen('problem_grid_flow');
        } else {
          handleWalkerNavigate(screen, data);
        }
      }} data={walkerServiceData} />,
      { title: 'Pet Walking', subtitle: 'Professional dog walking services', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Walker booking flow – use WalkerBookingRouter (same pattern as vet/grooming/training)
  if (currentScreen === 'walker-booking') {
    const walkerBookingVendorId =
      String(walkerServiceData?.vendorId || '').trim() ||
      pickWalkerVendorId((walkerServiceData?.walker || walkerServiceData || {}) as Record<string, unknown>);
    return (
      <WalkerBookingRouter
        phone={phone}
        vendorId={walkerBookingVendorId || undefined}
        walker={walkerServiceData?.walker}
        selectedService={walkerServiceData?.serviceId}
        serviceId={walkerServiceData?.serviceId}
        serviceName={walkerServiceData?.serviceName}
        serviceStyle={walkerServiceData?.serviceStyle || 'at_home'}
        serviceType={walkerServiceData?.serviceType || 'walking'}
        price={walkerServiceData?.price}
        duration={walkerServiceData?.duration}
        onBack={() => backFromBannerOr(handleBack, walkerServiceData, vetServiceData)}
        onInternalBackReady={(fn) => { walkerBookingInternalBackRef.current = fn; }}
        onNavigate={(screen, data) => {
          if (screen === 'booking-details' || screen === 'booking-confirmation') {
            handleViewBooking(data?.bookingId);
          } else if (screen === 'walk-live-tracking') {
            const bid = data?.bookingId ?? data?.sessionId;
            setWalkerServiceData({ sessionId: bid, bookingId: bid });
            navigateToScreen('walk-live-tracking');
          } else if (screen === 'schedule-walk') {
            setWalkerServiceData({ packageId: data?.packageId });
            navigateToScreen('schedule-walk');
          } else {
            handleWalkerNavigate(screen, data);
          }
        }}
        onViewBooking={handleViewBooking}
      />
    );
  }
  if (currentScreen === 'walker-provider-profile' && walkerServiceData?.vendorId) {
    const vid = walkerServiceData.vendorId as string;
    return (
      <HomeServiceProviderProfile
        phone={phone}
        vendorId={vid}
        serviceType="walker"
        config={SERVICE_CONFIGS.walker}
        onBack={() => backFromBannerOr(handleBack, walkerServiceData)}
        onOpenWalkServicesAndBundles={() => {
          const resolvedVid =
            String(vid || '').trim() ||
            pickWalkerVendorId((walkerServiceData?.walker || {}) as Record<string, unknown>);
          handleWalkerNavigate('walker-booking', {
            vendorId: resolvedVid,
            walker: walkerServiceData?.walker,
            serviceType: 'walking',
            serviceStyle: 'at_home',
            walkerProfileBackScreen:
              (walkerServiceData?.walkerProfileBackScreen as ScreenType) || 'walker',
          });
        }}
        onSelectService={(service, rawRow) => {
          if (rawRow && isVendorServicePackageRow(rawRow)) {
            const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
              vendorId: vid,
              vendorName: String(
                walkerServiceData?.walker?.name ??
                  walkerServiceData?.walker?.businessName ??
                  ''
              ).trim() || undefined,
              serviceRow: rawRow,
              serviceTypeCategory: 'walking',
              serviceStyle: 'at_home',
            });
            if (pkgNav) {
              openPurchasePackageScreen(pkgNav as Record<string, unknown>, { mergeWalkerData: true });
              return;
            }
          }
          setWalkerServiceData((prev: any) => ({
            ...(prev || {}),
            vendorId: vid,
            walker: prev?.walker ?? walkerServiceData?.walker,
            serviceType: 'walking',
            serviceStyle: 'at_home',
            serviceId: service.id,
            serviceName: service.name,
            price: service.price,
            duration: service.duration,
          }));
          navigateToScreen('walker-booking');
        }}
        onNavigate={(screen, data) => {
          if (screen === 'chat') {
            handleVendorProfileChat(data);
            return;
          }
          handleWalkerNavigate(screen, data);
        }}
      />
    );
  }
  if (currentScreen === 'behaviorist-provider-profile' && resolvedBehavioristProfileVendorId) {
    const vid = resolvedBehavioristProfileVendorId;
    return (
      <HomeServiceProviderProfile
        phone={phone}
        vendorId={vid}
        serviceType="behaviourist"
        config={SERVICE_CONFIGS.behaviourist}
        onBack={() => {
          setBehavioristProfileVendorId(null);
          clearProviderProfileContext('behaviorist');
          if (returnToProblemGridFromStyleHub) {
            setReturnToProblemGridFromStyleHub(false);
            navigateToScreen('problem_grid_flow');
            return;
          }
          handleBack();
        }}
        onSelectService={(service, rawRow) => {
          if (rawRow && isVendorServicePackageRow(rawRow)) {
            const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
              vendorId: vid,
              serviceRow: rawRow,
              serviceTypeCategory: 'behaviorist',
              serviceStyle: 'at_home',
            });
            if (pkgNav) {
              handleNavigateToService('purchase-package', pkgNav);
              return;
            }
          }
          setSelectedHomeServiceType('behaviourist');
          setSelectedVendorId(vid);
          setVetServiceData({
            vendorId: vid,
            serviceType: 'behaviourist',
            serviceId: service.id,
            serviceName: service.name,
            price: service.price,
            duration: service.duration,
          });
          navigateToScreen('universal-home-booking');
        }}
        onNavigate={(screen, data) => {
          if (screen === 'chat') {
            handleVendorProfileChat(data);
            return;
          }
          handleBottomNav(screen);
        }}
      />
    );
  }
  if (currentScreen === 'pet-sitter-provider-profile' && resolvedPetSitterProfileVendorId) {
    const vid = resolvedPetSitterProfileVendorId;
    return (
      <HomeServiceProviderProfile
        phone={phone}
        vendorId={vid}
        serviceType="sitter"
        config={SERVICE_CONFIGS.sitter}
        onBack={() => {
          setPetSitterProfileVendorId(null);
          clearProviderProfileContext('pet-sitter');
          handleBack();
        }}
        onSelectService={(service, rawRow) => {
          if (rawRow && isVendorServicePackageRow(rawRow)) {
            const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
              vendorId: vid,
              serviceRow: rawRow,
              serviceTypeCategory: 'sitting',
              serviceStyle: 'at_home',
            });
            if (pkgNav) {
              handleNavigateToService('purchase-package', pkgNav);
              return;
            }
          }
          setVetServiceData({
            vendorId: vid,
            serviceType: 'sitting',
            serviceId: service.id,
            serviceName: service.name,
            price: service.price,
            duration: service.duration,
            serviceStyle: 'at_home',
          });
          navigateToScreen('pet-sitter-booking');
        }}
        onNavigate={(screen, data) => {
          if (screen === 'chat') {
            handleVendorProfileChat(data);
            return;
          }
          handleBottomNav(screen);
        }}
      />
    );
  }
  if (currentScreen === 'walk-live-tracking') return <WalkLiveTrackingView bookingId={walkerServiceData?.bookingId || walkerServiceData?.sessionId || ''} onBack={handleBack} />;
  if (currentScreen === 'schedule-walk') return <CreateBookingPage phone={phone} vendorId={walkerServiceData?.vendorId} serviceId={walkerServiceData?.packageId} serviceStyle="at_home" onBack={handleBack} onSuccess={(bookingId) => handleViewBooking(bookingId)} />;
  // ✅ FIX: Vet Service with Frame UI (ServiceDashboardHeader)
  if (currentScreen === 'vet') {
    return renderScreenWithLayout('vet',
      <VetServiceRouter 
        phone={phone} 
        onBack={handleBack} 
        onNavigate={(screen, data) => {
          if (screen === 'problem_grid') {
            setCurrentServiceType('veterinarian');
            navigateToScreen('problem_grid');
          } else if (screen === 'problem_selected') {
            if (
              isEmergencyProblemTileLocked({
                id: data?.problemId,
                name: data?.problemTitle,
                displayName: data?.problemTitle,
              })
            ) {
              toast.info('Emergency care is coming soon on the app.');
              return;
            }
            setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Vet Service', roleId: 'veterinarian' });
            setProblemGridSpecialization(data?.problemId || undefined);
            navigateToScreen('problem_grid_flow');
          } else {
            handleVetNavigate(screen, data);
          }
        }} 
        data={vetServiceData} 
      />,
      { title: 'Veterinary Services', subtitle: 'Professional pet healthcare', showBackButton: true, skipHeader: true }
    );
  }
  if (currentScreen === 'vet-booking') return <VetBookingRouter phone={phone} doctorId={vetServiceData?.vendorId || vetServiceData?.doctorId} vendorId={vetServiceData?.vendorId} clinicId={vetServiceData?.clinicId || vetServiceData?.id} doctor={vetServiceData?.doctor} selectedService={vetServiceData?.service} serviceType={vetServiceData?.serviceType} serviceId={vetServiceData?.serviceId} serviceName={vetServiceData?.serviceName} serviceStyle={vetServiceData?.serviceStyle} price={vetServiceData?.price} duration={vetServiceData?.duration} selectedServices={vetServiceData?.selectedServices} vendorName={vetServiceData?.vendorName} onBack={() => backFromBannerOr(handleBack, vetServiceData)} onInternalBackReady={(fn) => { vetBookingInternalBackRef.current = fn; }} onNavigate={handleVetNavigate} onViewBooking={handleViewBooking} />;
  if (currentScreen === 'vet-doctor-details')
    return (
      <VetDoctorDetails
        phone={phone}
        doctorId={vetServiceData?.doctorId || ''}
        onBack={() => backFromBannerOr(handleBack, vetServiceData)}
        onNavigate={handleVetNavigate}
      />
    );
  if (currentScreen === 'vet-clinic-list') return <ClinicListView phone={phone} specialization={problemGridSpecialization} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'purchase-package') {
      handleVetNavigate(screen, data);
      return;
    }
    if (screen === 'vet-services-by-style') {
      setVetServiceData({
        ...(data || {}),
        returnScreen: data?.returnScreen || 'vet-clinic-list',
      });
      navigateToScreen('vet-services-by-style');
    } else if (screen === 'clinic-profile' || screen === 'clinic-details') {
      setVetServiceData({
        ...data,
        id: data?.id || data?.clinicId,
        clinicProfileBackScreen: data?.clinicProfileBackScreen ?? 'vet-clinic-list',
      });
      navigateToScreen('vet-clinic-profile');
    } else if (screen === 'appointment' || screen === 'vet-booking') {
      setVetServiceData({
        ...vetServiceData,
        id: data?.clinicId || data?.vendorId || vetServiceData?.id,
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
    } else {
      handleVetNavigate(screen, data);
    }
  }} />;
  if (currentScreen === 'vet-clinic-profile') return <ClinicProfileView phone={phone} clinicId={vetServiceData?.id || ''} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'purchase-package') {
      handleVetNavigate(screen, data);
      return;
    }
    if (screen === 'appointment' || screen === 'vet-booking') {
      setVetServiceData({
        ...vetServiceData,
        id: data?.clinicId || vetServiceData?.id,
        vendorId: data?.vendorId || data?.clinicId || vetServiceData?.id,
        clinicId: data?.clinicId || vetServiceData?.id,
        vendorName: data?.vendorName || vetServiceData?.vendorName,
        serviceType: data?.serviceType || 'at_center',
        serviceStyle: data?.serviceStyle || 'at_center',
        service: data?.service,
        serviceId: data?.serviceId,
        serviceName: data?.serviceName,
        price: data?.price,
        duration: data?.duration,
        doctor: data?.doctor,
        clinic: data?.clinic,
      });
      navigateToScreen('vet-booking');
    } else {
      handleVetNavigate(screen, data);
    }
  }} />;
  if (currentScreen === 'vet-clinic-booking') return <VetBookingFlow phone={phone} serviceType={vetServiceData?.serviceType || 'tele'} vendorId={vetServiceData?.vendorId} onBack={handleBack} onNavigate={handleVetNavigate} />;

  if (currentScreen === 'pet-boarding-vendors') {
    const slug = normalizeBoardingServiceSlug(spaBoardingVendorsSlug ?? petBoardingServiceSlug ?? null);
    return (
      <BoardingVendorListView
        phone={phone}
        serviceSlug={slug}
        onBack={() => {
          if (pathname === '/pet-boarding/vendors' || pathname.startsWith('/pet-boarding/vendors')) {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY, 'boarding');
            }
            router.push('/');
            return;
          }
          setSpaBoardingVendorsSlug(null);
          setBoardingVendorsReturnScreen(null);
          handleBack();
        }}
        onNavigate={(screen, data) => {
          if (screen === 'purchase-package') {
            handleNavigateToService(screen, data);
            return;
          }
          if (screen === 'boarding-booking') {
            setVetServiceData({
              vendorId: data?.vendorId as string | undefined,
              serviceType: (data?.flowVariant === 'swimming' || data?.serviceType === 'swimming'
                ? 'swimming'
                : 'boarding') as string,
              flowVariant: data?.flowVariant as string | undefined,
              serviceId: data?.serviceId as string | undefined,
              serviceName: data?.serviceName as string | undefined,
              price: data?.price as number | undefined,
              duration: data?.duration as number | undefined,
              serviceStyle: data?.serviceStyle as string | undefined,
              serviceSlug: data?.serviceSlug as string | undefined,
              facility: data?.facility,
            });
            navigateToScreen('boarding-booking');
          } else if (screen === 'pet-boarding-profile') {
            const bid = customerBoardingProfileVendorIdFromNavigateData(data);
            if (!bid) {
              toast.error('Profile unavailable — missing vendor id.');
              return;
            }
            openEmbeddedPetBoardingProfile(
              bid,
              data?.serviceSlug != null && String(data.serviceSlug) !== ''
                ? normalizeBoardingServiceSlug(String(data.serviceSlug))
                : slug,
            );
          }
        }}
      />
    );
  }

  if (currentScreen === 'pet-boarding-profile' && resolvedBoardingProfileVendorId) {
    const effectiveVendorId = resolvedBoardingProfileVendorId;
    const slug = resolvedBoardingProfileSlug;
    return (
      <BoardingVendorProfileView
        phone={phone}
        vendorId={effectiveVendorId}
        serviceSlug={slug}
        footerActiveTab="home"
        onBack={() => {
          backFromBannerOr(() => {
          if (problemFlowBoardingVendorId) {
            setProblemFlowBoardingVendorId(null);
            setProblemFlowBoardingSlug(null);
            clearBoardingProfileContext();
            navigateToScreen('problem_grid_flow');
            return;
          }
          if (embeddedBoardingProfileVendorId) {
            setEmbeddedBoardingProfileVendorId(null);
            setEmbeddedBoardingProfileSlug(null);
            clearBoardingProfileContext();
            handleBack();
            return;
          }
          router.push(`/pet-boarding/vendors?service=${encodeURIComponent(slug)}`);
          }, vetServiceData);
        }}
        onNavigate={(screen, data) => {
          if (screen === 'purchase-package') {
            handleNavigateToService(screen, data);
            return;
          }
          if (screen === 'boarding-booking') {
            setVetServiceData(
              mergeBannerNavigationPayload(vetServiceData, {
              vendorId: data?.vendorId,
              serviceType: 'boarding',
              serviceId: data?.serviceId,
              serviceName: data?.serviceName,
              price: data?.price,
              duration: data?.duration,
              serviceStyle: data?.serviceStyle,
              facility: data?.facility,
              })
            );
            navigateToScreen('boarding-booking');
          }
        }}
      />
    );
  }

  if (currentScreen === 'vet-services-by-style')
    return (
      <VetServicesByStyle
        phone={phone}
        vendorId={vetServiceData?.vendorId}
        serviceStyle={vetServiceData?.serviceStyle || 'tele'}
        serviceTypeName={vetServiceData?.serviceTypeName}
        category={vetServiceData?.category || 'vet'}
        specialization={vetServiceData?.specialization || problemGridSpecialization}
        onBack={() => {
          backFromBannerOr(() => {
          if (vetServiceData?.returnScreen === 'problem_grid_flow') {
            setVetServiceData(null);
            handleBack();
            return;
          }
          if (vetServiceData?.vendorId && vetServiceData?.returnScreen === 'vet-clinic-list') {
            setVetServiceData((p: any) => {
              if (!p || typeof p !== 'object') return null;
              const { vendorId: _v, ...rest } = p;
              return Object.keys(rest).length ? rest : null;
            });
            handleBack();
            return;
          }
          if (vetServiceData?.vendorId && vetServiceData?.returnScreen === 'vet') {
            setVetServiceData(null);
            handleBack();
            return;
          }
          if (vetServiceData?.vendorId) {
            // Default vendor profile back for clinic-visit style should go to filtered clinic list.
            if (vetServiceData?.serviceStyle === 'at_center') {
              setVetServiceData((p: any) => {
                if (!p || typeof p !== 'object') return null;
                const { vendorId: _v, ...rest } = p;
                return Object.keys(rest).length ? rest : null;
              });
              navigateToScreen('vet-clinic-list');
              return;
            }
            setVetServiceData((p: any) => {
              if (!p || typeof p !== 'object') return p;
              const { vendorId: _v, ...rest } = p;
              return Object.keys(rest).length ? rest : null;
            });
            return;
          }
          if (vetServiceData?.returnScreen === 'vet-clinic-list') {
            handleBack();
            return;
          }
          handleBack();
          }, vetServiceData);
        }}
        onNavigate={handleVetNavigate}
      />
    );
  // Tele Consultation chooser: Vet vs Pet Nutrition, before entering either flow
  if (currentScreen === 'tele-consultation-hub') {
    return renderScreenWithLayout('tele-consultation-hub',
      <TeleConsultationHub
        onBack={handleBack}
        onSelect={(choice) => {
          if (choice === 'nutritionist') {
            navigateToScreen('diet-consultation-services');
          } else {
            setTeleSkipToScheduled(true);
            navigateToScreen('vet-tele-consultation');
          }
        }}
      />,
      { title: 'Tele Consultation', subtitle: 'Talk to an expert over video', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Tele Consultation Router
  if (currentScreen === 'vet-tele-consultation') {
    return renderScreenWithLayout('vet-tele-consultation',
      <TeleConsultationRouter 
        phone={phone} 
        skipModeSelection={teleSkipModeSelection}
        skipToScheduled={teleSkipToScheduled}
        restoredSnapshot={teleWizardRestore}
        onRestoredSnapshotConsumed={() => setTeleWizardRestore(null)}
        onBack={handleBack}
        onInternalBackReady={(fn) => { teleInternalBackRef.current = fn; }}
        onNavigate={(screen, data) => {
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
            navigateToScreen('add-pet');
          } else if (screen === 'payment') {
            setPaymentData({
              ...(data && typeof data === 'object' ? data : {}),
              returnScreen: 'vet-tele-consultation',
            });
            navigateToScreen('payment');
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
        restoredSnapshot={homeVisitWizardRestore}
        onRestoredSnapshotConsumed={() => setHomeVisitWizardRestore(null)}
        onBack={handleBack}
        onInternalBackReady={(fn) => { homeVisitInternalBackRef.current = fn; }}
        onNavigate={(screen, data) => {
          // Handle navigation from HomeVisitRouter
          if (screen === 'payment') {
            setPaymentData({
              ...(data && typeof data === 'object' ? data : {}),
              returnScreen: 'vet-home-visit',
            });
            navigateToScreen('payment');
          } else if (screen === 'add-pet') {
            navigateToScreen('add-pet');
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
    let promotionIntent: any = bookingData?.promotionIntent;
    if (!promotionIntent && typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('wp_promotion_cta');
        if (raw) {
          const parsed = JSON.parse(raw);
          const clickedAt = Number(parsed?.clickedAt || parsed?.at || 0);
          const maxIntentAgeMs = 6 * 60 * 60 * 1000;
          if (parsed?.promotionId && clickedAt > 0 && Date.now() - clickedAt <= maxIntentAgeMs) {
            promotionIntent = parsed;
          }
        }
      } catch {
        // ignore stale/malformed session data
      }
    }
    const servicesArray = bookingData.services && Array.isArray(bookingData.services) 
      ? bookingData.services 
      : [];
    const firstService = servicesArray[0] || bookingData;
    
    // Normalize selectedServices for UniversalPaymentPage (supports both camelCase and snake_case)
    const normalizedFromResume =
      bookingData.selectedServices && Array.isArray(bookingData.selectedServices)
        ? bookingData.selectedServices
        : undefined;
    const selectedServices =
      normalizedFromResume && normalizedFromResume.length > 0
        ? normalizedFromResume.map((s: any) => ({
            id: s.id || s.serviceId || s.service_id,
            serviceId: s.serviceId || s.service_id || s.id,
            name: s.name || s.serviceName || s.service_name || 'Service',
            serviceName: s.serviceName || s.name || s.service_name,
            price: Number(s.price) || 0,
            duration: s.duration != null ? Number(s.duration) : 0,
            serviceStyle: s.serviceStyle || s.service_style || bookingData.serviceType || bookingData.serviceStyle,
            description: s.description,
          }))
        : servicesArray.length > 0
          ? servicesArray.map((s: any) => ({
              id: s.id || s.serviceId || s.service_id,
              serviceId: s.serviceId || s.service_id || s.id,
              name: s.name || s.serviceName || s.service_name || 'Service',
              serviceName: s.serviceName || s.name || s.service_name,
              price: Number(s.price) || 0,
              duration: s.duration != null ? Number(s.duration) : 0,
              serviceStyle: s.serviceStyle || s.service_style || bookingData.serviceType || bookingData.serviceStyle,
              description: s.description,
            }))
          : undefined;

    const isPaymentResume = bookingData.flowType === 'payment-resume';
    const resumeBasePrice = Number(bookingData.basePrice ?? bookingData.price ?? 0);
    const lockedPayable = Number(bookingData.lockedPayableAmount ?? bookingData.totalAmount ?? 0);
    const baseAmount = isPaymentResume && resumeBasePrice > 0
      ? resumeBasePrice
      : Number(bookingData.totalAmount) 
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
        priceIncludesTax={catalogPriceIncludesTax(firstService)}
        duration={duration}
        selectedServices={selectedServices}
        initialPromotionId={bookingData?.promotionId || promotionIntent?.promotionId}
        initialPromotionIntent={promotionIntent}
        customerPhone={phone}
        customerId={bookingData.customerId}
        flowType={bookingData.flowType}
        lockedPayableAmount={
          isPaymentResume && lockedPayable > 0 ? lockedPayable : undefined
        }
        resumeRazorpayOrderId={
          typeof bookingData.razorpayOrderId === 'string' ? bookingData.razorpayOrderId : undefined
        }
        resumeFinancialSnapshot={
          isPaymentResume &&
          bookingData.financialSnapshot &&
          typeof bookingData.financialSnapshot === 'object'
            ? (bookingData.financialSnapshot as {
                servicePrice: number;
                vendorDiscount: number;
                platformDiscount: number;
                couponDiscount: number;
                couponCode?: string;
                subtotalAfterDiscounts: number;
                cgst: number;
                sgst: number;
                igst: number;
                totalTax: number;
                platformFee: number;
                convenienceFee: number;
                deliveryFee: number;
                walletAmount: number;
                finalPaid: number;
              })
            : undefined
        }
        onBack={() => {
          if (shouldBannerReturnHome(bookingData as Record<string, unknown>, vetServiceData)) {
            bannerReturnHomeRef.current = false;
            setPaymentData(null);
            handleBack();
            return;
          }
          const bd = bookingData;
          const flowType = bd?.flowType as string | undefined;
          setPaymentData(null);

          if (
            flowType === 'tele-scheduled' ||
            flowType === 'tele-instant' ||
            flowType === 'tele-queue-accepted'
          ) {
            setTeleWizardRestore(consumeTeleWizardSnapshot());
            replaceShellScreen('vet-tele-consultation');
            return;
          }
          if (flowType === 'home-visit') {
            setHomeVisitWizardRestore(consumeHomeVisitWizardSnapshot());
            replaceShellScreen('vet-home-visit');
            return;
          }

          const fromPayload = bd?.returnScreen as ScreenType | undefined;
          const returnScreenAlias = String(bd?.returnScreen ?? '');
          if (
            fromPayload === 'nutritionist-tele' ||
            returnScreenAlias === 'tele-consultation' ||
            bd?.category === 'nutritionist'
          ) {
            setTeleWizardRestore(consumeTeleWizardSnapshot());
            if (fromPayload === 'nutritionist-tele') {
              replaceShellScreen('nutritionist-tele');
            } else {
              replaceShellScreen('vet-tele-consultation');
            }
            return;
          }
          if (fromPayload) {
            handleBack();
            return;
          }
          handleBack();
        }}
        onSuccess={(bookingId, orderId, otpCode, meta) => {
          setSelectedBookingId(bookingId);
          setSelectedAppointmentId(bookingId);
          setPaymentData(null);
          if (meta?.isInstantTele) {
            setInstantConnectingBookingId(bookingId);
            replaceShellScreen('instant-connecting');
            toast.success('Payment successful! Connecting to vet...');
            return;
          }
          shellNav.focusTabRoot('bookings');
          toast.success('Booking confirmed successfully!');
        }}
      />,
      { title: 'Payment', subtitle: 'Secure checkout', showBackButton: false, skipHeader: true, bareContent: true }
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
          navigateToScreen(
            'video-call',
            routeKey.booking(String(instantConnectingBookingId)),
          );
        }}
      />
    );
  }
  // ✅ FIX: Grooming Service with Frame UI (ServiceDashboardHeader)
  if (currentScreen === 'grooming') {
    return renderScreenWithLayout('grooming',
      <GroomingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => { 
        if (process.env.NODE_ENV === 'development') {
          console.log('🟢 [CustomerHomeWrapper] Grooming navigation:', screen, data);
        }
        if (screen === 'appointment-details') { 
          setSelectedAppointmentId(data?.appointmentId); 
          navigateToScreen('appointment-details'); 
        } else if (screen === 'create-booking') {
          setSelectedVendorId(data?.vendorId);
          setSelectedService(data?.serviceId ?? '');
          setVetServiceData(
            mergeBannerNavigationPayload(vetServiceData, {
              vendorId: data?.vendorId,
              serviceType: 'grooming',
              serviceStyle: data?.serviceStyle || 'at_center',
              groomer: data?.vendor || data?.groomer || (data?.vendorName ? { name: data.vendorName } : undefined),
              service: data?.service ?? (data?.serviceName ? { name: data.serviceName } : undefined),
              serviceId: data?.serviceId,
              selectedServices: data?.selectedServices,
              vendorName: data?.vendorName,
              price: data?.price,
              duration: data?.duration,
            })
          );
          navigateToScreen('grooming-booking');
        } else if (screen === 'problem_grid') {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [CustomerHomeWrapper] Setting problem_grid screen');
          }
          setCurrentServiceType('groomer');
          navigateToScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [CustomerHomeWrapper] Setting problem_selected screen:', data);
          }
          if (data?.problemId && !data?.problemTitle) {
            setSelectedProblem({ id: data.problemId, title: 'Loading...', roleId: 'groomer' });
          } else {
            setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Grooming Service', roleId: 'groomer' });
          }
          setProblemGridSpecialization(data?.problemId || undefined);
          navigateToScreen('problem_grid_flow');
        } else if (screen === 'grooming_center' || screen === 'at_center') {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [CustomerHomeWrapper] Setting grooming_center screen');
          }
          setGroomingCenterProfileVendorId(null);
          navigateToScreen('grooming_center');
        } else if (screen === 'grooming_home' || screen === 'at_home') {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [CustomerHomeWrapper] Setting grooming_home screen');
          }
          setGroomingHomeProfileVendorId(null);
          navigateToScreen('grooming_home');
        } else if (screen === 'add-address') {
          navigateToScreen('address_book');
        } else if (screen === 'profile') {
          navigateToScreen('customer-profile');
        } else if (screen === 'purchase-package') {
          const vid = String(data?.vendorId ?? '').trim();
          const vsid = String(data?.vendorServiceId ?? (data as any)?.vendor_service_id ?? '').trim();
          const payload =
            typeof data === 'object' && data != null && !Array.isArray(data)
              ? { ...(data as Record<string, unknown>) }
              : {};
          if (vid) (payload as any).vendorId = vid;
          if (vsid) (payload as any).vendorServiceId = vsid;
          openPurchasePackageScreen(Object.keys(payload).length ? payload : vid ? { vendorId: vid } : null, {
            mergeWalkerData: true,
          });
        } else if (screen === 'grooming-vendor-profile' && data?.vendorId) {
          const style = String(data.serviceStyle || 'at_center').toLowerCase();
          if (style === 'at_home' || style === 'home') {
            setGroomingHomeProfileVendorId(String(data.vendorId));
            navigateToScreen('grooming_home');
          } else {
            setGroomingCenterProfileVendorId(String(data.vendorId));
            navigateToScreen('grooming_center');
          }
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('🟡 [CustomerHomeWrapper] Unhandled grooming navigation:', screen, data);
          }
          navigateToScreen(screen as ScreenType);
        }
      }} />,
      { title: 'Grooming', subtitle: 'Premium pet grooming services', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ FIX: Training Service with Frame UI (ServiceDashboardHeader)
  if (currentScreen === 'training') {
    return renderScreenWithLayout('training',
      <TrainingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🟢 [CustomerHomeWrapper] Training navigation:', screen, data);
        }
        if (screen === 'create-booking' || screen === 'training-booking' || screen === 'booking') {
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'training', trainer: data?.trainer, service: data?.service, serviceId: data?.serviceId, vendorName: data?.vendorName, price: data?.price, duration: data?.duration });
          navigateToScreen('training-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('trainer');
          navigateToScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Training Service', roleId: 'trainer' });
          setProblemGridSpecialization(data?.problemId || undefined);
          navigateToScreen('problem_grid_flow');
        } else if (screen === 'training_center') {
          const embed = (data as { embedVendorId?: string } | undefined)?.embedVendorId;
          const embedStr = embed != null && String(embed).trim() ? String(embed).trim() : '';
          trainingCenterOpenedWithEmbedRef.current = Boolean(embedStr);
          setTrainingCenterProfileVendorId(embedStr || null);
          navigateToScreen('training_center');
        } else if (screen === 'training_home' || screen === 'at_home') {
          const embed = (data as { embedVendorId?: string } | undefined)?.embedVendorId;
          const embedStr = embed != null && String(embed).trim() ? String(embed).trim() : '';
          trainingHomeOpenedWithEmbedRef.current = Boolean(embedStr);
          setTrainingHomeProfileVendorId(embedStr || null);
          navigateToScreen('training_home');
        } else if (screen === 'training-trial-booking' || screen === 'training-progress' || screen === 'training-skill-matrix') {
          handleBack();
          toast.info('Not available.');
        } else if (screen === 'add-address') {
          navigateToScreen('address_book');
        } else if (screen === 'profile') {
          navigateToScreen('customer-profile');
        } else if (screen === 'purchase-package') {
          const vid = String(data?.vendorId ?? '').trim();
          const vsid = String(data?.vendorServiceId ?? (data as any)?.vendor_service_id ?? '').trim();
          const payload =
            typeof data === 'object' && data != null && !Array.isArray(data)
              ? { ...(data as Record<string, unknown>) }
              : {};
          if (vid) (payload as any).vendorId = vid;
          if (vsid) (payload as any).vendorServiceId = vsid;
          openPurchasePackageScreen(Object.keys(payload).length ? payload : vid ? { vendorId: vid } : null, {
            mergeWalkerData: true,
          });
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('🟡 [CustomerHomeWrapper] Unhandled training navigation:', screen, data);
          }
          navigateToScreen(screen as ScreenType);
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
          setProblemGridSpecialization((problem.id || problem.problemId) || undefined);
          navigateToScreen('problem_grid_flow');
        }}
      />
    );
  }
  // ✅ FIX: Boarding Service with Frame UI (ServiceDashboardHeader – skipHeader to match vet/grooming/training)
  if (currentScreen === 'boarding') {
    return renderScreenWithLayout('boarding',
      <BoardingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        if (screen === 'purchase-package') {
          handleNavigateToService(screen, data);
        } else if (screen === 'boarding-booking') {
          openBoardingBookingScreen(data);
        } else if (screen === 'create-booking') {
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          navigateToScreen('create-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('boarding');
          navigateToScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Boarding Service', roleId: 'boarding' });
          setProblemGridSpecialization(data?.problemId || undefined);
          navigateToScreen('problem_grid_flow');
        } else if (screen === 'boarding_facility') {
          navigateToScreen('boarding_facility');
        } else if (screen === 'pet-boarding-vendors') {
          const raw = (data as Record<string, unknown> | undefined)?.serviceSlug ?? (data as Record<string, unknown> | undefined)?.service;
          setSpaBoardingVendorsSlug(
            raw != null && String(raw) !== ''
              ? normalizeBoardingServiceSlug(String(raw))
              : normalizeBoardingServiceSlug('all')
          );
          setBoardingVendorsReturnScreen('boarding');
          navigateToScreen('pet-boarding-vendors');
        } else if (screen === 'pet-boarding-profile') {
          const bid = customerBoardingProfileVendorIdFromNavigateData(data);
          if (!bid) {
            toast.error('Profile unavailable — missing vendor id.');
            return;
          }
          openEmbeddedPetBoardingProfile(
            bid,
            normalizeBoardingServiceSlug(String(data?.serviceSlug ?? data?.service_slug ?? 'all')),
          );
        } else {
          navigateToScreen(screen as ScreenType);
        }
      }} />,
      { title: 'Pet Boarding', subtitle: 'Safe & comfortable pet stay', showBackButton: true, skipHeader: true }
    );
  }
  // ✅ Boarding Facility list (View all facilities) – same frame UI
  if (currentScreen === 'boarding_facility') {
    return renderScreenWithLayout('boarding_facility',
      <BoardingServiceRouter phone={phone} onBack={handleBack} onViewBooking={handleViewBooking} onNavigate={(screen, data) => {
        if (screen === 'purchase-package') {
          handleNavigateToService(screen, data);
        } else if (screen === 'boarding-booking') {
          openBoardingBookingScreen(data);
        } else if (screen === 'create-booking') {
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          navigateToScreen('create-booking');
        } else if (screen === 'boarding_facility') {
          navigateToScreen('boarding_facility');
        } else if (screen === 'pet-boarding-vendors') {
          const raw = (data as Record<string, unknown> | undefined)?.serviceSlug ?? (data as Record<string, unknown> | undefined)?.service;
          setSpaBoardingVendorsSlug(
            raw != null && String(raw) !== ''
              ? normalizeBoardingServiceSlug(String(raw))
              : normalizeBoardingServiceSlug('all')
          );
          setBoardingVendorsReturnScreen('boarding_facility');
          navigateToScreen('pet-boarding-vendors');
        } else if (screen === 'pet-boarding-profile') {
          const bid = customerBoardingProfileVendorIdFromNavigateData(data);
          if (!bid) {
            toast.error('Profile unavailable — missing vendor id.');
            return;
          }
          openEmbeddedPetBoardingProfile(
            bid,
            normalizeBoardingServiceSlug(String(data?.serviceSlug ?? data?.service_slug ?? 'all')),
          );
        } else if (screen) {
          navigateToScreen(screen as ScreenType);
        } else {
          navigateToScreen('boarding');
        }
      }} />,
      { title: 'Boarding Facilities', subtitle: 'Select a facility', showBackButton: true, skipHeader: true }
    );
  }
  if (currentScreen === 'pet-sitter') {
    return renderScreenWithLayout('pet-sitter',
      <PetSitterServiceRouter
        phone={phone}
        onBack={handlePetSitterHubBack}
        onNavigate={(screen, data) => {
          if (screen === 'pet-sitter-provider-profile' && data?.vendorId) {
            openPetSitterProviderProfile(String(data.vendorId));
          } else if (screen === 'pet-sitter-booking') {
            setVetServiceData({
              vendorId: data?.vendorId,
              serviceType: 'sitting',
              facility: data?.facility,
              sittingOptionId: data?.sittingOptionId,
            });
            navigateToScreen('pet-sitter-booking');
          } else if (screen === 'create-booking') {
            setSelectedVendorId(data?.vendorId);
            setVetServiceData({
              vendorId: data?.vendorId,
              serviceType: data?.serviceType || 'sitting',
              sittingOptionId: data?.sittingOptionId,
            });
            navigateToScreen('create-booking');
          } else if (screen === 'pet-sitter-vendors' || screen === 'pet-sitter-facility') {
            setPetSitterFacilityOptionId(
              typeof data?.sittingOptionId === 'string' ? data.sittingOptionId : null
            );
            navigateToScreen('pet-sitter-vendors');
          } else if (screen) {
            navigateToScreen(screen as ScreenType);
          } else {
            handlePetSitterHubBack();
          }
        }}
      />,
      { title: 'Pet Sitting', subtitle: 'Trusted in-home care', showBackButton: true, skipHeader: true }
    );
  }
  if (currentScreen === 'pet-sitter-vendors') {
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen="pet-sitter-vendors"
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <PetSittingVendorListView
          phone={phone}
          sittingOptionId={petSitterFacilityOptionId}
          onBack={() => {
            setPetSitterFacilityOptionId(null);
            navigateToScreen('pet-sitter');
          }}
          onNavigate={(screen, data) => {
            if (screen === 'pet-sitter-provider-profile' && data?.vendorId) {
              openPetSitterProviderProfile(String(data.vendorId));
            } else if (screen === 'pet-sitter-booking') {
              setVetServiceData({
                vendorId: data?.vendorId,
                serviceType: 'sitting',
                facility: data?.facility,
                sittingOptionId: data?.sittingOptionId ?? petSitterFacilityOptionId,
              });
              navigateToScreen('pet-sitter-booking');
            } else if (screen === 'create-booking') {
              setSelectedVendorId(
                data?.vendorId != null && String(data.vendorId).trim() !== ''
                  ? String(data.vendorId)
                  : undefined
              );
              setVetServiceData({
                vendorId: data?.vendorId,
                serviceType: data?.serviceType || 'sitting',
                sittingOptionId: data?.sittingOptionId ?? petSitterFacilityOptionId,
              });
              navigateToScreen('create-booking');
            } else if (screen === 'pet-sitter') {
              setPetSitterFacilityOptionId(null);
              navigateToScreen('pet-sitter');
            } else if (screen === 'pet-sitter-vendors' || screen === 'pet-sitter-facility') {
              setPetSitterFacilityOptionId(
                typeof data?.sittingOptionId === 'string' ? data.sittingOptionId : null
              );
            } else if (screen) {
              navigateToScreen(screen as ScreenType);
            } else {
              setPetSitterFacilityOptionId(null);
              navigateToScreen('pet-sitter');
            }
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  // ✅ FIX: Adoption Service with StandardizedHeader layout
  if (currentScreen === 'adoption') {
    return renderScreenWithLayout('adoption',
      <AdoptionServiceRouter phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
        if (screen === 'adoption_questionnaire') {
          navigateToScreen('adoption_questionnaire');
        } else if (screen === 'create-booking') {
          setSelectedVendorId(data?.vendorId);
          navigateToScreen('create-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('adoption');
          navigateToScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Adoption Service', roleId: 'adoption' });
          navigateToScreen('problem_grid_flow');
        } else if (screen) {
          navigateToScreen(screen as ScreenType);
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
          setSelectedVendorId(data?.vendorId);
          setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
          navigateToScreen('create-booking');
        } else if (screen === 'problem_grid') {
          setCurrentServiceType('sunset');
          navigateToScreen('problem_grid');
        } else if (screen === 'problem_selected') {
          setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Sunset Care Service', roleId: 'sunset' });
          navigateToScreen('problem_grid_flow');
        } else if (screen) {
          navigateToScreen(screen as ScreenType);
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
        if (screen === 'insurance_policy_purchase' || screen === 'insurance_provider') {
          const vid = String(data?.vendorId || data?.provider?.id || '').trim();
          setSelectedVendorId(vid || undefined);
          if (vid) {
            navigateToScreen('insurance_provider', routeKey.vendor(vid));
          } else {
            navigateToScreen('insurance_provider');
          }
        } else if (screen === 'create-booking') {
          setSelectedVendorId(data?.vendorId);
          navigateToScreen('create-booking');
        } else if (screen) {
          navigateToScreen(screen as ScreenType);
        } else {
          handleBack();
        }
      }} />,
      { title: 'Pet Insurance', subtitle: 'Protect your furry friend', showBackButton: true }
    );
  }

  if (currentScreen === 'insurance_provider') {
    return (
      <InsuranceProvider
        phone={phone}
        vendorId={selectedVendorId}
        onBack={handleBack}
        onNavigate={(screen) => handleNavigateToService(screen)}
      />
    );
  }
  
  // ✅ UPDATED LANDING PAGES & FLOWS
  if (currentScreen === 'resort') return <ResortServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'resort_booking') { setSelectedVendorId(data?.vendorId); navigateToScreen('resort_booking'); } else if (screen) navigateToScreen(screen as ScreenType); }} />;
  if (currentScreen === 'resort_booking') return <ResortBoardingBookingEnhanced phone={phone} preSelectedVendorId={selectedVendorId} onBack={handleBack} onSuccess={() => { bookingsFromAccountMenuRef.current = false; navigateToScreen('my-bookings'); }} />;
  
  if (currentScreen === 'cafes') return <PetCafeServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
      if (screen === 'cafe_reservation') { setSelectedVendorId(data?.vendorId); navigateToScreen('cafe_reservation'); }
      else if (screen === 'cafe_detail') { setSelectedVendorId(data?.vendorId); navigateToScreen('cafe_detail'); }
      else if (screen) navigateToScreen(screen as ScreenType);
  }} />;
  if (currentScreen === 'cafe_detail') return <PetCafeListingZomatoStyle cafeId={selectedVendorId || ''} onBack={handleBack} />;
  if (currentScreen === 'cafe_reservation') return <CafeReservationFlow phone={phone} preSelectedVendorId={selectedVendorId} onBack={handleBack} />;
  
  if (currentScreen === 'breeder') return <BreederServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'breeder_catalog') navigateToScreen('breeder_catalog'); else if (screen) navigateToScreen(screen as ScreenType); }} />;
  if (currentScreen === 'breeder_catalog') return <BreederCatalogView phone={phone} onBack={handleBack} />;

  if (currentScreen === 'ambulance') return <AmbulanceServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { if (screen === 'ambulance_sos') navigateToScreen('ambulance_sos'); else if (screen) navigateToScreen(screen as ScreenType); }} />;
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
  
  if (currentScreen === 'photography') return <PhotographyServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      navigateToScreen('create-booking');
    } else if (screen) {
      navigateToScreen(screen as ScreenType);
    } else {
      handleBack();
    }
  }} />;
  if (currentScreen === 'relocation') return <RelocationServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      navigateToScreen('create-booking');
    } else if (screen) {
      navigateToScreen(screen as ScreenType);
    } else {
      handleBack();
    }
  }} />;
  
  // Nutritionist & Holiday
  // ✅ Nutritionist Tele - Video consultation flow (scheduled or instant)
  if (currentScreen === 'nutritionist-tele') {
    return (
      <CustomerScreenWrapper customerPhone={phone} currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <NutritionistTeleRouter
          phone={phone}
          restoredSnapshot={teleWizardRestore}
          onRestoredSnapshotConsumed={() => setTeleWizardRestore(null)}
          onBack={handleBack}
          onNavigate={(screen, data) => {
            if (screen === 'payment' && data) {
              setPaymentData({ ...(typeof data === 'object' ? data : {}), returnScreen: 'nutritionist-tele' });
              navigateToScreen('payment');
            } else if (screen === 'video-call' && data?.bookingId) {
              setVideoCallData({ bookingId: data.bookingId, meetingId: data.meetingId });
              navigateToScreen('video-call');
            } else if (screen === 'add-pet' || screen === 'pets') {
              navigateToPets();
            } else if (screen === 'nutritionist-booking') {
              setVetServiceData({
                vendorId: data?.vendorId,
                serviceType: data?.serviceType || data?.category || 'pet_nutritionist',
                serviceStyle: data?.serviceStyle || 'tele',
                nutritionist: data?.nutritionist,
                serviceId: data?.serviceId,
              });
              navigateToScreen('nutritionist-booking');
            } else {
              handleNavigateToService(screen, data);
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
        serviceStyle={vetServiceData?.serviceStyle ?? 'tele'}
        price={vetServiceData?.price}
        duration={vetServiceData?.duration}
        onBack={() => backFromBannerOr(handleBack, vetServiceData)}
        onInternalBackReady={(fn) => { nutritionistBookingInternalBackRef.current = fn; }}
        onNavigate={(screen, data) => {
          if (screen === 'booking-details' || screen === 'booking-confirmation') {
            handleViewBooking(data?.bookingId);
          } else {
            handleNavigateToService(screen, data);
          }
        }}
        onViewBooking={handleViewBooking}
      />
    );
  }
  if (currentScreen === 'nutritionist') {
    return (
      <CustomerScreenWrapper customerPhone={phone} 
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
              if (!isCustomerMealPlansEnabled()) {
                toast.info('Meal plans are coming soon.');
                return;
              }
              if (data?.vendorId) {
                setMealPlanVendorFocus({
                  vendorId: String(data.vendorId),
                  vendorSnapshot:
                    data.vendorSnapshot && typeof data.vendorSnapshot === 'object'
                      ? (data.vendorSnapshot as Record<string, unknown>)
                      : undefined,
                });
              } else {
                setMealPlanVendorFocus(null);
              }
              navigateToScreen('nutrition-meal-plans');
            } else if (screen === 'diet-consultation-services') {
              navigateToScreen('diet-consultation-services');
            } else if (screen === 'nutritionist-tele') {
              navigateToScreen('nutritionist-tele');
            } else if (screen === 'nutritionist-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({
                vendorId: data?.vendorId,
                serviceType: data?.serviceType || data?.category || 'pet_nutritionist',
                serviceStyle: data?.serviceStyle || 'tele',
                nutritionist: data?.nutritionist,
                serviceId: data?.serviceId,
              });
              navigateToScreen('nutritionist-booking');
            } else if (screen === 'create-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
              navigateToScreen('create-booking');
            } else if (screen === 'pets') {
              navigateToPets();
            } else if (screen === 'problem_grid') {
              setCurrentServiceType('pet_nutritionist');
              navigateToScreen('problem_grid');
            } else if (screen === 'problem_selected') {
              setSelectedProblem({ id: data?.problemId, title: data?.problemTitle || 'Nutrition', roleId: 'pet_nutritionist' });
              navigateToScreen('problem_grid_flow');
            } else if (screen === 'expert-nutritionists') {
              navigateToScreen('expert-nutritionists');
            } else if (screen) {
              navigateToScreen(screen as ScreenType);
            } else {
              handleBack();
            }
          }} 
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'expert-nutritionists') {
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <ExpertNutritionistsList
          phone={phone}
          onBack={handleBack}
          onNavigate={(screen, data) => {
            if (screen === 'nutrition-meal-plans') {
              if (!isCustomerMealPlansEnabled()) {
                toast.info('Meal plans are coming soon.');
                return;
              }
              if (data?.vendorId) {
                setMealPlanVendorFocus({
                  vendorId: String(data.vendorId),
                  vendorSnapshot:
                    data.vendorSnapshot && typeof data.vendorSnapshot === 'object'
                      ? (data.vendorSnapshot as Record<string, unknown>)
                      : undefined,
                });
              } else {
                setMealPlanVendorFocus(null);
              }
              navigateToScreen('nutrition-meal-plans');
            } else if (screen === 'nutritionist-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({
                vendorId: data?.vendorId,
                serviceType: data?.serviceType || data?.category || 'pet_nutritionist',
                serviceStyle: data?.serviceStyle || 'tele',
                nutritionist: data?.nutritionist,
                serviceId: data?.serviceId,
              });
              navigateToScreen('nutritionist-booking');
            } else if (screen === 'create-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType || 'pet_nutritionist' });
              navigateToScreen('create-booking');
            } else if (screen === 'pets') {
              navigateToPets();
            } else if (screen) {
              navigateToScreen(screen as ScreenType);
            } else {
              navigateToScreen('nutritionist');
            }
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'diet-consultation-services') {
    return (
      <CustomerScreenWrapper customerPhone={phone} 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <DietConsultationVendors 
          phone={phone} 
          onBack={handleBack} 
          onNavigate={(screen, data) => {
            if (screen === 'nutritionist-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ 
                vendorId: data?.vendorId, 
                serviceId: data?.serviceId,
                serviceType: data?.serviceType || 'pet_nutritionist',
                serviceStyle: data?.serviceStyle || 'tele',
                serviceName: data?.serviceName,
                price: data?.price,
                duration: data?.duration
              });
              navigateToScreen('nutritionist-booking');
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
      <CustomerScreenWrapper customerPhone={phone} 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <MealPlansList 
          phone={phone} 
          onBack={handleBack} 
          vendorFocus={mealPlanVendorFocus}
          onExitVendorFocus={() => setMealPlanVendorFocus(null)}
          onNavigate={(screen, data) => {
            if (screen === 'meal-order-checkout') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, mealPlanId: data?.mealPlanId });
              navigateToScreen('meal-order-checkout');
            } else if (screen === 'create-booking') {
              setSelectedVendorId(data?.vendorId);
              setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType, mealPlanId: data?.mealPlanId });
              navigateToScreen('create-booking');
            } else if (screen === 'pets') {
              navigateToPets();
            } else if (screen === 'nutrition-meal-plans') {
              if (data?.vendorId) {
                setMealPlanVendorFocus({
                  vendorId: String(data.vendorId),
                  vendorSnapshot:
                    data.vendorSnapshot && typeof data.vendorSnapshot === 'object'
                      ? (data.vendorSnapshot as Record<string, unknown>)
                      : undefined,
                });
              } else {
                setMealPlanVendorFocus(null);
              }
              navigateToScreen('nutrition-meal-plans');
            } else {
              navigateToScreen(screen as ScreenType);
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
        onBack={handleBack}
        onSuccess={(orderId) => {
          toast.success('Order placed successfully');
          openMealOrderTracking(orderId, 'nutrition-meal-plans');
        }}
      />
    );
  }
  if (currentScreen === 'meal-plan-orders') {
    return (
      <MealPlanOrdersPanel
        fixedCustomerPhone={phone}
        onBack={handleMyBookingsBack}
        onTrackOrder={(orderId) => openMealOrderTracking(orderId, 'meal-plan-orders')}
      />
    );
  }
  if (currentScreen === 'holiday') return <PetHolidayServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => {
    if (screen === 'create-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: data?.serviceType });
      navigateToScreen('create-booking');
    } else if (screen) {
      navigateToScreen(screen as ScreenType);
    } else {
      handleBack();
    }
  }} />;

  // Pharmacy Landing - Entry point for pharmacy (Medicine): Order medicine flow or Browse shop
  if (currentScreen === 'pharmacy') return <PharmacyServicesLanding phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'pharmacy_order_flow') {
      if (data?.prescriptionId || data?.prescriptionUrl) setPrescriptionOrderData({ prescriptionId: data.prescriptionId, prescriptionUrl: data.prescriptionUrl });
      navigateToScreen('pharmacy_order_flow');
    }
    else if (screen === 'pharmacy_store') navigateToScreen('pharmacy_store'); 
    else if (screen === 'pharmacy_checkout') navigateToScreen('pharmacy_checkout');
    else if (screen) navigateToScreen(screen as ScreenType);
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
        navigateToScreen('pharmacy_order_status');
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
  if (currentScreen === 'lab-diagnostics') return <DiagnosticsServicesLanding phone={phone} onBack={handleBackFromLabDiagnostics} onNavigate={(screen, data) => { 
    if (screen === 'lab-booking') {
      if (isLegacyMockDiagnosticVendorId(data?.vendorId)) {
        toast.error('This lab is not available. Refresh the page or pick another lab.');
        return;
      }
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({ vendorId: data?.vendorId, serviceType: 'diagnostics' });
      setDiagnosticsPackageHint(
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
    } else if (screen) {
      navigateToScreen(screen as ScreenType);
    }
  }} />;

  // Diagnostics Booking Flow - Test selection, home/center, payment (uses DiagnosticsBookingFlow, NOT CreateBookingPage)
  // Fallback: use vetServiceData?.vendorId if selectedVendorId not set (wireframe stitching / alternate navigation)
  const diagnosticsVendorId = selectedVendorId || vetServiceData?.vendorId;
  if (currentScreen === 'diagnostics-booking' && diagnosticsVendorId) return <DiagnosticsBookingFlow 
    vendorId={diagnosticsVendorId} 
    customerPhone={phone} 
    packageHint={diagnosticsPackageHint ?? undefined}
    onBack={() => { setSelectedVendorId(undefined); setDiagnosticsPackageHint(null); handleBack(); }} 
    onInternalBackReady={(fn) => { diagnosticsBookingInternalBackRef.current = fn; }}
    onSuccess={(bookingId) => { setDiagnosticsPackageHint(null); handleViewBooking(bookingId); }} 
    onCancel={() => { setSelectedVendorId(undefined); setDiagnosticsPackageHint(null); handleBack(); }} 
  />;

  // Diagnostics Report Viewer - View and download lab reports (Phase 3: Order medicine, Book physio)
  if (currentScreen === 'diagnostics-reports' && selectedBookingId) return <DiagnosticsReportViewer 
    bookingId={selectedBookingId} 
    customerPhone={phone} 
    onBack={handleBack} 
    onShareWithVet={(reportId, vetId) => { toast.success('Report shared with vet'); }}
    onNavigate={(screen, data) => {
      if (screen === 'pharmacy_store' || screen === 'pharmacy') navigateToScreen('pharmacy');
      else if (screen === 'pharmacy_order_flow') {
        if (data?.prescriptionId || data?.prescriptionUrl) setPrescriptionOrderData({ prescriptionId: data.prescriptionId, prescriptionUrl: data.prescriptionUrl });
        navigateToScreen('pharmacy_order_flow');
      }
      else if (screen === 'my-bookings') navigateToScreen('my-bookings');
      else if (screen === 'vet' || screen === 'vet-services') navigateToScreen('vet');
      else if (screen === 'booking-details' && data?.bookingId) {
        setSelectedBookingId(data.bookingId);
        navigateToScreen('booking-details');
      }
    }}
  />;

  // Sample Collection Tracker - Track phlebotomist for home collection
  if (currentScreen === 'sample-collection-tracking' && selectedBookingId) return <SampleCollectionTracker 
    bookingId={selectedBookingId} 
    customerPhone={phone} 
    onBack={handleBack} 
    onComplete={() => { toast.success('Sample collection completed'); navigateToScreen('lab-diagnostics'); }}
  />;

  // Shop & Orders (marketplace gated by isCustomerEcommerceEnabled; demo account → home)
  if (!isShopUiVisibleForAccount(phone) && isCustomerEcommerceScreen(currentScreen)) {
    return <ReviewDemoShellRedirect onHome={goToHome} />;
  }
  if (!isCustomerEcommerceEnabled() && isCustomerEcommerceScreen(currentScreen)) {
    return <NotAvailable label="Shop" onBack={handleBack} />;
  }
  if (currentScreen === 'product_detail' && selectedProduct) return (
    <ProductDetailPage 
      product={selectedProduct} 
      phone={phone}
      onBack={() => goToShopFromParent()} 
      onNavigate={(screen, data) => {
        if (screen === 'product_detail' && data?.product) {
          setSelectedProduct(data.product);
          const pid = String(data.product.id ?? data.product.productId ?? '').trim();
          navigateToScreen('product_detail', pid ? routeKey.product(pid) : undefined);
        }
      }}
      onReviewsClick={() => {
        navigateToScreen('product_reviews');
      }} 
      onVendorClick={() => {
        if (selectedProduct.vendorId) {
          setSelectedVendorId(selectedProduct.vendorId);
          navigateToScreen('vendor_profile', routeKey.vendor(String(selectedProduct.vendorId)));
        } else {
          toast.info('Vendor information not available');
        }
      }} 
    />
  );
  if (currentScreen === 'product_reviews' && selectedProduct) return <ProductReviewsView productId={selectedProduct.id || selectedProduct.productId} productName={selectedProduct.name} onBack={handleBack} />;
  if (currentScreen === 'vendor_profile' && selectedVendorId) return <VendorProfileDetail vendorId={selectedVendorId} phone={phone} onBack={() => { if (selectedProduct) handleBack(); else goToShopFromParent(); }} onNavigate={(screen, data) => { if (screen === 'product_detail') { setSelectedProduct(data?.product); const pid = String(data?.product?.id ?? data?.product?.productId ?? '').trim(); navigateToScreen('product_detail', pid ? routeKey.product(pid) : undefined); } }} />;
  if (currentScreen === 'cart') {
    return <EcommerceRouteRedirect href="/cart" />;
  }
  if (currentScreen === 'checkout') {
    return <EcommerceRouteRedirect href="/checkout?step=payment" />;
  }
  if (currentScreen === 'order_success' && currentOrderId && isCustomerEcommerceEnabled()) {
    return <ProfileOrdersRedirect orderId={currentOrderId} />;
  }
  if (currentScreen === 'order_history')
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <OrderHistoryPage
          onBack={handleAccountHubBack}
          onCloseToHome={goToHome}
          onNavigate={handleAccountNavigate}
          spaShopReturnScreen="order_history"
        />
      </CustomerScreenWrapper>
    );
  if (currentScreen === 'address_book')
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AddressBookPage
          phone={phone}
          onCloseToHome={goToHome}
          onBack={handleAccountHubBack}
          onSelect={(address) => {
            toast.success('Address selected');
            setSelectedAddressFromBook(address);
            handleAccountHubBack();
          }}
        />
      </CustomerScreenWrapper>
    );
  // Add Address: must show address book, not fall through to default fallback
  if (currentScreen === 'add-address')
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AddressBookPage
          phone={phone}
          onCloseToHome={handleBack}
          onBack={handleBack}
          onSelect={(address) => {
            toast.success('Address selected');
            setSelectedAddressFromBook(address);
            handleBack();
          }}
        />
      </CustomerScreenWrapper>
    );
  if (currentScreen === 'wallet') return (
    <CustomerScreenWrapper customerPhone={phone} currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
      <WalletPage onBack={handleAccountHubBack} onCloseToHome={goToHome} onNavigate={handleAccountNavigate} />
    </CustomerScreenWrapper>
  );
  // if (currentScreen === 'order_history') return <OrderHistoryView phone={phone} onBack={handleBack} onOrderClick={(order) => { setSelectedOrder(order); setCurrentScreen('order_detail'); }} />;
  if (currentScreen === 'order_detail') {
    if (selectedOrder) {
      const detailOrderId = String(selectedOrder.id ?? selectedOrder.orderId ?? '').trim();
      return (
        <OrderDetailView
          order={selectedOrder}
          onBack={handleBack}
          onTrackOrder={() => goToEmbeddedOrderTracking(detailOrderId)}
          onReorder={() => { toast.success('Items added to cart'); goToShopFromParent(); }}
          onHelp={() => navigateToScreen('support_help')}
        />
      );
    }
    return <NotAvailable label="Order detail" onBack={handleBack} />;
  }
  if (currentScreen === 'order_tracking') {
    const trackingOrderId = String(selectedOrder?.id ?? selectedOrder?.orderId ?? '').trim();
    if (trackingOrderId) {
      return <OrderTrackingPage orderId={trackingOrderId} onBack={handleBack} />;
    }
    return <NotAvailable label="Order tracking" onBack={handleBack} />;
  }
  
  if (currentScreen === 'pharmacy_store') return <PharmacyStore phone={phone} onBack={handleBack} onNavigate={(screen) => { if (screen === 'pharmacy_checkout') navigateToScreen('pharmacy_checkout'); else if (screen === 'cart') navigateToScreen('cart'); }} />;
  if (currentScreen === 'pharmacy_checkout') return <PharmacyCheckout phone={phone} onBack={handleBack} onSuccess={() => goToHome()} />;

  // Other Screens
  if (currentScreen === 'my-bookings') {
    return (
      <CustomerScreenWrapper customerPhone={phone} 
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <MyBookings 
          phone={phone} 
          onBack={handleMyBookingsBack}
          onCloseToHome={goToHome}
          initialBookingId={selectedBookingId || undefined}
          onCloseInitialBookingDetail={returnToAccountMenuBookings}
          onReorderMedicine={handleReorderMedicine}
          onNavigate={(screen, data) => { 
            const bookingId =
              data?.bookingId != null ? String(data.bookingId).trim() : '';
            if (bookingId) setSelectedBookingId(bookingId);
            if (screen === 'video-call' && bookingId) {
              const payload = data as { bookingId: string; meetingId?: string };
              setVideoCallData({ bookingId, meetingId: payload.meetingId });
              navigateToScreen('video-call', routeKey.booking(bookingId));
            } else if (screen === 'payment' && data) {
              setPaymentData({ ...(data as Record<string, unknown>), returnScreen: 'my-bookings' });
              navigateToScreen('payment');
            } else if (screen === 'gps-tracking' || screen === 'tracking') {
              setTrackingBookingId(bookingId || null);
              const bid = data?.bookingId != null ? String(data.bookingId).trim() : '';
              navigateToScreen('gps-tracking', bid ? routeKey.booking(bid) : undefined);
            } else if (screen === 'package-tracking' && (data as { packagePurchaseId?: string })?.packagePurchaseId) {
              router.push(
                `/packages/${encodeURIComponent(String((data as { packagePurchaseId: string }).packagePurchaseId))}`
              );
            } else {
              const target = screen === 'bookings' ? 'my-bookings' : screen;
              const bid = data?.bookingId != null ? String(data.bookingId).trim() : '';
              if (
                bid &&
                (target === 'diagnostics-reports' || target === 'sample-collection-tracking')
              ) {
                navigateToScreen(target as ScreenType, routeKey.booking(bid));
              } else {
                navigateToScreen(target as ScreenType);
              }
            }
          }} 
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'appointments') {
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AppointmentsList
          phone={phone}
          onBack={handleAccountHubBack}
          onCloseToHome={goToHome}
          onSelectAppointment={(appointmentId) => {
            setSelectedAppointmentId(appointmentId);
            navigateToScreen('appointment-details');
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'appointment-details' && selectedAppointmentId) {
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <AppointmentDetailsView
          appointmentId={selectedAppointmentId}
          phone={phone}
          onBack={handleBack}
          onReschedule={(appointmentId) => {
            setSelectedAppointmentId(appointmentId);
            navigateToScreen('appointment-reschedule');
          }}
          onCancel={() => {
            handleBack();
            setSelectedAppointmentId(null);
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'appointment-reschedule' && selectedAppointmentId) {
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <RescheduleAppointmentView
          appointmentId={selectedAppointmentId}
          phone={phone}
          onBack={handleBack}
          onSuccess={() => {
            handleBack();
            toast.success('Rescheduled successfully');
          }}
        />
      </CustomerScreenWrapper>
    );
  }
  
  // if (currentScreen === 'wallet') return <WalletView phone={phone} onBack={handleBack} />;
  if (currentScreen === 'category-mapper') return <ProblemCategoryMapper />;
  
  // ✅ NEW: Adoption Questionnaire
  if (currentScreen === 'adoption_questionnaire') return <AdoptionQuestionnaire onBack={handleBack} onComplete={() => { toast.success('Preferences saved'); handleBack(); }} />;

  // ✅ NEW: Services Browser
  if (currentScreen === 'services') return <CustomerServicesPage phone={phone} onBack={handleBack} onNavigate={(screen, data) => { 
    if (screen === 'create-booking') { 
      setSelectedService(String(data?.serviceId ?? ''));
      setSelectedVendorId(data?.vendorId != null ? String(data.vendorId) : undefined);
      navigateToScreen('create-booking');
    } else {
      handleNavigateToService(screen, data);
    }
  }} />;
  
  // ✅ Grooming Service Style Screens - Frame UI (CustomerScreenWrapper for bottom nav, back → grooming)
  const groomingCenterNavigate = (screen: string, data?: any) => {
    if (screen === 'grooming_embed_vendor_profile' && data?.vendorId) {
      setGroomingCenterProfileVendorId(String(data.vendorId));
      return;
    }
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
      navigateToScreen('grooming-booking');
    } else {
      handleNavigateToService(screen, data);
    }
  };
  const groomingHomeNavigate = (screen: string, data?: any) => {
    if (screen === 'grooming_embed_vendor_profile' && data?.vendorId) {
      setGroomingHomeProfileVendorId(String(data.vendorId));
      return;
    }
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
      navigateToScreen('grooming-booking');
    } else {
      handleNavigateToService(screen, data);
    }
  };
  if (currentScreen === 'grooming_center') {
    return (
      <CustomerScreenWrapper customerPhone={phone} currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
          <GroomingServicesByStyle
            phone={phone}
            serviceStyle="at_center"
            serviceTypeName="Grooming Center"
            category="grooming"
            specialization={problemGridSpecialization}
            vendorId={groomingCenterProfileVendorId ?? undefined}
            onBack={() => {
              backFromBannerOr(() => {
              if (groomingCenterProfileVendorId) {
                setGroomingCenterProfileVendorId(null);
                return;
              }
              if (returnToProblemGridFromStyleHub) {
                setReturnToProblemGridFromStyleHub(false);
                navigateToScreen('problem_grid_flow');
                return;
              }
              handleBack();
              }, vetServiceData);
            }}
            onNavigate={groomingCenterNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'grooming_home') {
    return (
      <CustomerScreenWrapper customerPhone={phone} currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
          <GroomingServicesByStyle
            phone={phone}
            serviceStyle="at_home"
            serviceTypeName="At Home Grooming"
            category="grooming"
            specialization={problemGridSpecialization}
            vendorId={groomingHomeProfileVendorId ?? undefined}
            onBack={() => {
              backFromBannerOr(() => {
              if (groomingHomeProfileVendorId) {
                setGroomingHomeProfileVendorId(null);
                return;
              }
              if (returnToProblemGridFromStyleHub) {
                setReturnToProblemGridFromStyleHub(false);
                navigateToScreen('problem_grid_flow');
                return;
              }
              handleBack();
              }, vetServiceData);
            }}
            onNavigate={groomingHomeNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }

  // ✅ Training Service Style Screens - Frame UI (CustomerScreenWrapper for bottom nav, back → training)
  const trainingCenterNavigate = (screen: string, data?: any) => {
    if (screen === 'training_embed_vendor_profile' && data?.vendorId) {
      setTrainingCenterProfileVendorId(String(data.vendorId));
      return;
    }
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
      navigateToScreen('training-booking');
    } else {
      handleNavigateToService(screen, data);
    }
  };
  const trainingHomeNavigate = (screen: string, data?: any) => {
    if (screen === 'training_embed_vendor_profile' && data?.vendorId) {
      setTrainingHomeProfileVendorId(String(data.vendorId));
      return;
    }
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
      navigateToScreen('training-booking');
    } else {
      handleNavigateToService(screen, data);
    }
  };
  if (currentScreen === 'training_center') {
    return (
      <CustomerScreenWrapper customerPhone={phone} currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
          <UniversalServicesByStyle
            phone={phone}
            roleId="trainer"
            serviceStyle="at_center"
            serviceTypeName="Training Center"
            category="training"
            specialization={problemGridSpecialization}
            bookingScreen="training-booking"
            vendorId={trainingCenterProfileVendorId ?? undefined}
            onBack={() => {
              backFromBannerOr(() => {
              if (trainingCenterProfileVendorId) {
                const openedAsEmbedOnly = trainingCenterOpenedWithEmbedRef.current;
                setTrainingCenterProfileVendorId(null);
                trainingCenterOpenedWithEmbedRef.current = false;
                if (openedAsEmbedOnly) {
                  handleBack();
                }
                return;
              }
              if (returnToProblemGridFromStyleHub) {
                setReturnToProblemGridFromStyleHub(false);
                navigateToScreen('problem_grid_flow');
                return;
              }
              handleBack();
              }, vetServiceData);
            }}
            onNavigate={trainingCenterNavigate}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }
  if (currentScreen === 'training_home') {
    return (
      <CustomerScreenWrapper customerPhone={phone} currentScreen={currentScreen} onNavigate={handleBottomNav} onProfileClick={handleProfileClick} accountSidebar={accountSidebarOverlay}>
        <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
          <UniversalServicesByStyle
            phone={phone}
            roleId="trainer"
            serviceStyle="at_home"
            serviceTypeName="At Home Training"
            category="training"
            specialization={problemGridSpecialization}
            bookingScreen="training-booking"
            vendorId={trainingHomeProfileVendorId ?? undefined}
            onBack={() => {
              backFromBannerOr(() => {
              if (trainingHomeProfileVendorId) {
                const openedAsEmbedOnly = trainingHomeOpenedWithEmbedRef.current;
                setTrainingHomeProfileVendorId(null);
                trainingHomeOpenedWithEmbedRef.current = false;
                if (openedAsEmbedOnly) {
                  handleBack();
                }
                return;
              }
              if (returnToProblemGridFromStyleHub) {
                setReturnToProblemGridFromStyleHub(false);
                navigateToScreen('problem_grid_flow');
                return;
              }
              handleBack();
              }, vetServiceData);
            }}
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
    onBack={() => backFromBannerOr(handleBack, vetServiceData)} 
    onInternalBackReady={(fn) => {
      groomingBookingInternalBackRef.current = fn;
    }}
    onNavigate={(screen, data) => {
      if (screen === 'booking-details' || screen === 'booking-confirmation') {
        handleViewBooking(data?.bookingId);
      } else {
        handleNavigateToService(screen, data);
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
    onBack={() => backFromBannerOr(handleBack, vetServiceData)} 
    onInternalBackReady={(fn) => {
      trainingBookingInternalBackRef.current = fn;
    }}
    onNavigate={(screen, data) => {
      if (screen === 'booking-details' || screen === 'booking-confirmation') {
        handleViewBooking(data?.bookingId);
      } else {
        handleNavigateToService(screen, data);
      }
    }}
    onViewBooking={handleViewBooking}
  />;

  // ✅ Boarding Booking Router - step-by-step boarding flow (service → datetime → pet → room → payment → confirmation)
  if (currentScreen === 'boarding-booking' || currentScreen === 'pet-sitter-booking') {
    const sittingBooking = currentScreen === 'pet-sitter-booking';
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <div className="min-h-0 w-full bg-gray-50">
          <BoardingBookingRouter
            flowVariant={
              sittingBooking
                ? 'pet_sitting'
                : vetServiceData?.flowVariant === 'swimming' || vetServiceData?.serviceType === 'swimming'
                  ? 'swimming'
                  : 'boarding'
            }
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
            presetSittingOptionId={sittingBooking ? vetServiceData?.sittingOptionId : undefined}
            presetServiceSlug={
              !sittingBooking && vetServiceData?.serviceSlug
                ? String(vetServiceData.serviceSlug)
                : vetServiceData?.serviceType === 'swimming'
                  ? 'swimming'
                  : undefined
            }
            onBack={() => backFromBannerOr(handleBack, vetServiceData)}
            onInternalBackReady={(fn) => { boardingBookingInternalBackRef.current = fn; }}
            onNavigate={(screen, data) => {
              if (screen === 'booking-details' || screen === 'booking-confirmation') {
                handleViewBooking(data?.bookingId);
              } else {
                handleNavigateToService(screen, data);
              }
            }}
            onViewBooking={handleViewBooking}
          />
        </div>
      </CustomerScreenWrapper>
    );
  }
  
  // Support & Help Center
  if (currentScreen === 'support_help') {
    const supportCtx = resolveSupportContactContext(
      readSupportBookingContext(),
      readSupportMealOrderContext(),
    );
    const handleSupportBack = () => {
      const mealResume = consumeMealTrackSupportBack();
      if (mealResume?.orderId) {
        openMealOrderTracking(mealResume.orderId, mealResume.backScreen as ScreenType);
        return;
      }
      backFromWalletHubChild();
    };
    return (
      <div className="h-[100dvh] w-full max-w-customer mx-auto flex flex-col overflow-hidden bg-gray-50">
        <SupportHelpCenter
          phone={phone}
          onBack={handleSupportBack}
          onInternalBackReady={(fn) => { supportHelpInternalBackRef.current = fn; }}
          onChatbotNavigate={handleSupportHelpChatbotNavigate}
          initialTab={supportCtx.kind ? 'contact' : undefined}
          bookingContext={supportCtx.booking}
          mealOrderContext={supportCtx.meal}
        />
      </div>
    );
  }

  // ✅ NEW: Create Booking
  if (currentScreen === 'create-booking') return (
    <CreateBookingPage
      phone={phone}
      serviceId={selectedService || vetServiceData?.serviceId}
      vendorId={selectedVendorId || vetServiceData?.vendorId}
      serviceStyle={vetServiceData?.serviceStyle}
      vendorName={vetServiceData?.vendorName || vetServiceData?.providerName}
      serviceName={vetServiceData?.serviceName || vetServiceData?.service?.name}
      price={vetServiceData?.price}
      duration={vetServiceData?.duration}
      groomer={vetServiceData?.groomer}
      onBack={() => backFromBannerOr(handleBack, vetServiceData)}
      onSuccess={(bookingId) => handleViewBooking(bookingId)}
    />
  );

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
        setSelectedPetId(data.petId);
        navigateToScreen('pet-details', routeKey.pet(String(data.petId)));
      }
    }} 
    onAddPet={() => navigateToScreen('add-pet')} 
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
    onBack={handleBack}
  />;

  // Rewards & Points
  if (currentScreen === 'rewards-loyalty') {
    if (!isLoyaltyUiVisibleForAccount(phone)) {
      return <ReviewDemoShellRedirect onHome={goToHome} />;
    }
    return (
      <RewardsLoyaltyPage
        customerPhone={phone}
        onBack={backFromWalletHubChild}
        onCloseToHome={goToHome}
      />
    );
  }

  // Referral System
  if (currentScreen === 'referral-system') {
    if (!isLoyaltyUiVisibleForAccount(phone)) {
      return <ReviewDemoShellRedirect onHome={goToHome} />;
    }
    return (
      <ReferralSystemPage
        customerPhone={phone}
        customerId={phone}
        onBack={backFromWalletHubChild}
        onCloseToHome={goToHome}
      />
    );
  }

  // Legacy: deep links that still set `package-tracking` → My Bookings (package progress uses `/packages/:id`).
  if (currentScreen === 'package-tracking') {
    return (
      <CustomerScreenWrapper customerPhone={phone}
        currentScreen={currentScreen}
        onNavigate={handleBottomNav}
        onProfileClick={handleProfileClick}
        accountSidebar={accountSidebarOverlay}
      >
        <PackageTrackingShellRedirect />
      </CustomerScreenWrapper>
    );
  }

  // Shared intent: vendorId alone loads GET /vendor/packages + vendor_services package rows; full row pre-selects one package.
  const walkSessionForPackage = walkerServiceData?.walkSession ?? null;
  const wPkg = walkerServiceData;
  const vendorPackageIntentCoercedVsId =
    firstNonEmptyString(wPkg?.vendorServiceId, (wPkg as Record<string, unknown> | null | undefined)?.vendor_service_id) ?? '';

  const vendorPackageIntentFromWalker =
    wPkg?.vendorId
      ? {
          vendorId: String(wPkg.vendorId),
          vendorName: wPkg?.walker?.name || wPkg.vendorName,
          ...(vendorPackageIntentCoercedVsId
            ? {
                vendorServiceId: vendorPackageIntentCoercedVsId,
                serviceName: String(wPkg.serviceName || 'Package'),
                totalSessions: Number(wPkg.totalSessions) || 1,
                sessionsPerDay: Math.max(
                  1,
                  Math.min(24, Number(wPkg.sessionsPerDay ?? wPkg.sessions_per_day) || 1)
                ),
                sessionIntervalDays: Math.max(
                  1,
                  Math.min(366, Number(wPkg.sessionIntervalDays ?? wPkg.session_interval_days) || 7)
                ),
                price: Number(wPkg.price ?? 0),
                duration: wPkg.duration != null ? Number(wPkg.duration) : 60,
                serviceType: wPkg.serviceType || 'walking',
                serviceStyle: wPkg.serviceStyle || 'at_home',
                description: wPkg.description,
              }
            : {}),
        }
      : null;

  // Package Booking
  if (currentScreen === 'package-booking')
    return (
      <PackageBookingPage
        customerPhone={phone}
        customerId={phone}
        petId={selectedPetId || undefined}
        onBack={handleBackFromPackageBooking}
        onInternalBackReady={(fn) => { packageBookingInternalBackRef.current = fn; }}
        vendorPackageIntent={vendorPackageIntentFromWalker}
        walkSessionIntent={walkSessionForPackage}
        onContinueToChooseWalker={
          walkSessionForPackage
            ? () => {
                setWalkerServiceData({ pendingWalkSession: walkSessionForPackage });
                navigateToScreen('walker');
              }
            : undefined
        }
      />
    );
  // purchase-package: same as package-booking (e.g. from VetBookingRouter/GroomingBookingRouter package cards)
  if (currentScreen === 'purchase-package') {
    const walkSession = walkSessionForPackage;
    const vendorPackageIntent = vendorPackageIntentFromWalker;
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
        onBack={handleBackFromPackageBooking}
        onInternalBackReady={(fn) => { packageBookingInternalBackRef.current = fn; }}
      />
    );
  }
  if (currentScreen === 'profile') {
    return (
      <CustomerProfileView
        phone={phone}
        onBack={handleBack}
        onCloseToHome={handleBack}
        ordersBackSpaScreen="profile"
      />
    );
  }

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
    onBack={handleBack}
  />;

  // Customer Wallet (Enhanced)
  if (currentScreen === 'customer-wallet') return <CustomerWalletPage
    customerPhone={phone}
    customerId={phone}
    onBack={handleBack}
    onNavigate={handleAccountNavigate}
  />;

  // ✅ PEER TO PEER SERVICE - P2P Matchmaking
  if (currentScreen === 'mating-dating-hub') return <MatingDatingHub
    phone={phone}
    onBack={handleBack}
  />;

  // ✅ GAP FIXES: Rule 2 & 6
  if (currentScreen === 'integrated-services')
    return (
      <IntegratedServicesHub
        onBack={handleBack}
        onNavigate={(service) => handleNavigateToService(service)}
      />
    );

  if (currentScreen === 'universal-home-booking') {
    return (
      <UniversalHomeServiceRouter
        phone={phone}
        serviceType={selectedHomeServiceType}
        preSelectedVendorId={selectedVendorId}
        onBack={() => {
          setSelectedVendorId(undefined);
          navigateToScreen('home-service-selection');
        }}
        onNavigate={(screen, data) => {
          if (screen === 'my-bookings' && data?.bookingId) handleViewBooking(data.bookingId);
        }}
        onViewBooking={handleViewBooking}
      />
    );
  }

  if (currentScreen === 'home-service-selection') return <HomeServiceSelectionEnhanced
    customerId={phone}
    customerPhone={phone}
    petId={selectedPetId || 'pet_default'}
    onBack={handleBack}
    onNavigate={(screen, data) => {
      const navData = (data ?? {}) as Record<string, unknown>;
      const problem = (navData.problem ?? {}) as Record<string, unknown>;
      if (screen === 'services_by_problem' || screen === 'problem_selected') {
        const problemId = navData.problemId != null ? String(navData.problemId) : undefined;
        const problemTitle =
          navData.problemTitle != null ? String(navData.problemTitle) : undefined;
        if (
          isEmergencyProblemTileLocked({
            id: problemId,
            name: problemTitle,
            displayName: problemTitle,
          })
        ) {
          toast.info('Emergency care is coming soon on the app.');
          return;
        }
        const categoryStored = navData.category ?? problem.category;
        const rawCategory = String(categoryStored ?? '').toLowerCase();
        const isBehaviorCategory =
          rawCategory === 'behavioral' ||
          rawCategory === 'behavior' ||
          rawCategory === 'sub_behavior';
        let roleIdForFlow = String(navData.roleId ?? problem.roleId ?? '').trim();
        if (isBehaviorCategory && roleIdForFlow && !/behav/i.test(roleIdForFlow)) {
          roleIdForFlow = 'behaviorist';
        }
        if (isBehaviorCategory && !roleIdForFlow) {
          roleIdForFlow = 'behaviorist';
        }
        const allowedStylesRaw =
          problem.allowedServiceStyles ?? navData.allowedServiceStyles;
        const allowedStylesList = allowedStylesRaw
          ? Array.isArray(allowedStylesRaw)
            ? (allowedStylesRaw as string[])
            : [String(allowedStylesRaw)]
          : null;
        setSelectedProblem({
          id: problemId ?? '',
          title: problemTitle || 'Service',
          roleId: roleIdForFlow || (navData.roleId != null ? String(navData.roleId) : undefined),
          category:
            categoryStored != null
              ? String(categoryStored)
              : isBehaviorCategory
                ? 'behavioral'
                : undefined,
          allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(allowedStylesList, {
            roleId: roleIdForFlow || (navData.roleId != null ? String(navData.roleId) : undefined),
            specializationId: problemId,
            categoryHint:
              categoryStored != null
                ? String(categoryStored)
                : isBehaviorCategory
                  ? 'behavioral'
                  : undefined,
          }),
        });
        setProblemGridSpecialization(problemId);
        navigateToScreen('problem_grid_flow');
        return;
      }
      if (screen === 'support_help') {
        handleSupportHelpChatbotNavigate(screen, data);
        return;
      }
      handleNavigateToService(screen, data);
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
    
    const problemGridBack = () => {
      setCurrentServiceType(null);
      if (pathname === '/services/all') {
        router.push('/');
        return;
      }
      handleBack();
    };

    const problemGridTopSlot =
      pathname === '/services/all' ? (
        <CustomerPlacementBanners
          placement="category"
          onNavigate={(screen, data) => handleNavigateToService(screen, data)}
        />
      ) : undefined;

    if (isNewHomeUiEnabled()) {
      return (
        <AllServicesScreen
          phone={phone}
          onBack={problemGridBack}
          onNavigate={(screen, data) => handleNavigateToService(screen, data)}
        />
      );
    }

    return (
      <ProblemGridSelector
        roleId={roleInfo.roleId}
        roleName={roleInfo.roleName}
        customerId={phone}
        phone={phone}
        topSlot={problemGridTopSlot}
        onBack={problemGridBack}
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
          const problemId = String(problem.id || problem.problemId || '').trim();
          navigateToScreen(
            'problem_grid_flow',
            problemId ? routeKey.problemFlow(problemId) : undefined,
          );
        }}
      />
    );
  }

  const handleProblemGridDiscoveryNavigate = (screen: string, data?: any) => {
    const gridBack = 'problem_grid_flow';
    const mergeReturn = (d?: any) => {
      if (!d || typeof d !== 'object' || Array.isArray(d)) return { returnScreen: gridBack };
      return { ...d, returnScreen: d.returnScreen ?? gridBack };
    };

    if (screen === 'grooming_embed_vendor_profile' && data?.vendorId) {
      setReturnToProblemGridFromStyleHub(true);
      const st = String(data.serviceStyle || '').toLowerCase();
      if (st === 'at_home' || st === 'home_visit') {
        setGroomingHomeProfileVendorId(String(data.vendorId));
        navigateToScreen('grooming_home');
      } else {
        setGroomingCenterProfileVendorId(String(data.vendorId));
        navigateToScreen('grooming_center');
      }
      return;
    }

    if (screen === 'grooming-booking' || (screen === 'create-booking' && data?.serviceType === 'grooming')) {
      const st = String(data?.serviceStyle || '').toLowerCase();
      if (st === 'at_home' || st === 'home_visit') groomingHomeNavigate(screen, data);
      else groomingCenterNavigate(screen, data);
      return;
    }

    if (screen === 'training_embed_vendor_profile' && data?.vendorId) {
      setReturnToProblemGridFromStyleHub(true);
      const st = String(data.serviceStyle || '').toLowerCase();
      if (st === 'at_center') {
        setTrainingCenterProfileVendorId(String(data.vendorId));
        navigateToScreen('training_center');
      } else {
        setTrainingHomeProfileVendorId(String(data.vendorId));
        navigateToScreen('training_home');
      }
      return;
    }

    if (screen === 'training-booking') {
      const st = String(data?.serviceStyle || '').toLowerCase();
      if (st === 'at_center') trainingCenterNavigate(screen, data);
      else trainingHomeNavigate(screen, data);
      return;
    }

    if (screen === 'purchase-package') {
      const vid = String(data?.vendorId ?? '').trim();
      const vsid = String(data?.vendorServiceId ?? (data as any)?.vendor_service_id ?? '').trim();
      const payload =
        typeof data === 'object' && data != null && !Array.isArray(data)
          ? { ...(data as Record<string, unknown>) }
          : {};
      if (vid) (payload as any).vendorId = vid;
      if (vsid) (payload as any).vendorServiceId = vsid;
      openPurchasePackageScreen(Object.keys(payload).length ? payload : vid ? { vendorId: vid } : null);
      return;
    }

    if (screen === 'vet-services-by-style') {
      handleVetNavigate(screen, mergeReturn(data));
      return;
    }

    if (screen === 'vet-booking' || screen === 'appointment') {
      handleVetNavigate(screen === 'appointment' ? 'vet-booking' : screen, data);
      return;
    }

    if (screen === 'vet-clinic-profile' || screen === 'vet-doctor-details') {
      handleVetNavigate(screen, {
        ...(data || {}),
        clinicProfileBackScreen: data?.clinicProfileBackScreen ?? gridBack,
        doctorProfileBackScreen: data?.doctorProfileBackScreen ?? gridBack,
      });
      return;
    }

    if (screen === 'nutritionist-booking') {
      setSelectedVendorId(data?.vendorId);
      setVetServiceData({
        vendorId: data?.vendorId,
        serviceType: data?.serviceType || data?.category || 'pet_nutritionist',
        serviceStyle: data?.serviceStyle || 'at_home',
        nutritionist: data?.nutritionist,
        serviceId: data?.serviceId,
        service: data?.service,
        price: data?.price,
        duration: data?.duration,
        serviceName: data?.serviceName,
      });
      navigateToScreen('nutritionist-booking');
      return;
    }

    if (screen === 'walker-booking') {
      setWalkerServiceData(data);
      navigateToScreen('walker-booking');
      return;
    }

    if (screen === 'walker-provider-profile' && data?.vendorId) {
      const vid = String(data.vendorId).trim();
      const payload =
        typeof data === 'object' && data != null && !Array.isArray(data)
          ? { ...(data as Record<string, unknown>) }
          : {};
      setWalkerServiceData({
        ...payload,
        vendorId: vid,
        walkerProfileBackScreen:
          (payload.walkerProfileBackScreen as string | undefined) ?? gridBack,
        serviceType: (payload.serviceType as string | undefined) ?? 'walking',
      });
      navigateToScreen('walker-provider-profile');
      return;
    }

    if (screen === 'boarding-booking') {
      setVetServiceData({
        vendorId: data?.vendorId as string | undefined,
        serviceType: 'boarding',
        serviceId: data?.serviceId as string | undefined,
        serviceName: data?.serviceName as string | undefined,
        price: data?.price as number | undefined,
        duration: data?.duration as number | undefined,
        serviceStyle: data?.serviceStyle as string | undefined,
        facility: data?.facility,
      });
      navigateToScreen('boarding-booking');
      return;
    }

    handleVetNavigate(screen, data);
  };

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
          linkedServiceRoles: (() => {
            const base = selectedProblem.roleId ? [selectedProblem.roleId] : [];
            const c = String(selectedProblem.category || '').toLowerCase();
            if (c === 'behavioral' || c === 'behavior' || c === 'sub_behavior') {
              return [
                ...new Set([
                  ...base,
                  'behaviourist',
                  'behaviorist',
                  'pet_behaviourist',
                  'pet_behaviorist',
                  'pet_behavior',
                ]),
              ];
            }
            if (base.length) return base;
            const rid = String(selectedProblem.roleId || '').trim();
            return rid ? [rid] : ['veterinarian'];
          })(),
          category: selectedProblem.category || selectedProblem.roleId || 'general',
        }}
        customerId={phone}
        onClose={() => {
          if (currentServiceType) {
            navigateToScreen('problem_grid');
          } else if (pathname === '/services/all') {
            navigateToScreen('problem_grid');
          } else {
            handleBack();
          }
          setSelectedProblem(null);
          setProblemGridSpecialization(undefined);
        }}
        onDiscoveryNavigate={handleProblemGridDiscoveryNavigate}
      />
    );
  }

  if (currentScreen === 'services_by_problem' && selectedProblem) {
    return (
      <ServicesByProblem
        problemId={selectedProblem.id}
        problemTitle={selectedProblem.title}
        onBack={() => {
          handleBack();
        }}
        onServiceSelect={(service) => {
          const vendorId = (service as any).vendorId || (service as any).id;
          const serviceId = (service as any).serviceId || (service as any).id;
          
          setSelectedVendorId(vendorId);
          setSelectedService(serviceId);
          setVetServiceData({ 
            vendorId: vendorId, 
            serviceType: selectedProblem.roleId,
            service: service
          });
          navigateToScreen('create-booking');
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
