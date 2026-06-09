'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { useRouter } from 'next/navigation';

const NON_JOINABLE_BOOKING_STATUSES = new Set(['completed', 'cancelled', 'no_show', 'expired']);

function isJoinableTeleTrackerSession(session: { bookingStatus?: string; status?: string }): boolean {
  const bookingStatus = String(session.bookingStatus || '').toLowerCase();
  if (NON_JOINABLE_BOOKING_STATUSES.has(bookingStatus)) return false;
  return true;
}

export interface ActiveVideoCallSession {
  sessionId: string;
  bookingId: string;
  meetingId: string;
  customerId: string;
  vendorId: string;
  customerPhone?: string;
  status: 'active' | 'waiting';
  startedAt: string;
  vendorName: string;
  vendorPhone?: string;
  serviceName: string;
  petName?: string;
  customerName?: string;
  bookingDate: string;
  bookingTime: string;
  bookingStatus: string;
  hasExistingAttendee: boolean;
  meetingExists: boolean;
}

interface UseActiveVideoCallResult {
  activeSessions: ActiveVideoCallSession[];
  hasActiveCall: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  joinCall: (session: ActiveVideoCallSession) => Promise<void>;
}

export function useActiveVideoCall(
  customerId: string | null,
  options: { enabled?: boolean; pollingIntervalMs?: number } = {}
): UseActiveVideoCallResult {
  const { enabled = true, pollingIntervalMs = 10000 } = options;
  const router = useRouter();
  
  const [activeSessions, setActiveSessions] = useState<ActiveVideoCallSession[]>([]);
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchActiveCalls = useCallback(async () => {
    if (!customerId || !enabled) return;

    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/video' || pathname.startsWith('/video/')) {
        setActiveSessions([]);
        setHasActiveCall(false);
        return;
      }
    }

    try {
      const response = await apiClient.get<any>(
        `/video-call/customer/${customerId}/active`
      );

      if (response.success) {
        const sessions = ((response.sessions || []) as ActiveVideoCallSession[]).filter(
          isJoinableTeleTrackerSession
        );
        setActiveSessions(sessions);
        setHasActiveCall(sessions.length > 0);
        setError(null);
      }
    } catch (err: any) {
      if (err?.status !== 404) {
        console.error('Error fetching active video calls:', err);
        setError(err.message || 'Failed to fetch video call data');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customerId, enabled]);

  /**
   * Navigates to the video call page and joins the call.
   * 
   * Stores customerId in localStorage and passes it as a query parameter.
   * This ensures the video page has the customerId even if localStorage
   * is cleared on deployed environments after refresh.
   * 
   * @param session - The active video call session to join
   */
  const joinCall = useCallback(async (session: ActiveVideoCallSession) => {
    try {
      // Store customer ID/phone in localStorage for video page
      if (session.customerId) {
        localStorage.setItem('customerId', session.customerId);
      }
      if (session.customerPhone) {
        localStorage.setItem('customerPhone', session.customerPhone);
        localStorage.setItem('phone', session.customerPhone);
      }

      const videoUrl = `/video/${session.bookingId}`;
      router.push(videoUrl);
    } catch (err: any) {
      console.error('Error joining call:', err);
      throw err;
    }
  }, [router]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchActiveCalls();
  }, [fetchActiveCalls]);

  useEffect(() => {
    if (!enabled || !customerId) {
      setIsLoading(false);
      return;
    }

    fetchActiveCalls();
    pollIntervalRef.current = setInterval(fetchActiveCalls, pollingIntervalMs);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [customerId, enabled, pollingIntervalMs, fetchActiveCalls]);

  return {
    activeSessions,
    hasActiveCall,
    isLoading,
    error,
    refresh,
    joinCall,
  };
}