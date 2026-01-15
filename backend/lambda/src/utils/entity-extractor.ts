/**
 * ============================================================================
 * ENTITY EXTRACTOR - STANDARDIZED FIELD EXTRACTION
 * ============================================================================
 * 
 * Provides consistent extraction of entity IDs from various sources:
 * - Request body (camelCase)
 * - Path parameters (camelCase or snake_case)
 * - Query parameters (camelCase or snake_case)
 * - Database rows (snake_case)
 * 
 * USAGE:
 *   const { roleId, vendorId, serviceId } = extractEntityIds(c.req);
 *   const booking = normalizeBookingRow(dbRow);
 * 
 * ============================================================================
 */

import { Context } from 'hono';
import { 
  RoleId, VendorId, ServiceId, CustomerId, BookingId, 
  PaymentId, StaffId, PetId, CatalogId, VendorServiceId,
  isValidUUID 
} from '../types/entities';

// ============================================================================
// ENTITY ID EXTRACTION FROM REQUEST
// ============================================================================

export interface ExtractedIds {
  roleId?: RoleId;
  vendorId?: VendorId;
  serviceId?: ServiceId;
  catalogId?: CatalogId;
  vendorServiceId?: VendorServiceId;
  customerId?: CustomerId;
  bookingId?: BookingId;
  paymentId?: PaymentId;
  staffId?: StaffId;
  petId?: PetId;
  identityId?: string;
}

/**
 * Extract entity IDs from request (params, query, body)
 * Handles both camelCase and snake_case
 */
export function extractEntityIds(c: Context, body?: any): ExtractedIds {
  const params = c.req.param() || {};
  const queryParams = Object.fromEntries(new URL(c.req.url).searchParams);
  const requestBody = body || {};

  return {
    roleId: extractId(['roleId', 'role_id', 'roleid'], params, queryParams, requestBody),
    vendorId: extractId(['vendorId', 'vendor_id', 'vendorid'], params, queryParams, requestBody),
    serviceId: extractId(['serviceId', 'service_id', 'serviceid'], params, queryParams, requestBody),
    catalogId: extractId(['catalogId', 'catalog_id', 'catalogid'], params, queryParams, requestBody),
    vendorServiceId: extractId(['vendorServiceId', 'vendor_service_id'], params, queryParams, requestBody),
    customerId: extractId(['customerId', 'customer_id', 'customerid'], params, queryParams, requestBody),
    bookingId: extractId(['bookingId', 'booking_id', 'bookingid', 'id'], params, queryParams, requestBody),
    paymentId: extractId(['paymentId', 'payment_id', 'paymentid'], params, queryParams, requestBody),
    staffId: extractId(['staffId', 'staff_id', 'staffid'], params, queryParams, requestBody),
    petId: extractId(['petId', 'pet_id', 'petid'], params, queryParams, requestBody),
    identityId: extractId(['identityId', 'identity_id'], params, queryParams, requestBody),
  };
}

function extractId(
  keys: string[], 
  params: Record<string, any>, 
  query: Record<string, any>, 
  body: Record<string, any>
): string | undefined {
  for (const key of keys) {
    // Check params first (URL path)
    if (params[key] && isValidUUID(params[key])) {
      return params[key];
    }
    // Then query
    if (query[key] && isValidUUID(query[key])) {
      return query[key];
    }
    // Then body
    if (body[key] && isValidUUID(body[key])) {
      return body[key];
    }
  }
  return undefined;
}

/**
 * Extract vendorId from various sources in priority order
 * 1. Path parameter
 * 2. Query parameter
 * 3. Request body
 * 4. Authorization header (JWT token)
 */
export async function extractVendorId(c: Context, body?: any): Promise<VendorId | null> {
  const ids = extractEntityIds(c, body);
  
  if (ids.vendorId) {
    return ids.vendorId;
  }

  // Try to extract from authorization header
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // In a real implementation, decode JWT and extract vendorId
    // For now, return null
  }

  return null;
}

// ============================================================================
// DATABASE ROW NORMALIZERS
// ============================================================================

/**
 * Normalize any database row to have both camelCase and snake_case fields
 * This ensures backward compatibility while moving to standardized format
 */
export function normalizeDbRow<T extends Record<string, any>>(row: T): T & Record<string, any> {
  if (!row) return row;
  
  const normalized: Record<string, any> = { ...row };
  
  // Add camelCase versions of common snake_case fields
  if (row.role_id) normalized['roleId'] = row.role_id;
  if (row.vendor_id) normalized['vendorId'] = row.vendor_id;
  if (row.service_id) normalized['serviceId'] = row.service_id;
  if (row.customer_id) normalized['customerId'] = row.customer_id;
  if (row.booking_id) normalized['bookingId'] = row.booking_id;
  if (row.payment_id) normalized['paymentId'] = row.payment_id;
  if (row.staff_id) normalized['staffId'] = row.staff_id;
  if (row.pet_id) normalized['petId'] = row.pet_id;
  if (row.catalog_id) normalized['catalogId'] = row.catalog_id;
  if (row.vendor_service_id) normalized['vendorServiceId'] = row.vendor_service_id;
  if (row.identity_id) normalized['identityId'] = row.identity_id;
  
  // Common fields
  if (row.business_name) normalized['businessName'] = row.business_name;
  if (row.owner_name) normalized['ownerName'] = row.owner_name;
  if (row.display_name) normalized['displayName'] = row.display_name;
  if (row.service_name) normalized['serviceName'] = row.service_name;
  if (row.service_style) normalized['serviceStyle'] = row.service_style;
  if (row.service_type) normalized['serviceType'] = row.service_type;
  if (row.booking_date) normalized['bookingDate'] = row.booking_date;
  if (row.booking_time) normalized['bookingTime'] = row.booking_time;
  if (row.base_price) normalized['basePrice'] = row.base_price;
  if (row.total_amount) normalized['totalAmount'] = row.total_amount;
  if (row.tax_amount) normalized['taxAmount'] = row.tax_amount;
  if (row.payment_status) normalized['paymentStatus'] = row.payment_status;
  if (row.is_active !== undefined) normalized['isActive'] = row.is_active;
  if (row.is_enabled !== undefined) normalized['isEnabled'] = row.is_enabled;
  if (row.is_published !== undefined) normalized['isPublished'] = row.is_published;
  if (row.created_at) normalized['createdAt'] = row.created_at;
  if (row.updated_at) normalized['updatedAt'] = row.updated_at;
  
  // Also handle ID field
  if (row.id) {
    // Infer the type based on other fields present
    if (row.role_id === undefined && row.name && row.display_name) {
      normalized['roleId'] = row.id;
    } else if (row.vendor_id === undefined && (row.business_name || row.vendor_type)) {
      normalized['vendorId'] = row.id;
    } else if (row.booking_date) {
      normalized['bookingId'] = row.id;
    }
  }
  
  return normalized as T & Record<string, any>;
}

/**
 * Normalize array of database rows
 */
export function normalizeDbRows<T extends Record<string, any>>(rows: T[]): (T & Record<string, any>)[] {
  return rows.map(normalizeDbRow);
}

// ============================================================================
// API RESPONSE STANDARDIZER
// ============================================================================

/**
 * Standardize API response to always use camelCase
 */
export function standardizeApiResponse<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(standardizeApiResponse) as unknown as T;
  }
  
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Convert snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    
    // Recursively standardize nested objects
    result[camelKey] = typeof value === 'object' && value !== null 
      ? standardizeApiResponse(value)
      : value;
  }
  
  return result as T;
}

// ============================================================================
// ENTITY CHAIN VALIDATION
// ============================================================================

/**
 * Validate that entities form a valid chain
 * e.g., vendorId → roleId, serviceId → vendorId, etc.
 */
export interface EntityChain {
  roleId?: RoleId;
  vendorId?: VendorId;
  serviceId?: ServiceId;
  bookingId?: BookingId;
  paymentId?: PaymentId;
}

export async function validateEntityChain(
  chain: EntityChain,
  queryFn: typeof import('../database/rds-connection').select
): Promise<{ valid: boolean; error?: string; resolvedChain?: EntityChain }> {
  const resolvedChain: EntityChain = { ...chain };

  // If we have paymentId, get bookingId
  if (chain.paymentId && !chain.bookingId) {
    const payments = await queryFn('payments', { id: chain.paymentId });
    if (payments.length === 0) {
      return { valid: false, error: `Payment ${chain.paymentId} not found` };
    }
    resolvedChain.bookingId = payments[0].booking_id;
  }

  // If we have bookingId, get vendorId and serviceId
  if (resolvedChain.bookingId && (!chain.vendorId || !chain.serviceId)) {
    const bookings = await queryFn('bookings', { id: resolvedChain.bookingId });
    if (bookings.length === 0) {
      return { valid: false, error: `Booking ${resolvedChain.bookingId} not found` };
    }
    resolvedChain.vendorId = bookings[0].vendor_id;
    resolvedChain.serviceId = bookings[0].service_id;
  }

  // If we have vendorId, get roleId
  if (resolvedChain.vendorId && !chain.roleId) {
    const vendors = await queryFn('vendors', { id: resolvedChain.vendorId });
    if (vendors.length > 0) {
      resolvedChain.roleId = vendors[0].role_id;
    }
  }

  return { valid: true, resolvedChain };
}

// ============================================================================
// COMMON RESPONSE BUILDERS
// ============================================================================

/**
 * Build standardized vendor response
 */
export function buildVendorResponse(vendor: any, role?: any): Record<string, any> {
  return {
    vendorId: vendor.id || vendor.vendor_id || vendor.vendorId,
    roleId: vendor.role_id || vendor.roleId || role?.id,
    roleName: role?.name || role?.display_name,
    businessName: vendor.business_name || vendor.businessName,
    ownerName: vendor.owner_name || vendor.ownerName,
    phone: vendor.phone,
    email: vendor.email,
    address: vendor.address,
    status: vendor.status || vendor.onboarding_status,
    isActive: vendor.is_active !== false,
    createdAt: vendor.created_at || vendor.createdAt,
  };
}

/**
 * Build standardized booking response
 */
export function buildBookingResponse(booking: any, extras?: {
  vendor?: any;
  service?: any;
  customer?: any;
  payment?: any;
}): Record<string, any> {
  return {
    bookingId: booking.id || booking.booking_id || booking.bookingId,
    customerId: booking.customer_id || booking.customerId,
    vendorId: booking.vendor_id || booking.vendorId,
    serviceId: booking.service_id || booking.serviceId,
    staffId: booking.staff_id || booking.staffId,
    petId: booking.pet_id || booking.petId,
    bookingDate: booking.booking_date || booking.bookingDate,
    bookingTime: booking.booking_time || booking.bookingTime,
    serviceType: booking.service_type || booking.serviceType,
    status: booking.status,
    basePrice: booking.base_price || booking.basePrice,
    taxAmount: booking.tax_amount || booking.taxAmount,
    discountAmount: booking.discount_amount || booking.discountAmount,
    totalAmount: booking.total_amount || booking.totalAmount,
    paymentStatus: booking.payment_status || booking.paymentStatus,
    serviceName: extras?.service?.name || booking.service_name || booking.serviceName,
    vendorName: extras?.vendor?.business_name || extras?.vendor?.businessName,
    customerName: extras?.customer?.name,
    createdAt: booking.created_at || booking.createdAt,
    payment: extras?.payment ? {
      paymentId: extras.payment.id || extras.payment.payment_id,
      status: extras.payment.status,
      method: extras.payment.method || extras.payment.payment_method,
    } : undefined,
  };
}

/**
 * Build standardized payment response
 */
export function buildPaymentResponse(payment: any): Record<string, any> {
  return {
    paymentId: payment.id || payment.payment_id || payment.paymentId,
    bookingId: payment.booking_id || payment.bookingId,
    customerId: payment.customer_id || payment.customerId,
    vendorId: payment.vendor_id || payment.vendorId,
    amount: payment.amount,
    currency: payment.currency || 'INR',
    status: payment.status,
    method: payment.method || payment.payment_method,
    gatewayOrderId: payment.gateway_order_id || payment.razorpay_order_id,
    gatewayPaymentId: payment.gateway_payment_id || payment.razorpay_payment_id,
    createdAt: payment.created_at || payment.createdAt,
    paidAt: payment.paid_at || payment.paidAt,
  };
}
