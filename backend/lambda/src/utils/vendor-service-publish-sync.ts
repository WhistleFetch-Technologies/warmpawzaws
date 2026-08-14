/** Publish statuses that make a vendor service customer-visible (with is_enabled = true). */
export const VENDOR_SERVICE_PUBLISHED_STATUSES = ['published', 'auto_published'] as const;

export function isVendorServicePublishedStatus(status: unknown): boolean {
  if (status == null) return false;
  const norm = String(status).trim().toLowerCase();
  return (VENDOR_SERVICE_PUBLISHED_STATUSES as readonly string[]).includes(norm);
}

/**
 * Keep publish_status and is_enabled aligned for customer discovery:
 * - Publishing enables the service (published wins over is_enabled=false in the same request).
 * - Disabling unpublishes to draft so "Off" hides from customers.
 */
export function applyVendorServicePublishEnableSync(updateData: Record<string, unknown>): void {
  const publishStatus = updateData.publish_status;
  const hasPublishUpdate = publishStatus !== undefined;

  if (hasPublishUpdate && isVendorServicePublishedStatus(publishStatus)) {
    updateData.is_enabled = true;
    return;
  }

  if (updateData.is_enabled === false) {
    updateData.publish_status = 'draft';
  }
}

/** Build vendor_services update payload from API body (PUT/POST :serviceId). */
export function buildVendorServiceUpdateData(serviceData: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};

  if (serviceData.price !== undefined || serviceData.customPrice !== undefined) {
    updateData.price = serviceData.price ?? serviceData.customPrice;
  }
  if (serviceData.customPrice !== undefined) {
    updateData.custom_price = serviceData.customPrice;
  }
  if (serviceData.duration !== undefined || serviceData.customDuration !== undefined) {
    const raw = serviceData.duration ?? serviceData.customDuration;
    const mins = raw != null && raw !== '' ? Number(raw) || 30 : 30;
    updateData.duration_minutes = Math.max(5, Math.min(1440, mins));
  }
  if (serviceData.customDuration !== undefined) {
    const raw = serviceData.customDuration;
    updateData.custom_duration = raw != null && raw !== '' ? Number(raw) || 30 : null;
  }
  if (serviceData.isEnabled !== undefined || serviceData.is_enabled !== undefined) {
    updateData.is_enabled =
      serviceData.isEnabled !== undefined ? serviceData.isEnabled : serviceData.is_enabled;
  }
  if (serviceData.publishStatus !== undefined || serviceData.publish_status !== undefined) {
    updateData.publish_status = serviceData.publishStatus ?? serviceData.publish_status;
  }
  if (serviceData.description !== undefined) {
    updateData.custom_description = serviceData.description;
  }
  if (serviceData.serviceName !== undefined || serviceData.service_name !== undefined) {
    const name = String(serviceData.serviceName ?? serviceData.service_name ?? '').trim();
    if (name) updateData.service_name = name;
  }

  applyVendorServicePublishEnableSync(updateData);
  return updateData;
}
