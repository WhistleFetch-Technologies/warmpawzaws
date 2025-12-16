/**
 * WEBSOCKET SERVER FOR REAL-TIME UPDATES
 * Broadcasts booking, availability, and order changes to all connected clients
 */

import { Hono } from 'npm:hono@4';

// Store active WebSocket connections
const connections = new Map<string, WebSocket>();
const clientSubscriptions = new Map<string, Set<string>>(); // clientId -> Set of topics (staffId, orderId, etc.) they're watching

/**
 * WebSocket upgrade handler
 * GET /make-server-3dd53475/ws/slots
 */
export function websocketEndpoints(app: Hono) {
  
  app.get('/make-server-3dd53475/ws/slots', (c) => {
    const upgradeHeader = c.req.header('Upgrade');
    
    if (upgradeHeader !== 'websocket') {
      return c.json({ error: 'Expected WebSocket upgrade' }, 400);
    }
    
    const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    console.log(`🔌 [WS] New client connecting: ${clientId}`);
    
    socket.onopen = () => {
      console.log(`✅ [WS] Client connected: ${clientId}`);
      connections.set(clientId, socket);
      clientSubscriptions.set(clientId, new Set());
      
      // Send welcome message
      socket.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
        message: 'Connected to Warmpawz real-time updates'
      }));
      
      console.log(`📊 [WS] Total connections: ${connections.size}`);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`📨 [WS] Message from ${clientId}:`, message);
        
        handleClientMessage(clientId, message, socket);
      } catch (error) {
        console.error(`❌ [WS] Error processing message from ${clientId}:`, error);
        socket.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    };
    
    socket.onerror = (error) => {
      console.error(`❌ [WS] Error for client ${clientId}:`, error);
    };
    
    socket.onclose = () => {
      console.log(`🔌 [WS] Client disconnected: ${clientId}`);
      connections.delete(clientId);
      clientSubscriptions.delete(clientId);
      console.log(`📊 [WS] Total connections: ${connections.size}`);
    };
    
    return response;
  });
  
  console.log('✅ WebSocket endpoints registered');
}

/**
 * Handle incoming messages from clients
 */
function handleClientMessage(clientId: string, message: any, socket: WebSocket) {
  const { type, staffId, topic, date, vendorId } = message;
  
  // Normalize topic: prefer 'topic', fallback to 'staffId' for backward compatibility
  const subscriptionTopic = topic || staffId;

  switch (type) {
    case 'subscribe':
      // Client wants to watch a specific topic (staff slots, order updates, etc.)
      if (subscriptionTopic) {
        const subscriptions = clientSubscriptions.get(clientId);
        if (subscriptions) {
          subscriptions.add(subscriptionTopic);
          console.log(`✅ [WS] ${clientId} subscribed to ${subscriptionTopic}`);
          
          socket.send(JSON.stringify({
            type: 'subscribed',
            topic: subscriptionTopic,
            staffId: staffId, // Echo back for backward compat
            timestamp: new Date().toISOString()
          }));
        }
      }
      break;
      
    case 'unsubscribe':
      if (subscriptionTopic) {
        const subscriptions = clientSubscriptions.get(clientId);
        if (subscriptions) {
          subscriptions.delete(subscriptionTopic);
          console.log(`✅ [WS] ${clientId} unsubscribed from ${subscriptionTopic}`);
          
          socket.send(JSON.stringify({
            type: 'unsubscribed',
            topic: subscriptionTopic,
            staffId: staffId,
            timestamp: new Date().toISOString()
          }));
        }
      }
      break;
      
    case 'ping':
      // Keepalive
      socket.send(JSON.stringify({
        type: 'pong',
        timestamp: new Date().toISOString()
      }));
      break;
      
    default:
      console.warn(`⚠️ [WS] Unknown message type: ${type}`);
      socket.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${type}`,
        timestamp: new Date().toISOString()
      }));
  }
}

/**
 * Broadcast slot update to all subscribed clients
 * Called when a booking is created, cancelled, or modified
 */
export function broadcastSlotUpdate(data: {
  staffId: string;
  vendorId?: string;
  date: string;
  time: string;
  action: 'booked' | 'cancelled' | 'blocked' | 'available';
  bookingId?: string;
  customerName?: string;
  serviceName?: string;
  duration?: number;
}) {
  console.log(`📢 [WS-BROADCAST] Slot update:`, data);
  
  let broadcastCount = 0;
  
  // Find all clients subscribed to this staff member
  for (const [clientId, subscriptions] of clientSubscriptions.entries()) {
    if (subscriptions.has(data.staffId)) {
      const socket = connections.get(clientId);
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({
            type: 'slot_update',
            ...data,
            timestamp: new Date().toISOString()
          }));
          broadcastCount++;
        } catch (error) {
          console.error(`❌ [WS-BROADCAST] Error sending to ${clientId}:`, error);
        }
      }
    }
  }
  
  console.log(`✅ [WS-BROADCAST] Sent to ${broadcastCount} clients`);
  return broadcastCount;
}

/**
 * Broadcast availability change (schedule update, holiday, etc.)
 */
export function broadcastAvailabilityChange(data: {
  staffId: string;
  vendorId?: string;
  changeType: 'schedule' | 'holiday' | 'break' | 'location';
  affectedDates?: string[];
  message?: string;
}) {
  console.log(`📢 [WS-BROADCAST] Availability change:`, data);
  
  let broadcastCount = 0;
  
  for (const [clientId, subscriptions] of clientSubscriptions.entries()) {
    if (subscriptions.has(data.staffId)) {
      const socket = connections.get(clientId);
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({
            type: 'availability_change',
            ...data,
            timestamp: new Date().toISOString()
          }));
          broadcastCount++;
        } catch (error) {
          console.error(`❌ [WS-BROADCAST] Error sending to ${clientId}:`, error);
        }
      }
    }
  }
  
  console.log(`✅ [WS-BROADCAST] Sent to ${broadcastCount} clients`);
  return broadcastCount;
}

/**
 * Broadcast order status update
 * Use topic format: "order:{orderId}" or "customer:{customerId}"
 */
export function broadcastOrderUpdate(data: {
  orderId: string;
  customerId: string;
  status: string;
  message?: string;
  updatedAt: string;
}) {
  console.log(`📢 [WS-BROADCAST] Order update:`, data);
  
  let broadcastCount = 0;
  
  // Topics to broadcast to
  const topics = [`order:${data.orderId}`, `customer:${data.customerId}`];
  
  for (const [clientId, subscriptions] of clientSubscriptions.entries()) {
    // Check if client is subscribed to any relevant topic
    const isSubscribed = topics.some(topic => subscriptions.has(topic));
    
    if (isSubscribed) {
      const socket = connections.get(clientId);
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({
            type: 'order_update',
            ...data,
            timestamp: new Date().toISOString()
          }));
          broadcastCount++;
        } catch (error) {
          console.error(`❌ [WS-BROADCAST] Error sending to ${clientId}:`, error);
        }
      }
    }
  }
  
  console.log(`✅ [WS-BROADCAST] Sent order update to ${broadcastCount} clients`);
  return broadcastCount;
}

/**
 * Get connection statistics
 */
export function getConnectionStats() {
  const stats = {
    totalConnections: connections.size,
    totalSubscriptions: 0,
    subscriptionsByTopic: new Map<string, number>()
  };
  
  for (const subscriptions of clientSubscriptions.values()) {
    stats.totalSubscriptions += subscriptions.size;
    
    for (const topic of subscriptions) {
      const count = stats.subscriptionsByTopic.get(topic) || 0;
      stats.subscriptionsByTopic.set(topic, count + 1);
    }
  }
  
  // Convert Map to object for JSON response
  const subscriptionsByTopicObj: Record<string, number> = {};
  stats.subscriptionsByTopic.forEach((value, key) => {
    subscriptionsByTopicObj[key] = value;
  });
  
  return {
    ...stats,
    subscriptionsByTopic: subscriptionsByTopicObj
  };
}

/**
 * Health check endpoint for WebSocket server
 */
export function websocketHealthCheck(app: Hono) {
  app.get('/make-server-3dd53475/ws/health', (c) => {
    const stats = getConnectionStats();
    
    return c.json({
      status: 'healthy',
      connections: stats.totalConnections,
      subscriptions: stats.totalSubscriptions,
      subscriptionsByTopic: stats.subscriptionsByTopic,
      timestamp: new Date().toISOString()
    });
  });
}
