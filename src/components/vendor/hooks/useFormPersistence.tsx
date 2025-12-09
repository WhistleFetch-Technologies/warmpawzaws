import { useState, useEffect, useCallback } from 'react';

/**
 * 💾 FORM PERSISTENCE HOOK
 * 
 * Auto-saves form data to localStorage with debouncing
 * Restores data on component mount
 * Clears data on successful submission
 * 
 * Usage:
 * const { data, setData, clearSaved, hasSavedData } = useFormPersistence({
 *   key: 'my_form',
 *   debounceMs: 2000,
 *   excludeFields: ['password', 'otp']
 * });
 */

interface UseFormPersistenceOptions {
  key: string;
  debounceMs?: number;
  excludeFields?: string[];
}

export function useFormPersistence<T extends Record<string, any>>({
  key,
  debounceMs = 2000,
  excludeFields = []
}: UseFormPersistenceOptions) {
  const [data, setData] = useState<T>(() => {
    // Load from localStorage on mount
    if (typeof window === 'undefined') return {} as T;
    
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`📦 [FORM PERSISTENCE] Restored data for ${key}`);
        return parsed as T;
      }
    } catch (error) {
      console.error('❌ [FORM PERSISTENCE] Failed to load:', error);
    }
    return {} as T;
  });

  const [saveTimer, setSaveTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-save with debounce
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Object.keys(data).length === 0) return;

    if (saveTimer) clearTimeout(saveTimer);

    const timer = setTimeout(() => {
      try {
        // Filter out excluded fields
        const dataToSave = { ...data };
        excludeFields.forEach(field => {
          delete dataToSave[field];
        });

        localStorage.setItem(key, JSON.stringify(dataToSave));
        console.log(`💾 [FORM PERSISTENCE] Auto-saved for ${key}`);
      } catch (error) {
        console.error('❌ [FORM PERSISTENCE] Failed to save:', error);
      }
    }, debounceMs);

    setSaveTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [data, key, debounceMs, excludeFields]);

  // Clear saved data
  const clearSaved = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
      console.log(`🗑️ [FORM PERSISTENCE] Cleared data for ${key}`);
    } catch (error) {
      console.error('❌ [FORM PERSISTENCE] Failed to clear:', error);
    }
  }, [key]);

  // Check if has saved data
  const hasSavedData = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const saved = localStorage.getItem(key);
      return saved !== null && saved !== '{}';
    } catch {
      return false;
    }
  }, [key]);

  // Force save immediately (useful before navigation)
  const forceSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const dataToSave = { ...data };
      excludeFields.forEach(field => {
        delete dataToSave[field];
      });
      localStorage.setItem(key, JSON.stringify(dataToSave));
      console.log(`💾 [FORM PERSISTENCE] Force-saved for ${key}`);
    } catch (error) {
      console.error('❌ [FORM PERSISTENCE] Failed to force-save:', error);
    }
  }, [key, data, excludeFields]);

  return {
    data,
    setData,
    clearSaved,
    hasSavedData,
    forceSave
  };
}
