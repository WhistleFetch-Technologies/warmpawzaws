/**
 * Analytics Utility
 * Centralized analytics tracking
 */

interface EventProperties {
  [key: string]: string | number | boolean | undefined;
}

export const Analytics = {
  /**
   * Track a custom event
   */
  track: (event: string, properties?: EventProperties): void => {
    // Google Analytics 4
    if (typeof window !== 'undefined' && (window as any).gtag) {
      try {
        (window as any).gtag('event', event, properties);
      } catch (error) {
        console.warn('Analytics tracking failed:', error);
      }
    }

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', event, properties);
    }
  },

  /**
   * Track page view
   */
  pageView: (page: string, title?: string): void => {
    Analytics.track('page_view', {
      page_path: page,
      page_title: title || document.title
    });
  },

  // ============================================
  // VENDOR LIFECYCLE EVENTS
  // ============================================

  /**
   * Vendor started onboarding
   */
  vendorOnboardingStarted: (roleId: string, phone: string): void => {
    Analytics.track('vendor_onboarding_started', {
      role_id: roleId,
      phone_hash: Analytics.hashPhone(phone)
    });
  },

  /**
   * Vendor completed onboarding
   */
  vendorOnboarded: (roleId: string, vendorId: string, serviceStyles: string[]): void => {
    Analytics.track('vendor_onboarded', {
      role_id: roleId,
      vendor_id: vendorId,
      service_styles: serviceStyles.join(','),
      service_count: serviceStyles.length
    });
  },

  /**
   * Vendor application approved
   */
  vendorApproved: (roleId: string, vendorId: string, approvalTime: number): void => {
    Analytics.track('vendor_approved', {
      role_id: roleId,
      vendor_id: vendorId,
      approval_time_hours: approvalTime
    });
  },

  /**
   * Vendor application rejected
   */
  vendorRejected: (roleId: string, vendorId: string, reason: string): void => {
    Analytics.track('vendor_rejected', {
      role_id: roleId,
      vendor_id: vendorId,
      rejection_category: Analytics.categorizeRejectionReason(reason)
    });
  },

  /**
   * More info requested from vendor
   */
  vendorInfoRequested: (roleId: string, vendorId: string, requestedFields: string[]): void => {
    Analytics.track('vendor_info_requested', {
      role_id: roleId,
      vendor_id: vendorId,
      field_count: requestedFields.length,
      fields: requestedFields.join(',')
    });
  },

  // ============================================
  // DASHBOARD EVENTS
  // ============================================

  /**
   * Dashboard viewed
   */
  dashboardViewed: (vendorId: string, roleId: string, loadTime: number): void => {
    Analytics.track('dashboard_viewed', {
      vendor_id: vendorId,
      role_id: roleId,
      load_time_ms: Math.round(loadTime),
      load_time_seconds: (loadTime / 1000).toFixed(2)
    });
  },

  /**
   * Dashboard section viewed
   */
  dashboardSectionViewed: (vendorId: string, section: string): void => {
    Analytics.track('dashboard_section_viewed', {
      vendor_id: vendorId,
      section_name: section
    });
  },

  /**
   * Quick action clicked
   */
  quickActionClicked: (vendorId: string, action: string): void => {
    Analytics.track('quick_action_clicked', {
      vendor_id: vendorId,
      action_name: action
    });
  },

  // ============================================
  // BOOKING EVENTS
  // ============================================

  /**
   * Booking received
   */
  bookingReceived: (vendorId: string, bookingId: string, serviceType: string, amount: number): void => {
    Analytics.track('booking_received', {
      vendor_id: vendorId,
      booking_id: bookingId,
      service_type: serviceType,
      amount: amount
    });
  },

  /**
   * Booking accepted
   */
  bookingAccepted: (vendorId: string, bookingId: string, responseTime: number): void => {
    Analytics.track('booking_accepted', {
      vendor_id: vendorId,
      booking_id: bookingId,
      response_time_minutes: responseTime
    });
  },

  /**
   * Booking rejected
   */
  bookingRejected: (vendorId: string, bookingId: string, reason: string): void => {
    Analytics.track('booking_rejected', {
      vendor_id: vendorId,
      booking_id: bookingId,
      rejection_reason: reason
    });
  },

  /**
   * Booking completed
   */
  bookingCompleted: (vendorId: string, bookingId: string, amount: number, duration: number): void => {
    Analytics.track('booking_completed', {
      vendor_id: vendorId,
      booking_id: bookingId,
      amount: amount,
      duration_minutes: duration
    });
  },

  // ============================================
  // COMMUNICATION EVENTS
  // ============================================

  /**
   * Chat initiated
   */
  chatInitiated: (vendorId: string, customerId: string): void => {
    Analytics.track('chat_initiated', {
      vendor_id: vendorId,
      customer_id: customerId
    });
  },

  /**
   * Video call started
   */
  videoCallStarted: (vendorId: string, bookingId: string, type: string): void => {
    Analytics.track('video_call_started', {
      vendor_id: vendorId,
      booking_id: bookingId,
      call_type: type // tele_consultation, etc.
    });
  },

  /**
   * Video call completed
   */
  videoCallCompleted: (vendorId: string, bookingId: string, duration: number): void => {
    Analytics.track('video_call_completed', {
      vendor_id: vendorId,
      booking_id: bookingId,
      duration_minutes: duration
    });
  },

  // ============================================
  // ROLE-SPECIFIC EVENTS
  // ============================================

  /**
   * Prescription written (Vet)
   */
  prescriptionWritten: (vendorId: string, patientId: string, medicineCount: number): void => {
    Analytics.track('prescription_written', {
      vendor_id: vendorId,
      patient_id: patientId,
      medicine_count: medicineCount
    });
  },

  /**
   * Photo update sent (Groomer/Boarding)
   */
  photoUpdateSent: (vendorId: string, customerId: string, photoCount: number, type: string): void => {
    Analytics.track('photo_update_sent', {
      vendor_id: vendorId,
      customer_id: customerId,
      photo_count: photoCount,
      update_type: type // before_after, daily_update, etc.
    });
  },

  /**
   * Progress updated (Trainer)
   */
  progressUpdated: (vendorId: string, programId: string, sessionNumber: number): void => {
    Analytics.track('progress_updated', {
      vendor_id: vendorId,
      program_id: programId,
      session_number: sessionNumber
    });
  },

  /**
   * Walk started (Dog Walker)
   */
  walkStarted: (vendorId: string, bookingId: string, dogCount: number): void => {
    Analytics.track('walk_started', {
      vendor_id: vendorId,
      booking_id: bookingId,
      dog_count: dogCount
    });
  },

  /**
   * Walk completed (Dog Walker)
   */
  walkCompleted: (vendorId: string, bookingId: string, distance: number, duration: number): void => {
    Analytics.track('walk_completed', {
      vendor_id: vendorId,
      booking_id: bookingId,
      distance_km: distance,
      duration_minutes: duration
    });
  },

  /**
   * Product added (Store)
   */
  productAdded: (vendorId: string, productId: string, category: string, price: number): void => {
    Analytics.track('product_added', {
      vendor_id: vendorId,
      product_id: productId,
      category: category,
      price: price
    });
  },

  /**
   * Order shipped (Store)
   */
  orderShipped: (vendorId: string, orderId: string, courier: string, amount: number): void => {
    Analytics.track('order_shipped', {
      vendor_id: vendorId,
      order_id: orderId,
      courier: courier,
      amount: amount
    });
  },

  /**
   * CCTV access shared (Boarding)
   */
  cctvAccessShared: (vendorId: string, customerId: string, duration: number): void => {
    Analytics.track('cctv_access_shared', {
      vendor_id: vendorId,
      customer_id: customerId,
      access_duration_hours: duration
    });
  },

  // ============================================
  // PAYMENT EVENTS
  // ============================================

  /**
   * Payment received
   */
  paymentReceived: (vendorId: string, bookingId: string, amount: number, method: string): void => {
    Analytics.track('payment_received', {
      vendor_id: vendorId,
      booking_id: bookingId,
      amount: amount,
      payment_method: method
    });
  },

  /**
   * Payout requested
   */
  payoutRequested: (vendorId: string, amount: number): void => {
    Analytics.track('payout_requested', {
      vendor_id: vendorId,
      amount: amount
    });
  },

  // ============================================
  // ERROR TRACKING
  // ============================================

  /**
   * Track errors
   */
  trackError: (error: Error, context?: EventProperties): void => {
    Analytics.track('error_occurred', {
      error_message: error.message,
      error_name: error.name,
      error_stack: error.stack?.substring(0, 500),
      ...context
    });
  },

  /**
   * Track API errors
   */
  trackApiError: (endpoint: string, status: number, error: string): void => {
    Analytics.track('api_error', {
      endpoint: endpoint,
      status_code: status,
      error_message: error
    });
  },

  // ============================================
  // USER ENGAGEMENT
  // ============================================

  /**
   * Session started
   */
  sessionStarted: (vendorId: string, roleId: string): void => {
    Analytics.track('session_started', {
      vendor_id: vendorId,
      role_id: roleId,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Feature used
   */
  featureUsed: (vendorId: string, feature: string, duration?: number): void => {
    Analytics.track('feature_used', {
      vendor_id: vendorId,
      feature_name: feature,
      duration_seconds: duration
    });
  },

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Hash phone number for privacy
   */
  hashPhone: (phone: string): string => {
    // Simple hash for analytics (not cryptographic)
    let hash = 0;
    for (let i = 0; i < phone.length; i++) {
      const char = phone.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  },

  /**
   * Categorize rejection reason
   */
  categorizeRejectionReason: (reason: string): string => {
    const lower = reason.toLowerCase();
    
    if (lower.includes('document') || lower.includes('license') || lower.includes('certificate')) {
      return 'documentation_issue';
    }
    if (lower.includes('experience') || lower.includes('qualification')) {
      return 'qualification_issue';
    }
    if (lower.includes('incomplete') || lower.includes('missing')) {
      return 'incomplete_application';
    }
    if (lower.includes('fraud') || lower.includes('fake')) {
      return 'fraud_suspected';
    }
    
    return 'other';
  },

  /**
   * Set user properties
   */
  setUserProperties: (vendorId: string, properties: EventProperties): void => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      try {
        (window as any).gtag('set', 'user_properties', {
          vendor_id: vendorId,
          ...properties
        });
      } catch (error) {
        console.warn('Failed to set user properties:', error);
      }
    }
  },

  /**
   * Identify vendor
   */
  identify: (vendorId: string, roleId: string, status: string): void => {
    Analytics.setUserProperties(vendorId, {
      role_id: roleId,
      vendor_status: status,
      last_active: new Date().toISOString()
    });
  }
};

export default Analytics;
