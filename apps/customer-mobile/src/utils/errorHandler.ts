/**
 * Error Handler Utilities for Customer Mobile App
 */

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export function handleApiError(error: any): ApiError {
  if (error.response) {
    // API responded with error
    return {
      message: error.response.data?.error || error.response.data?.message || 'An error occurred',
      code: error.response.data?.code,
      status: error.response.status,
    };
  } else if (error.request) {
    // Request made but no response
    return {
      message: 'Network error. Please check your internet connection.',
      code: 'NETWORK_ERROR',
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

export function getErrorMessage(error: ApiError | Error | string): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return error.message || 'An error occurred';
}

export function isNetworkError(error: ApiError): boolean {
  return error.code === 'NETWORK_ERROR' || error.status === undefined;
}

export function isAuthError(error: ApiError): boolean {
  return error.status === 401 || error.status === 403;
}

