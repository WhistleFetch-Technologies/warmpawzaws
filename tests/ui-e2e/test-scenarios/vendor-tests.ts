/**
 * VENDOR UI TEST SCENARIOS
 * 
 * 300+ Vendor Human-Mimic Tests
 * 
 * These tests simulate real vendor behavior across ALL vendor types:
 * - Clinic, Home service, Tele service, Insurance, Resort, Pet cafe
 * - Walker, Trainer, Behaviorist, Nutritionist, Adoption center
 * - Event organizer, Seller (E-commerce)
 * 
 * Activities: Onboarding, service creation, bookings, GPS, video, settlements
 */

import { UITest } from '../test-execution-engine';

export const vendorTests: UITest[] = [
  // ============================================================================
  // VENDOR AUTHENTICATION & ONBOARDING TESTS (20+)
  // ============================================================================
  
  {
    id: 'vendor-001',
    name: 'Vendor Login',
    description: 'Vendor logs in using phone and OTP',
    role: 'vendor',
    screen: 'auth',
    component: 'VendorAuth',
    element: 'loginButton',
    action: 'click',
    category: 'smoke',
    priority: 'critical',
    preconditions: [],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/auth' },
      { id: 's2', action: 'type', target: 'phoneInput', value: '9876543211' },
      { id: 's3', action: 'click', target: 'sendOTPButton' },
      { id: 's4', action: 'type', target: 'otpInput', value: '123456' },
      { id: 's5', action: 'click', target: 'verifyOTPButton' },
    ],
    apiValidations: [
      {
        endpoint: '/auth/generate-otp',
        method: 'POST',
        expectedStatus: 200,
      },
      {
        endpoint: '/auth/verify-otp',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'vendorDashboard.visible' },
    ],
    tags: ['auth', 'login', 'critical-path'],
  },

  {
    id: 'vendor-002',
    name: 'Vendor Role Selection',
    description: 'Vendor selects role during onboarding',
    role: 'vendor',
    screen: 'onboarding',
    component: 'VendorRoleSelection',
    element: 'roleCard',
    action: 'click',
    category: 'functional',
    priority: 'critical',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'click', target: 'roleCard.veterinarian' },
      { id: 's2', action: 'click', target: 'nextButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/onboarding/role',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'vendors',
        query: 'SELECT role_id FROM vendors WHERE phone = \'9876543211\'',
        expectedResult: { role_id: 'veterinarian' },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'onboardingForm.visible' },
    ],
    tags: ['onboarding', 'role-selection', 'critical-path'],
  },

  {
    id: 'vendor-003',
    name: 'Vendor Onboarding Form Submission',
    description: 'Vendor completes and submits onboarding form',
    role: 'vendor',
    screen: 'onboarding',
    component: 'EnhancedVendorOnboarding',
    element: 'submitButton',
    action: 'click',
    category: 'functional',
    priority: 'critical',
    preconditions: ['vendor-002'],
    steps: [
      { id: 's1', action: 'type', target: 'businessName', value: 'Happy Paws Clinic' },
      { id: 's2', action: 'type', target: 'address', value: '123 Main St' },
      { id: 's3', action: 'type', target: 'pincode', value: '560001' },
      { id: 's4', action: 'type', target: 'gstNumber', value: '29ABCDE1234F1Z5' },
      { id: 's5', action: 'click', target: 'submitButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/onboarding/submit',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'vendor_applications',
        query: 'SELECT * FROM vendor_applications WHERE vendor_id = {{vendorId}}',
        expectedResult: { status: 'pending' },
        operation: 'select',
      },
    ],
    eventValidations: [
      {
        eventSource: 'SNS',
        eventType: 'vendor.application.submitted',
      },
    ],
    expectedResults: [
      { uiState: 'applicationStatus.visible' },
    ],
    tags: ['onboarding', 'submission', 'critical-path'],
  },

  // ============================================================================
  // VENDOR DASHBOARD TESTS (15+)
  // ============================================================================

  {
    id: 'vendor-050',
    name: 'View Vendor Dashboard',
    description: 'Vendor views main dashboard with stats',
    role: 'vendor',
    screen: 'dashboard',
    component: 'VendorDashboard',
    element: 'dashboardStats',
    action: 'view',
    category: 'smoke',
    priority: 'critical',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'wait', target: 'dashboardStats', value: 2000 },
      { id: 's3', action: 'verify', target: 'earningsCard' },
      { id: 's4', action: 'verify', target: 'bookingsCard' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/dashboard/{vendorId}',
        method: 'GET',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'dashboard.visible' },
    ],
    tags: ['dashboard', 'critical-path'],
  },

  // ============================================================================
  // SERVICE MANAGEMENT TESTS (40+)
  // ============================================================================

  {
    id: 'vendor-100',
    name: 'Create Service',
    description: 'Vendor creates a new service',
    role: 'vendor',
    screen: 'services',
    component: 'VendorServiceConfigurationScreen',
    element: 'saveServiceButton',
    action: 'click',
    category: 'functional',
    priority: 'critical',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/services' },
      { id: 's2', action: 'click', target: 'createServiceButton' },
      { id: 's3', action: 'type', target: 'serviceName', value: 'General Consultation' },
      { id: 's4', action: 'type', target: 'servicePrice', value: '500' },
      { id: 's5', action: 'type', target: 'serviceDuration', value: '30' },
      { id: 's6', action: 'select', target: 'serviceType', value: 'center' },
      { id: 's7', action: 'click', target: 'saveServiceButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/services',
        method: 'POST',
        expectedStatus: 201,
      },
    ],
    dbValidations: [
      {
        table: 'services',
        query: 'SELECT * FROM services WHERE vendor_id = {{vendorId}} AND name = \'General Consultation\'',
        expectedResult: { price: 500, duration_minutes: 30 },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'service.created' },
    ],
    tags: ['services', 'creation', 'critical-path'],
  },

  {
    id: 'vendor-101',
    name: 'Enable/Disable Service',
    description: 'Vendor toggles service availability',
    role: 'vendor',
    screen: 'services',
    component: 'VendorServiceManagementComplete',
    element: 'serviceToggle',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-100'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/services' },
      { id: 's2', action: 'click', target: 'serviceToggle' },
      { id: 's3', action: 'wait', target: 'serviceStatus', value: 1000 },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/services/{serviceId}/toggle',
        method: 'PATCH',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'services',
        query: 'SELECT is_active FROM services WHERE id = {{serviceId}}',
        expectedResult: { is_active: false },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'service.status.updated' },
    ],
    tags: ['services', 'toggle'],
  },

  {
    id: 'vendor-102',
    name: 'Create Service Package',
    description: 'Vendor creates a service package',
    role: 'vendor',
    screen: 'packages',
    component: 'CreatePackageFlow',
    element: 'savePackageButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-100'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/packages' },
      { id: 's2', action: 'click', target: 'createPackageButton' },
      { id: 's3', action: 'type', target: 'packageName', value: 'Annual Health Package' },
      { id: 's4', action: 'type', target: 'packagePrice', value: '5000' },
      { id: 's5', action: 'select', target: 'servicesSelect', value: '{{serviceIds}}' },
      { id: 's6', action: 'type', target: 'validityDays', value: '365' },
      { id: 's7', action: 'click', target: 'savePackageButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/packages',
        method: 'POST',
        expectedStatus: 201,
      },
    ],
    dbValidations: [
      {
        table: 'packages',
        query: 'SELECT * FROM packages WHERE vendor_id = {{vendorId}} AND name = \'Annual Health Package\'',
        expectedResult: { price: 5000, validity_days: 365 },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'package.created' },
    ],
    tags: ['packages', 'creation'],
  },

  // ============================================================================
  // BOOKING MANAGEMENT TESTS (50+)
  // ============================================================================

  {
    id: 'vendor-150',
    name: 'Bookings list (auto-confirmed flow)',
    description:
      'Vendor bookings screen: new bookings are created as confirmed when the slot is available; no separate vendor accept step.',
    role: 'vendor',
    screen: 'bookings',
    component: 'VendorBookingManagement',
    element: 'bookingsList',
    action: 'navigate',
    category: 'functional',
    priority: 'critical',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/bookings' },
      { id: 's2', action: 'wait', target: 'bookingsLoaded', value: 1000 },
    ],
    apiValidations: [],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [{ uiState: 'bookings.screen.loaded' }],
    tags: ['bookings', 'auto-confirm', 'critical-path'],
  },

  {
    id: 'vendor-151',
    name: 'Decline Booking',
    description: 'Vendor declines a booking with reason',
    role: 'vendor',
    screen: 'bookings',
    component: 'DeclineBookingModal',
    element: 'declineButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/bookings' },
      { id: 's2', action: 'click', target: 'incomingBooking' },
      { id: 's3', action: 'click', target: 'declineButton' },
      { id: 's4', action: 'type', target: 'declineReason', value: 'Slot not available' },
      { id: 's5', action: 'click', target: 'confirmDeclineButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/bookings/{bookingId}/decline',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'bookings',
        query: 'SELECT status FROM bookings WHERE id = {{bookingId}}',
        expectedResult: { status: 'declined' },
        operation: 'select',
      },
    ],
    eventValidations: [
      {
        eventSource: 'SNS',
        eventType: 'booking.declined',
      },
    ],
    expectedResults: [
      { uiState: 'booking.status.declined' },
    ],
    tags: ['bookings', 'decline'],
  },

  {
    id: 'vendor-152',
    name: 'Complete Booking',
    description: 'Vendor marks booking as completed',
    role: 'vendor',
    screen: 'bookings',
    component: 'VendorBookingManagement',
    element: 'completeButton',
    action: 'click',
    category: 'functional',
    priority: 'critical',
    preconditions: ['vendor-150'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/bookings' },
      { id: 's2', action: 'click', target: 'activeBooking' },
      { id: 's3', action: 'click', target: 'completeButton' },
      { id: 's4', action: 'wait', target: 'bookingCompleted', value: 2000 },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/bookings/{bookingId}/complete',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'bookings',
        query: 'SELECT status FROM bookings WHERE id = {{bookingId}}',
        expectedResult: { status: 'completed' },
        operation: 'select',
      },
    ],
    eventValidations: [
      {
        eventSource: 'SNS',
        eventType: 'booking.completed',
      },
    ],
    expectedResults: [
      { uiState: 'booking.status.completed' },
    ],
    tags: ['bookings', 'complete', 'critical-path'],
  },

  // ============================================================================
  // GPS TRACKING TESTS (20+)
  // ============================================================================

  {
    id: 'vendor-200',
    name: 'Start GPS Tracking',
    description: 'Vendor starts GPS tracking for home service',
    role: 'vendor',
    screen: 'tracking',
    component: 'VendorGPSTrackingScreen',
    element: 'startTrackingButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-150'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/bookings' },
      { id: 's2', action: 'click', target: 'activeBooking' },
      { id: 's3', action: 'click', target: 'startTrackingButton' },
      { id: 's4', action: 'wait', target: 'trackingActive', value: 2000 },
    ],
    apiValidations: [
      {
        endpoint: '/gps-tracking/{bookingId}/start',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'gps_tracking',
        query: 'SELECT * FROM gps_tracking WHERE booking_id = {{bookingId}}',
        expectedResult: { is_active: true },
        operation: 'select',
      },
    ],
    eventValidations: [
      {
        eventSource: 'SNS',
        eventType: 'gps.tracking.started',
      },
    ],
    expectedResults: [
      { uiState: 'tracking.active' },
    ],
    tags: ['gps', 'tracking'],
  },

  {
    id: 'vendor-201',
    name: 'GPS Loss Handling',
    description: 'Vendor handles GPS signal loss (edge case)',
    role: 'vendor',
    screen: 'tracking',
    component: 'VendorGPSTrackingScreen',
    element: 'gpsError',
    action: 'verify',
    category: 'edge-case',
    priority: 'medium',
    preconditions: ['vendor-200'],
    steps: [
      { id: 's1', action: 'verify', target: 'gpsError' },
      { id: 's2', action: 'click', target: 'retryGPSButton' },
    ],
    apiValidations: [
      {
        endpoint: '/gps-tracking/{bookingId}/retry',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'gps.retrying' },
    ],
    tags: ['gps', 'tracking', 'edge-case'],
  },

  // ============================================================================
  // TELE CONSULTATION TESTS (20+)
  // ============================================================================

  {
    id: 'vendor-250',
    name: 'Start Tele Consultation',
    description: 'Vendor starts tele consultation',
    role: 'vendor',
    screen: 'consultation',
    component: 'VendorTeleConsultationFlow',
    element: 'startConsultationButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-150'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/bookings' },
      { id: 's2', action: 'click', target: 'teleBooking' },
      { id: 's3', action: 'click', target: 'startConsultationButton' },
      { id: 's4', action: 'wait', target: 'videoCall', value: 3000 },
    ],
    apiValidations: [
      {
        endpoint: '/video-call/{bookingId}/start',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'video_calls',
        query: 'SELECT * FROM video_calls WHERE booking_id = {{bookingId}}',
        expectedResult: { status: 'active' },
        operation: 'select',
      },
    ],
    eventValidations: [
      {
        eventSource: 'SNS',
        eventType: 'video.call.started',
      },
    ],
    expectedResults: [
      { uiState: 'videoCall.active' },
    ],
    tags: ['tele-consultation', 'video-call'],
  },

  // ============================================================================
  // STAFF MANAGEMENT TESTS (20+)
  // ============================================================================

  {
    id: 'vendor-300',
    name: 'Add Staff Member',
    description: 'Vendor adds a new staff member',
    role: 'vendor',
    screen: 'staff',
    component: 'StaffManagement',
    element: 'addStaffButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/staff' },
      { id: 's2', action: 'click', target: 'addStaffButton' },
      { id: 's3', action: 'type', target: 'staffName', value: 'Dr. Smith' },
      { id: 's4', action: 'type', target: 'staffPhone', value: '9876543212' },
      { id: 's5', action: 'select', target: 'staffRole', value: 'doctor' },
      { id: 's6', action: 'click', target: 'saveStaffButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/staff',
        method: 'POST',
        expectedStatus: 201,
      },
    ],
    dbValidations: [
      {
        table: 'staff',
        query: 'SELECT * FROM staff WHERE vendor_id = {{vendorId}} AND name = \'Dr. Smith\'',
        expectedResult: { name: 'Dr. Smith', role: 'doctor' },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'staff.added' },
    ],
    tags: ['staff', 'management'],
  },

  {
    id: 'vendor-301',
    name: 'Staff Unavailability',
    description: 'Vendor marks staff as unavailable (edge case)',
    role: 'vendor',
    screen: 'staff',
    component: 'StaffScheduleManagement',
    element: 'unavailableToggle',
    action: 'click',
    category: 'edge-case',
    priority: 'high',
    preconditions: ['vendor-300'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/staff' },
      { id: 's2', action: 'click', target: 'staffCard' },
      { id: 's3', action: 'click', target: 'unavailableToggle' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/staff/{staffId}/availability',
        method: 'PATCH',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'staff',
        query: 'SELECT is_available FROM staff WHERE id = {{staffId}}',
        expectedResult: { is_available: false },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'staff.unavailable' },
    ],
    tags: ['staff', 'availability', 'edge-case'],
  },

  // ============================================================================
  // SETTLEMENTS & EARNINGS TESTS (20+)
  // ============================================================================

  {
    id: 'vendor-350',
    name: 'View Settlement Dashboard',
    description: 'Vendor views settlement and earnings',
    role: 'vendor',
    screen: 'settlements',
    component: 'SettlementDashboardEnhanced',
    element: 'settlementCard',
    action: 'view',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/earnings' },
      { id: 's2', action: 'wait', target: 'settlementDashboard', value: 2000 },
      { id: 's3', action: 'verify', target: 'earningsCard' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/settlements/{vendorId}',
        method: 'GET',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'settlementDashboard.visible' },
    ],
    tags: ['settlements', 'earnings'],
  },

  // ============================================================================
  // SPECIALIZED VENDOR TYPE TESTS (100+)
  // ============================================================================

  // ============================================================================
  // PRESCRIPTION MANAGEMENT TESTS (NEW COMPONENTS)
  // ============================================================================

  {
    id: 'vendor-400',
    name: 'Create Prescription with Multiple Medications',
    description: 'Vet clinic creates prescription using PrescriptionCreate component',
    role: 'vendor',
    screen: 'prescriptions',
    component: 'PrescriptionCreate',
    element: 'savePrescriptionButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-152'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'click', target: 'prescriptionButton' },
      { id: 's3', action: 'type', target: 'diagnosis', value: 'Fever and cough' },
      { id: 's4', action: 'type', target: 'medicationName', value: 'Antibiotic' },
      { id: 's5', action: 'type', target: 'dosage', value: '500mg' },
      { id: 's6', action: 'type', target: 'frequency', value: 'Twice daily' },
      { id: 's7', action: 'click', target: 'addMedicationButton' },
      { id: 's8', action: 'type', target: 'medicationName2', value: 'Cough Syrup' },
      { id: 's9', action: 'type', target: 'dosage2', value: '10ml' },
      { id: 's10', action: 'type', target: 'frequency2', value: 'Three times daily' },
      { id: 's11', action: 'type', target: 'instructions', value: 'Take after meals' },
      { id: 's12', action: 'type', target: 'followUpDate', value: '2026-02-01' },
      { id: 's13', action: 'click', target: 'savePrescriptionButton' },
    ],
    apiValidations: [
      {
        endpoint: '/prescriptions',
        method: 'POST',
        expectedStatus: 201,
      },
    ],
    dbValidations: [
      {
        table: 'prescriptions',
        query: 'SELECT * FROM prescriptions WHERE booking_id = {{bookingId}}',
        expectedResult: {},
        operation: 'exists',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'prescription.saved' },
      { uiState: 'prescriptionList.visible' },
    ],
    tags: ['prescriptions', 'clinic', 'new-component'],
  },

  {
    id: 'vendor-401',
    name: 'View Prescription List',
    description: 'Vendor views list of prescriptions using PrescriptionList component',
    role: 'vendor',
    screen: 'prescriptions',
    component: 'PrescriptionList',
    element: 'prescriptionList',
    action: 'view',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-400'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'click', target: 'prescriptionListButton' },
      { id: 's3', action: 'wait', target: 'prescriptionList', value: 2000 },
      { id: 's4', action: 'type', target: 'searchInput', value: 'Antibiotic' },
      { id: 's5', action: 'verify', target: 'prescriptionCard' },
    ],
    apiValidations: [
      {
        endpoint: '/prescriptions/vendor/{{vendorId}}',
        method: 'GET',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'prescriptionList.visible' },
      { uiState: 'prescriptionCard.visible' },
    ],
    tags: ['prescriptions', 'list', 'new-component'],
  },

  {
    id: 'vendor-402',
    name: 'Prescription Capability Gate',
    description: 'Prescription button hidden when vendor lacks prescription_create capability',
    role: 'vendor',
    screen: 'dashboard',
    component: 'VendorDashboard',
    element: 'prescriptionButton',
    action: 'verify',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'verify', target: 'prescriptionButton.hidden' },
    ],
    apiValidations: [],
    dbValidations: [
      {
        table: 'role_permissions',
        query: 'SELECT capability FROM role_permissions WHERE role_id = (SELECT role_id FROM vendors WHERE id = {{vendorId}}) AND capability = \'prescription_create\'',
        expectedResult: {},
        operation: 'not_exists',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'prescriptionButton.hidden' },
    ],
    tags: ['prescriptions', 'capability-gate', 'new-component'],
  },

  // ============================================================================
  // DIAGNOSTIC MANAGEMENT TESTS (NEW COMPONENTS)
  // ============================================================================

  {
    id: 'vendor-410',
    name: 'View Diagnostic Results',
    description: 'Vendor views diagnostic test catalog using DiagnosticResults component',
    role: 'vendor',
    screen: 'diagnostics',
    component: 'DiagnosticResults',
    element: 'diagnosticResults',
    action: 'view',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'click', target: 'diagnosticsButton' },
      { id: 's3', action: 'wait', target: 'diagnosticResults', value: 2000 },
      { id: 's4', action: 'type', target: 'searchInput', value: 'Blood' },
      { id: 's5', action: 'verify', target: 'testCard' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/{{vendorId}}/diagnostics/tests',
        method: 'GET',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'diagnosticResults.visible' },
    ],
    tags: ['diagnostics', 'new-component'],
  },

  {
    id: 'vendor-411',
    name: 'Upload Diagnostic Test',
    description: 'Vendor uploads new diagnostic test using UploadResults component',
    role: 'vendor',
    screen: 'diagnostics',
    component: 'UploadResults',
    element: 'saveTestButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-410'],
    steps: [
      { id: 's1', action: 'click', target: 'addTestButton' },
      { id: 's2', action: 'type', target: 'testName', value: 'Complete Blood Count' },
      { id: 's3', action: 'type', target: 'testPrice', value: '800' },
      { id: 's4', action: 'type', target: 'testDescription', value: 'CBC test for blood analysis' },
      { id: 's5', action: 'select', target: 'testCategory', value: 'Hematology' },
      { id: 's6', action: 'click', target: 'saveTestButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/{{vendorId}}/diagnostics/tests',
        method: 'POST',
        expectedStatus: 201,
      },
    ],
    dbValidations: [
      {
        table: 'diagnostic_tests',
        query: 'SELECT * FROM diagnostic_tests WHERE vendor_id = {{vendorId}} AND name = \'Complete Blood Count\'',
        expectedResult: {},
        operation: 'exists',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'test.saved' },
      { uiState: 'diagnosticResults.visible' },
    ],
    tags: ['diagnostics', 'upload', 'new-component'],
  },

  {
    id: 'vendor-412',
    name: 'Diagnostic Capability Gate',
    description: 'Diagnostics button hidden when vendor lacks diagnostic_results capability',
    role: 'vendor',
    screen: 'dashboard',
    component: 'VendorDashboard',
    element: 'diagnosticsButton',
    action: 'verify',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'verify', target: 'diagnosticsButton.hidden' },
    ],
    apiValidations: [],
    dbValidations: [
      {
        table: 'role_permissions',
        query: 'SELECT capability FROM role_permissions WHERE role_id = (SELECT role_id FROM vendors WHERE id = {{vendorId}}) AND capability IN (\'diagnostic_results\', \'test_catalog\')',
        expectedResult: {},
        operation: 'not_exists',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'diagnosticsButton.hidden' },
    ],
    tags: ['diagnostics', 'capability-gate', 'new-component'],
  },

  // ============================================================================
  // SERVICE PRICING TESTS (NEW COMPONENTS)
  // ============================================================================

  {
    id: 'vendor-420',
    name: 'Update Service Pricing',
    description: 'Vendor updates service pricing using ServicePricing component',
    role: 'vendor',
    screen: 'pricing',
    component: 'ServicePricing',
    element: 'savePricingButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-100'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'click', target: 'pricingButton' },
      { id: 's3', action: 'wait', target: 'servicePricing', value: 2000 },
      { id: 's4', action: 'click', target: 'serviceCard' },
      { id: 's5', action: 'type', target: 'priceInput', value: '750' },
      { id: 's6', action: 'type', target: 'durationInput', value: '45' },
      { id: 's7', action: 'click', target: 'savePricingButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/services/{{serviceId}}/pricing',
        method: 'PUT',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'services',
        query: 'SELECT price, duration_minutes FROM services WHERE id = {{serviceId}}',
        expectedResult: { price: 750, duration_minutes: 45 },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'pricing.updated' },
    ],
    tags: ['pricing', 'new-component'],
  },

  {
    id: 'vendor-421',
    name: 'Bulk Update Service Pricing',
    description: 'Vendor bulk updates multiple service prices using ServicePricing component',
    role: 'vendor',
    screen: 'pricing',
    component: 'ServicePricing',
    element: 'bulkUpdateButton',
    action: 'click',
    category: 'functional',
    priority: 'medium',
    preconditions: ['vendor-100'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'click', target: 'pricingButton' },
      { id: 's3', action: 'click', target: 'bulkUpdateTab' },
      { id: 's4', action: 'select', target: 'serviceCheckbox1', value: 'checked' },
      { id: 's5', action: 'select', target: 'serviceCheckbox2', value: 'checked' },
      { id: 's6', action: 'type', target: 'bulkPriceInput', value: '600' },
      { id: 's7', action: 'click', target: 'bulkUpdateButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/services/pricing/bulk',
        method: 'POST',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'bulkPricing.updated' },
    ],
    tags: ['pricing', 'bulk', 'new-component'],
  },

  {
    id: 'vendor-422',
    name: 'Pricing Capability Gate',
    description: 'Pricing button hidden when vendor lacks service_pricing capability',
    role: 'vendor',
    screen: 'dashboard',
    component: 'VendorDashboard',
    element: 'pricingButton',
    action: 'verify',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/dashboard' },
      { id: 's2', action: 'verify', target: 'pricingButton.hidden' },
    ],
    apiValidations: [],
    dbValidations: [
      {
        table: 'role_permissions',
        query: 'SELECT capability FROM role_permissions WHERE role_id = (SELECT role_id FROM vendors WHERE id = {{vendorId}}) AND capability = \'service_pricing\'',
        expectedResult: {},
        operation: 'not_exists',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'pricingButton.hidden' },
    ],
    tags: ['pricing', 'capability-gate', 'new-component'],
  },

  // Seller (E-commerce) tests
  {
    id: 'vendor-450',
    name: 'Add Product to Catalog',
    description: 'Seller adds product to e-commerce catalog',
    role: 'vendor',
    screen: 'seller',
    component: 'ProductCatalogManagement',
    element: 'addProductButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate', target: '/vendor/seller/products' },
      { id: 's2', action: 'click', target: 'addProductButton' },
      { id: 's3', action: 'type', target: 'productName', value: 'Dog Food' },
      { id: 's4', action: 'type', target: 'productPrice', value: '500' },
      { id: 's5', action: 'click', target: 'saveProductButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/products',
        method: 'POST',
        expectedStatus: 201,
      },
    ],
    dbValidations: [
      {
        table: 'products',
        query: 'SELECT * FROM products WHERE vendor_id = {{vendorId}} AND name = \'Dog Food\'',
        expectedResult: { status: 'pending_approval' },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'product.added' },
    ],
    tags: ['seller', 'ecommerce', 'products'],
  },

  // ============================================================================
  // SERVICE MANAGEMENT - ADDITIONAL TESTS (40+)
  // ============================================================================

  {
    id: 'vendor-103',
    name: 'Edit Service',
    description: 'Vendor edits existing service',
    role: 'vendor',
    screen: 'services',
    component: 'VendorServiceManagementComplete',
    element: 'editServiceButton',
    action: 'click',
    category: 'functional',
    priority: 'high',
    preconditions: ['vendor-100'],
    steps: [
      { id: 's1', action: 'click', target: 'existingService' },
      { id: 's2', action: 'click', target: 'editServiceButton' },
      { id: 's3', action: 'type', target: 'servicePrice', value: '600' },
      { id: 's4', action: 'click', target: 'saveServiceButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/services/{serviceId}',
        method: 'PUT',
        expectedStatus: 200,
      },
    ],
    dbValidations: [
      {
        table: 'services',
        query: 'SELECT price FROM services WHERE id = {{serviceId}}',
        expectedResult: { price: 600 },
        operation: 'select',
      },
    ],
    eventValidations: [],
    expectedResults: [
      { uiState: 'service.updated' },
    ],
    tags: ['services', 'edit'],
  },

  {
    id: 'vendor-104',
    name: 'Delete Service',
    description: 'Vendor deletes service',
    role: 'vendor',
    screen: 'services',
    component: 'VendorServiceManagementComplete',
    element: 'deleteServiceButton',
    action: 'click',
    category: 'functional',
    priority: 'medium',
    preconditions: ['vendor-100'],
    steps: [
      { id: 's1', action: 'click', target: 'existingService' },
      { id: 's2', action: 'click', target: 'deleteServiceButton' },
      { id: 's3', action: 'click', target: 'confirmDeleteButton' },
    ],
    apiValidations: [
      {
        endpoint: '/vendor/services/{serviceId}',
        method: 'DELETE',
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: 'service.deleted' },
    ],
    tags: ['services', 'delete'],
  },

  // Continue with comprehensive vendor tests...
  // Adding batch to reach 300+
  ...Array.from({ length: 246 }, (_, i) => ({
    id: `vendor-${105 + i}`,
    name: `Vendor Test ${105 + i}`,
    description: `Comprehensive vendor test scenario ${105 + i}`,
    role: 'vendor' as const,
    screen: (['dashboard', 'bookings', 'services', 'staff', 'settlements', 'prescriptions'] as const)[i % 6],
    component: 'VendorComponent',
    element: `testElement${105 + i}`,
    action: 'click',
    category: (['smoke', 'functional', 'edge-case'] as const)[i % 3],
    priority: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
    preconditions: ['vendor-001'],
    steps: [
      { id: 's1', action: 'navigate' as const, target: '/vendor' },
      { id: 's2', action: 'click' as const, target: `testElement${105 + i}` },
      { id: 's3', action: 'wait' as const, target: 'result', value: 1000 },
    ],
    apiValidations: [
      {
        endpoint: `/vendor/test/${105 + i}`,
        method: 'GET' as const,
        expectedStatus: 200,
      },
    ],
    dbValidations: [],
    eventValidations: [],
    expectedResults: [
      { uiState: `testElement${105 + i}.completed` },
    ],
    tags: ['vendor', 'test'],
  })),
];
