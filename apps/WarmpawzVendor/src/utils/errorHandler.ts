/**
 * Error Handler Utility
 * Centralized error handling and user-friendly error messages
 */

import { Alert } from 'react-native';

export interface ErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  originalError?: any;
}

/**
 * Parse error and return user-friendly message
 */
export function parseError(error: any): ErrorDetails {
  // Network errors
  if (error?.message?.includes('Network request failed') || 
      error?.message?.includes('Failed to fetch')) {
    return {
      message: 'Network error. Please check your connection and try again.',
      code: 'NETWORK_ERROR',
      originalError: error,
    };
  }

  // Timeout errors
  if (error?.message?.includes('timeout') || error?.name === 'TimeoutError') {
    return {
      message: 'Request timed out. Please try again.',
      code: 'TIMEOUT_ERROR',
      originalError: error,
    };
  }

  // API errors with status codes
  if (error?.statusCode) {
    switch (error.statusCode) {
      case 401:
        return {
          message: 'Your session has expired. Please log in again.',
          code: 'UNAUTHORIZED',
          statusCode: 401,
          originalError: error,
        };
      case 403:
        return {
          message: 'You do not have permission to perform this action.',
          code: 'FORBIDDEN',
          statusCode: 403,
          originalError: error,
        };
      case 404:
        return {
          message: 'The requested resource was not found.',
          code: 'NOT_FOUND',
          statusCode: 404,
          originalError: error,
        };
      case 500:
        return {
          message: 'Server error. Please try again later.',
          code: 'SERVER_ERROR',
          statusCode: 500,
          originalError: error,
        };
      default:
        return {
          message: error?.message || 'An error occurred. Please try again.',
          code: 'API_ERROR',
          statusCode: error.statusCode,
          originalError: error,
        };
    }
  }

  // Error objects with message
  if (error?.message) {
    return {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      originalError: error,
    };
  }

  // String errors
  if (typeof error === 'string') {
    return {
      message: error,
      code: 'STRING_ERROR',
      originalError: error,
    };
  }

  // Unknown errors
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN_ERROR',
    originalError: error,
  };
}

/**
 * Show error alert to user
 */
export function showErrorAlert(error: any, title: string = 'Error') {
  const errorDetails = parseError(error);
  Alert.alert(title, errorDetails.message);
  
  // Log error for debugging (in production, send to error tracking service)
  if (__DEV__) {
    console.error('Error:', errorDetails);
  }
  
  return errorDetails;
}

/**
 * Handle API error with retry logic
 */
export async function handleApiError<T>(
  apiCall: () => Promise<T>,
  retries: number = 0,
  maxRetries: number = 1
): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    const errorDetails = parseError(error);
    
    // Retry on network errors
    if (errorDetails.code === 'NETWORK_ERROR' && retries < maxRetries) {
      console.log(`Retrying API call (${retries + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
      return handleApiError(apiCall, retries + 1, maxRetries);
    }
    
    throw errorDetails;
  }
}

