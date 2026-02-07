'use client';

/**
 * Analytics Tracking Utility for Warmpawz Customer Web
 * 
 * Provides event tracking for:
 * - Page views
 * - Booking flow steps
 * - User interactions (clicks, searches, filters)
 * - Conversions (bookings completed, payments)
 * - Error tracking
 * 
 * Supports multiple analytics providers:
 * - Google Analytics 4
 * - Custom internal analytics endpoint
 */

// Event categories for organized tracking
export type EventCategory = 
  | 'page_view'
  | 'booking_flow'
  | 'search'
  | 'filter'
  | 'click'
  | 'conversion'
  | 'error'
  | 'engagement'
  | 'navigation';

// Booking flow step names
export type BookingStep = 
  | 'service_selection'
  | 'provider_discovery'
  | 'provider_selection'
  | 'schedule_selection'
  | 'address_selection'
  | 'pet_selection'
  | 'problem_selection'
  | 'prescription_upload'
  | 'payment_initiated'
  | 'payment_completed'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled';

// Service categories
export type ServiceCategory = 
  | 'vet'
  | 'grooming'
  | 'training'
  | 'walking'
  | 'boarding'
  | 'sitting'
  | 'pharmacy'
  | 'nutrition'
  | 'diagnostics'
  | 'ambulance'
  | 'photography'
  | 'relocation';

interface AnalyticsEvent {
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  customDimensions?: Record<string, string | number | boolean>;
}

interface BookingFlowEvent {
  step: BookingStep;
  serviceCategory: ServiceCategory;
  serviceStyle?: 'at_center' | 'at_home' | 'tele';
  vendorId?: string;
  petId?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

interface PageViewEvent {
  pageName: string;
  pageCategory?: string;
  referrer?: string;
  metadata?: Record<string, any>;
}

// Analytics configuration
let analyticsConfig = {
  enabled: true,
  debug: process.env.NODE_ENV === 'development',
  gaTrackingId: process.env.NEXT_PUBLIC_GA_TRACKING_ID || '',
  internalEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '',
};

// Session tracking
let sessionData = {
  sessionId: '',
  userId: '',
  deviceType: '',
  startTime: Date.now(),
};

// Initialize session
function initializeSession() {
  if (typeof window === 'undefined') return;
  
  // Generate or retrieve session ID
  sessionData.sessionId = sessionStorage.getItem('warmpawz_session_id') || 
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('warmpawz_session_id', sessionData.sessionId);
  
  // Detect device type
  const ua = navigator.userAgent;
  sessionData.deviceType = /Mobile|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop';
  
  // Get user ID if available
  sessionData.userId = localStorage.getItem('warmpawz_customer_phone') || '';
}

// Initialize on load
if (typeof window !== 'undefined') {
  initializeSession();
}

/**
 * Set user identifier for analytics
 */
export function setAnalyticsUser(phone: string) {
  sessionData.userId = phone;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('warmpawz_customer_phone', phone);
  }
  
  // Send user identification event
  track({
    category: 'engagement',
    action: 'user_identified',
    customDimensions: { userId: phone }
  });
}

/**
 * Core tracking function
 */
export function track(event: AnalyticsEvent) {
  if (!analyticsConfig.enabled) return;
  
  const enrichedEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    sessionId: sessionData.sessionId,
    userId: sessionData.userId,
    deviceType: sessionData.deviceType,
    url: typeof window !== 'undefined' ? window.location.href : '',
  };
  
  // Debug logging
  if (analyticsConfig.debug) {
    console.log('📊 [Analytics]', enrichedEvent);
  }
  
  // Send to Google Analytics if configured
  if (analyticsConfig.gaTrackingId && typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      ...event.customDimensions,
    });
  }
  
  // Send to internal analytics endpoint
  if (analyticsConfig.internalEndpoint) {
    fetch(analyticsConfig.internalEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedEvent),
    }).catch(() => {
      // Silently fail for analytics
    });
  }
}

/**
 * Track page view
 */
export function trackPageView(event: PageViewEvent) {
  track({
    category: 'page_view',
    action: 'view',
    label: event.pageName,
    customDimensions: {
      pageCategory: event.pageCategory || '',
      referrer: event.referrer || (typeof document !== 'undefined' ? document.referrer : ''),
      ...event.metadata,
    },
  });
}

/**
 * Track booking flow step
 */
export function trackBookingStep(event: BookingFlowEvent) {
  track({
    category: 'booking_flow',
    action: event.step,
    label: event.serviceCategory,
    customDimensions: {
      serviceStyle: event.serviceStyle || '',
      vendorId: event.vendorId || '',
      petId: event.petId || '',
      phone: event.phone || sessionData.userId,
      ...event.metadata,
    },
  });
}

/**
 * Track search action
 */
export function trackSearch(query: string, category?: ServiceCategory, resultsCount?: number) {
  track({
    category: 'search',
    action: 'search_performed',
    label: query,
    value: resultsCount,
    customDimensions: {
      searchCategory: category || 'all',
    },
  });
}

/**
 * Track filter application
 */
export function trackFilter(filterType: string, filterValue: string, category?: ServiceCategory) {
  track({
    category: 'filter',
    action: 'filter_applied',
    label: `${filterType}:${filterValue}`,
    customDimensions: {
      filterType,
      filterValue,
      serviceCategory: category || '',
    },
  });
}

/**
 * Track click event
 */
export function trackClick(elementName: string, elementType: string, metadata?: Record<string, any>) {
  track({
    category: 'click',
    action: elementType,
    label: elementName,
    customDimensions: metadata,
  });
}

/**
 * Track conversion (booking completed, payment success)
 */
export function trackConversion(
  conversionType: 'booking_completed' | 'payment_success' | 'signup_completed',
  value?: number,
  metadata?: Record<string, any>
) {
  track({
    category: 'conversion',
    action: conversionType,
    value,
    customDimensions: metadata,
  });
}

/**
 * Track error
 */
export function trackError(errorType: string, errorMessage: string, metadata?: Record<string, any>) {
  track({
    category: 'error',
    action: errorType,
    label: errorMessage,
    customDimensions: metadata,
  });
}

/**
 * Track navigation
 */
export function trackNavigation(from: string, to: string, method: 'click' | 'back' | 'swipe' | 'auto') {
  track({
    category: 'navigation',
    action: method,
    label: `${from} → ${to}`,
    customDimensions: {
      fromPage: from,
      toPage: to,
    },
  });
}

/**
 * Booking flow analytics wrapper
 * Use this to wrap booking flow components for automatic step tracking
 */
export function useBookingAnalytics(
  serviceCategory: ServiceCategory,
  serviceStyle?: 'at_center' | 'at_home' | 'tele'
) {
  const trackStep = (step: BookingStep, metadata?: Record<string, any>) => {
    trackBookingStep({
      step,
      serviceCategory,
      serviceStyle,
      metadata,
    });
  };
  
  return {
    trackStep,
    trackProviderView: (vendorId: string) => {
      trackStep('provider_selection', { vendorId });
    },
    trackScheduleSelect: (date: string, time: string) => {
      trackStep('schedule_selection', { selectedDate: date, selectedTime: time });
    },
    trackPaymentInitiated: (amount: number, vendorId: string) => {
      trackStep('payment_initiated', { amount, vendorId });
    },
    trackPaymentCompleted: (amount: number, orderId: string) => {
      trackStep('payment_completed', { amount, orderId });
      trackConversion('payment_success', amount, { orderId, serviceCategory });
    },
    trackBookingConfirmed: (bookingId: string, vendorId: string) => {
      trackStep('booking_confirmed', { bookingId, vendorId });
      trackConversion('booking_completed', undefined, { bookingId, vendorId, serviceCategory });
    },
  };
}

// Export default instance
export default {
  track,
  trackPageView,
  trackBookingStep,
  trackSearch,
  trackFilter,
  trackClick,
  trackConversion,
  trackError,
  trackNavigation,
  setAnalyticsUser,
  useBookingAnalytics,
};
