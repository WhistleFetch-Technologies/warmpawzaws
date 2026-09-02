'use client';

/**
 * Vendor Landing Page - Main Entry Point for Vendor Portal
 * Handles all vendor lifecycle states from onboarding to active operations
 */
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { vendorNavigate } from '@/lib/vendor-route-nav';
import { toast } from 'sonner';
import { useVendorCapabilities } from '../hooks/useVendorCapabilities';
import { getVendorRoleId, getVendorProgressRoleType, hasVendorRole, isDiagnosticsCenter } from '@/lib/vendor-utils';
import { DoctorManagement } from '../clinic/DoctorManagement';
import { VendorBusinessHub } from '../business/VendorBusinessHub'; // ✅ NEW
import { VetSpecializedServicesManager } from '../clinic/VetSpecializedServicesManager'; // ✅ NEW: Vet-specific services
import { ResortManagementDashboard } from '../resort/ResortManagementDashboard'; // ✅ NEW: Pet resort management
import { EnhancedVendorOnboarding } from '../onboarding/EnhancedVendorOnboarding';
import { WARMPAWZ_VENDOR_PROFILE_SUBMITTED_EVENT } from '../VendorSetPasswordGate';
import { VendorApplicationSubmitted } from '../VendorApplicationSubmitted';
import { VendorApplicationUnderReview } from '../VendorApplicationUnderReview';
import { VendorClarificationRequested } from '../VendorClarificationRequested';
import { VendorApprovedSetup } from '../VendorApprovedSetup';
// ✅ REMOVED: VendorAvailabilitySetup - Using AdvancedAvailabilityManager as standard
// import { VendorAvailabilitySetup } from './VendorAvailabilitySetup';
import { VendorSetupCompleted } from '../VendorSetupCompleted';
import { VendorApplicationRejected } from '../VendorApplicationRejected';
// Lazy-load VendorDashboard so heavy chunk loads only when active vendor view is shown
const VendorDashboard = React.lazy(() =>
  import('../dashboard/BussinesProvider/VendorDashboard').then((m) => ({ default: m.VendorDashboard }))
);
// ✅ REMOVED: VendorScheduleManagement - Using AdvancedAvailabilityManager as standard
// import { VendorScheduleManagement } from './VendorScheduleManagement';
import { VendorServiceManagementComplete } from '../VendorServiceManagementComplete';
import { VendorHeader } from '../VendorHeader';
import { VendorConsultationScreen } from '../VendorConsultationScreen';
import { VendorBookingManagement } from '../VendorBookingManagement';
import { VendorTeleConsultationFlow } from '../VendorTeleConsultationFlow';
import { FacilityManagement } from '../FacilityManagement';
import { ProfileManager } from '../vendorProfileManager/ProfileManagerCenter'; // ✅ RENAMED: CenterProfileManager -> ProfileManager
import { AdvancedAvailabilityManager } from '../AdvancedAvailabilityManager'; // ✅ NEW: Advanced Availability System
import { CafeVendorDashboard } from '../cafe/CafeVendorDashboard';
import { SunsetServicesVendorDashboard } from '../sunset/SunsetServicesVendorDashboard';
import { InsuranceVendorContainer } from '../insurance/InsuranceVendorContainer';
import { PhotographyVendorDashboard } from '../photography/PhotographyVendorDashboard';
import { AmbulanceVendorDashboard } from '../ambulance/AmbulanceVendorDashboard';
import { RelocationVendorDashboard } from '../relocation/RelocationVendorDashboard';
import { VendorGalleryManagement } from '../VendorGalleryManagement'; // ✅ FIX: Gallery component
import { VendorPortfolioManagement } from '../VendorPortfolioManagement'; // ✅ FIX: Portfolio component
import { VendorCCTVAccess } from '../VendorCCTVAccess'; // ✅ FIX: CCTV component
import { VendorControlledSubstances } from '../VendorControlledSubstances'; // ✅ FIX: Controlled substances component
// import { VendorPrescriptionBuilder } from './VendorPrescriptionBuilder'; // ❌ DEPRECATED - Use VendorPrescriptionModal instead
import { PrescriptionCreate } from '../prescription/PrescriptionCreate'; // ✅ Prescription creation standalone
import { PrescriptionList } from '../prescription/PrescriptionList'; // ✅ NEW: Prescription list
import { DiagnosticResults } from '../diagnostics/DiagnosticResults'; // ✅ NEW: Diagnostic management
import { DiagnosticsOrderDashboard } from '../diagnostics/DiagnosticsOrderDashboard'; // ✅ Diagnostics center: lab orders
import { AppointmentDetailModal } from '../AppointmentDetailModal'; // ✅ Diagnostics booking detail
import { ServicePricing } from '../pricing/ServicePricing'; // ✅ NEW: Service pricing
import { ProgressTrackingDashboard } from '../ProgressTrackingDashboard'; // ✅ FIX: Progress tracking - CORRECTED PATH
// DETACHED: PackageManagementContainer - 500 errors, will fix later
import { VendorCustomServiceCreationEnhanced as VendorCustomServiceCreation } from '../VendorCustomServiceCreationEnhanced'; // ✅ ENHANCED: Role-based custom services
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ShelterAdoptionSystem } from '../ShelterAdoptionSystem'; // ✅ FIX: Adoption management
import { VendorMemorialServices } from '../VendorMemorialServices'; // ✅ FIX: Memorial services
import { VendorExpiryManagement } from '../VendorExpiryManagement'; // ✅ NEW: Expiry management
import { VendorDonationManagement } from '../VendorDonationManagement'; // ✅ NEW: Donation management
import { VendorEventManagement } from '../VendorEventManagement'; // ✅ NEW: Event management
import { VendorPatientMonitoring } from '../VendorPatientMonitoring'; // ✅ NEW: Patient monitoring
import { VendorCafeMenuManagement } from '../VendorCafeMenuManagement'; // ✅ NEW: Cafe menu management
import { VendorPrescriptionVerification } from '../VendorPrescriptionVerification'; // ✅ NEW: Prescription verification
import { VendorDeliveryManagement } from '../VendorDeliveryManagement'; // ✅ NEW: Delivery management
import { VendorDietCharts } from '../VendorDietCharts'; // ✅ NEW: Diet charts
import { VendorCounseling } from '../VendorCounseling'; // ✅ NEW: Counseling services
import { VendorPolicyManagement } from '../VendorPolicyManagement'; // ✅ NEW: Policy management
import { VendorDistancePricing } from '../VendorDistancePricing'; // ✅ NEW: Distance pricing
import { VendorSupportDashboard } from '../VendorSupportDashboard'; // ✅ NEW: Support tickets
import { ServicePromotionsManagement } from '../ServicePromotionsManagement'; // ✅ NEW: Service Promotions
import { TeleCallNotification } from '../notification/teleNotification/TeleCallNotification'; // ✅ P2P Video Call Notification
import { VendorNewBookingOrderAlert } from '../VendorNewBookingOrderAlert'; // Rule 4: Large new appointment/order alert
import { isPharmacyVendor, isPetProductsStoreVendor } from './constants/helpers';
import { useVendorNotificationService } from '../hooks/useVendorNotificationService';
import { PackageManagementContainer } from '../packages/PackageManagementContainer';
import { ApplicationData, VendorData, VendorLandingPageProps, VendorStatus } from './constants/interface';



export function VendorLandingPage({
  vendorId,
  phone,
  vendorType,
  serviceStyle,
  initialVendorData,
  onComplete,
  justSubmitted
}: VendorLandingPageProps) {




  //-----------------------------ROUTER--------------------------------//
  const router = useRouter();

  //-----------------------------STATE--------------------------------//
  const [status, setStatus] = useState<VendorStatus>('new');
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<VendorData | any>(null);
  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null);
  const [showConsultation, setShowConsultation] = useState(false);
  const [showServiceManagement, setShowServiceManagement] = useState(false);
  const [showBookingManagement, setShowBookingManagement] = useState(false);
  const [showTeleConsultation, setShowTeleConsultation] = useState(false);
  const [showAdvancedAvailability, setShowAdvancedAvailability] = useState(false);
  const [showFacilityManagement, setShowFacilityManagement] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showBusinessHub, setShowBusinessHub] = useState(false);
  const [showSupportDashboard, setShowSupportDashboard] = useState(false);
  const [showVetSpecialized, setShowVetSpecialized] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showCCTV, setShowCCTV] = useState(false);
  const [showControlledSubstances, setShowControlledSubstances] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showPrescriptionList, setShowPrescriptionList] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showDiagnosticsOrders, setShowDiagnosticsOrders] = useState(false);
  const [selectedDiagnosticsBookingId, setSelectedDiagnosticsBookingId] = useState<string | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [showProgressTracking, setShowProgressTracking] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [showCustomServices, setShowCustomServices] = useState(false);
  const [showAdoptionSystem, setShowAdoptionSystem] = useState(false);
  const [showMemorialServices, setShowMemorialServices] = useState(false);
  const [showExpiryManagement, setShowExpiryManagement] = useState(false);
  const [showDonationManagement, setShowDonationManagement] = useState(false);
  const [showEventManagement, setShowEventManagement] = useState(false);
  const [showPatientMonitoring, setShowPatientMonitoring] = useState(false);
  const [showCafeMenuManagement, setShowCafeMenuManagement] = useState(false);
  const [showPrescriptionVerification, setShowPrescriptionVerification] = useState(false);
  const [showDeliveryManagement, setShowDeliveryManagement] = useState(false);
  const [showDietCharts, setShowDietCharts] = useState(false);
  const [showCounseling, setShowCounseling] = useState(false);
  const [showPolicyManagement, setShowPolicyManagement] = useState(false);
  const [showDistancePricing, setShowDistancePricing] = useState(false);
  const [showServicePromotions, setShowServicePromotions] = useState(false);
  const [newBookingAlert, setNewBookingAlert] = useState<any>(null);
  const [isReEditing, setIsReEditing] = useState(false);
  const [existingApplicationData, setExistingApplicationData] = useState<any>(null);
  const [reEditMode, setReEditMode] = useState<'correction' | 'clarification' | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    bookingId: string;
    meetingId?: string;
    callType?: 'incoming' | 'customer_waiting';
    customer: {
      id: string;
      name: string;
      photo?: string;
      phone?: string;
    };
    serviceName?: string;
    petName?: string;
    isInstant?: boolean;
    isInstantV3?: boolean;
    notificationId?: string; // Track notification ID to mark as read when call is handled
  } | null>(null);
  const [showLiveTracking, setShowLiveTracking] = useState(false);
  const [showSpecializedServices, setShowSpecializedServices] = useState(false);
  const [showResortManagement, setShowResortManagement] = useState(false);
  const [showCafeTables, setShowCafeTables] = useState(false);
  const [returnToStaffManagement, setReturnToStaffManagement] = useState(false)


  //-----------------------------VARIABLES--------------------------------//
  const effectiveRoleId = vendorData?.roleId || vendorData?.role_id || (vendorData as any)?.selected_role_id;
  const applicationIdForStatus = vendorData?.applicationId || applicationData?.id || vendorId;

  //-----------------------------REFS--------------------------------//
  const shownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasCheckedStatus = useRef(false);
  const isCheckingStatus = useRef(false);

  //-----------------------------USEHOOKS--------------------------------//
  const { capabilities } = useVendorCapabilities(effectiveRoleId);


  { /*Enable vendor notification service - works throughout the landing page*/ }
  useVendorNotificationService({
    vendorId: vendorId,
    enabled: !!vendorId,
    onNewNotification: (notification) => {
      const type = notification.type || notification.notification_type;

      if (type === 'new_booking' || type === 'new_order' || type === 'warmpawz_pay_received') {
        setNewBookingAlert(notification);
      }
    }
  });




  //-----------------------------USEEFFECTS--------------------------------//

  useEffect(() => {
    // Prevent multiple status checks causing flickering
    if (hasCheckedStatus.current) {
      console.log('⚠️ [VendorLandingPage] Status already checked, skipping');
      return;
    }
    hasCheckedStatus.current = true;

    // 🔒 Fast-path: if localStorage already knows we're approved/activated, show dashboard immediately
    if (typeof window !== 'undefined') {
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      const storedVendor = localStorage.getItem('vendorData');
      if (storedStatus && ['APPROVED', 'ACTIVATED'].includes(storedStatus)) {
        console.log('✅ [VendorLandingPage] Fast-path: APPROVED/ACTIVATED vendor detected, showing dashboard');
        setStatus('active');
        if (storedVendor) {
          try {
            const vendor = JSON.parse(storedVendor);
            // Ensure vendor data has active status
            vendor.status = 'active';
            vendor.isActive = true;
            setVendorData(vendor);
          } catch {
            // ignore parse errors
          }
        }
        setLoading(false);
        return; // ✅ Return early to skip onboarding flow
      }
    }

    // If we have initial vendor data, use it instead of fetching
    if (initialVendorData) {
      console.log('📦 Using initial vendor data:', initialVendorData);
      console.log('🔍 Initial vendor STATUS:', initialVendorData.status);
      console.log('🔍 Initial vendor SETUP COMPLETED:', initialVendorData.setupCompleted);
      console.log('🔍 Initial vendor ROLE ID:', initialVendorData.roleId || initialVendorData.role_id);
      processVendorData(initialVendorData);
      setLoading(false);
    } else {
      checkVendorStatus();
    }
  }, []);

  {/*Sync vendorData when initialVendorData updates (e.g., after profile fetch)*/ }
  useEffect(() => {
    if (initialVendorData && initialVendorData.roleId && !vendorData?.roleId) {
      console.log('🔄 [VendorLandingPage] Syncing roleId from initialVendorData:', initialVendorData.roleId);
      setVendorData((prev: any) => ({
        ...prev,
        ...initialVendorData,
        roleId: initialVendorData.roleId || initialVendorData.role_id,
      }));
    }
  }, [initialVendorData?.roleId, initialVendorData?.role_id]);

  {/* Fetch vendor profile when status is active but vendorData is null (e.g. fast-path with missing localStorage vendorData)*/ }
  useEffect(() => {
    if (status !== 'active' || vendorData || !vendorId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<any>(`/vendor/${vendorId}/profile`);
        const profile = res?.vendor ?? res?.profile ?? res;
        if (cancelled || !profile) return;
        const v = { ...profile, id: profile.id || vendorId, status: 'active', isActive: true };
        setVendorData(v);
        try {
          localStorage.setItem('vendorData', JSON.stringify(v));
          if (profile.role_id || profile.roleId) {
            localStorage.setItem('vendorRole', profile.role_id || profile.roleId);
          }
        } catch (_) { }
      } catch (err) {
        if (!cancelled) console.warn('[VendorLandingPage] Profile fetch failed (active but no vendorData):', err);
      }
    })();
    return () => { cancelled = true; };
  }, [status, vendorData, vendorId]);

  // Open Gallery when returning from /profile (Get started sets sessionStorage before router.push('/'))
  useEffect(() => {
    if (typeof window === 'undefined' || status !== 'active' || !vendorData) return;
    try {
      if (sessionStorage.getItem('warmpawz_vendor_open_gallery') === '1') {
        sessionStorage.removeItem('warmpawz_vendor_open_gallery');
        setShowProfile(false);
        setShowGallery(true);
      }
    } catch {
      /* ignore */
    }
  }, [status, vendorData]);

  {/* P2P VIDEO CALL: Check for incoming calls periodically (for tele consultations)*/ }
  useEffect(() => {
    if (!vendorId || status !== 'active') return;

    const checkIncomingCalls = async () => {
      try {
        // Fetch unread notifications
        const response = await apiClient.get<any>(
          `/notifications?userId=${vendorId}&userType=vendor&isRead=false`
        );

        if (!response.success || !response.notifications?.length) return;

        // Filter for call-related notification types
        const callTypes = ['tele_call_incoming', 'tele_customer_waiting', 'tele_instant_incoming'];
        const callNotifications = response.notifications.filter((n: any) => {
          const notificationId = n.id || n.notificationId || n.notification_id;
          // Skip if already shown
          if (notificationId && shownNotificationIdsRef.current.has(notificationId)) {
            return false;
          }
          return callTypes.includes(n.notification_type || n.type) && !n.is_read;
        });

        if (callNotifications.length === 0) return;

        const callNotification = callNotifications[0];
        const notificationId = callNotification.id || callNotification.notificationId || callNotification.notification_id;
        const notificationData = typeof callNotification.data === 'string'
          ? JSON.parse(callNotification.data)
          : callNotification.data || {};

        const notificationType = callNotification.notification_type || callNotification.type;
        const isInstantV3 = notificationType === 'tele_instant_incoming' || notificationData.call_type === 'incoming_instant';
        const isIncoming = notificationData.call_type === 'incoming' || isInstantV3;
        const isCustomerWaiting = notificationData.call_type === 'customer_waiting';

        if (!notificationData.booking_id || (!isIncoming && !isCustomerWaiting)) return;

        // Skip if vendor is already on the video page for this booking
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const currentSearch = window.location.search;
          const urlBookingId = currentPath.includes('/video')
            ? (currentPath.match(/\/video\/([^/?]+)/)?.[1] || new URLSearchParams(currentSearch).get('bookingId'))
            : null;

          if (urlBookingId === notificationData.booking_id) {
            // Vendor is already on the video page for this booking - mark notification as read and skip
            if (notificationId) {
              await apiClient.put(`/notifications/${notificationId}/read`, {}).catch(() => { });
              shownNotificationIdsRef.current.add(notificationId);
            }
            return;
          }
        }

        // Check booking status - skip if booking is already in call or completed
        try {
          const bookingStatusResponse = await apiClient.get<any>(
            `/bookings/${notificationData.booking_id}?vendorId=${encodeURIComponent(vendorId)}`
          );

          if (bookingStatusResponse?.success && bookingStatusResponse?.booking) {
            const booking = bookingStatusResponse.booking;
            const bookingStatus = booking.status || booking.booking_status;

            // Skip notification if booking is already completed, cancelled, or in a final state
            const finalStates = ['completed', 'cancelled', 'closed', 'finished', 'ended'];
            if (finalStates.includes(bookingStatus?.toLowerCase())) {
              // Mark notification as read since booking is already completed
              if (notificationId) {
                await apiClient.put(`/notifications/${notificationId}/read`, {}).catch(() => { });
                shownNotificationIdsRef.current.add(notificationId);
              }
              return;
            }
          }
        } catch (err) {
          // If booking check fails, proceed with showing notification (fail-safe)
          console.warn('[VendorLandingPage] Could not check booking status, proceeding with notification:', err);
        }

        // Build base incoming call object
        const baseIncoming = {
          bookingId: notificationData.booking_id,
          meetingId: notificationData.meeting_id,
          callType: isCustomerWaiting ? 'customer_waiting' as const : 'incoming' as const,
          customer: {
            id: notificationData.customer_id || '',
            name: notificationData.customer_name || 'Customer',
            photo: undefined as string | undefined,
            phone: undefined as string | undefined,
          },
          serviceName: notificationData.service_name as string | undefined,
          petName: notificationData.pet_name as string | undefined,
          isInstant: isInstantV3,
          isInstantV3,
          notificationId, // Store notification ID for marking as read
        };

        // Mark notification as shown immediately to prevent duplicates
        if (notificationId) {
          shownNotificationIdsRef.current.add(notificationId);
        }

        setIncomingCall(baseIncoming);

        // Enrich with booking details if available
        if (!isInstantV3 || !notificationData.customer_name) {
          try {
            const bookingResponse = await apiClient.get<any>(
              `/bookings/${notificationData.booking_id}?vendorId=${encodeURIComponent(vendorId)}`
            );
            if (bookingResponse?.success && bookingResponse?.booking) {
              const booking = bookingResponse.booking;
              setIncomingCall({
                ...baseIncoming,
                customer: {
                  id: booking.customer_id || baseIncoming.customer.id,
                  name: booking.customer_name || baseIncoming.customer.name,
                  photo: booking.customer_photo,
                  phone: booking.customer_phone,
                },
                serviceName: baseIncoming.serviceName || booking.service_name,
                petName: baseIncoming.petName || booking.pet_name,
              });
            }
          } catch (_) {
            // Keep base incoming call; UI already shows Accept/Reject
          }
        }

        // Mark notification as read when showing (prevents re-showing on next poll)
        if (notificationId) {
          await apiClient.put(`/notifications/${notificationId}/read`, {}).catch(() => {
            console.warn('[VendorLandingPage] Failed to mark notification as read:', notificationId);
          });
        }
      } catch (error) {
        console.error('[VendorLandingPage] Error checking incoming calls:', error);
      }
    };

    // Check immediately and then every 5 seconds
    checkIncomingCalls();
    const interval = setInterval(checkIncomingCalls, 5000);

    return () => clearInterval(interval);
  }, [vendorId, status]);


  //-----------------------------FUNCTIONS--------------------------------//

  const processVendorData = (vendor: any) => {
    setVendorData(vendor);


    // Check for active status FIRST (before other status checks)
    // VendorApp sets status='active' for APPROVED vendors, so we need to catch this
    if (vendor.status === 'active' || vendor.isActive === true) {
      setStatus('active');
      return;
    }

    // Map vendor status to UI status
    // NEW WORKFLOW: Status values are 'pending', 'approved', 'rejected', 'more_info_required', 'resubmitted'
    if (vendor.status === 'submitted' || vendor.status === 'pending' || vendor.status === 'resubmitted' || vendor.status === 'under_review' || vendor.status === 'pending_approval') {
      // Show pending screen ONLY if this is their first login OR they just submitted
      // If they're logging in again and already have pending status, it means they haven't been approved yet
      // But if they were previously approved and made changes, we need to distinguish that
      const wasApprovedBefore = vendor.previousStatus === 'approved' || vendor.wasApprovedBefore;

      if (wasApprovedBefore) {
        // They were approved, made changes, and are now pending re-approval
        // Show them a different message
        setStatus('pending');
      } else {
        // First time pending OR just submitted
        const finalStatus = justSubmitted || vendor.status === 'submitted' ? 'submitted' : 'pending';
        setStatus(finalStatus);
      }
    } else if (vendor.status === 'approved') {
      // Check setup stage to determine which screen to show
      const setupStage = vendor.setupStage || 'services_pending';


      const isAlreadyActivated = vendor.isActive === true ||
        vendor.onboarding_status === 'ACTIVATED' ||
        vendor.onboardingStatus === 'ACTIVATED';

      const hasCompletedSetup = vendor.setupCompleted === true ||
        vendor.setup_completed === true ||
        (vendor.availability_configured === true && vendor.services_configured === true) ||
        (vendor.availabilityConfigured === true && vendor.servicesConfigured === true);

      if (isAlreadyActivated || hasCompletedSetup) {
        setStatus('active');
      } else if (setupStage === 'completed' && vendor.setupCompleted) {
        setStatus('setup_completed');
      } else if (setupStage === 'availability_pending' || vendor.servicesConfigured) {
        setStatus('approved_availability');
      } else {
        setStatus('approved_services');
      }

    } else if (vendor.status === 'rejected') {
      setStatus('rejected');
    } else if (vendor.status === 'more_info_required' || vendor.status === 'clarification_requested') {
      setStatus('clarification');
    } else if (vendor.status === 'documents_required') {
      setStatus('documents_required');
    } else {
      setStatus('new');
    }
  };

  const checkVendorStatus = async () => {
    // ✅ FIX: Prevent concurrent status checks
    if (isCheckingStatus.current) {
      console.log('⚠️ [VendorLandingPage] Status check already in progress, skipping');
      return;
    }
    isCheckingStatus.current = true;

    try {
      setLoading(true);

      // Try to load vendor profile
      const profileData = await apiClient.get(`/vendor/profile`) as any;

      if (profileData && profileData.vendor) {
        setVendorData(profileData.vendor);

        console.log('📊 [VendorLandingPage] Profile loaded:', {
          isActive: profileData.vendor.isActive,
          status: profileData.vendor.status,
          applicationId: profileData.vendor.applicationId,
        });

        // ✅ FIX: Check if vendor is already active (approved + setup complete)
        if (profileData.vendor.isActive === true || profileData.vendor.status === 'active') {
          console.log('✅ [VendorLandingPage] Vendor is active - showing dashboard');
          setStatus('active');
          return; // Don't continue checking, vendor is fully active
        }

        // Check if they have an application
        if (profileData.vendor?.applicationId) {
          // Load application status
          const appData = await apiClient.get(`/vendor/application/status/${profileData.vendor.applicationId}`) as any;

          if (appData && appData.application) {
            setApplicationData(appData.application);

            // Determine status based on application status
            if (appData.application.status === 'approved') {
              if (profileData.vendor.setupCompleted) {
                setStatus('active');
              } else if (profileData.vendor.availabilitySetupCompleted) {
                setStatus('setup_completed');
              } else if (profileData.vendor.servicesSetupCompleted) {
                setStatus('approved_availability');
              } else {
                setStatus('approved_services');
              }
            } else if (appData.application.status === 'rejected') {
              setStatus('rejected');
            } else if (appData.application.status === 'clarification_requested') {
              setStatus('clarification');
            } else if (appData.application.status === 'pending' || appData.application.status === 'under_review') {
              setStatus(justSubmitted ? 'submitted' : 'pending');
            }
          }
        } else if (profileData.vendor?.profileCreated) {
          // Profile exists but no application submitted
          setStatus('profile_incomplete');
        } else if (profileData.vendor?.status === 'approved') {
          // Vendor approved but no application - show approved status
          setStatus('approved_services');
        } else {
          setStatus('new');
        }
      } else {
        // No profile found
        setStatus('new');
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
      setStatus('new');
    } finally {
      setLoading(false);
      isCheckingStatus.current = false;
    }
  };

  const handleProfileSubmit = async (profileData: any) => {
    try {
      console.log('📤 [handleProfileSubmit] Called with data:', profileData);
      console.log('📤 [handleProfileSubmit] Checking conditions:', {
        hasSuccess: !!profileData.success,
        hasStatus: !!profileData.status,
        statusValue: profileData.status,
        conditionMet: profileData.success && profileData.status === 'submitted'
      });

      // ✅ FIX: Check if this is the new dynamic form submission
      if (profileData.success && profileData.status === 'submitted') {
        console.log('✅ [handleProfileSubmit] Dynamic form submission detected - updating status to submitted');
        console.log('✅ [handleProfileSubmit] Application ID:', profileData.applicationId);
        console.log('✅ [handleProfileSubmit] Vendor ID:', profileData.vendorId);

        // Update local state with application data
        setApplicationData({
          id: profileData.applicationId,
          status: 'pending'
        });

        // Show submitted screen
        setStatus('submitted');
        toast.success('Application submitted successfully!');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(WARMPAWZ_VENDOR_PROFILE_SUBMITTED_EVENT));
        }
        return;
      }

      console.log('⚠️ [handleProfileSubmit] Not a dynamic form submission - running legacy code');

      // ✅ LEGACY CODE BELOW - Only runs for old onboarding flow (if any)
      console.log('📤 Starting profile submission with document upload...');

      // STEP 1: Upload all documents to S3 (via API Gateway / Lambda)
      const formData = new FormData();
      formData.append('vendorId', vendorId);

      const documents: any[] = [];

      // Add Aadhaar front
      if (profileData.aadhaarFiles?.front) {
        formData.append('aadhaar_front', profileData.aadhaarFiles.front);
        console.log('📎 Added Aadhaar Front');
      }

      // Add Aadhaar back
      if (profileData.aadhaarFiles?.back) {
        formData.append('aadhaar_back', profileData.aadhaarFiles.back);
        console.log('📎 Added Aadhaar Back');
      }

      // Add GST certificate
      if (profileData.gstCertificate) {
        formData.append('gst_certificate', profileData.gstCertificate);
        console.log('📎 Added GST Certificate');
      }

      // Add Police Verification
      if (profileData.policeVerification) {
        formData.append('police_verification', profileData.policeVerification);
        console.log('📎 Added Police Verification');
      }

      // Add Cancelled Cheque
      if (profileData.bankDetails?.cancelledCheque) {
        formData.append('cancelled_cheque', profileData.bankDetails.cancelledCheque);
        console.log('📎 Added Cancelled Cheque');
      }

      // Upload all documents
      console.log('☁️ Uploading documents to storage...');
      const uploadResponse = await apiClient.post('/storage/upload-multiple', formData) as any;

      if (!uploadResponse || !uploadResponse.success) {
        console.error('❌ Upload failed:', uploadResponse?.error);
        toast.error('Failed to upload documents');
        return;
      }

      const uploadResult = uploadResponse;
      console.log('✅ Documents uploaded:', uploadResult);

      // Map upload results to documents array
      const documentTypeMap: Record<string, string> = {
        'aadhaar_front': 'Aadhaar Front',
        'aadhaar_back': 'Aadhaar Back',
        'gst_certificate': 'GST Certificate',
        'police_verification': 'Police Verification Certificate',
        'cancelled_cheque': 'Cancelled Cheque'
      };

      if (uploadResult.uploads) {
        uploadResult.uploads.forEach((upload: any) => {
          if (upload.success) {
            documents.push({
              name: upload.originalName || documentTypeMap[upload.documentType],
              category: documentTypeMap[upload.documentType],
              type: upload.type,
              url: upload.url,
              fileName: upload.fileName
            });
          }
        });
      }

      console.log('📋 Prepared documents array:', documents);

      // STEP 2: Save the profile
      const vendorProfile = {
        id: vendorId,
        phone: phone,
        fullName: profileData.fullName,
        businessName: profileData.businessName,
        vendorType: vendorType,
        serviceStyle: serviceStyle,
        address: profileData.address,
        location: profileData.coordinates,
        aadhaarNumber: profileData.aadhaarNumber,
        panNumber: profileData.panNumber,
        gstNumber: profileData.gstNumber,
        experience: profileData.experience,
        bankDetails: profileData.bankDetails,
        profileCreated: true,
        createdAt: new Date().toISOString()
      };

      const profileResponse = await apiClient.put(`/vendor/${vendorId}/profile`, vendorProfile) as any;

      if (!profileResponse || profileResponse.error) {
        toast.error(profileResponse?.error || 'Failed to save profile');
        return;
      }

      // STEP 3: Submit the application with document URLs
      const applicationPayload = {
        vendorId: vendorId,
        fullName: profileData.fullName,
        businessName: profileData.businessName || '',
        vendorType: vendorType,
        serviceStyle: serviceStyle,
        email: profileData.email || `${phone}@warmpawz.com`, // Fallback email
        phone: phone,
        location: profileData.coordinates,
        address: profileData.address,
        city: profileData.city || '',
        state: profileData.state || '',
        pincode: (profileData.pincode && profileData.pincode !== '000000') ? profileData.pincode : '',
        gstNumber: profileData.gstNumber || '',
        panNumber: profileData.panNumber || '',
        licenseNumber: profileData.licenseNumber || '',
        licenseExpiryDate: profileData.licenseExpiryDate || '',
        documents: documents, // Now includes URLs!
        additionalInfo: {
          aadhaarNumber: profileData.aadhaarNumber,
          panNumber: profileData.panNumber,
          gstNumber: profileData.gstNumber,
          experience: profileData.experience,
          bankDetails: profileData.bankDetails
        }
      };

      console.log('📤 Application payload being sent:', {
        vendorId: applicationPayload.vendorId,
        documentsCount: applicationPayload.documents.length,
        documents: applicationPayload.documents
      });

      const result = await apiClient.post('/vendor/onboarding/submit-application', applicationPayload) as any;

      if (result && result.success) {
        console.log('✅ Application submitted successfully:', result.applicationId);

        // Update local state
        setApplicationData({
          id: result.applicationId,
          status: 'pending'
        });

        // Show submitted screen
        setStatus('submitted');
        toast.success('Application submitted successfully!');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(WARMPAWZ_VENDOR_PROFILE_SUBMITTED_EVENT));
        }
      } else {
        console.error('❌ Failed to submit application:', result);
        toast.error(result?.error || 'Failed to submit application. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting profile and application:', error);
      toast.error('An error occurred. Please try again.');
    }
  };

  const handleContinueFromSubmitted = () => {
    setStatus('pending');
  };

  const handleApproved = () => {
    setStatus('approved_services');
  };

  const handleSetupComplete = async () => {
    console.log('🎯 [VendorLandingPage] handleSetupComplete called - updating vendor data...');

    // Refetch vendor data to get updated status
    try {
      const profileData = await apiClient.get(`/vendor/profile`) as any;

      if (profileData && profileData.vendor) {
        const vendor = profileData.vendorProfile || profileData.vendor;
        console.log('✅ [VendorLandingPage] Vendor data refreshed:', {
          setupCompleted: vendor?.setupCompleted,
          setupStage: vendor?.setupStage,
          isActive: vendor?.isActive
        });
        setVendorData(vendor);
      }
    } catch (error) {
      console.error('❌ [VendorLandingPage] Error refreshing vendor data:', error);
    }

    // Update status to active
    setStatus('active');
    if (onComplete) {
      onComplete();
    }
  };

  const handleResubmit = () => {
    setStatus('new');
  };

  {/*Handler for "Go back to onboarding form" – load existing application and show form for correction/clarification*/ }
  const handleCorrectAndResubmit = async (mode: 'correction' | 'clarification') => {
    if (!applicationIdForStatus) {
      toast.error('Application ID not found. Please refresh and try again.');
      return;
    }
    try {
      console.log(`📝 Starting re-onboarding in ${mode} mode...`);
      setLoading(true);

      const data = await apiClient.get(`/vendor/application/status/${applicationIdForStatus}`) as any;

      if (data?.application) {
        const app = data.application;
        const payload = app.form_data ?? app.application_payload ?? app ?? {};
        setExistingApplicationData(typeof payload === 'object' && payload !== null ? payload : {});
        setReEditMode(mode);
        setIsReEditing(true);
        setLoading(false);
        toast.success('Application loaded. Please update the required information.');
      } else {
        console.error('❌ Failed to load application:', data?.error);
        toast.error(data?.error || 'Failed to load application data. Please try again.');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Error loading application:', error);
      toast.error(error?.message || 'An error occurred. Please try again.');
      setLoading(false);
    }
  };


  { /*andler for completing re-onboarding*/ }
  const handleResubmitComplete = (data: any) => {
    console.log('✅ Resubmission complete:', data);

    // Reset re-editing state
    setIsReEditing(false);
    setExistingApplicationData(null);
    setReEditMode(null);

    // Reload vendor status
    if (initialVendorData) {
      processVendorData(initialVendorData);
    } else {
      checkVendorStatus();
    }

    toast.success('Application resubmitted successfully!');
  };

  //--------------------------------renders-----------------------------------//

  if (loading) {
    return (
      <div className="min-h-screen bg-white vendor-app-column flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  {/*Show re-onboarding screen when user clicked "Go back to onboarding form" (correction or clarification)*/ }
  if (isReEditing && existingApplicationData !== null) {
    const roleIdForForm = vendorData?.roleId ?? (applicationData as any)?.roleId ?? (existingApplicationData as any)?.roleId ?? (existingApplicationData as any)?.selected_role_id;
    console.log('📝 Rendering re-onboarding screen with mode:', reEditMode);
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="vendor-app-column p-4 bg-blue-50 border-b-2 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">!</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">
                {reEditMode === 'correction' ? 'Correction Required' : 'Update Your Application'}
              </h3>
              <p className="text-sm text-blue-800">
                Please review and update your application details below.
              </p>
            </div>
          </div>
        </div>
        <EnhancedVendorOnboarding
          phone={phone}
          roleId={roleIdForForm}
          onComplete={handleResubmitComplete}
          initialData={existingApplicationData}
        />
      </div>
    );
  }

  {/*Route to appropriate screen based on status*/ }
  switch (status) {
    case 'new':
    case 'profile_incomplete':
    case 'documents_required':
      return (
        <div className="min-h-screen bg-gray-50">
          {/* Show warning banner if documents are required */}
          {status === 'documents_required' && (
            <div className="vendor-app-column p-4 bg-orange-50 border-b-2 border-orange-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm">!</span>
                </div>
                <div>
                  <h3 className="font-medium text-orange-900 mb-1">Documents Required</h3>
                  <p className="text-sm text-orange-800">
                    {vendorData?.documentNotes || 'Please re-upload your documents. Some documents are missing or need to be updated.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <EnhancedVendorOnboarding
            phone={phone}
            roleId={vendorData?.roleId}
            onComplete={handleProfileSubmit}
          />
        </div>
      );

    case 'submitted':
      return (
        <VendorApplicationSubmitted
          applicationId={applicationData?.id || 'N/A'}
          onContinue={handleContinueFromSubmitted}
        />
      );

    case 'pending':
      return (
        <VendorApplicationUnderReview
          submittedAt={vendorData?.submittedAt || vendorData?.createdAt || new Date().toISOString()}
          isReapproval={vendorData?.wasApprovedBefore || vendorData?.previousStatus === 'approved'}
          reapprovalReason={vendorData?.reapprovalReason}
        />
      );

    case 'clarification':
      return (
        <VendorClarificationRequested
          applicationId={vendorData?.applicationId || applicationData?.id || 'N/A'}
          clarificationNotes={vendorData?.infoRequestMessage || applicationData?.clarificationNotes || 'Please update your application.'}
          reviewerName="Admin"
          onCorrectAndResubmit={() => handleCorrectAndResubmit('clarification')}
        />
      );

    case 'approved_services':
      return (
        <VendorApprovedSetup
          vendorId={vendorId}
          roleId={vendorData?.roleId}
          onComplete={handleSetupComplete}
        />
      );

    case 'approved_availability':
      return (
        <AdvancedAvailabilityManager
          vendorId={vendorId}
          vendorData={vendorData}
          onBack={() => {
            handleSetupComplete();
          }}
        />
      );

    case 'setup_completed':
      return (
        <VendorSetupCompleted
          onContinue={handleSetupComplete}
        />
      );

    case 'rejected':
      return (
        <VendorApplicationRejected
          applicationId={vendorData?.applicationId || applicationData?.id || 'N/A'}
          rejectionReason={vendorData?.rejectionReason || applicationData?.rejectionReason || 'No reason provided'}
          allowResubmit={applicationData?.allowResubmit !== false}
          onResubmit={handleResubmit}
          onCorrectAndResubmit={() => handleCorrectAndResubmit('correction')}
          onGoBack={() => {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('vendorData');
              localStorage.removeItem('vendorApplicationStatus');
              localStorage.removeItem('vendorRole');
              window.location.href = '/';
            }
          }}
        />
      );

    case 'active':

      if (showAdvancedAvailability) {
        return (
          <AdvancedAvailabilityManager
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowAdvancedAvailability(false)}
          />
        );
      }

      // Show service management screen if requested
      if (showServiceManagement) {
        return (
          <VendorServiceManagementComplete
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => vendorNavigate('/dashboard', router)}
          />
        );
      }

      // Show consultation screen if requested
      if (showConsultation) {
        return (
          <VendorConsultationScreen
            vendorId={vendorId}

            onBack={() => setShowConsultation(false)}
          />
        );
      }

      // Show booking management screen if requested
      if (showBookingManagement) {
        return (
          <VendorBookingManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowBookingManagement(false)}
            chatEnabled={!!capabilities?.chat}
            vendorPhone={vendorData?.phone}
            vendorName={vendorData?.fullName || vendorData?.businessName}
          />
        );
      }

      // Show tele consultation screen if requested
      if (showTeleConsultation) {
        return (
          <VendorTeleConsultationFlow
            vendorId={vendorId}

            onBack={() => setShowTeleConsultation(false)}
          />
        );
      }

      // Show facility management screen if requested
      if (showFacilityManagement) {
        return (
          <FacilityManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowFacilityManagement(false)}
          />
        );
      }

      // ✅ NEW: Show Center Profile Manager screen if requested
      if (showProfile) {
        return (
          <ProfileManager
            vendorId={vendorId}
            vendorData={vendorData}
            onNavigateToGallery={() => {
              setShowProfile(false);
              setShowGallery(true);
            }}
            onBack={async () => {
              setShowProfile(false);
              try {
                const res = await apiClient.get('/vendor/profile') as any;
                const v = res?.vendor;
                if (res?.success && v) {
                  const biz = v.businessName ?? v.business_name ?? v.name;
                  setVendorData((prev: any) => ({
                    ...(prev || {}),
                    ...(biz
                      ? { businessName: biz, business_name: biz }
                      : {}),
                    ownerName: v.ownerName ?? v.owner_name ?? prev?.ownerName,
                    owner_name: v.owner_name ?? v.ownerName ?? prev?.owner_name,
                    profilePhotoUrl: v.profilePhotoUrl ?? v.profile_photo_url ?? prev?.profilePhotoUrl,
                  }));
                }
              } catch {
                /* non-blocking */
              }
            }}
          />
        );
      }

      // ❌ REMOVED: Staff management has been decommissioned
      // Staff functionality has been replaced by vendor-level availability and scheduling

      // ✅ NEW: Render VendorBusinessHub
      if (showBusinessHub) {
        return (
          <VendorBusinessHub
            vendorId={vendorId}

            onBack={() => setShowBusinessHub(false)}
          />
        );
      }

      // ✅ NEW: Support Tickets Dashboard
      if (showSupportDashboard) {
        return <VendorSupportDashboard vendorId={vendorId} />;
      }

      // ✅ NEW: Vet Specialized Services Manager
      if (showVetSpecialized) {
        return (
          <VetSpecializedServicesManager
            vendorId={vendorId}

            onBack={() => setShowVetSpecialized(false)}
          />
        );
      }

      // ✅ FIX: Gallery Management
      if (showGallery) {
        return (
          <VendorGalleryManagement
            vendorId={vendorId}

            onBack={() => setShowGallery(false)}
          />
        );
      }

      // ✅ FIX: Portfolio Management
      if (showPortfolio) {
        return (
          <VendorPortfolioManagement
            vendorId={vendorId}

            onBack={() => setShowPortfolio(false)}
          />
        );
      }

      // ✅ FIX: CCTV Access
      if (showCCTV) {
        return (
          <VendorCCTVAccess
            vendorId={vendorId}

            onBack={() => setShowCCTV(false)}
          />
        );
      }

      // ✅ FIX: Controlled Substances Management
      if (showControlledSubstances) {
        return (
          <VendorControlledSubstances
            vendorId={vendorId}

            onBack={() => setShowControlledSubstances(false)}
          />
        );
      }

      // ✅ FIX: Prescription Builder (Enhanced)
      if (showPrescription) {
        return (
          <PrescriptionCreate
            vendorId={vendorId}
            onBack={() => setShowPrescription(false)}
            onSuccess={() => {
              setShowPrescription(false);
              setShowPrescriptionList(true);
            }}
          />
        );
      }

      // ✅ NEW: Prescription List
      if (showPrescriptionList) {
        return (
          <div className="vendor-page-shell bg-gray-50">
            <div className="vendor-app-column min-h-screen bg-white">
              <VendorHeader
                title="Prescriptions"
                onBack={() => setShowPrescriptionList(false)}
                actions={[
                  <button
                    key="create-rx"
                    type="button"
                    onClick={() => {
                      setShowPrescriptionList(false);
                      setShowPrescription(true);
                    }}
                    className="h-9 shrink-0 rounded-lg bg-blue-600 px-3 text-sm text-white hover:bg-blue-700"
                  >
                    Create New
                  </button>,
                ]}
              />
              <div className="mx-auto w-full max-w-4xl px-4 py-6">
                <PrescriptionList vendorId={vendorId} />
              </div>
            </div>
          </div>
        );
      }

      // ✅ Diagnostics center: Lab orders dashboard first; Test catalog secondary
      if (showDiagnosticsOrders) {
        return (
          <div className="min-h-screen bg-gray-50 vendor-screen-safe-top">
            <div className="max-w-6xl mx-auto px-4 pb-6">
              <DiagnosticsOrderDashboard
                vendorId={vendorId}
                onBack={() => {
                  setShowDiagnosticsOrders(false);
                  setShowDiagnostics(true);
                }}
                onSelectBooking={(bookingId) => setSelectedDiagnosticsBookingId(bookingId)}
              />
              {selectedDiagnosticsBookingId && (
                <AppointmentDetailModal
                  bookingId={selectedDiagnosticsBookingId}
                  vendorData={vendorData}
                  onClose={() => setSelectedDiagnosticsBookingId(null)}
                  onRefresh={() => setSelectedDiagnosticsBookingId(null)}
                />
              )}
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => { setShowDiagnosticsOrders(false); setShowDiagnostics(true); }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Manage Test Catalog →
                </button>
              </div>
            </div>
          </div>
        );
      }
      // ✅ NEW: Diagnostic Results (Test catalog)
      if (showDiagnostics) {
        return (
          <div className="min-h-screen bg-gray-50 vendor-screen-safe-top">
            <div className="max-w-6xl mx-auto px-4 pb-6">
              <DiagnosticResults
                vendorId={vendorId}
                vendorData={vendorData}
                onBack={() => {
                  setShowDiagnostics(false);
                  // Back from test catalog → main vendor dashboard (home). Lab orders: explicit "Lab Orders" row (onNavigateToOrders).
                }}
                onNavigateToOrders={() => {
                  setShowDiagnostics(false);
                  setShowDiagnosticsOrders(true);
                }}
              />
            </div>
          </div>
        );
      }

      // ✅ NEW: Service Pricing
      if (showPricing) {
        return (
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 py-6">
              <ServicePricing
                vendorId={vendorId}
                onBack={() => setShowPricing(false)}
              />
            </div>
          </div>
        );
      }

      // ✅ FIX: Progress Tracking Dashboard
      if (showProgressTracking) {
        const progressRoleType = getVendorProgressRoleType(vendorData);
        return (
          <ProgressTrackingDashboard
            vendorId={vendorId}
            roleType={progressRoleType}
            onBack={() => setShowProgressTracking(false)}
          />
        );
      }

      // ✅ FIX: Package Management
      if (showPackages) {
        return (
          <PackageManagementContainer
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowPackages(false)}
          />
        );
      }

      // ✅ FIX: Custom Service Creation - no early return; rendered as modal overlay below

      // ✅ FIX: Adoption System
      if (showAdoptionSystem) {
        return (
          <ShelterAdoptionSystem
            vendorId={vendorId}

            onBack={() => setShowAdoptionSystem(false)}
          />
        );
      }

      // ✅ FIX: Memorial Services
      if (showMemorialServices) {
        return (
          <VendorMemorialServices
            vendorId={vendorId}

            onBack={() => setShowMemorialServices(false)}
          />
        );
      }

      // ✅ NEW: Expiry Management
      if (showExpiryManagement) {
        return (
          <VendorExpiryManagement
            vendorId={vendorId}

            onBack={() => setShowExpiryManagement(false)}
          />
        );
      }

      // ✅ NEW: Donation Management
      if (showDonationManagement) {
        return (
          <VendorDonationManagement
            vendorId={vendorId}

            onBack={() => setShowDonationManagement(false)}
          />
        );
      }

      // ✅ NEW: Event Management
      if (showEventManagement) {
        return (
          <VendorEventManagement
            vendorId={vendorId}

            onBack={() => setShowEventManagement(false)}
          />
        );
      }

      // ✅ NEW: Patient Monitoring
      if (showPatientMonitoring) {
        return (
          <VendorPatientMonitoring
            vendorId={vendorId}

            onBack={() => setShowPatientMonitoring(false)}
          />
        );
      }

      // ✅ NEW: Cafe Menu Management
      if (showCafeMenuManagement) {
        return (
          <VendorCafeMenuManagement
            vendorId={vendorId}

            onBack={() => setShowCafeMenuManagement(false)}
          />
        );
      }

      // ✅ NEW: Prescription Verification
      if (showPrescriptionVerification) {
        return (
          <VendorPrescriptionVerification
            vendorId={vendorId}

            onBack={() => setShowPrescriptionVerification(false)}
          />
        );
      }

      // ✅ NEW: Delivery Management
      if (showDeliveryManagement) {
        return (
          <VendorDeliveryManagement
            vendorId={vendorId}

            onBack={() => setShowDeliveryManagement(false)}
          />
        );
      }

      // ✅ NEW: Diet Charts
      if (showDietCharts) {
        return (
          <VendorDietCharts
            vendorId={vendorId}

            onBack={() => setShowDietCharts(false)}
          />
        );
      }

      // ✅ NEW: Counseling
      if (showCounseling) {
        return (
          <VendorCounseling
            vendorId={vendorId}

            onBack={() => setShowCounseling(false)}
          />
        );
      }

      // ✅ NEW: Policy Management
      if (showPolicyManagement) {
        return (
          <VendorPolicyManagement
            vendorId={vendorId}

            onBack={() => setShowPolicyManagement(false)}
          />
        );
      }

      // ✅ NEW: Service Promotions Management
      if (showServicePromotions) {
        return (
          <ServicePromotionsManagement
            vendorId={vendorId}
            vendorRole={vendorData?.vendorType}
            roleId={vendorData?.roleId ?? vendorData?.role_id}
            onBack={() => setShowServicePromotions(false)}
          />
        );
      }

      // ✅ NEW: Distance Pricing (uses onClose)
      if (showDistancePricing) {
        return (
          <VendorDistancePricing
            vendorId={vendorId}
            onClose={() => setShowDistancePricing(false)}
          />
        );
      }

      // ⚡️ ROLE-SPECIFIC DASHBOARDS
      // Some roles have specialized dashboards with unique capabilities outside the universal config

      // 1. Veterinary Clinic - NOW USES VendorDashboard for comprehensive features
      // VendorDashboard includes: Quick Actions, Center Profile, Vet Services (Pharmacy/Diagnostics/Ambulance)
      // Removed ClinicDashboard as it was too limited and missing key vet features

      // 2. Pet Cafe
      if (vendorData?.roleId === 'pet_cafe') {
        console.log('☕ Rendering CafeVendorDashboard');
        return (
          <CafeVendorDashboard
            vendorId={vendorId}
            onNavigateToEventManagement={() => setShowEventManagement(true)}
          />
        );
      }

      // 3. Pet Resort
      if (vendorData?.roleId === 'pet_resort') {
        console.log('🏨 Rendering ResortManagementDashboard');
        return (
          <ResortManagementDashboard
            vendorId={vendorId}

            onBack={() => {
              // Handle logout or settings
            }}
          />
        );
      }

      // 4. Nutritionist — same home dashboard as other solo vendors (VendorDashboard).
      // Nutritionist meal products & orders: Additional Features "Diet" → /nutrition/dashboard only.

      // 5. Sunset Services (Memorial/Cremation)
      if (vendorData?.roleId === 'sunset_services') {
        console.log('🌅 Rendering SunsetServicesVendorDashboard');
        return (
          <SunsetServicesVendorDashboard
            vendorId={vendorId}
          />
        );
      }

      // 6. Pet / general insurance provider (plan creation + links to issued policies & claims)
      if (vendorData?.roleId === 'insurance' || vendorData?.roleId === 'pet_insurance') {
        console.log('🛡️ Rendering InsuranceVendorContainer');
        return (
          <InsuranceVendorContainer
            vendorId={vendorId}
          />
        );
      }

      // 7. Photography Services
      if (vendorData?.roleId === 'pet_photography' || vendorData?.roleId === 'photography') {
        console.log('📸 Rendering PhotographyVendorDashboard');
        return (
          <PhotographyVendorDashboard
            vendorId={vendorId}
          />
        );
      }

      // 8. Ambulance Services
      if (vendorData?.roleId === 'pet_ambulance' || vendorData?.roleId === 'ambulance') {
        console.log('🚑 Rendering AmbulanceVendorDashboard');
        return (
          <AmbulanceVendorDashboard
            vendorId={vendorId}
          />
        );
      }

      // 9. Pet Relocation Services
      if (vendorData?.roleId === 'pet_relocation' || vendorData?.roleId === 'relocation') {
        console.log('🚚 Rendering RelocationVendorDashboard');
        return (
          <RelocationVendorDashboard
            vendorId={vendorId}
          />
        );
      }

      // 10. Pet Products Store / Retailer — Seller Hub only for explicit retail roles (not nutritionist/pharmacy)
      if (isPetProductsStoreVendor(vendorData)) {
        const vendorRoleId = vendorData?.roleId || (vendorData as any)?.role_id;
        console.log('🏪 Pet Products Store detected - redirecting to Seller Hub. RoleId:', vendorRoleId);
        if (typeof window !== 'undefined' && window.location.pathname !== '/seller') {
          router.replace('/seller');
        }
        return null;
      }

      // ✅ Full VendorDashboard (Figma UI) – all options, appointment models, navigation
      console.log('🎯 Rendering VendorDashboard (Figma UI) for vendor:', vendorId);

      const isGroomerVendorPortfolioUnwired = hasVendorRole(vendorData, [
        'groomer',
        'groomer_solo',
        'groomer_center',
        'grooming_solo',
        'pet_groomer',
        'grooming_salon',
        'pet_grooming',
        'grooming',
      ]);

      /** Dog walkers: "progress" is walk sessions (OTP start / end session / GPS), not training program trackers. */
      const isWalkerVendor = hasVendorRole(vendorData, ['pet_walker', 'walker', 'dog_walker']);

      return (
        <>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4" />
              <p className="text-gray-600 mt-4">Loading dashboard...</p>
            </div>
          }>
            <VendorDashboard
              vendorId={vendorId}
              vendorData={vendorData}
              onNavigateToConsultation={() => setShowConsultation(true)}
              onNavigateToServiceManagement={() => vendorNavigate('/services', router)}
              onNavigateToBookingManagement={() => setShowBookingManagement(true)}
              onNavigateToTeleConsultation={() => setShowTeleConsultation(true)}
              onNavigateToScheduleManagement={() => setShowAdvancedAvailability(true)}
              onNavigateToAdvancedAvailability={() => setShowAdvancedAvailability(true)}
              onNavigateToProfile={() => setShowProfile(true)}
              onNavigateToFacilityManagement={() => setShowFacilityManagement(true)}
              onNavigateToBusinessHub={() => setShowBusinessHub(true)}
              onNavigateToSupport={() => setShowSupportDashboard(true)}
              onNavigateToLiveTracking={() => setShowLiveTracking(true)}
              onNavigateToSpecializedServices={() => setShowSpecializedServices(true)}
              onNavigateToGallery={() => setShowGallery(true)}
              onNavigateToPortfolio={
                isGroomerVendorPortfolioUnwired ? undefined : () => setShowPortfolio(true)
              }
              onNavigateToCCTV={() => setShowCCTV(true)}
              onNavigateToControlledSubstances={() => setShowControlledSubstances(true)}
              onNavigateToPrescription={() => setShowPrescription(true)}
              onNavigateToPrescriptionList={() => setShowPrescriptionList(true)}
              onNavigateToDiagnostics={() => {
                const roleName = vendorData?.role?.name || vendorData?.roleName || vendorData?.role_name;
                const isDiagnosticsCenterDirect = roleName && (
                  roleName.toLowerCase().includes('diagnostics_center') ||
                  roleName.toLowerCase().includes('diagnostic_center') ||
                  roleName.toLowerCase() === 'diagnostics'
                );
                const vendorDataWithCapabilities = { ...vendorData, capabilities: capabilities || [] };
                const isDiagnosticsCenterHelper = isDiagnosticsCenter(vendorDataWithCapabilities);
                const shouldShowOrders = isDiagnosticsCenterDirect || isDiagnosticsCenterHelper;
                if (shouldShowOrders) setShowDiagnosticsOrders(true);
                else setShowDiagnostics(true);
              }}
              onNavigateToPricing={() => setShowPricing(true)}
              onNavigateToProgressTracking={() => {
                if (isWalkerVendor) {
                  router.push('/bookings?walkSessions=1');
                } else {
                  setShowProgressTracking(true);
                }
              }}
              onNavigateToPackages={undefined}
              onNavigateToCustomServices={() => setShowCustomServices(true)}
              onNavigateToAdoptionSystem={() => setShowAdoptionSystem(true)}
              onNavigateToMemorialServices={() => setShowMemorialServices(true)}
              onNavigateToExpiryManagement={() => setShowExpiryManagement(true)}
              onNavigateToDonationManagement={() => setShowDonationManagement(true)}
              onNavigateToEventManagement={() => setShowEventManagement(true)}
              onNavigateToPatientMonitoring={() => setShowPatientMonitoring(true)}
              onNavigateToCafeMenuManagement={() => setShowCafeMenuManagement(true)}
              onNavigateToCafeTables={() => router.push('/cafe/tables')}
              onNavigateToPrescriptionVerification={() => setShowPrescriptionVerification(true)}
              onNavigateToDeliveryManagement={() => setShowDeliveryManagement(true)}
              onNavigateToDietCharts={() => router.push('/nutrition/dashboard')}
              onNavigateToCounseling={() => setShowCounseling(true)}
              onNavigateToDistancePricing={() => setShowDistancePricing(true)}
              onNavigateToPolicyManagement={() => setShowPolicyManagement(true)}
              onNavigateToServicePromotions={() => setShowServicePromotions(true)}
            />
          </Suspense>

          {showCustomServices && (
            <Dialog open={true} onOpenChange={(open) => !open && setShowCustomServices(false)}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
                <VendorCustomServiceCreation
                  vendorId={vendorId}
                  vendorData={vendorData}
                  serviceStyle={vendorData?.serviceStyle === 'both' ? 'both' : 'at_center'}
                  onClose={() => setShowCustomServices(false)}
                  onServiceCreated={() => setShowCustomServices(false)}
                />
              </DialogContent>
            </Dialog>
          )}
          {newBookingAlert && vendorId && (
            <VendorNewBookingOrderAlert
              notification={newBookingAlert}
              vendorId={vendorId}
              onView={(bookingId) => {
                setNewBookingAlert(null);
                setShowBookingManagement(true);
              }}
              onDismiss={() => setNewBookingAlert(null)}
              playSound={true}
            />
          )}
          {incomingCall && (
            <TeleCallNotification
              callType={incomingCall.callType || 'incoming'}
              customer={incomingCall.customer}
              bookingId={incomingCall.bookingId}
              meetingId={incomingCall.meetingId}
              serviceName={incomingCall.serviceName}
              petName={incomingCall.petName}
              onAccept={async (bookingId, meetingId) => {
                // Mark notification as read when call is accepted
                if (incomingCall?.notificationId) {
                  try {
                    await apiClient.put(`/notifications/${incomingCall.notificationId}/read`, {});
                    console.log('✅ [VENDOR-LANDING] Marked notification as read after accept:', incomingCall.notificationId);
                  } catch (err) {
                    console.warn('[VENDOR-LANDING] Failed to mark notification as read on accept:', err);
                  }
                }

                if (incomingCall?.isInstantV3) {
                  // V3 flow: call accept endpoint first, then navigate with waitingForPayment flag
                  try {
                    const res = await apiClient.post<any>(`/vendor/tele/instant-accept/${bookingId}`);
                    if (res?.success) {
                      toast.success('Call accepted! Waiting for customer payment...');
                      const params = new URLSearchParams();
                      params.set('bookingId', bookingId);
                      if (res.sessionId) params.set('sessionId', res.sessionId);
                      if (vendorId) params.set('vendorId', vendorId);
                      params.set('waitingForPayment', 'true');
                      router.push(`/video?${params.toString()}`);
                    } else {
                      toast.error(res?.error || 'Failed to accept call');
                    }
                  } catch (err: any) {
                    console.error('[VENDOR-LANDING] instant-accept error:', err);
                    toast.error(err?.message || 'Failed to accept call');
                  }
                } else {
                  // Legacy flow: navigate directly to video
                  const params = new URLSearchParams();
                  params.set('bookingId', bookingId);
                  if (meetingId) params.set('meetingId', meetingId);
                  if (vendorId) params.set('vendorId', vendorId);
                  const query = params.toString();
                  router.push(`/video${query ? `?${query}` : ''}`);
                }
                setIncomingCall(null);
              }}
              onReject={async () => {
                // Mark notification as read when call is rejected
                if (incomingCall?.notificationId) {
                  try {
                    await apiClient.put(`/notifications/${incomingCall.notificationId}/read`, {});
                    console.log('✅ [VENDOR-LANDING] Marked notification as read after reject:', incomingCall.notificationId);
                  } catch (err) {
                    console.warn('[VENDOR-LANDING] Failed to mark notification as read on reject:', err);
                  }
                }

                if (incomingCall?.isInstantV3) {
                  // V3 flow: call reject endpoint
                  try {
                    await apiClient.post<any>(`/vendor/tele/instant-reject/${incomingCall.bookingId}`);
                  } catch (err) {
                    console.warn('[VENDOR-LANDING] instant-reject error:', err);
                  }
                }
                setIncomingCall(null);
                toast.info('Call declined');
              }}
              onDismiss={() => {
                // Mark notification as read when call is dismissed
                if (incomingCall?.notificationId) {
                  apiClient.put(`/notifications/${incomingCall.notificationId}/read`, {}).catch(() => {
                    console.warn('[VENDOR-LANDING] Failed to mark notification as read on dismiss');
                  });
                }
                setIncomingCall(null);
              }}
            />
          )}
        </>
      );

    default:
      return null;
  }
}
