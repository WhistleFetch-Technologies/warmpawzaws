'use client';

/**
 * ============================================================================
 * USE ACTIVE GPS TRACKING HOOK
 * ============================================================================
 * 
 * Custom hook for polling active GPS tracking sessions for a customer
 * Used to show "Vendor on the way" popup on home screen
 * 
 * Features:
 * - Polls backend for active tracking sessions
 * - Returns session data including ETA, vendor info
 * - Configurable polling interval
 * - Automatic cleanup on unmount
 * - SSE support for real-time updates (with fallback to polling)
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// FIX: Use refs for callbacks to prevent infinite re-render loops
// When callbacks are passed inline from parent, they create new references
// on every render. Using refs ensures stable function identity for useEffect.
// ============================================================================

export interface ActiveTrackingSession {
  sessionId: string;
  bookingId: string;
  vendorId: string;
  staffId?: string;
  status: 'in_transit' | 'en_route' | 'arriving' | 'arrived' | 'on_way';
  vendorName: string;
  vendorPhone?: string;
  vendorPhoto?: string;
  serviceName: string;
  petName?: string;
  eta: number | null;
  distance: number | null;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  destinationLocation: {
    latitude: number;
    longitude: number;
  };
  startedAt: string;
  arrivedAt?: string;
  lastUpdateAt: string;
}

interface UseActiveGpsTrackingOptions {
  pollingIntervalMs?: number;
  enabled?: boolean;
  onSessionStart?: (session: ActiveTrackingSession) => void;
  onSessionUpdate?: (session: ActiveTrackingSession) => void;
  onVendorArrived?: (session: ActiveTrackingSession) => void;
}

interface UseActiveGpsTrackingResult {
  activeSessions: ActiveTrackingSession[];
  hasActiveTracking: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dismissSession: (sessionId: string) => void;
}

export function useActiveGpsTracking(
  customerPhone: string,
  options: UseActiveGpsTrackingOptions = {}
): UseActiveGpsTrackingResult {
  const {
    pollingIntervalMs = 15000, // 15 seconds default
    enabled = true,
    onSessionStart,
    onSessionUpdate,
    onVendorArrived,
  } = options;

  const [activeSessions, setActiveSessions] = useState<ActiveTrackingSession[]>([]);
  const [hasActiveTracking, setHasActiveTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track dismissed sessions to not show them again
  const dismissedSessionsRef = useRef<Set<string>>(new Set());
  // Track previous sessions to detect changes
  const previousSessionsRef = useRef<Map<string, ActiveTrackingSession>>(new Map());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ FIX: Store callbacks in refs to prevent infinite re-render loops
  // This ensures the useCallback doesn't depend on callback identity
  const onSessionStartRef = useRef(onSessionStart);
  const onSessionUpdateRef = useRef(onSessionUpdate);
  const onVendorArrivedRef = useRef(onVendorArrived);
  
  // Keep refs updated with latest callback values
  useEffect(() => {
    onSessionStartRef.current = onSessionStart;
    onSessionUpdateRef.current = onSessionUpdate;
    onVendorArrivedRef.current = onVendorArrived;
  }, [onSessionStart, onSessionUpdate, onVendorArrived]);

  const fetchActiveSessions = useCallback(async () => {
    if (!customerPhone || !enabled) return;

    try {
      const response = await apiClient.get<any>(
        `/tracking/customer/phone/${encodeURIComponent(customerPhone)}/active`
      );

      if (response.success) {
        const sessions = (response.sessions || []) as ActiveTrackingSession[];
        
        // Filter out dismissed sessions
        const filteredSessions = sessions.filter(
          (s) => !dismissedSessionsRef.current.has(s.sessionId)
        );

        // Detect new sessions and status changes
        filteredSessions.forEach((session) => {
          const prevSession = previousSessionsRef.current.get(session.sessionId);
          
          if (!prevSession) {
            // New session detected - use ref to call latest callback
            onSessionStartRef.current?.(session);
          } else {
            // Check for status change
            if (prevSession.status !== session.status) {
              onSessionUpdateRef.current?.(session);
              
              // Special handling for arrival
              if (session.status === 'arrived' && prevSession.status !== 'arrived') {
                onVendorArrivedRef.current?.(session);
              }
            }
            // Check for significant ETA change (more than 2 minutes difference)
            else if (
              prevSession.eta !== null && 
              session.eta !== null && 
              Math.abs(prevSession.eta - session.eta) > 2
            ) {
              onSessionUpdateRef.current?.(session);
            }
          }
        });

        // Update previous sessions map
        const newMap = new Map<string, ActiveTrackingSession>();
        filteredSessions.forEach((s) => newMap.set(s.sessionId, s));
        previousSessionsRef.current = newMap;

        setActiveSessions(filteredSessions);
        setHasActiveTracking(filteredSessions.length > 0);
        setError(null);
      }
    } catch (err: any) {
      // Don't show error for 404 or empty responses
      if (err?.status !== 404) {
        console.error('Error fetching active GPS sessions:', err);
        setError(err.message || 'Failed to fetch tracking data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customerPhone, enabled]); // ✅ FIX: Removed callback deps - now using refs

  const dismissSession = useCallback((sessionId: string) => {
    dismissedSessionsRef.current.add(sessionId);
    setActiveSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    if (activeSessions.length <= 1) {
      setHasActiveTracking(false);
    }
  }, [activeSessions.length]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchActiveSessions();
  }, [fetchActiveSessions]);

  // Start polling
  useEffect(() => {
    if (!enabled || !customerPhone) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchActiveSessions();

    // Set up polling interval
    pollIntervalRef.current = setInterval(fetchActiveSessions, pollingIntervalMs);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [customerPhone, enabled, pollingIntervalMs, fetchActiveSessions]);

  // Reset dismissed sessions when customer changes
  useEffect(() => {
    dismissedSessionsRef.current.clear();
    previousSessionsRef.current.clear();
  }, [customerPhone]);

  return {
    activeSessions,
    hasActiveTracking,
    isLoading,
    error,
    refresh,
    dismissSession,
  };
}

export default useActiveGpsTracking;
