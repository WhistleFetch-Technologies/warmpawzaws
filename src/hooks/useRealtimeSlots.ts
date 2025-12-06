import { useEffect, useRef, useState, useCallback } from 'react';
import { projectId } from '../utils/supabase/info';

export interface SlotUpdate {
  type: 'slot_update' | 'availability_change' | 'connected' | 'subscribed' | 'error';
  staffId?: string;
  vendorId?: string;
  date?: string;
  time?: string;
  action?: 'booked' | 'cancelled' | 'blocked' | 'available';
  bookingId?: string;
  customerName?: string;
  serviceName?: string;
  duration?: number;
  timestamp?: string;
  message?: string;
  error?: string;
}

interface UseRealtimeSlotsOptions {
  staffId?: string;
  onUpdate?: (update: SlotUpdate) => void;
  autoConnect?: boolean;
}

export function useRealtimeSlots(options: UseRealtimeSlotsOptions = {}) {
  const { staffId, onUpdate, autoConnect = true } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<SlotUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('🔌 [WS] Already connected');
      return;
    }

    if (isConnecting) {
      console.log('🔌 [WS] Connection already in progress');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Construct WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${projectId}.supabase.co/functions/v1/make-server-3dd53475/ws/slots`;
      
      console.log('🔌 [WS] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ [WS] Connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Subscribe to staff if staffId is provided
        if (staffId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            staffId
          }));
          console.log(`📢 [WS] Subscribed to staff: ${staffId}`);
        }
      };

      ws.onmessage = (event) => {
        try {
          const update: SlotUpdate = JSON.parse(event.data);
          console.log('📨 [WS] Received update:', update);
          
          setLastUpdate(update);

          if (onUpdate) {
            onUpdate(update);
          }

          // Handle specific message types
          if (update.type === 'connected') {
            console.log('✅ [WS] Connection confirmed by server');
          } else if (update.type === 'slot_update') {
            console.log(`🔄 [WS] Slot ${update.action}: ${update.date} ${update.time}`);
          } else if (update.type === 'availability_change') {
            console.log(`🔄 [WS] Availability changed for staff ${update.staffId}`);
          }
        } catch (err) {
          console.error('❌ [WS] Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ [WS] Error:', event);
        setError('WebSocket connection error');
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('🔌 [WS] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Attempt to reconnect if not intentionally closed
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && autoConnect) {
          reconnectAttemptsRef.current++;
          console.log(`🔄 [WS] Reconnecting... (Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY * reconnectAttemptsRef.current);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Failed to connect after multiple attempts');
        }
      };
    } catch (err) {
      console.error('❌ [WS] Error creating connection:', err);
      setError(String(err));
      setIsConnecting(false);
    }
  }, [staffId, onUpdate, autoConnect, isConnecting]);

  const disconnect = useCallback(() => {
    console.log('🔌 [WS] Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const subscribe = useCallback((newStaffId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        staffId: newStaffId
      }));
      console.log(`📢 [WS] Subscribed to staff: ${newStaffId}`);
    } else {
      console.warn('⚠️ [WS] Cannot subscribe - not connected');
    }
  }, []);

  const unsubscribe = useCallback((staffIdToUnsubscribe: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        staffId: staffIdToUnsubscribe
      }));
      console.log(`📢 [WS] Unsubscribed from staff: ${staffIdToUnsubscribe}`);
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (isConnected) {
      const pingInterval = setInterval(() => {
        sendPing();
      }, 30000);

      return () => clearInterval(pingInterval);
    }
  }, [isConnected, sendPing]);

  // Update subscription when staffId changes
  useEffect(() => {
    if (isConnected && staffId) {
      subscribe(staffId);
    }
  }, [isConnected, staffId, subscribe]);

  return {
    isConnected,
    isConnecting,
    error,
    lastUpdate,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendPing
  };
}
