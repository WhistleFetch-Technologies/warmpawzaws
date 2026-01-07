/**
 * ============================================================================
 * AI CHATBOT ENDPOINTS - AWS BEDROCK INTEGRATION
 * ============================================================================
 * 
 * Handles AI chatbot features:
 * - General chat with intent classification
 * - Symptoms checker
 * - Smart booking assist
 * - Customer support
 * - Agent handoff to CRM
 * 
 * Date: 2026-01-07
 * Phase 3: AI Chatbot Integration
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { invokeBedrock } from '../utils/bedrock-client';
import { withRetry } from '../utils/error-recovery';

export function registerAIChatbotEndpoints(app: Hono) {
  /**
   * POST /ai-chatbot/chat
   * Main AI chatbot endpoint with intent classification
   */
  app.post("/ai-chatbot/chat", async (c) => {
    try {
      const { message, customerId, customerPhone, conversationId, context, petId } = await c.req.json();

      if (!message) {
        return c.json({ error: 'message is required' }, 400);
      }

      // Generate or use conversation ID
      const currentConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // Fetch customer context
      let customerContext = '';
      let petContext = '';
      let bookingContext = '';

      if (customerId || customerPhone) {
        try {
          const customer = customerId
            ? await select('customers', { id: customerId })
            : await query(`SELECT * FROM customers WHERE phone = $1 LIMIT 1`, [customerPhone]);
          
          if (customer.length > 0 || (customer as any).rows?.length > 0) {
            const cust = Array.isArray(customer) ? customer[0] : (customer as any).rows[0];
            customerContext = `Customer: ${cust.first_name || ''} ${cust.last_name || ''}, Phone: ${cust.phone || customerPhone}`;
          }
        } catch (e) {
          console.warn('Failed to fetch customer context', e);
        }
      }

      // Fetch pet context
      if (petId) {
        try {
          const pets = await select('pets', { id: petId });
          if (pets.length > 0) {
            const pet = pets[0];
            petContext = `Pet: ${pet.name || 'Unknown'}, Breed: ${pet.breed || 'Unknown'}, Age: ${pet.age || 'Unknown'}`;
          }
        } catch (e) {
          console.warn('Failed to fetch pet context', e);
        }
      }

      // Fetch recent bookings context
      if (customerId || customerPhone) {
        try {
          const bookings = await query(
            `SELECT id, service_type, booking_date, status 
             FROM bookings 
             WHERE customer_id = $1 OR customer_phone = $2
             ORDER BY created_at DESC 
             LIMIT 3`,
            [customerId || null, customerPhone || null]
          );
          if (bookings.rows && bookings.rows.length > 0) {
            bookingContext = `Recent Bookings: ${bookings.rows.map((b: any) => `${b.service_type} (${b.status})`).join(', ')}`;
          }
        } catch (e) {
          console.warn('Failed to fetch booking context', e);
        }
      }

      // Fetch store context (products/services)
      let storeContext = '';
      try {
        const products = await query(
          `SELECT name, sale_price, base_price FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 5`
        );
        if (products.rows && products.rows.length > 0) {
          storeContext = `Featured Products:\n${products.rows.map((p: any) => `- ${p.name} (₹${p.sale_price || p.base_price || 0})`).join('\n')}`;
        }
      } catch (e) {
        console.warn('Failed to fetch product context', e);
      }

      // Build system prompt
      const systemPrompt = `You are the Warmpawz AI Assistant, a helpful and friendly pet care assistant.

ROLE: Help customers with pet care, shopping, bookings, and support.

CONTEXT:
${customerContext ? `- ${customerContext}\n` : ''}${petContext ? `- ${petContext}\n` : ''}${bookingContext ? `- ${bookingContext}\n` : ''}${storeContext ? `- ${storeContext}\n` : ''}

CAPABILITIES:
1. Symptoms Checker: Analyze pet symptoms and provide general guidance (ALWAYS recommend seeing a vet for serious issues)
2. Smart Booking Assist: Help customers find and book services
3. Customer Support: Answer questions about services, orders, bookings, and platform features
4. Shopping: Help with product recommendations and orders

INTENT CLASSIFICATION:
Analyze the user's message and determine the INTENT from:
- 'symptoms': Pet health symptoms or medical questions
- 'booking': Service booking requests
- 'support': General support questions
- 'shopping': Product inquiries
- 'adoption': Pet adoption questions
- 'knowledge': General pet care knowledge
- 'general': Other queries

OUTPUT FORMAT:
Respond with a VALID JSON object ONLY:
{
  "response": "Your helpful response text here...",
  "intent": "detected_intent",
  "confidence": 0.95,
  "suggestedActions": ["action1", "action2"],
  "requiresAgent": false
}

IMPORTANT RULES:
- For symptoms: Always advise seeing a vet for serious issues, never diagnose
- For booking: Guide users to the booking flow
- For support: Provide helpful information or escalate to agent if needed
- If confidence < 0.7 or user requests human agent, set requiresAgent: true`;

      let responseText = '';
      let intent = 'general';
      let confidence = 0.5;
      let suggestedActions: string[] = [];
      let requiresAgent = false;
      let usedBedrock = false;

      // Try AWS Bedrock with retry
      try {
        const completion = await withRetry(
          () => invokeBedrock(message, systemPrompt, {
            maxTokens: 1024,
            temperature: 0.5,
            topP: 0.9,
          }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );

        // Extract JSON from response
        try {
          const jsonMatch = completion.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            responseText = parsed.response || completion;
            intent = parsed.intent || 'general';
            confidence = parsed.confidence || 0.8;
            suggestedActions = parsed.suggestedActions || [];
            requiresAgent = parsed.requiresAgent || false;
          } else {
            responseText = completion;
            intent = 'general';
            confidence = 0.7;
          }
          usedBedrock = true;
        } catch (e) {
          console.warn('Failed to parse JSON from AI response', e);
          responseText = completion;
        }
      } catch (err: any) {
        console.error('Bedrock invocation failed:', err);
        // Fallback to rule-based responses
        usedBedrock = false;
      }

      // Fallback to rule-based responses if Bedrock failed
      if (!usedBedrock) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('symptom') || lowerMessage.includes('sick') || lowerMessage.includes('ill') || 
            lowerMessage.includes('vomit') || lowerMessage.includes('diarrhea') || lowerMessage.includes('fever')) {
          intent = 'symptoms';
          responseText = "I understand you're concerned about your pet's health. While I can provide general guidance, it's important to consult with a veterinarian for proper diagnosis and treatment. Would you like me to help you find a nearby vet clinic or book a consultation?";
          confidence = 0.8;
          suggestedActions = ['Find Vet Clinic', 'Book Consultation'];
        } else if (lowerMessage.includes('book') || lowerMessage.includes('appointment') || lowerMessage.includes('schedule')) {
          intent = 'booking';
          responseText = "I'd be happy to help you book a service! What type of service are you looking for? (e.g., Vet consultation, Grooming, Training, etc.)";
          confidence = 0.85;
          suggestedActions = ['Browse Services', 'Book Now'];
        } else if (lowerMessage.includes('order') || lowerMessage.includes('product') || lowerMessage.includes('buy') || lowerMessage.includes('shop')) {
          intent = 'shopping';
          responseText = "I can help you with shopping! You can browse our products in the Shop section. What are you looking for?";
          confidence = 0.8;
          suggestedActions = ['Browse Shop', 'View Cart'];
        } else {
          intent = 'support';
          responseText = "I'm here to help! How can I assist you today? I can help with bookings, pet care questions, orders, or connect you with a support agent if needed.";
          confidence = 0.6;
          suggestedActions = ['Get Help', 'Contact Support'];
        }
      }

      // Save conversation to database
      try {
        await insert('ai_chatbot_conversations', {
          conversation_id: currentConversationId,
          customer_id: customerId || null,
          customer_phone: customerPhone || null,
          user_message: message,
          bot_response: responseText,
          intent,
          confidence,
          requires_agent: requiresAgent,
          created_at: new Date().toISOString(),
        }).catch(() => {
          // Graceful fallback if table doesn't exist
        });
      } catch (e) {
        console.warn('Failed to save conversation', e);
      }

      // Check if agent handoff is needed
      if (requiresAgent || confidence < 0.7) {
        // Create support ticket for agent handoff
        try {
          await insert('support_tickets', {
            customer_id: customerId || null,
            customer_phone: customerPhone || null,
            subject: `AI Chatbot Handoff - ${intent}`,
            message: `User: ${message}\n\nAI Response: ${responseText}\n\nIntent: ${intent}, Confidence: ${confidence}`,
            source: 'ai_chatbot',
            status: 'open',
            priority: 'medium',
            created_at: new Date().toISOString(),
          }).catch(() => {
            // Graceful fallback
          });
        } catch (e) {
          console.warn('Failed to create support ticket', e);
        }
      }

      return c.json({
        success: true,
        conversationId: currentConversationId,
        response: responseText,
        intent,
        confidence,
        suggestedActions,
        requiresAgent,
        usedBedrock,
      });
    } catch (error: any) {
      console.error('Error in AI chatbot:', error);
      return c.json({ error: error.message || 'Failed to process chat message' }, 500);
    }
  });

  /**
   * POST /ai-chatbot/symptoms-checker
   * Dedicated symptoms checker endpoint
   */
  app.post("/ai-chatbot/symptoms-checker", async (c) => {
    try {
      const { symptoms, petId, petType, petAge, customerId, customerPhone } = await c.req.json();

      if (!symptoms) {
        return c.json({ error: 'symptoms are required' }, 400);
      }

      // Fetch pet context
      let petContext = '';
      if (petId) {
        try {
          const pets = await select('pets', { id: petId });
          if (pets.length > 0) {
            const pet = pets[0];
            petContext = `Pet: ${pet.name || 'Unknown'}, Type: ${pet.pet_type || petType || 'Unknown'}, Breed: ${pet.breed || 'Unknown'}, Age: ${pet.age || petAge || 'Unknown'}`;
          }
        } catch (e) {
          console.warn('Failed to fetch pet context', e);
        }
      }

      const systemPrompt = `You are a pet health assistant. Your role is to:
1. Analyze pet symptoms provided by the owner
2. Provide general guidance and possible causes
3. ALWAYS recommend consulting a veterinarian for proper diagnosis
4. NEVER provide a definitive diagnosis
5. Suggest urgency level (immediate, soon, routine)

CONTEXT:
${petContext ? `- ${petContext}\n` : ''}

OUTPUT FORMAT (JSON only):
{
  "response": "Your analysis and guidance...",
  "possibleCauses": ["cause1", "cause2"],
  "urgency": "immediate" | "soon" | "routine",
  "recommendations": ["rec1", "rec2"],
  "shouldSeeVet": true,
  "vetBookingSuggested": true
}`;

      let analysis;
      try {
        const completion = await withRetry(
          () => invokeBedrock(symptoms, systemPrompt, {
            maxTokens: 1024,
            temperature: 0.3, // Lower temperature for medical advice
            topP: 0.9,
          }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );

        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = {
            response: completion,
            possibleCauses: [],
            urgency: 'routine',
            recommendations: ['Consult with a veterinarian'],
            shouldSeeVet: true,
            vetBookingSuggested: true,
          };
        }
      } catch (err: any) {
        console.error('Bedrock invocation failed:', err);
        // Fallback response
        analysis = {
          response: "I understand you're concerned about your pet's symptoms. It's important to consult with a veterinarian for proper diagnosis and treatment. Would you like me to help you find a nearby vet clinic?",
          possibleCauses: [],
          urgency: 'routine',
          recommendations: ['Consult with a veterinarian', 'Monitor symptoms', 'Keep pet comfortable'],
          shouldSeeVet: true,
          vetBookingSuggested: true,
        };
      }

      // Save symptoms check
      try {
        await insert('symptoms_checks', {
          customer_id: customerId || null,
          customer_phone: customerPhone || null,
          pet_id: petId || null,
          symptoms,
          analysis: JSON.stringify(analysis),
          created_at: new Date().toISOString(),
        }).catch(() => {
          // Graceful fallback
        });
      } catch (e) {
        console.warn('Failed to save symptoms check', e);
      }

      return c.json({
        success: true,
        ...analysis,
      });
    } catch (error: any) {
      console.error('Error in symptoms checker:', error);
      return c.json({ error: error.message || 'Failed to analyze symptoms' }, 500);
    }
  });

  /**
   * POST /ai-chatbot/booking-assist
   * Smart booking assistance
   */
  app.post("/ai-chatbot/booking-assist", async (c) => {
    try {
      const { query: bookingQuery, customerId, customerPhone, location, petId } = await c.req.json();

      if (!bookingQuery) {
        return c.json({ error: 'query is required' }, 400);
      }

      // Fetch available services
      let servicesContext = '';
      try {
        const services = await query(
          `SELECT id, name, service_style, role_id 
           FROM services 
           WHERE is_active = true 
           ORDER BY created_at DESC 
           LIMIT 20`
        );
        if (services.rows && services.rows.length > 0) {
          servicesContext = `Available Services:\n${services.rows.map((s: any) => `- ${s.name} (${s.service_style || 'general'})`).join('\n')}`;
        }
      } catch (e) {
        console.warn('Failed to fetch services context', e);
      }

      const systemPrompt = `You are a booking assistant for Warmpawz pet services platform.

CONTEXT:
${servicesContext ? `- ${servicesContext}\n` : ''}${location ? `- Location: ${location}\n` : ''}

TASK:
1. Understand the user's booking request
2. Identify the service type they need
3. Suggest appropriate services
4. Guide them to the booking flow

OUTPUT FORMAT (JSON only):
{
  "response": "Your helpful booking guidance...",
  "suggestedServices": ["service1", "service2"],
  "serviceType": "vet" | "grooming" | "training" | "boarding" | "other",
  "nextSteps": ["step1", "step2"],
  "bookingUrl": "/book?service=..."
}`;

      let assistance;
      try {
        const completion = await withRetry(
          () => invokeBedrock(bookingQuery, systemPrompt, {
            maxTokens: 512,
            temperature: 0.6,
            topP: 0.9,
          }),
          {
            maxAttempts: 3,
            initialDelayMs: 1000,
            retryableErrors: ['Bedrock invocation failed', 'ETIMEDOUT', 'ECONNRESET'],
          }
        );

        const jsonMatch = completion.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          assistance = JSON.parse(jsonMatch[0]);
        } else {
          assistance = {
            response: completion,
            suggestedServices: [],
            serviceType: 'other',
            nextSteps: ['Browse Services', 'Select Service', 'Choose Time Slot'],
            bookingUrl: '/book',
          };
        }
      } catch (err: any) {
        console.error('Bedrock invocation failed:', err);
        assistance = {
          response: "I'd be happy to help you book a service! What type of service are you looking for?",
          suggestedServices: [],
          serviceType: 'other',
          nextSteps: ['Browse Services', 'Select Service', 'Choose Time Slot'],
          bookingUrl: '/book',
        };
      }

      return c.json({
        success: true,
        ...assistance,
      });
    } catch (error: any) {
      console.error('Error in booking assist:', error);
      return c.json({ error: error.message || 'Failed to assist with booking' }, 500);
    }
  });

  /**
   * POST /ai-chatbot/escalate-to-agent
   * Escalate conversation to human agent
   */
  app.post("/ai-chatbot/escalate-to-agent", async (c) => {
    try {
      const { conversationId, customerId, customerPhone, reason, conversationHistory } = await c.req.json();

      if (!conversationId) {
        return c.json({ error: 'conversationId is required' }, 400);
      }

      // Create support ticket
      const ticket = await insert('support_tickets', {
        customer_id: customerId || null,
        customer_phone: customerPhone || null,
        subject: `AI Chatbot Escalation - ${reason || 'User Request'}`,
        message: `Conversation ID: ${conversationId}\n\nReason: ${reason || 'User requested human agent'}\n\nConversation History:\n${conversationHistory || 'N/A'}`,
        source: 'ai_chatbot',
        status: 'open',
        priority: 'high',
        created_at: new Date().toISOString(),
      });

      // Update conversation
      try {
        await update('ai_chatbot_conversations',
          { conversation_id: conversationId },
          {
            escalated_to_agent: true,
            escalation_reason: reason || 'User Request',
            escalation_ticket_id: ticket[0]?.id || null,
            updated_at: new Date().toISOString(),
          }
        ).catch(() => {
          // Graceful fallback
        });
      } catch (e) {
        console.warn('Failed to update conversation', e);
      }

      return c.json({
        success: true,
        ticketId: ticket[0]?.id,
        message: 'Your conversation has been escalated to a support agent. They will contact you shortly.',
      });
    } catch (error: any) {
      console.error('Error escalating to agent:', error);
      return c.json({ error: error.message || 'Failed to escalate to agent' }, 500);
    }
  });

  /**
   * GET /ai-chatbot/conversation/:conversationId
   * Get conversation history
   */
  app.get("/ai-chatbot/conversation/:conversationId", async (c) => {
    try {
      const { conversationId } = c.req.param();

      const conversations = await query(
        `SELECT * FROM ai_chatbot_conversations 
         WHERE conversation_id = $1 
         ORDER BY created_at ASC`,
        [conversationId]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        conversationId,
        messages: conversations.rows || [],
      });
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      return c.json({ error: error.message || 'Failed to fetch conversation' }, 500);
    }
  });
}

