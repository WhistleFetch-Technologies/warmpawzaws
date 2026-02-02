/**
 * ============================================================================
 * USE WEBSOCKET HOOK
 * ============================================================================
 * 
 * React hook for WebSocket connections
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { useEffect, useRef, useCallback } from 'react';
import { createWebSocketClient, getWebSocketClient, disconnectWebSocket } from '@/lib/websocket-client';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';

export function useWebSocket(userId?: string, userType: 'customer' | 'vendor' = 'customer') {
  const clientRef = useRef<ReturnType<typeof createWebSocketClient> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Get API base URL from runtime config (API Gateway); getApiBaseUrl() has correct fallback
    const apiBaseUrl = getApiBaseUrl();

    // Create or get WebSocket client
    clientRef.current = createWebSocketClient(apiBaseUrl, userId, userType);

    // Connect
    clientRef.current.connect().catch((error) => {
      console.error('[useWebSocket] Failed to connect:', error);
    });

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [userId, userType]);

  /**
   * Subscribe to order status updates
   */
  const subscribeToOrder = useCallback((orderId: string, handler: (data: any) => void) => {
    if (!clientRef.current) return () => {};

    return clientRef.current.onOrderUpdate(orderId, handler);
  }, []);

  /**
   * Subscribe to pharmacy broadcast updates
   */
  const subscribeToPharmacyBroadcast = useCallback((handler: (data: any) => void) => {
    if (!clientRef.current) return () => {};

    return clientRef.current.onPharmacyBroadcast(handler);
  }, []);

  /**
   * Subscribe to delivery updates
   */
  const subscribeToDelivery = useCallback((orderId: string, handler: (data: any) => void) => {
    if (!clientRef.current) return () => {};

    return clientRef.current.onDeliveryUpdate(orderId, handler);
  }, []);

  return {
    isConnected: clientRef.current?.isConnected() || false,
    subscribeToOrder,
    subscribeToPharmacyBroadcast,
    subscribeToDelivery,
  };
}
