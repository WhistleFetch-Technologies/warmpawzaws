'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createWebSocketClient, disconnectWebSocket } from '@/lib/websocket-client';
import { getApiBaseUrl } from '@/lib/api-client';

/** Vendor WebSocket hook — meal subscription delivery broadcast + future channels. */
export function useVendorWebSocket(vendorId?: string) {
  const clientRef = useRef<ReturnType<typeof createWebSocketClient> | null>(null);

  useEffect(() => {
    if (!vendorId) return;
    const apiBaseUrl = getApiBaseUrl();
    clientRef.current = createWebSocketClient(apiBaseUrl, vendorId, 'vendor');
    clientRef.current.connect().catch(() => {});
    return () => {
      disconnectWebSocket();
      clientRef.current = null;
    };
  }, [vendorId]);

  const subscribeToMealSubscriptionDeliveryBroadcast = useCallback((handler: (data: any) => void) => {
    if (!clientRef.current) return () => {};
    return clientRef.current.onMealSubscriptionDeliveryBroadcast(handler);
  }, []);

  return {
    isConnected: clientRef.current?.isConnected() || false,
    subscribeToMealSubscriptionDeliveryBroadcast,
  };
}
