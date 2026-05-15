
export interface PushNotificationPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
    imageUrl?: string;
    sound?: 'default' | 'high_priority' | 'urgent';
    priority?: 'low' | 'normal' | 'high';
    ttl?: number; // Time-to-live in seconds
    collapseKey?: string; // For grouping notifications
}

export interface NotificationRecipient {
    userId: string;
    userType: 'customer' | 'vendor' | 'admin' | 'staff';
    phone?: string;
    email?: string;
}

export interface NotificationEvent {
    eventType: NotificationEventType;
    recipientId: string;
    recipientType: 'customer' | 'vendor' | 'admin' | 'staff';
    relatedId?: string; // booking_id, order_id, etc.
    data?: Record<string, any>;
}

export type NotificationEventType =
    // Booking Events
    | 'booking_created'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'booking_completed'
    | 'booking_reminder'
    | 'booking_start_otp'
    | 'booking_rescheduled'
    // Video Call Events
    | 'video_call_reminder_5min'
    | 'video_call_started'
    | 'video_call_ready'
    | 'video_call_ended'
    | 'tele_customer_waiting'
    | 'tele_call_incoming'
    // Vendor Events
    | 'vendor_on_way'
    | 'vendor_arrived'
    | 'vendor_started_service'
    | 'vendor_application_approved'
    | 'vendor_application_rejected'
    | 'vendor_application_clarification'
    // Pharmacy/Delivery Events
    | 'pharmacy_order_broadcast'
    | 'pharmacy_order_accepted'
    | 'pharmacy_order_preparing'
    | 'pharmacy_order_ready'
    | 'pharmacy_order_dispatched'
    | 'pharmacy_order_delivered'
    // Meal Delivery Events
    | 'meal_order_received'
    | 'meal_order_preparing'
    | 'meal_order_eta_updated'
    | 'meal_order_pickup'
    | 'meal_order_delivered'
    // Rating/Review Events
    | 'rating_request'
    | 'review_received'
    // General Events
    | 'payment_successful'
    | 'payment_failed'
    | 'refund_processed'
    | 'subscription_reminder'
    | 'prescription_uploaded'
    | 'report_uploaded'
    //settleemts
    | 'settlement_created'
    | 'settlement_processed'
    | 'payout_processed'


export const NOTIFICATION_TEMPLATES: Record<NotificationEventType, {
    title: string;
    body: string;
    sound?: 'default' | 'high_priority' | 'urgent';
}> = {
    // Booking Events
    booking_created: {
        title: '🐾 Booking Confirmed!',
        body: 'Your appointment with {vendorName} is confirmed for {date} at {time}.',
    },
    booking_confirmed: {
        title: '✅ Booking Accepted',
        body: '{vendorName} has accepted your booking for {serviceName}.',
    },
    booking_cancelled: {
        title: '❌ Booking Cancelled',
        body: 'Your booking for {serviceName} has been cancelled. Refund will be processed shortly.',
    },
    booking_completed: {
        title: '🎉 Service Completed!',
        body: 'Your {serviceName} session is complete. How was your experience?',
    },
    booking_reminder: {
        title: '⏰ Appointment Reminder',
        body: 'Your appointment with {vendorName} is in {timeLeft}. OTP: {otp}',
    },
    booking_start_otp: {
        title: '🔐 Service Start OTP',
        body: 'Share this OTP with {vendorName} to start your service: {otp}',
    },
    booking_rescheduled: {
        title: '📅 Booking Rescheduled',
        body: 'Customer has rescheduled booking from {oldDate} {oldTime} to {newDate} {newTime}. Reason: {reason}',
        sound: 'high_priority',
    },

    // Video Call Events
    video_call_reminder_5min: {
        title: '📹 Video Call in 5 Minutes!',
        body: 'Your consultation with {vendorName} starts in 5 minutes. Please be ready.',
        sound: 'high_priority',
    },
    video_call_started: {
        title: '📞 Call Started',
        body: '{vendorName} is ready for your video consultation. Join now!',
        sound: 'urgent',
    },
    video_call_ready: {
        title: '👋 Participant Ready',
        body: '{participantName} is ready for the video call.',
    },
    video_call_ended: {
        title: '📞 Call Ended',
        body: 'Your consultation with {vendorName} has ended. Prescription will be uploaded shortly.',
    },
    tele_customer_waiting: {
        title: '👋 Customer Waiting',
        body: 'Your customer is waiting for you to join the video consultation.',
    },
    tele_call_incoming: {
        title: '📞 Call Incoming',
        body: 'Your customer is ready to start the video consultation. Join now!',
    },

    // Vendor Events
    vendor_on_way: {
        title: '🚗 Vendor On The Way!',
        body: '{vendorName} is on the way. ETA: {eta} minutes.',
        sound: 'high_priority',
    },
    vendor_arrived: {
        title: '🏠 Vendor Arrived',
        body: '{vendorName} has arrived at your location.',
        sound: 'urgent',
    },
    vendor_started_service: {
        title: '✨ Service Started',
        body: '{vendorName} has started the {serviceName} service.',
    },
    vendor_application_approved: {
        title: '🎉 Application Approved!',
        body: 'Congratulations! Your vendor application has been approved. Get started now!',
    },
    vendor_application_rejected: {
        title: '❌ Application Not Approved',
        body: 'Unfortunately, your application was not approved. Reason: {reason}',
    },
    vendor_application_clarification: {
        title: '📝 Clarification Required',
        body: 'Please review the admin feedback and update your application: {comment}',
    },

    // Pharmacy/Delivery Events
    pharmacy_order_broadcast: {
        title: '💊 New Pharmacy Order!',
        body: 'New order from {customerName}. {itemCount} items. Accept within 2 minutes.',
        sound: 'urgent',
    },
    pharmacy_order_accepted: {
        title: '✅ Order Accepted',
        body: '{pharmacyName} has accepted your order. Preparing now...',
    },
    pharmacy_order_preparing: {
        title: '⏳ Order Being Prepared',
        body: 'Your order is being prepared at {pharmacyName}.',
    },
    pharmacy_order_ready: {
        title: '📦 Order Ready for Pickup',
        body: 'Your order is ready! Delivery partner will pick up soon.',
    },
    pharmacy_order_dispatched: {
        title: '🚴 Order Dispatched!',
        body: 'Your order is on the way. Track: {trackingUrl}',
        sound: 'high_priority',
    },
    pharmacy_order_delivered: {
        title: '🎉 Order Delivered!',
        body: 'Your pharmacy order has been delivered. Thank you for using Warmpawz!',
    },

    // Meal Delivery Events
    meal_order_received: {
        title: '🍽️ Meal Order Received',
        body: 'Your meal order has been received by {vendorName}.',
    },
    meal_order_preparing: {
        title: '👨‍🍳 Meal Being Prepared',
        body: 'Your fresh meal is being prepared. ETA: {eta} minutes.',
    },
    meal_order_eta_updated: {
        title: '⏱️ Meal ETA Updated',
        body: 'Your meal preparation ETA is now {preparationEtaMinutes} minutes.',
    },
    meal_order_pickup: {
        title: '🚴 Pickup In Progress',
        body: 'Delivery partner is picking up your meal from {vendorName}.',
    },
    meal_order_delivered: {
        title: '🎉 Meal Delivered!',
        body: 'Enjoy your pet\'s fresh meal! Rate your experience.',
    },

    // Rating/Review Events
    rating_request: {
        title: '⭐ Rate Your Experience',
        body: 'How was your experience with {vendorName}? Tap to rate.',
    },
    review_received: {
        title: '⭐ New Review Received',
        body: '{customerName} left a {rating}-star review for your service.',
    },

    // General Events
    payment_successful: {
        title: '💳 Payment Successful',
        body: 'Payment of ₹{amount} for {serviceName} was successful.',
    },
    payment_failed: {
        title: '❌ Payment Failed',
        body: 'Payment of ₹{amount} failed. Please try again.',
        sound: 'high_priority',
    },
    refund_processed: {
        title: '💰 Refund Processed',
        body: '₹{amount} has been refunded to your {refundMethod}.',
    },
    subscription_reminder: {
        title: '📅 Subscription Renewal',
        body: 'Your {subscriptionName} subscription renews in {daysLeft} days.',
    },
    prescription_uploaded: {
        title: '📋 Prescription Ready',
        body: '{vendorName} has uploaded a prescription for {petName}.',
    },
    report_uploaded: {
        title: '📊 Report Available',
        body: 'Diagnostic report for {petName} is now available. View in Medical Records.',
    },
    //settleemts

    settlement_created: {
        title: '💰 Settlement Created',
        body: 'Your settlement of ₹{amount} has been created. {status}',
        sound: 'default',
    },
    settlement_processed: {
        title: '✅ Settlement Processed',
        body: 'Your settlement of ₹{amount} has been processed. Funds will reach your bank in 2-3 business days.',
        sound: 'default',
    },
    payout_processed: {
        title: '💳 Payout Processed',
        body: '₹{amount} has been transferred to your bank account.',
        sound: 'default',
    },
};