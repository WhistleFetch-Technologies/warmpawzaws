/**
 * Error Handler Utility - Customer Mobile App
 * Centralized error handling and user-friendly error messages
 */

export interface ErrorInfo {
  code?: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  action?: string;
}

class ErrorHandler {
  /**
   * Parse error and return user-friendly message
   */
  parseError(error: any): ErrorInfo {
    // Network errors
    if (error.message?.includes('Network request failed') || error.message?.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: error.message,
        userMessage: 'Unable to connect. Please check your internet connection.',
        retryable: true,
        action: 'retry',
      };
    }

    // API errors
    if (error.response || error.status) {
      const status = error.status || error.response?.status;
      const data = error.response?.data || error.data;

      switch (status) {
        case 400:
          return {
            code: 'BAD_REQUEST',
            message: data?.error || error.message,
            userMessage: data?.userMessage || 'Invalid request. Please try again.',
            retryable: false,
          };
        case 401:
          return {
            code: 'UNAUTHORIZED',
            message: data?.error || error.message,
            userMessage: 'Please log in to continue.',
            retryable: false,
            action: 'login',
          };
        case 403:
          return {
            code: 'FORBIDDEN',
            message: data?.error || error.message,
            userMessage: 'You don\'t have permission to perform this action.',
            retryable: false,
          };
        case 404:
          return {
            code: 'NOT_FOUND',
            message: data?.error || error.message,
            userMessage: 'The requested item was not found.',
            retryable: false,
          };
        case 429:
          return {
            code: 'RATE_LIMIT',
            message: data?.error || error.message,
            userMessage: 'Too many requests. Please wait a moment and try again.',
            retryable: true,
            action: 'retry',
          };
        case 500:
        case 502:
        case 503:
          return {
            code: 'SERVER_ERROR',
            message: data?.error || error.message,
            userMessage: 'Server error. Please try again later.',
            retryable: true,
            action: 'retry',
          };
        default:
          return {
            code: 'API_ERROR',
            message: data?.error || error.message,
            userMessage: 'Something went wrong. Please try again.',
            retryable: true,
            action: 'retry',
          };
      }
    }

    // Validation errors
    if (error.message?.includes('required') || error.message?.includes('invalid')) {
      return {
        code: 'VALIDATION_ERROR',
        message: error.message,
        userMessage: error.message,
        retryable: false,
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      userMessage: 'Something went wrong. Please try again.',
      retryable: true,
      action: 'retry',
    };
  }

  /**
   * Show error to user (can be extended to show toast/alert)
   */
  showError(error: any, onRetry?: () => void): void {
    const errorInfo = this.parseError(error);
    
    console.error(`[ERROR] ${errorInfo.code}:`, errorInfo.message);
    
    // In a real app, you would show a toast or alert here
    // For now, we'll just log it
    // TODO: Integrate with toast/alert system
  }

  /**
   * Handle error with retry logic
   */
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorInfo = this.parseError(error);

        if (!errorInfo.retryable || attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        console.log(`[RETRY] Attempt ${attempt + 1}/${maxRetries}`);
      }
    }

    throw lastError;
  }
}

export default new ErrorHandler();
