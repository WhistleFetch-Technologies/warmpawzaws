/**
 * Error Handling Utilities for Customer Web App
 * Provides consistent error handling and user-friendly messages
 */

import { ApiError } from './error-handling';

/**
 * Check if error is a server-side error (500/503)
 */
export function isServerError(error: any): boolean {
  return error?.statusCode === 500 || error?.statusCode === 503;
}

/**
 * Check if error should be logged (suppress server errors in production)
 */
export function shouldLogError(error: any): boolean {
  if (typeof window === 'undefined') return false;
  
  // Don't log server errors in production/UAT
  if (isServerError(error)) {
    return process.env.NODE_ENV === 'development';
  }
  
  // Don't log CORS errors
  if (error?.code === 'CORS_ERROR') {
    return false;
  }
  
  return true;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: any): string {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }

  // Server errors - generic message
  if (isServerError(error)) {
    return 'Service temporarily unavailable. Our team has been notified. Please try again in a few moments.';
  }

  // CORS errors
  if (error?.code === 'CORS_ERROR') {
    return 'Connection issue. Please check your internet connection.';
  }

  // Network errors
  if (
    error?.message?.includes('Failed to fetch') ||
    error?.message?.includes('NetworkError') ||
    error?.code === 'network_error'
  ) {
    return 'Network error. Please check your internet connection and try again.';
  }

  // Timeout errors
  if (error?.code === 'timeout' || error?.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Rate limit errors
  if (error?.statusCode === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // 404 errors
  if (error?.statusCode === 404) {
    return 'The requested resource was not found.';
  }

  // 401/403 errors
  if (error?.statusCode === 401 || error?.statusCode === 403) {
    return 'Session expired. Please log in again.';
  }

  // Try to extract message from API response
  const errorData = error?.response || error?.responseData;
  if (errorData?.error?.message) {
    return errorData.error.message;
  }
  if (errorData?.error && typeof errorData.error === 'string') {
    return errorData.error;
  }
  if (errorData?.message) {
    return errorData.message;
  }

  // Fallback to error message
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

/**
 * Log error with appropriate level
 */
export function logError(context: string, error: any): void {
  if (!shouldLogError(error)) {
    return;
  }

  const message = error?.message || String(error);
  const statusCode = error?.statusCode || error?.status;
  
  if (isServerError(error)) {
    console.warn(`⚠️ [${context}] Server error ${statusCode}:`, message);
  } else if (error?.code === 'CORS_ERROR') {
    // Suppress CORS errors
    return;
  } else {
    console.error(`❌ [${context}] Error:`, error);
  }
}

/**
 * Handle API error gracefully - log if needed and return user-friendly message
 */
export function handleApiError(context: string, error: any): string {
  logError(context, error);
  return getUserFriendlyErrorMessage(error);
}
