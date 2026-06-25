
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
    | 'meal_order_confirmed'
    | 'meal_order_preparing'
    | 'meal_order_ready'
    | 'meal_order_eta_updated'
    | 'meal_rider_assigned'
    | 'meal_rider_reassign_pending'
    | 'meal_rider_reassigned'
    | 'meal_order_pickup'
    | 'meal_rider_on_the_way'
    | 'meal_rider_nearby'
    | 'meal_order_delivered'
    | 'meal_order_cancelled'
    | 'meal_logistics_cancelled'
    | 'meal_refund_review_initiated'
    | 'meal_refund_approved'
    | 'meal_refund_completed'
    | 'meal_subscription_paused'
    | 'meal_subscription_resumed'
    | 'meal_subscription_cancelled'
    | 'meal_subscription_delivery_due'
    // Vendor meal events
    | 'vendor_meal_order_received'
    | 'vendor_meal_order_cancelled'
    | 'vendor_meal_rider_assigned'
    | 'vendor_meal_rider_reassign_pending'
    | 'vendor_meal_rider_reassigned'
    | 'vendor_meal_rider_picked_up'
    | 'vendor_meal_order_delivered'
    | 'vendor_meal_delivery_failed'
    | 'vendor_meal_dispatch_failed'
    | 'vendor_meal_subscription_due'
    | 'vendor_meal_subscription_paused'
    | 'vendor_meal_subscription_resumed'
    | 'vendor_meal_subscription_cancelled'
    | 'vendor_meal_subscription_active'
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
    | 'vaccination_reminder_1day'
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
    meal_order_confirmed: {
        title: '✅ Order Confirmed',
        body: '{vendorName} confirmed your meal order #{orderNumber}.',
    },
    meal_order_preparing: {
        title: '👨‍🍳 Meal Being Prepared',
        body: '{vendorName} is preparing your pet\'s fresh meal.',
    },
    meal_order_ready: {
        title: '📦 Ready for Pickup',
        body: 'Your order from {vendorName} is ready — a rider will pick it up soon.',
    },
    meal_order_eta_updated: {
        title: '⏱️ Meal ETA Updated',
        body: 'Your meal preparation ETA is now {preparationEtaMinutes} minutes.',
    },
    meal_rider_assigned: {
        title: '🛵 Delivery Partner Assigned',
        body: 'A rider is on the way to pick up your order from {vendorName}.',
        sound: 'high_priority',
    },
    meal_rider_reassign_pending: {
        title: '🔄 Finding a new delivery partner',
        body: 'We are assigning a new rider for your meal order #{orderNumber} from {vendorName}.',
        sound: 'high_priority',
    },
    meal_rider_reassigned: {
        title: '🛵 New delivery partner assigned',
        body: 'A new rider ({riderName}) is heading to pick up your order from {vendorName}.',
        sound: 'high_priority',
    },
    meal_order_pickup: {
        title: '🚴 Order Picked Up',
        body: 'Your meal was picked up and is heading your way.',
        sound: 'high_priority',
    },
    meal_rider_on_the_way: {
        title: '🚗 On The Way',
        body: 'Your meal from {vendorName} is out for delivery.',
        sound: 'high_priority',
    },
    meal_rider_nearby: {
        title: '📍 Arriving Soon',
        body: 'Your meal delivery is nearby — please be ready to receive it.',
        sound: 'urgent',
    },
    meal_order_delivered: {
        title: '🎉 Meal Delivered!',
        body: 'Enjoy your pet\'s fresh meal! Rate your experience.',
    },
    meal_order_cancelled: {
        title: '❌ Meal Order Cancelled',
        body: '{vendorName} cancelled order #{orderNumber}. {reason}',
    },
    meal_logistics_cancelled: {
        title: 'Delivery cancelled',
        body: 'Your meal order #{orderNumber} from {vendorName} was cancelled. {customerMessage}',
        sound: 'high_priority',
    },
    meal_refund_review_initiated: {
        title: 'Refund under review',
        body: 'Our team is reviewing your refund request for order #{orderNumber} from {vendorName}.',
    },
    meal_refund_approved: {
        title: 'Refund approved',
        body: 'Your refund of {refundAmount} for order #{orderNumber} from {vendorName} has been approved and is being processed.',
        sound: 'high_priority',
    },
    meal_refund_completed: {
        title: 'Refund completed',
        body: 'Your refund of {refundAmount} for order #{orderNumber} from {vendorName} has been completed.',
    },
    meal_subscription_paused: {
        title: '⏸️ Subscription Paused',
        body: 'Your meal plan with {vendorName} is paused. Deliveries will resume when you unpause.',
    },
    meal_subscription_resumed: {
        title: '▶️ Subscription Resumed',
        body: 'Your meal plan with {vendorName} is active again. Upcoming deliveries are scheduled.',
    },
    meal_subscription_cancelled: {
        title: 'Subscription Cancelled',
        body: 'Your meal subscription with {vendorName} has been cancelled.',
    },
    meal_subscription_delivery_due: {
        title: '🍽️ Delivery Today',
        body: 'Your {mealPlanName} from {vendorName} is scheduled for delivery today.',
    },

    vendor_meal_order_received: {
        title: '🍽️ New Meal Order!',
        body: '{customerName} placed order #{orderNumber}. Start preparing when ready.',
        sound: 'urgent',
    },
    vendor_meal_order_cancelled: {
        title: '❌ Order Cancelled',
        body: '{customerName} cancelled meal order #{orderNumber}.',
        sound: 'high_priority',
    },
    vendor_meal_rider_assigned: {
        title: '🛵 Rider Assigned',
        body: 'A delivery partner is heading to pick up order #{orderNumber}.',
    },
    vendor_meal_rider_reassign_pending: {
        title: '🔄 Rider reassign in progress',
        body: 'Finding a new delivery partner for order #{orderNumber}.',
    },
    vendor_meal_rider_reassigned: {
        title: '🛵 New rider assigned',
        body: 'New delivery partner {riderName} is heading to pick up order #{orderNumber}.',
    },
    vendor_meal_rider_picked_up: {
        title: '📦 Order Picked Up',
        body: 'Order #{orderNumber} was picked up and is out for delivery.',
    },
    vendor_meal_order_delivered: {
        title: '✅ Order Delivered',
        body: 'Order #{orderNumber} was delivered successfully.',
    },
    vendor_meal_delivery_failed: {
        title: '⚠️ Delivery Issue',
        body: 'Delivery failed or was interrupted for order #{orderNumber}. Check the order details.',
        sound: 'high_priority',
    },
    vendor_meal_dispatch_failed: {
        title: '⚠️ Dispatch Failed',
        body: 'Could not assign a rider for order #{orderNumber}. {reason}',
        sound: 'urgent',
    },
    vendor_meal_subscription_due: {
        title: '📅 Meal Delivery Today',
        body: '{customerName} — {mealPlanName} delivery scheduled for today.',
        sound: 'high_priority',
    },
    vendor_meal_subscription_paused: {
        title: '⏸️ Subscription Paused',
        body: '{customerName} paused their meal subscription ({mealPlanName}).',
    },
    vendor_meal_subscription_resumed: {
        title: '▶️ Subscription Resumed',
        body: '{customerName} resumed their meal subscription ({mealPlanName}).',
    },
    vendor_meal_subscription_cancelled: {
        title: 'Subscription Cancelled',
        body: '{customerName} cancelled their meal subscription ({mealPlanName}).',
        sound: 'high_priority',
    },
    vendor_meal_subscription_active: {
        title: '🎉 New Meal Subscription',
        body: '{customerName} subscribed to {mealPlanName}.',
        sound: 'urgent',
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
    vaccination_reminder_1day: {
        title: '💉 Vaccination Due Tomorrow',
        body: "{petName}'s {vaccineName} is due tomorrow. Book a vet appointment on Warmpawz.",
        sound: 'high_priority',
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