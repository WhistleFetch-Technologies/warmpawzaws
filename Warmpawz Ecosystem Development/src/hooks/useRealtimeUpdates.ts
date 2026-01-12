import { useEffect, useRef, useState, useCallback } from 'react';
import { projectId } from '../utils/supabase/info';

export interface RealtimeUpdate {
  type: 'slot_update' | 'availability_change' | 'connected' | 'subscribed' | 'error' | 'order_update';
  topic?: string;
  staffId?: string;
  [key: string]: any;
}

interface UseRealtimeUpdatesOptions {
  topic?: string; // e.g., 'staff:123', 'order:456', 'customer:789'
  onUpdate?: (update: RealtimeUpdate) => void;
  autoConnect?: boolean;
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const { topic, onUpdate, autoConnect = true } = options;
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<RealtimeUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (isConnecting) {
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

        // Subscribe if topic is provided
        if (topic) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            topic
          }));
          console.log(`📢 [WS] Subscribed to: ${topic}`);
        }
      };

      ws.onmessage = (event) => {
        try {
          const update: RealtimeUpdate = JSON.parse(event.data);
          // console.log('📨 [WS] Received update:', update);
          
          setLastUpdate(update);

          if (onUpdate) {
            onUpdate(update);
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
        }
      };
    } catch (err) {
      console.error('❌ [WS] Error creating connection:', err);
      setError(String(err));
      setIsConnecting(false);
    }
  }, [topic, onUpdate, autoConnect, isConnecting]);

  const disconnect = useCallback(() => {
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

  const subscribe = useCallback((newTopic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        topic: newTopic
      }));
      console.log(`📢 [WS] Subscribed to: ${newTopic}`);
    }
  }, []);

  const unsubscribe = useCallback((topicToUnsubscribe: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        topic: topicToUnsubscribe
      }));
      console.log(`📢 [WS] Unsubscribed from: ${topicToUnsubscribe}`);
    }
  }, []);

  // Auto-connect
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  // Update subscription when topic changes
  useEffect(() => {
    if (isConnected && topic) {
      subscribe(topic);
    }
  }, [isConnected, topic, subscribe]);

  return {
    isConnected,
    isConnecting,
    error,
    lastUpdate,
    connect,
    disconnect,
    subscribe,
    unsubscribe
  };
}
