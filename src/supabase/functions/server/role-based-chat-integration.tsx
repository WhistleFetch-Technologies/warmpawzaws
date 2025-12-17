/**
 * ROLE-BASED CHAT INTEGRATION
 * Production-Grade Implementation
 * 
 * Features:
 * - Chat integration based on vendor role
 * - Role-specific chat features
 * - Automated responses based on role
 * - Chat availability rules
 * - Integration with booking lifecycle
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

interface RoleChatConfig {
  roleId: string;
  roleName: string;
  chatEnabled: boolean;
  autoResponseEnabled: boolean;
  chatWindowDays: number;
  allowedMessageTypes: string[];
  features: {
    prescriptionSharing: boolean;
    fileSharing: boolean;
    videoCall: boolean;
    appointmentScheduling: boolean;
  };
}

export function roleBasedChatIntegrationEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  // Role-specific chat configurations
  const ROLE_CHAT_CONFIGS: Record<string, RoleChatConfig> = {
    'role_veterinarian': {
      roleId: 'role_veterinarian',
      roleName: 'Veterinarian',
      chatEnabled: true,
      autoResponseEnabled: true,
      chatWindowDays: 7,
      allowedMessageTypes: ['text', 'image', 'prescription', 'medical_record'],
      features: {
        prescriptionSharing: true,
        fileSharing: true,
        videoCall: true,
        appointmentScheduling: true
      }
    },
    'role_groomer': {
      roleId: 'role_groomer',
      roleName: 'Groomer',
      chatEnabled: true,
      autoResponseEnabled: false,
      chatWindowDays: 3,
      allowedMessageTypes: ['text', 'image'],
      features: {
        prescriptionSharing: false,
        fileSharing: true,
        videoCall: false,
        appointmentScheduling: true
      }
    },
    'role_trainer': {
      roleId: 'role_trainer',
      roleName: 'Trainer',
      chatEnabled: true,
      autoResponseEnabled: false,
      chatWindowDays: 14,
      allowedMessageTypes: ['text', 'image', 'video'],
      features: {
        prescriptionSharing: false,
        fileSharing: true,
        videoCall: true,
        appointmentScheduling: true
      }
    },
    'role_nutritionist': {
      roleId: 'role_nutritionist',
      roleName: 'Nutritionist',
      chatEnabled: true,
      autoResponseEnabled: true,
      chatWindowDays: 7,
      allowedMessageTypes: ['text', 'image', 'meal_plan'],
      features: {
        prescriptionSharing: false,
        fileSharing: true,
        videoCall: true,
        appointmentScheduling: true
      }
    },
    'role_insurance_provider': {
      roleId: 'role_insurance_provider',
      roleName: 'Insurance Provider',
      chatEnabled: true,
      autoResponseEnabled: true,
      chatWindowDays: 30,
      allowedMessageTypes: ['text', 'document', 'claim_form'],
      features: {
        prescriptionSharing: false,
        fileSharing: true,
        videoCall: false,
        appointmentScheduling: false
      }
    }
  };

  /**
   * GET /chat/role-config/:roleId
   * Get chat configuration for a role
   */
  app.get(`${BASE}/chat/role-config/:roleId`, async (c) => {
    try {
      const { roleId } = c.req.param();
      const config = ROLE_CHAT_CONFIGS[roleId] || ROLE_CHAT_CONFIGS['role_veterinarian'];

      return c.json({
        success: true,
        config
      });

    } catch (error) {
      console.error('❌ [ROLE-CHAT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * POST /chat/booking/:bookingId/send-role-aware
   * Send message with role-aware features
   */
  app.post(`${BASE}/chat/booking/:bookingId/send-role-aware`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const {
        senderPhone,
        senderName,
        senderType,
        message,
        messageType,
        attachments
      } = await c.req.json();

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Get vendor role
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      const roleId = vendor?.roleId || 'role_veterinarian';
      const roleConfig = ROLE_CHAT_CONFIGS[roleId] || ROLE_CHAT_CONFIGS['role_veterinarian'];

      // Check if chat is enabled for this role
      if (!roleConfig.chatEnabled) {
        return c.json({ error: 'Chat not available for this vendor type' }, 403);
      }

      // Check message type is allowed
      if (!roleConfig.allowedMessageTypes.includes(messageType)) {
        return c.json({ 
          error: `Message type '${messageType}' not allowed for ${roleConfig.roleName}` 
        }, 400);
      }

      // Check chat window
      if (booking.status === 'completed' && booking.otpVerifiedAt) {
        const completedAt = new Date(booking.otpVerifiedAt);
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > roleConfig.chatWindowDays) {
          return c.json({ 
            error: `Chat window has expired (${roleConfig.chatWindowDays} days after completion)` 
          }, 403);
        }
      }

      // Create message
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const chatMessage = {
        id: messageId,
        bookingId,
        senderPhone,
        senderName,
        senderType,
        receiverPhone: senderType === 'customer' ? booking.vendorPhone : booking.customerPhone,
        receiverName: senderType === 'customer' ? booking.vendorName : booking.customerName,
        receiverType: senderType === 'customer' ? 'vendor' : 'customer',
        message,
        messageType,
        attachments: attachments || [],
        roleId,
        roleFeatures: roleConfig.features,
        createdAt: new Date().toISOString()
      };

      // Save message
      const chatKey = `chat:booking:${bookingId}`;
      const messages = await kv.get(chatKey) || [];
      messages.push(chatMessage);
      await kv.set(chatKey, messages);

      // Auto-response if enabled
      if (roleConfig.autoResponseEnabled && senderType === 'customer') {
        await sendAutoResponse(booking, roleConfig, chatMessage);
      }

      // Notify receiver
      await notifyReceiver(chatMessage);

      return c.json({
        success: true,
        message: chatMessage,
        roleConfig
      });

    } catch (error) {
      console.error('❌ [ROLE-CHAT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /chat/booking/:bookingId/role-features
   * Get available chat features for booking based on role
   */
  app.get(`${BASE}/chat/booking/:bookingId/role-features`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const booking = await kv.get(`booking:${bookingId}`);

      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      const roleId = vendor?.roleId || 'role_veterinarian';
      const roleConfig = ROLE_CHAT_CONFIGS[roleId] || ROLE_CHAT_CONFIGS['role_veterinarian'];

      return c.json({
        success: true,
        features: roleConfig.features,
        allowedMessageTypes: roleConfig.allowedMessageTypes,
        chatWindowDays: roleConfig.chatWindowDays,
        roleName: roleConfig.roleName
      });

    } catch (error) {
      console.error('❌ [ROLE-CHAT] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Send auto-response based on role
   */
  async function sendAutoResponse(booking: any, roleConfig: RoleChatConfig, customerMessage: any) {
    try {
      // Generate role-specific auto-response
      let autoResponse = '';
      
      if (roleConfig.roleId === 'role_veterinarian') {
        autoResponse = `Thank you for your message. Our veterinary team will respond shortly. For emergencies, please call our emergency line.`;
      } else if (roleConfig.roleId === 'role_nutritionist') {
        autoResponse = `Thank you for reaching out. Our nutritionist will review your message and respond soon.`;
      } else if (roleConfig.roleId === 'role_insurance_provider') {
        autoResponse = `We've received your message. Our insurance team will get back to you within 24 hours.`;
      }

      if (autoResponse) {
        const responseMessage = {
          id: `msg_${Date.now()}_auto`,
          bookingId: booking.id,
          senderPhone: booking.vendorPhone,
          senderName: booking.vendorName,
          senderType: 'vendor',
          receiverPhone: booking.customerPhone,
          receiverName: booking.customerName,
          receiverType: 'customer',
          message: autoResponse,
          messageType: 'text',
          isAutoResponse: true,
          createdAt: new Date().toISOString()
        };

        const chatKey = `chat:booking:${booking.id}`;
        const messages = await kv.get(chatKey) || [];
        messages.push(responseMessage);
        await kv.set(chatKey, messages);
      }
    } catch (error) {
      console.error('❌ [ROLE-CHAT] Error sending auto-response:', error);
    }
  }

  /**
   * Notify receiver
   */
  async function notifyReceiver(message: any) {
    try {
      const notifications = await kv.get(`${message.receiverType}:${message.receiverPhone}:notifications`) || [];
      notifications.push({
        id: `notif_${Date.now()}`,
        type: 'chat_message',
        title: `New message from ${message.senderName}`,
        message: message.message.substring(0, 100),
        bookingId: message.bookingId,
        createdAt: new Date().toISOString(),
        read: false
      });
      await kv.set(`${message.receiverType}:${message.receiverPhone}:notifications`, notifications);
    } catch (error) {
      console.error('❌ [ROLE-CHAT] Error notifying receiver:', error);
    }
  }

  console.log('✅ Role-Based Chat Integration endpoints registered');
}

