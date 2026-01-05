"use strict";
/**
 * ============================================================================
 * AI CHATBOT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Enhanced AI Chatbot with Intent Classification and Context
 * Uses AWS Bedrock for natural language processing
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAIChatbotEndpoints = registerAIChatbotEndpoints;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const bedrock_client_1 = require("../lib/utils/bedrock-client");
const BASE_PATH = '/make-server-3dd53475';
function registerAIChatbotEndpoints(app) {
    /**
     * POST /make-server-3dd53475/ai-chatbot/chat
     * Enhanced AI Chatbot with Intent Classification and Context
     */
    app.post(`${BASE_PATH}/ai-chatbot/chat`, async (c) => {
        try {
            const { message, customerPhone, conversationId, context } = await c.req.json();
            console.log(`🤖 [AI-CHATBOT] Request: "${message?.substring(0, 50)}..."`, { customerPhone });
            // Generate or use conversation ID
            const currentConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            // ✅ SQL: Fetch Store Context (Products/Services)
            let storeContext = '';
            try {
                const pool = await (0, db_1.getDbClient)();
                const productsResult = await pool.query('SELECT name, sale_price, base_price FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 5');
                const products = productsResult.rows
                    .map((p) => `- ${p.name} (₹${p.sale_price || p.base_price || 0})`)
                    .join('\n');
                storeContext = products ? `Featured Products:\n${products}` : '';
            }
            catch (e) {
                console.warn('Failed to fetch product context', e);
            }
            let responseText = '';
            let intent = 'general';
            let confidence = 0.5;
            let usedBedrock = false;
            // 1. Try AWS Bedrock if enabled
            try {
                const systemPrompt = `You are the Warmpawz AI Assistant. 
        
ROLE: Help customers with pet care, shopping, bookings, and support.

CONTEXT:
- User Phone: ${customerPhone || 'Guest'}
- Pet Context: ${context ? JSON.stringify(context) : 'None'}
${storeContext}

TASK:
1. Analyze the user's message.
2. Determine the INTENT from: 'support', 'booking', 'symptoms', 'shopping', 'adoption', 'knowledge', 'general'.
3. Provide a helpful, friendly response.
4. If intent is 'shopping', recommend checking the 'Shop' tab.
5. If intent is 'symptoms', strictly advise seeing a vet for serious issues.

OUTPUT FORMAT:
Respond with a VALID JSON object ONLY:
{
  "response": "Your response text here...",
  "intent": "detected_intent",
  "confidence": 0.95
}`;
                const completion = await (0, bedrock_client_1.invokeBedrock)(message, systemPrompt, {
                    maxTokens: 1024,
                    temperature: 0.5,
                    topP: 0.9,
                });
                // Extract JSON from response
                try {
                    const jsonMatch = completion.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        responseText = parsed.response;
                        intent = parsed.intent || 'general';
                        confidence = parsed.confidence || 0.8;
                    }
                    else {
                        responseText = completion;
                        intent = 'general';
                    }
                    usedBedrock = true;
                }
                catch (e) {
                    console.warn('Failed to parse JSON from AI response', e);
                    responseText = completion;
                }
            }
            catch (err) {
                console.error('Bedrock invocation failed:', err);
                // Fallback to simulation
            }
            // 2. Simulation Fallback
            if (!usedBedrock) {
                const lowerMsg = message.toLowerCase();
                if (lowerMsg.includes('buy') || lowerMsg.includes('shop') || lowerMsg.includes('product') || lowerMsg.includes('price')) {
                    intent = 'shopping';
                    responseText = "You can explore our wide range of pet products in the Shop section. Is there something specific you're looking for, like food or toys?";
                    confidence = 0.9;
                }
                else if (lowerMsg.includes('vet') || lowerMsg.includes('doctor') || lowerMsg.includes('sick') || lowerMsg.includes('pain')) {
                    intent = 'symptoms';
                    responseText = "I'm sorry to hear your pet isn't feeling well. For medical advice, please consult a veterinarian immediately. You can book a vet appointment through our Services tab.";
                    confidence = 0.95;
                }
                else if (lowerMsg.includes('book') || lowerMsg.includes('appointment')) {
                    intent = 'booking';
                    responseText = "I can help you with that! You can book Grooming, Vet, or Boarding services directly from the Home screen.";
                    confidence = 0.9;
                }
                else if (lowerMsg.includes('support') || lowerMsg.includes('help') || lowerMsg.includes('issue')) {
                    intent = 'support';
                    responseText = "I understand you need assistance. I can create a support ticket for you, or you can browse our FAQ.";
                    confidence = 0.85;
                }
                else {
                    intent = 'general';
                    responseText = "I'm the Warmpawz AI Assistant. I can help you shop, book services, or find pet care tips. How can I help you today?";
                    confidence = 0.5;
                }
            }
            // ✅ SQL: Save conversation history
            const pool = await (0, db_1.getDbClient)();
            const now = new Date().toISOString();
            // Upsert conversation
            const conversationResult = await pool.query(`INSERT INTO ai_conversations (id, customer_phone, created_at, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET updated_at = $4`, [currentConversationId, customerPhone || null, now, now]);
            // Insert messages
            await pool.query(`INSERT INTO ai_messages (conversation_id, role, content, intent, created_at)
         VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`, [
                currentConversationId, 'user', message, null, now,
                currentConversationId, 'assistant', responseText, intent, now,
            ]);
            return (0, response_utils_1.sendSuccess)(c, {
                conversationId: currentConversationId,
                response: responseText,
                intent,
                confidence,
                timestamp: now,
            });
        }
        catch (error) {
            console.error('AI Chatbot Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /make-server-3dd53475/ai-chatbot/conversation/:conversationId
     * Get conversation history
     */
    app.get(`${BASE_PATH}/ai-chatbot/conversation/:conversationId`, async (c) => {
        try {
            const conversationId = c.req.param('conversationId');
            // ✅ SQL: Get conversation history
            const pool = await (0, db_1.getDbClient)();
            const result = await pool.query('SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC', [conversationId]);
            const history = result.rows.map((m) => ({
                role: m.role,
                content: m.content,
                intent: m.intent,
                timestamp: m.created_at,
            }));
            return (0, response_utils_1.sendSuccess)(c, { history });
        }
        catch (error) {
            console.error('Error fetching conversation:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=ai-chatbot-endpoints-sql.js.map