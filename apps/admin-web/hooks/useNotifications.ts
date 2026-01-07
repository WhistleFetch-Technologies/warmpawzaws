/**
 * Reusable hook for managing success and error notifications
 * Provides consistent notification handling across the app
 */

import { useState, useCallback, useEffect } from 'react';

interface UseNotificationsReturn {
  success: string | null;
  error: string | null;
  setSuccess: (message: string | null) => void;
  setError: (message: string | null) => void;
  clearSuccess: () => void;
  clearError: () => void;
  clearAll: () => void;
}

interface UseNotificationsOptions {
  autoClearSuccess?: boolean;
  autoClearError?: boolean;
  clearDelay?: number; // milliseconds
}

export function useNotifications({
  autoClearSuccess = true,
  autoClearError = false,
  clearDelay = 3000,
}: UseNotificationsOptions = {}): UseNotificationsReturn {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearAll = useCallback(() => {
    setSuccess(null);
    setError(null);
  }, []);

  // Auto-clear success messages
  useEffect(() => {
    if (success && autoClearSuccess) {
      const timer = setTimeout(() => {
        clearSuccess();
      }, clearDelay);
      return () => clearTimeout(timer);
    }
  }, [success, autoClearSuccess, clearDelay, clearSuccess]);

  // Auto-clear error messages
  useEffect(() => {
    if (error && autoClearError) {
      const timer = setTimeout(() => {
        clearError();
      }, clearDelay);
      return () => clearTimeout(timer);
    }
  }, [error, autoClearError, clearDelay, clearError]);

  return {
    success,
    error,
    setSuccess,
    setError,
    clearSuccess,
    clearError,
    clearAll,
  };
}

