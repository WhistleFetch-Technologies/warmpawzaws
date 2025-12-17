/**
 * useLogout Hook
 * Provides logout functionality with complete state cleanup
 */

import { useCallback } from 'react';
import { performLogout, getStoredSession, getStoredTokens, clearSession } from '../utils/session-manager';
import { supabase } from '../utils/supabase/client';

export function useLogout() {
  const logout = useCallback(async (options?: {
    redirectTo?: string;
    showMessage?: boolean;
    onComplete?: () => void;
  }) => {
    try {
      // Get current session data
      const session = getStoredSession();
      const tokens = getStoredTokens();
      
      // Perform logout
      await performLogout(
        session?.sessionId,
        session?.userId,
        tokens || undefined
      );
      
      // Clear any additional state
      clearSession();
      
      // Call onComplete callback if provided
      if (options?.onComplete) {
        options.onComplete();
      } else {
        // Default: Reload page to clear all React state
        const redirectPath = options?.redirectTo || '/';
        window.location.href = redirectPath;
      }
      
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local state
      clearSession();
      
      // Call onComplete or reload
      if (options?.onComplete) {
        options.onComplete();
      } else {
        window.location.href = options?.redirectTo || '/';
      }
    }
  }, []);

  return { logout };
}

