/**
 * Vendor Error Handler Utility
 * Provides consistent error handling for vendor-related operations
 */

import { toast } from 'sonner';

export interface VendorError {
  status: number;
  message: string;
  vendorId?: string;
}

/**
 * Handle vendor-related API errors consistently
 */
export function handleVendorError(error: any, vendorId?: string): VendorError {
  const errorStatus = error?.status || error?.response?.status || 500;
  const errorMessage = error?.message || error?.error || 'An error occurred';
  
  const vendorError: VendorError = {
    status: errorStatus,
    message: errorMessage,
    vendorId
  };
  
  // Show appropriate toast based on error type
  if (errorStatus === 404) {
    toast.error(`Vendor not found${vendorId ? `: ${vendorId}` : ''}. Please check your vendor ID or complete registration.`);
  } else if (errorStatus === 403) {
    toast.error('You do not have permission to perform this action.');
  } else if (errorStatus === 401) {
    toast.error('Authentication required. Please log in again.');
  } else if (errorStatus >= 500) {
    toast.error('Server error. Please try again later.');
  } else {
    toast.error(errorMessage);
  }
  
  return vendorError;
}

/**
 * Check if error is a vendor not found error
 */
export function isVendorNotFound(error: any): boolean {
  const status = error?.status || error?.response?.status;
  const message = (error?.message || error?.error || '').toLowerCase();
  return status === 404 || message.includes('vendor not found') || message.includes('not found');
}

/**
 * Get user-friendly error message
 */
export function getVendorErrorMessage(error: any): string {
  if (isVendorNotFound(error)) {
    return 'Vendor profile not found. Please complete registration or check your vendor ID.';
  }
  
  const status = error?.status || error?.response?.status;
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 401) {
    return 'Authentication required. Please log in again.';
  }
  if (status >= 500) {
    return 'Server error. Please try again later.';
  }
  
  return error?.message || error?.error || 'An unexpected error occurred';
}

