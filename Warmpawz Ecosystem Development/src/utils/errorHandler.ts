import { toast } from 'sonner@2.0.3';

/**
 * 🚨 CENTRALIZED ERROR HANDLING
 * 
 * Provides consistent error handling across the application
 * Features:
 * - User-friendly error messages
 * - Error logging (can integrate Sentry)
 * - Recovery actions
 * - Context-aware error handling
 */

export interface ErrorContext {
  action: string; // What the user was trying to do
  technical?: string; // Technical error for logging
  recovery?: {
    label: string;
    action: () => void;
  };
}

export class AppError extends Error {
  constructor(
    public userMessage: string,
    public context: ErrorContext,
    public originalError?: Error
  ) {
    super(userMessage);
    this.name = 'AppError';
  }
}

export function handleError(error: unknown, context: ErrorContext): void {
  console.error(`❌ [ERROR] ${context.action}:`, error);

  // Log to error tracking service
  logToErrorTracking(error, context);

  // Determine user-friendly message
  let userMessage = 'An unexpected error occurred';

  if (error instanceof AppError) {
    userMessage = error.userMessage;
  } else if (error instanceof Error) {
    // Map common errors to user-friendly messages
    if (error.message.includes('Network') || error.message.includes('network')) {
      userMessage = 'Network error. Please check your internet connection.';
    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      userMessage = 'Request timed out. Please try again.';
    } else if (error.message.includes('401') || error.message.includes('403')) {
      userMessage = 'Session expired. Please log in again.';
    } else if (error.message.includes('500') || error.message.includes('Internal Server')) {
      userMessage = 'Server error. Our team has been notified.';
    } else if (error.message.includes('404')) {
      userMessage = 'The requested resource was not found.';
    } else if (context.technical) {
      userMessage = context.technical;
    } else {
      userMessage = error.message || 'An unexpected error occurred';
    }
  } else if (typeof error === 'string') {
    userMessage = error;
  }

  // Show error toast with recovery option
  toast.error(userMessage, {
    description: context.action,
    duration: 5000,
    action: context.recovery ? {
      label: context.recovery.label,
      onClick: context.recovery.action
    } : undefined
  });
}

function logToErrorTracking(error: unknown, context: ErrorContext): void {
  // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
  const errorLog = {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown'
  };

  console.log('[ERROR TRACKING]', errorLog);

  // Example Sentry integration (uncomment when ready):
  // if (typeof Sentry !== 'undefined') {
  //   Sentry.captureException(error, {
  //     contexts: {
  //       action: { type: 'user_action', data: context }
  //     }
  //   });
  // }
}

/**
 * Pre-configured error handlers for common scenarios
 */
export const ErrorHandlers = {
  formSubmission: (error: unknown, retryAction?: () => void) => handleError(error, {
    action: 'submitting vendor application',
    technical: error instanceof Error ? error.message : 'Failed to submit application',
    recovery: retryAction ? {
      label: 'Retry',
      action: retryAction
    } : undefined
  }),

  fileUpload: (fileName: string, error: unknown, retryAction?: () => void) => handleError(error, {
    action: `uploading ${fileName}`,
    technical: error instanceof Error ? error.message : `Failed to upload ${fileName}`,
    recovery: retryAction ? {
      label: 'Try Again',
      action: retryAction
    } : undefined
  }),

  duplicateCheck: (error: unknown) => handleError(error, {
    action: 'checking for duplicates',
    technical: 'Failed to verify uniqueness. Please try again.'
  }),

  otpRequest: (error: unknown, retryAction?: () => void) => handleError(error, {
    action: 'sending OTP',
    technical: 'Failed to send OTP. Please check your phone number.',
    recovery: retryAction ? {
      label: 'Resend OTP',
      action: retryAction
    } : undefined
  }),

  otpVerification: (error: unknown, retryAction?: () => void) => handleError(error, {
    action: 'verifying OTP',
    technical: 'Failed to verify OTP. Please check the code.',
    recovery: retryAction ? {
      label: 'Try Again',
      action: retryAction
    } : undefined
  }),

  dataFetch: (dataType: string, error: unknown, retryAction?: () => void) => handleError(error, {
    action: `loading ${dataType}`,
    technical: `Failed to load ${dataType}. Please refresh the page.`,
    recovery: retryAction ? {
      label: 'Retry',
      action: retryAction
    } : undefined
  }),

  dataUpdate: (dataType: string, error: unknown, retryAction?: () => void) => handleError(error, {
    action: `updating ${dataType}`,
    technical: `Failed to update ${dataType}. Please try again.`,
    recovery: retryAction ? {
      label: 'Retry',
      action: retryAction
    } : undefined
  }),

  dataDelete: (dataType: string, error: unknown) => handleError(error, {
    action: `deleting ${dataType}`,
    technical: `Failed to delete ${dataType}. Please try again.`
  }),

  authentication: (error: unknown) => handleError(error, {
    action: 'authenticating user',
    technical: 'Authentication failed. Please try logging in again.',
    recovery: {
      label: 'Login',
      action: () => {
        if (typeof window !== 'undefined') {
          window.location.href = '/vendor-auth';
        }
      }
    }
  }),

  payment: (error: unknown) => handleError(error, {
    action: 'processing payment',
    technical: 'Payment processing failed. No charges were made.',
    recovery: {
      label: 'Contact Support',
      action: () => {
        if (typeof window !== 'undefined') {
          window.location.href = '/support';
        }
      }
    }
  }),

  network: (error: unknown, retryAction?: () => void) => handleError(error, {
    action: 'connecting to server',
    technical: 'Network connection failed. Please check your internet.',
    recovery: retryAction ? {
      label: 'Retry',
      action: retryAction
    } : undefined
  })
};

/**
 * Success message helper
 */
export function showSuccess(message: string, description?: string): void {
  toast.success(message, {
    description,
    duration: 3000
  });
}

/**
 * Warning message helper
 */
export function showWarning(message: string, description?: string): void {
  toast.warning(message, {
    description,
    duration: 4000
  });
}

/**
 * Info message helper
 */
export function showInfo(message: string, description?: string): void {
  toast.info(message, {
    description,
    duration: 3000
  });
}
