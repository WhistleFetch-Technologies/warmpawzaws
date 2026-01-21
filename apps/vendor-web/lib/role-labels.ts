/**
 * ============================================================================
 * ROLE-AWARE LABELS
 * ============================================================================
 * 
 * Provides context-appropriate terminology for each vendor role.
 * This ensures the UI uses natural language that matches each profession.
 * 
 * Example:
 * - Veterinarian sees "Appointments" and "Patients"
 * - Groomer sees "Appointments" and "Clients"
 * - Trainer sees "Sessions" and "Trainees"
 * - Pharmacy sees "Orders" and "Customers"
 * - Walker sees "Walks" and "Dogs"
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RoleLabels {
  // Booking-related
  booking: string;
  bookings: string;
  bookingVerb: string; // "Book", "Schedule", "Order"
  
  // Customer-related  
  customer: string;
  customers: string;
  
  // Pet-related
  pet: string;
  pets: string;
  
  // Service delivery
  service: string;
  services: string;
  session: string;
  sessions: string;
  
  // Actions
  startAction: string; // "Start Consultation", "Begin Walk", "Start Session"
  completeAction: string; // "Complete", "End Walk", "Finish"
  
  // Time slots
  slot: string;
  slots: string;
  
  // Schedule
  todayLabel: string; // "Today's Appointments", "Today's Walks"
  upcomingLabel: string; // "Upcoming Appointments", "Scheduled Walks"
  
  // Dashboard stats
  todayStat: string; // "Today's Appointments", "Walks Today"
  completedStat: string; // "Completed Appointments", "Walks Completed"
  pendingStat: string; // "Pending Consultations", "Pending Orders"
  
  // Service style labels
  atCenterLabel: string; // "At Clinic", "At Salon", "In Store"
  atHomeLabel: string; // "Home Visit", "At-Home Service"
  teleLabel: string; // "Video Consultation", "Online Session"
}

// ============================================================================
// ROLE LABEL CONFIGURATIONS
// ============================================================================

export const ROLE_LABELS: Record<string, RoleLabels> = {
  // =====================
  // HEALTHCARE ROLES
  // =====================
  veterinarian: {
    booking: 'Appointment',
    bookings: 'Appointments',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Patient',
    pets: 'Patients',
    service: 'Consultation',
    services: 'Consultations',
    session: 'Consultation',
    sessions: 'Consultations',
    startAction: 'Start Consultation',
    completeAction: 'Complete Consultation',
    slot: 'Appointment Slot',
    slots: 'Appointment Slots',
    todayLabel: "Today's Appointments",
    upcomingLabel: 'Upcoming Appointments',
    todayStat: 'Appointments Today',
    completedStat: 'Patients Seen',
    pendingStat: 'Pending Consultations',
    atCenterLabel: 'At Clinic',
    atHomeLabel: 'Home Visit',
    teleLabel: 'Tele Consult',
  },
  
  vet_clinic: {
    booking: 'Appointment',
    bookings: 'Appointments',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Patient',
    pets: 'Patients',
    service: 'Service',
    services: 'Services',
    session: 'Appointment',
    sessions: 'Appointments',
    startAction: 'Check-in Patient',
    completeAction: 'Complete Visit',
    slot: 'Appointment Slot',
    slots: 'Appointment Slots',
    todayLabel: "Today's Appointments",
    upcomingLabel: 'Upcoming Appointments',
    todayStat: 'Appointments Today',
    completedStat: 'Patients Seen',
    pendingStat: 'Waiting Patients',
    atCenterLabel: 'In Clinic',
    atHomeLabel: 'Home Visit',
    teleLabel: 'Video Consultation',
  },
  
  pharmacy: {
    booking: 'Order',
    bookings: 'Orders',
    bookingVerb: 'Place',
    customer: 'Customer',
    customers: 'Customers',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Delivery',
    services: 'Deliveries',
    session: 'Order',
    sessions: 'Orders',
    startAction: 'Process Order',
    completeAction: 'Complete Order',
    slot: 'Delivery Slot',
    slots: 'Delivery Slots',
    todayLabel: "Today's Orders",
    upcomingLabel: 'Pending Orders',
    todayStat: 'Orders Today',
    completedStat: 'Orders Fulfilled',
    pendingStat: 'Pending Orders',
    atCenterLabel: 'Store Pickup',
    atHomeLabel: 'Home Delivery',
    teleLabel: 'Online Consult',
  },
  
  ambulance: {
    booking: 'Emergency Request',
    bookings: 'Emergency Requests',
    bookingVerb: 'Request',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Patient',
    pets: 'Patients',
    service: 'Transport',
    services: 'Transports',
    session: 'Trip',
    sessions: 'Trips',
    startAction: 'Start Trip',
    completeAction: 'Complete Trip',
    slot: 'Availability',
    slots: 'Availability',
    todayLabel: "Today's Emergencies",
    upcomingLabel: 'Active Requests',
    todayStat: 'Trips Today',
    completedStat: 'Trips Completed',
    pendingStat: 'Active Emergencies',
    atCenterLabel: 'Hospital Transfer',
    atHomeLabel: 'Home Pickup',
    teleLabel: 'Emergency Consult',
  },
  
  diagnostics_center: {
    booking: 'Test Appointment',
    bookings: 'Test Appointments',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Patient',
    pets: 'Patients',
    service: 'Test',
    services: 'Tests',
    session: 'Sample Collection',
    sessions: 'Sample Collections',
    startAction: 'Start Test',
    completeAction: 'Upload Results',
    slot: 'Test Slot',
    slots: 'Test Slots',
    todayLabel: "Today's Tests",
    upcomingLabel: 'Scheduled Tests',
    todayStat: 'Tests Today',
    completedStat: 'Results Uploaded',
    pendingStat: 'Pending Results',
    atCenterLabel: 'At Center',
    atHomeLabel: 'Home Collection',
    teleLabel: 'Report Review',
  },
  
  // =====================
  // GROOMING & SPA ROLES
  // =====================
  groomer: {
    booking: 'Appointment',
    bookings: 'Appointments',
    bookingVerb: 'Book',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Grooming',
    services: 'Grooming Services',
    session: 'Grooming Session',
    sessions: 'Grooming Sessions',
    startAction: 'Start Grooming',
    completeAction: 'Complete Grooming',
    slot: 'Slot',
    slots: 'Slots',
    todayLabel: "Today's Appointments",
    upcomingLabel: 'Upcoming Appointments',
    todayStat: 'Appointments Today',
    completedStat: 'Pets Groomed',
    pendingStat: 'Waiting Pets',
    atCenterLabel: 'At Salon',
    atHomeLabel: 'Home Grooming',
    teleLabel: 'Video Consult',
  },
  
  pet_groomer: {
    booking: 'Appointment',
    bookings: 'Appointments',
    bookingVerb: 'Book',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Grooming',
    services: 'Grooming Services',
    session: 'Grooming Session',
    sessions: 'Grooming Sessions',
    startAction: 'Start Grooming',
    completeAction: 'Complete Grooming',
    slot: 'Slot',
    slots: 'Slots',
    todayLabel: "Today's Appointments",
    upcomingLabel: 'Upcoming Appointments',
    todayStat: 'Appointments Today',
    completedStat: 'Pets Groomed',
    pendingStat: 'Waiting Pets',
    atCenterLabel: 'At Salon',
    atHomeLabel: 'Home Grooming',
    teleLabel: 'Video Consult',
  },
  
  pet_spa: {
    booking: 'Appointment',
    bookings: 'Appointments',
    bookingVerb: 'Book',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Spa Treatment',
    services: 'Spa Treatments',
    session: 'Spa Session',
    sessions: 'Spa Sessions',
    startAction: 'Start Treatment',
    completeAction: 'Complete Treatment',
    slot: 'Slot',
    slots: 'Slots',
    todayLabel: "Today's Appointments",
    upcomingLabel: 'Upcoming Appointments',
    todayStat: 'Appointments Today',
    completedStat: 'Treatments Done',
    pendingStat: 'Waiting Pets',
    atCenterLabel: 'At Spa',
    atHomeLabel: 'Home Spa',
    teleLabel: 'Consultation',
  },
  
  // =====================
  // TRAINING ROLES
  // =====================
  trainer: {
    booking: 'Session',
    bookings: 'Sessions',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Trainee',
    pets: 'Trainees',
    service: 'Training',
    services: 'Training Programs',
    session: 'Training Session',
    sessions: 'Training Sessions',
    startAction: 'Start Session',
    completeAction: 'Complete Session',
    slot: 'Session Slot',
    slots: 'Session Slots',
    todayLabel: "Today's Sessions",
    upcomingLabel: 'Upcoming Sessions',
    todayStat: 'Sessions Today',
    completedStat: 'Sessions Completed',
    pendingStat: 'Pending Sessions',
    atCenterLabel: 'At Training Center',
    atHomeLabel: 'Home Training',
    teleLabel: 'Online Training',
  },
  
  pet_trainer: {
    booking: 'Session',
    bookings: 'Sessions',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Trainee',
    pets: 'Trainees',
    service: 'Training',
    services: 'Training Programs',
    session: 'Training Session',
    sessions: 'Training Sessions',
    startAction: 'Start Session',
    completeAction: 'Complete Session',
    slot: 'Session Slot',
    slots: 'Session Slots',
    todayLabel: "Today's Sessions",
    upcomingLabel: 'Upcoming Sessions',
    todayStat: 'Sessions Today',
    completedStat: 'Sessions Completed',
    pendingStat: 'Pending Sessions',
    atCenterLabel: 'At Training Center',
    atHomeLabel: 'Home Training',
    teleLabel: 'Online Training',
  },
  
  // =====================
  // WALKING & SITTING ROLES
  // =====================
  walker: {
    booking: 'Walk',
    bookings: 'Walks',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Dog',
    pets: 'Dogs',
    service: 'Walk',
    services: 'Walking Services',
    session: 'Walk',
    sessions: 'Walks',
    startAction: 'Start Walk',
    completeAction: 'End Walk',
    slot: 'Walk Slot',
    slots: 'Walk Slots',
    todayLabel: "Today's Walks",
    upcomingLabel: 'Scheduled Walks',
    todayStat: 'Walks Today',
    completedStat: 'Walks Completed',
    pendingStat: 'Upcoming Walks',
    atCenterLabel: 'Park Walk',
    atHomeLabel: 'Neighborhood Walk',
    teleLabel: 'Video Check-in',
  },
  
  pet_walker: {
    booking: 'Walk',
    bookings: 'Walks',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Dog',
    pets: 'Dogs',
    service: 'Walk',
    services: 'Walking Services',
    session: 'Walk',
    sessions: 'Walks',
    startAction: 'Start Walk',
    completeAction: 'End Walk',
    slot: 'Walk Slot',
    slots: 'Walk Slots',
    todayLabel: "Today's Walks",
    upcomingLabel: 'Scheduled Walks',
    todayStat: 'Walks Today',
    completedStat: 'Walks Completed',
    pendingStat: 'Upcoming Walks',
    atCenterLabel: 'Park Walk',
    atHomeLabel: 'Neighborhood Walk',
    teleLabel: 'Video Check-in',
  },
  
  pet_sitter: {
    booking: 'Booking',
    bookings: 'Bookings',
    bookingVerb: 'Book',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Pet Sitting',
    services: 'Pet Sitting Services',
    session: 'Sitting Session',
    sessions: 'Sitting Sessions',
    startAction: 'Check-in Pet',
    completeAction: 'Check-out Pet',
    slot: 'Time Slot',
    slots: 'Time Slots',
    todayLabel: "Today's Bookings",
    upcomingLabel: 'Upcoming Bookings',
    todayStat: 'Bookings Today',
    completedStat: 'Sessions Completed',
    pendingStat: 'Active Sittings',
    atCenterLabel: 'At Your Place',
    atHomeLabel: "At Pet's Home",
    teleLabel: 'Video Update',
  },
  
  // =====================
  // BOARDING ROLES
  // =====================
  pet_boarder: {
    booking: 'Reservation',
    bookings: 'Reservations',
    bookingVerb: 'Reserve',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Guest',
    pets: 'Guests',
    service: 'Boarding',
    services: 'Boarding Services',
    session: 'Stay',
    sessions: 'Stays',
    startAction: 'Check-in',
    completeAction: 'Check-out',
    slot: 'Room',
    slots: 'Rooms',
    todayLabel: 'Current Guests',
    upcomingLabel: 'Upcoming Arrivals',
    todayStat: 'Current Occupancy',
    completedStat: 'Check-outs Today',
    pendingStat: 'Arrivals Today',
    atCenterLabel: 'Standard Room',
    atHomeLabel: 'Premium Suite',
    teleLabel: 'Live Camera',
  },
  
  pet_daycare: {
    booking: 'Booking',
    bookings: 'Bookings',
    bookingVerb: 'Book',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Daycare',
    services: 'Daycare Services',
    session: 'Day Session',
    sessions: 'Day Sessions',
    startAction: 'Check-in',
    completeAction: 'Check-out',
    slot: 'Spot',
    slots: 'Spots',
    todayLabel: 'Pets In Care',
    upcomingLabel: 'Upcoming Bookings',
    todayStat: 'Pets Today',
    completedStat: 'Checked Out',
    pendingStat: 'Expected Arrivals',
    atCenterLabel: 'Full Day',
    atHomeLabel: 'Half Day',
    teleLabel: 'Live Feed',
  },
  
  // =====================
  // CAFE & HOSPITALITY
  // =====================
  pet_cafe: {
    booking: 'Reservation',
    bookings: 'Reservations',
    bookingVerb: 'Reserve',
    customer: 'Guest',
    customers: 'Guests',
    pet: 'Furry Friend',
    pets: 'Furry Friends',
    service: 'Table Service',
    services: 'Menu Items',
    session: 'Visit',
    sessions: 'Visits',
    startAction: 'Seat Guest',
    completeAction: 'Bill & Checkout',
    slot: 'Table',
    slots: 'Tables',
    todayLabel: "Today's Reservations",
    upcomingLabel: 'Upcoming Reservations',
    todayStat: 'Guests Today',
    completedStat: 'Tables Served',
    pendingStat: 'Waiting List',
    atCenterLabel: 'Dine-in',
    atHomeLabel: 'Takeaway',
    teleLabel: 'Pre-order',
  },
  
  // =====================
  // NUTRITION & DIET
  // =====================
  nutritionist: {
    booking: 'Consultation',
    bookings: 'Consultations',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Patient',
    pets: 'Patients',
    service: 'Diet Plan',
    services: 'Diet Plans',
    session: 'Consultation',
    sessions: 'Consultations',
    startAction: 'Start Consultation',
    completeAction: 'Complete Plan',
    slot: 'Consultation Slot',
    slots: 'Consultation Slots',
    todayLabel: "Today's Consultations",
    upcomingLabel: 'Upcoming Consultations',
    todayStat: 'Consultations Today',
    completedStat: 'Plans Created',
    pendingStat: 'Pending Reviews',
    atCenterLabel: 'In-person',
    atHomeLabel: 'Home Visit',
    teleLabel: 'Video Consult',
  },
  
  pet_nutritionist: {
    booking: 'Consultation',
    bookings: 'Consultations',
    bookingVerb: 'Schedule',
    customer: 'Pet Parent',
    customers: 'Pet Parents',
    pet: 'Patient',
    pets: 'Patients',
    service: 'Diet Plan',
    services: 'Diet Plans',
    session: 'Consultation',
    sessions: 'Consultations',
    startAction: 'Start Consultation',
    completeAction: 'Complete Plan',
    slot: 'Consultation Slot',
    slots: 'Consultation Slots',
    todayLabel: "Today's Consultations",
    upcomingLabel: 'Upcoming Consultations',
    todayStat: 'Consultations Today',
    completedStat: 'Plans Created',
    pendingStat: 'Pending Reviews',
    atCenterLabel: 'In-person',
    atHomeLabel: 'Home Visit',
    teleLabel: 'Video Consult',
  },
  
  // =====================
  // E-COMMERCE & RETAIL
  // =====================
  seller: {
    booking: 'Order',
    bookings: 'Orders',
    bookingVerb: 'Place',
    customer: 'Customer',
    customers: 'Customers',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Product',
    services: 'Products',
    session: 'Order',
    sessions: 'Orders',
    startAction: 'Process Order',
    completeAction: 'Complete Order',
    slot: 'Delivery Slot',
    slots: 'Delivery Slots',
    todayLabel: "Today's Orders",
    upcomingLabel: 'Pending Orders',
    todayStat: 'Orders Today',
    completedStat: 'Orders Shipped',
    pendingStat: 'Pending Orders',
    atCenterLabel: 'Store Pickup',
    atHomeLabel: 'Home Delivery',
    teleLabel: 'Online Support',
  },
  
  // =====================
  // SPECIALTY SERVICES
  // =====================
  pet_photographer: {
    booking: 'Session',
    bookings: 'Sessions',
    bookingVerb: 'Book',
    customer: 'Client',
    customers: 'Clients',
    pet: 'Model',
    pets: 'Models',
    service: 'Photo Shoot',
    services: 'Photo Packages',
    session: 'Photo Session',
    sessions: 'Photo Sessions',
    startAction: 'Start Session',
    completeAction: 'Complete Session',
    slot: 'Session Slot',
    slots: 'Session Slots',
    todayLabel: "Today's Sessions",
    upcomingLabel: 'Upcoming Sessions',
    todayStat: 'Sessions Today',
    completedStat: 'Sessions Completed',
    pendingStat: 'Pending Edits',
    atCenterLabel: 'Studio',
    atHomeLabel: 'On Location',
    teleLabel: 'Virtual Consult',
  },
  
  pet_relocation: {
    booking: 'Shipment',
    bookings: 'Shipments',
    bookingVerb: 'Schedule',
    customer: 'Client',
    customers: 'Clients',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Relocation',
    services: 'Relocation Services',
    session: 'Transport',
    sessions: 'Transports',
    startAction: 'Start Transport',
    completeAction: 'Complete Delivery',
    slot: 'Slot',
    slots: 'Slots',
    todayLabel: "Today's Shipments",
    upcomingLabel: 'Scheduled Shipments',
    todayStat: 'Shipments Today',
    completedStat: 'Delivered',
    pendingStat: 'In Transit',
    atCenterLabel: 'Domestic',
    atHomeLabel: 'Door-to-Door',
    teleLabel: 'Live Tracking',
  },
  
  pet_transport: {
    booking: 'Trip',
    bookings: 'Trips',
    bookingVerb: 'Book',
    customer: 'Customer',
    customers: 'Customers',
    pet: 'Pet',
    pets: 'Pets',
    service: 'Transport',
    services: 'Transport Services',
    session: 'Trip',
    sessions: 'Trips',
    startAction: 'Start Trip',
    completeAction: 'Complete Trip',
    slot: 'Slot',
    slots: 'Slots',
    todayLabel: "Today's Trips",
    upcomingLabel: 'Scheduled Trips',
    todayStat: 'Trips Today',
    completedStat: 'Trips Completed',
    pendingStat: 'Active Trips',
    atCenterLabel: 'Standard',
    atHomeLabel: 'Door-to-Door',
    teleLabel: 'Track Live',
  },
  
  pet_insurance: {
    booking: 'Application',
    bookings: 'Applications',
    bookingVerb: 'Apply',
    customer: 'Policyholder',
    customers: 'Policyholders',
    pet: 'Insured Pet',
    pets: 'Insured Pets',
    service: 'Policy',
    services: 'Insurance Policies',
    session: 'Consultation',
    sessions: 'Consultations',
    startAction: 'Review Application',
    completeAction: 'Issue Policy',
    slot: 'Appointment',
    slots: 'Appointments',
    todayLabel: "Today's Applications",
    upcomingLabel: 'Pending Applications',
    todayStat: 'Applications Today',
    completedStat: 'Policies Issued',
    pendingStat: 'Pending Claims',
    atCenterLabel: 'In-person',
    atHomeLabel: 'Home Visit',
    teleLabel: 'Video Consult',
  },
  
  shelter: {
    booking: 'Application',
    bookings: 'Applications',
    bookingVerb: 'Apply',
    customer: 'Adopter',
    customers: 'Adopters',
    pet: 'Rescue',
    pets: 'Rescues',
    service: 'Adoption',
    services: 'Adoption Services',
    session: 'Meet & Greet',
    sessions: 'Meet & Greets',
    startAction: 'Start Visit',
    completeAction: 'Complete Adoption',
    slot: 'Visiting Slot',
    slots: 'Visiting Slots',
    todayLabel: "Today's Visits",
    upcomingLabel: 'Scheduled Visits',
    todayStat: 'Visitors Today',
    completedStat: 'Adoptions Today',
    pendingStat: 'Pending Applications',
    atCenterLabel: 'At Shelter',
    atHomeLabel: 'Home Check',
    teleLabel: 'Virtual Tour',
  },
  
  pet_adoption_center: {
    booking: 'Application',
    bookings: 'Applications',
    bookingVerb: 'Apply',
    customer: 'Adopter',
    customers: 'Adopters',
    pet: 'Rescue',
    pets: 'Rescues',
    service: 'Adoption',
    services: 'Adoption Services',
    session: 'Meet & Greet',
    sessions: 'Meet & Greets',
    startAction: 'Start Visit',
    completeAction: 'Complete Adoption',
    slot: 'Visiting Slot',
    slots: 'Visiting Slots',
    todayLabel: "Today's Visits",
    upcomingLabel: 'Scheduled Visits',
    todayStat: 'Visitors Today',
    completedStat: 'Adoptions Today',
    pendingStat: 'Pending Applications',
    atCenterLabel: 'At Shelter',
    atHomeLabel: 'Home Check',
    teleLabel: 'Virtual Tour',
  },
  
  pet_event_organizer: {
    booking: 'Registration',
    bookings: 'Registrations',
    bookingVerb: 'Register',
    customer: 'Participant',
    customers: 'Participants',
    pet: 'Competitor',
    pets: 'Competitors',
    service: 'Event',
    services: 'Events',
    session: 'Event',
    sessions: 'Events',
    startAction: 'Start Event',
    completeAction: 'End Event',
    slot: 'Entry',
    slots: 'Entries',
    todayLabel: "Today's Events",
    upcomingLabel: 'Upcoming Events',
    todayStat: 'Events Today',
    completedStat: 'Events Completed',
    pendingStat: 'Pending Registrations',
    atCenterLabel: 'Venue',
    atHomeLabel: 'Virtual Event',
    teleLabel: 'Live Stream',
  },
};

// ============================================================================
// DEFAULT LABELS (fallback for unknown roles)
// ============================================================================

export const DEFAULT_LABELS: RoleLabels = {
  booking: 'Booking',
  bookings: 'Bookings',
  bookingVerb: 'Book',
  customer: 'Customer',
  customers: 'Customers',
  pet: 'Pet',
  pets: 'Pets',
  service: 'Service',
  services: 'Services',
  session: 'Session',
  sessions: 'Sessions',
  startAction: 'Start',
  completeAction: 'Complete',
  slot: 'Slot',
  slots: 'Slots',
  todayLabel: "Today's Schedule",
  upcomingLabel: 'Upcoming',
  todayStat: 'Today',
  completedStat: 'Completed',
  pendingStat: 'Pending',
  atCenterLabel: 'At Center',
  atHomeLabel: 'At Home',
  teleLabel: 'Online',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get labels for a specific role
 * Falls back to default labels for unknown roles
 */
export function getRoleLabels(roleId: string | undefined): RoleLabels {
  if (!roleId) return DEFAULT_LABELS;
  
  const normalized = roleId.toLowerCase().trim();
  return ROLE_LABELS[normalized] || DEFAULT_LABELS;
}

/**
 * Get a specific label for a role
 */
export function getLabel(roleId: string | undefined, key: keyof RoleLabels): string {
  const labels = getRoleLabels(roleId);
  return labels[key] || DEFAULT_LABELS[key];
}

/**
 * Get booking-related labels (singular and plural)
 */
export function getBookingLabels(roleId: string | undefined): { singular: string; plural: string; verb: string } {
  const labels = getRoleLabels(roleId);
  return {
    singular: labels.booking,
    plural: labels.bookings,
    verb: labels.bookingVerb,
  };
}

/**
 * Get service style label based on role
 */
export function getServiceStyleLabel(roleId: string | undefined, style: 'at_center' | 'at_home' | 'tele'): string {
  const labels = getRoleLabels(roleId);
  switch (style) {
    case 'at_center':
      return labels.atCenterLabel;
    case 'at_home':
      return labels.atHomeLabel;
    case 'tele':
      return labels.teleLabel;
    default:
      return labels.atCenterLabel;
  }
}
