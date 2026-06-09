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
    vendorJoined?: boolean;
    customerJoined?: boolean;
}

interface UseActiveVideoCallForVendorResult {
    activeSessions: ActiveVideoCallSession[];
    hasActiveCall: boolean;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    joinCall: (session: ActiveVideoCallSession) => Promise<void>;
}

export function useActiveVideoCallForVendor(
    vendorId: string | null,
    options: { enabled?: boolean; pollingIntervalMs?: number } = {}
): UseActiveVideoCallForVendorResult {
    const { enabled = true, pollingIntervalMs = 10000 } = options;
    const router = useRouter();

    const [activeSessions, setActiveSessions] = useState<ActiveVideoCallSession[]>([]);
    const [hasActiveCall, setHasActiveCall] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchActiveCalls = useCallback(async () => {
        if (!vendorId || !enabled) return;

        
        if (typeof window !== 'undefined') {
            const pathname = window.location.pathname;
            // Match both /video (with query params) and /video/[bookingId] patterns
            const isVideoRoute = pathname === '/video' || pathname.startsWith('/video/');
            
            if (isVideoRoute) {
                setActiveSessions([]);
                setHasActiveCall(false);
                return;
            }
        }

        try {
            const response = await apiClient.get<any>(
                `/video-call/vendor/${vendorId}/active`
            );

            if (response.success) {
                const sessions = ((response.sessions || []) as ActiveVideoCallSession[]).filter(
                    isJoinableTeleTrackerSession
                );

                // Filter out sessions where vendor is already in the call
                // Only filter if session is 'active' (not 'waiting') to handle stale data after refresh
                const filteredSessions = sessions.filter((session) => {
                    // Don't show tracker if vendor is already in the call AND session is active
                    // If status is 'waiting', show tracker even if vendorJoined is true (might be stale)
                    if (session.vendorJoined && session.status === 'active') {
                        return false;
                    }
                    return true;
                });

                setActiveSessions(filteredSessions);
                setHasActiveCall(filteredSessions.length > 0);
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
    }, [vendorId, enabled]);

    const joinCall = useCallback(async (session: ActiveVideoCallSession) => {
        try {
            // ✅ Immediately clear sessions to hide tracker when joining
                setActiveSessions([]);
                setHasActiveCall(false);
            
            if (session.vendorId) {
                localStorage.setItem('vendorId', session.vendorId);
            }

            // Navigate to video page - it will auto-join
            router.push(`/video/${session.bookingId}`);
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
        if (!enabled || !vendorId) {
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
    }, [vendorId, enabled, pollingIntervalMs, fetchActiveCalls]);

    return {
        activeSessions,
        hasActiveCall,
        isLoading,
        error,
        refresh,
        joinCall,
    };
}