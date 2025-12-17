/**
 * Notification Helper Functions
 * Shared notification utilities for triggering notifications across the system
 */

import { createNotificationHelper, Notification, NotificationType } from './notification-system.tsx';

/**
 * Get notification template based on type
 */
function getNotificationTemplate(type: NotificationType, data: any): { title: string; message: string; priority: 'low' | 'medium' | 'high' | 'urgent' } {
  switch (type) {
    case 'vendor_application_approved':
      return {
        title: '✅ Application Approved - Welcome to Warmpawz!',
        message: `Congratulations ${data.vendorName}! Your application for ${data.roleName} has been approved. You can now start offering services on Warmpawz.`,
        priority: 'high'
      };

    case 'vendor_application_rejected':
      return {
        title: '❌ Application Status Update',
        message: `Dear ${data.vendorName}, your application for ${data.roleName} has been reviewed. Reason: ${data.rejectionReason}. You may reapply after addressing the concerns.`,
        priority: 'high'
      };

    case 'vendor_clarification_requested':
      return {
        title: '📋 Clarification Required for Your Application',
        message: `Dear ${data.vendorName}, we need additional information for your ${data.roleName} application. Clarification needed: ${data.clarificationReason}. Please respond at your earliest convenience.`,
        priority: 'high'
      };

    case 'custom_service_approved':
      return {
        title: '🎉 Custom Service Approved!',
        message: `Great news! Your custom service "${data.serviceName}" has been approved and is now live on Warmpawz. Customers can now book this service.`,
        priority: 'high'
      };

    case 'custom_service_rejected':
      return {
        title: '❌ Custom Service Review Update',
        message: `Your custom service "${data.serviceName}" needs revision. Reason: ${data.rejectionReason}. Please update and resubmit.`,
        priority: 'high'
      };

    default:
      return {
        title: 'Notification',
        message: data.message || 'You have a new notification',
        priority: 'low'
      };
  }
}

/**
 * Notify vendor about application status
 */
export async function notifyVendorApplicationStatus(
  kv: any,
  vendorId: string,
  vendorData: any,
  status: 'approved' | 'rejected' | 'clarification_requested',
  additionalData?: any
): Promise<void> {
  try {
    const vendor = vendorData || await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      console.log(`⚠️ Vendor not found for notification: ${vendorId}`);
      return;
    }

    let notificationType: NotificationType;
    const data: any = {
      vendorName: vendor.fullName || vendor.businessName,
      roleName: vendor.roleName
    };

    if (status === 'approved') {
      notificationType = 'vendor_application_approved';
    } else if (status === 'rejected') {
      notificationType = 'vendor_application_rejected';
      data.rejectionReason = additionalData?.rejectionReason || additionalData?.reason || 'Please contact support';
    } else {
      notificationType = 'vendor_clarification_requested';
      data.clarificationReason = additionalData?.clarificationReason || additionalData?.message || 'Additional information needed';
    }

    const template = getNotificationTemplate(notificationType, data);

    await createNotificationHelper(kv, {
      recipientId: vendorId,
      recipientType: 'vendor',
      recipientEmail: vendor.email,
      recipientPhone: vendor.phone,
      type: notificationType,
      category: 'vendor_onboarding',
      title: template.title,
      message: template.message,
      data,
      channels: {
        email: true,
        sms: true,
        inApp: true,
        push: false
      },
      priority: template.priority
    });

    console.log(`✅ Notification sent: ${notificationType} to vendor ${vendorId}`);
  } catch (error) {
    console.error(`❌ Error sending vendor application status notification:`, error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

/**
 * Notify vendor about custom service status
 */
export async function notifyCustomServiceStatus(
  kv: any,
  vendorId: string,
  serviceId: string,
  service: any,
  status: 'approved' | 'rejected'
): Promise<void> {
  try {
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (!vendor) {
      console.log(`⚠️ Vendor not found for notification: ${vendorId}`);
      return;
    }

    const notificationType: NotificationType = status === 'approved' 
      ? 'custom_service_approved' 
      : 'custom_service_rejected';

    const data = {
      serviceName: service.serviceName || service.name,
      categoryName: service.categoryName || service.category || 'General',
      rejectionReason: service.rejectionReason || service.adminNote || 'Please contact support'
    };

    const template = getNotificationTemplate(notificationType, data);

    await createNotificationHelper(kv, {
      recipientId: vendorId,
      recipientType: 'vendor',
      recipientEmail: vendor.email,
      recipientPhone: vendor.phone,
      type: notificationType,
      category: 'custom_services',
      title: template.title,
      message: template.message,
      data: {
        ...data,
        serviceId: serviceId
      },
      channels: {
        email: true,
        sms: true,
        inApp: true,
        push: false
      },
      priority: template.priority
    });

    console.log(`✅ Notification sent: ${notificationType} to vendor ${vendorId} for service ${serviceId}`);
  } catch (error) {
    console.error(`❌ Error sending custom service status notification:`, error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

