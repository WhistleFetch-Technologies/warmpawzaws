/**
 * Error Handler Utilities - Vendor Mobile App
 * Centralized error handling
 */

import { Alert } from 'react-native';
import { APIError, NetworkError, AuthenticationError } from '../services/api';

export const handleError = (error: any, customMessage?: string) => {
  console.error('Error:', error);

  let message = customMessage || 'An error occurred. Please try again.';

  if (error instanceof NetworkError) {
    message = 'Network error. Please check your internet connection.';
  } else if (error instanceof AuthenticationError) {
    message = 'Authentication failed. Please log in again.';
  } else if (error instanceof APIError) {
    message = error.message || message;
  } else if (error instanceof Error) {
    message = error.message || message;
  }

  Alert.alert('Error', message);
};

export const extractErrorMessage = (error: any): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

