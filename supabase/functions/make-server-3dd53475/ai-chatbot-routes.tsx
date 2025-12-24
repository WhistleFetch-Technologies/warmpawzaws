import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { BedrockRuntimeClient, InvokeModelCommand } from "npm:@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "npm:@smithy/node-http-handler";
import { getPlatformSettingsRepository } from "../../lib/repositories/platform-settings.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export function registerAIChatbotRoutes(app: Hono) {

  /**
   * POST /make-server-3dd53475/ai-chatbot/chat
   * Enhanced AI Chatbot with Intent Classification and Context
   */
  app.post("/make-server-3dd53475/ai-chatbot/chat", async (c) => {
    try {
      const { message, customerPhone, conversationId, context } = await c.req.json();
      
      console.log(`🤖 [AI-CHATBOT] Request: "${message?.substring(0, 50)}..."`, { customerPhone });

      // Generate or use conversation ID
      const currentConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // ✅ SQL: Fetch AWS Settings
      const platformRepo = getPlatformSettingsRepository();
      const awsSettings = await platformRepo.getAWSSettings();
      
      // ✅ SQL: Fetch Store Context (Products/Services)
      let storeContext = "";
      try {
        // Fetch top 5 products from SQL
        const { data: products } = await supabase
          .from('products')
          .select('name, sale_price, base_price')
          .eq('status', 'active')
          .limit(5);
        
        if (products && products.length > 0) {
          const productList = products
            .map((p: any) => `- ${p.name} (₹${p.sale_price || p.base_price})`)
            .join('\n');
          storeContext = `Featured Products:\n${productList}`;
        }
      } catch (e) {
        console.warn("Failed to fetch product context", e);
      }
      
      // ✅ SQL: Resolve customer ID if phone provided
      let customerId: string | null = null;
      let userId: string | null = null;
      if (customerPhone) {
        const customersRepo = getCustomersRepository();
        const customer = await customersRepo.findByPhone(customerPhone);
        if (customer) {
          customerId = customer.id;
          userId = customer.user_id || null;
        }
      }

      let responseText = "";
      let intent = "general";
      let confidence = 0.0;
      let usedBedrock = false;

      // 1. Try AWS Bedrock if enabled
      if (awsSettings?.bedrock?.enabled && awsSettings?.credentials?.accessKeyId) {
        try {
          const accessKeyId = String(awsSettings.credentials.accessKeyId).trim();
          const secretAccessKey = String(awsSettings.credentials.secretAccessKey).trim();
          let modelId = awsSettings.bedrock.modelId || "us.amazon.nova-lite-v1:0";
          if (modelId === "amazon.nova-lite-v1:0") modelId = "us.amazon.nova-lite-v1:0";

          let region = (awsSettings.bedrock.region || 'ap-south-1').trim();
          if (modelId.startsWith('us.') && region === 'ap-south-1') region = 'us-east-1';

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

          const payload = {
            messages: [
              {
                role: "user", 
                content: [{ text: message }]
              }
            ],
            system: [{ text: systemPrompt }],
            inferenceConfig: {
              max_new_tokens: 1024,
              temperature: 0.5,
              top_p: 0.9
            }
          };

          // Adjust payload for Claude models if necessary (omitted for brevity, assuming Nova/Claude 3 structure mostly)
          // If Claude 3:
          if (modelId.includes('claude-3')) {
             // @ts-ignore
             payload.anthropic_version = "bedrock-2023-05-31";
             // @ts-ignore
             payload.max_tokens = 1024;
             // @ts-ignore
             delete payload.inferenceConfig;
          }

          const client = new BedrockRuntimeClient({
            region,
            credentials: { accessKeyId, secretAccessKey },
            requestHandler: new NodeHttpHandler({
                connectionTimeout: 5000, 
                requestTimeout: 5000,
                // @ts-ignore
                http2Enabled: false
            })
          });

          const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
          });

          const bedrockResponse = await client.send(command);
          const responseBody = new TextDecoder().decode(bedrockResponse.body);
          const result = JSON.parse(responseBody);

          let completion = "";
          if (result.output?.message?.content) {
             completion = result.output.message.content.map((c: any) => c.text).join('');
          } else if (result.content) {
             completion = result.content.map((c: any) => c.text).join('');
          }

          // Extract JSON
          try {
            const jsonMatch = completion.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              responseText = parsed.response;
              intent = parsed.intent || 'general';
              confidence = parsed.confidence || 0.8;
            } else {
              responseText = completion;
              intent = 'general'; // Fallback
            }
            usedBedrock = true;
          } catch (e) {
            console.warn("Failed to parse JSON from AI response", e);
            responseText = completion;
          }

        } catch (err) {
          console.error("Bedrock invocation failed:", err);
          // Fallback to simulation
        }
      }

      // 2. Simulation Fallback
      if (!usedBedrock) {
        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('buy') || lowerMsg.includes('shop') || lowerMsg.includes('product') || lowerMsg.includes('price')) {
          intent = 'shopping';
          responseText = "You can explore our wide range of pet products in the Shop section. Is there something specific you're looking for, like food or toys?";
          confidence = 0.9;
        } else if (lowerMsg.includes('vet') || lowerMsg.includes('doctor') || lowerMsg.includes('sick') || lowerMsg.includes('pain')) {
          intent = 'symptoms';
          responseText = "I'm sorry to hear your pet isn't feeling well. For medical advice, please consult a veterinarian immediately. You can book a vet appointment through our Services tab.";
          confidence = 0.95;
        } else if (lowerMsg.includes('book') || lowerMsg.includes('appointment')) {
          intent = 'booking';
          responseText = "I can help you with that! You can book Grooming, Vet, or Boarding services directly from the Home screen.";
          confidence = 0.9;
        } else if (lowerMsg.includes('support') || lowerMsg.includes('help') || lowerMsg.includes('issue')) {
          intent = 'support';
          responseText = "I understand you need assistance. I can create a support ticket for you, or you can browse our FAQ.";
          confidence = 0.85;
        } else {
          intent = 'general';
          responseText = "I'm the Warmpawz AI Assistant. I can help you shop, book services, or find pet care tips. How can I help you today?";
          confidence = 0.5;
        }
      }

      // ✅ SQL: Save conversation history
      try {
        // Save user message
        await supabase.from('ai_chat_history').insert({
          conversation_id: currentConversationId,
          customer_id: customerId,
          user_id: userId,
          message_type: 'user',
          message_content: message,
          context: context || {}
        });
        
        // Save assistant response
        await supabase.from('ai_chat_history').insert({
          conversation_id: currentConversationId,
          customer_id: customerId,
          user_id: userId,
          message_type: 'assistant',
          message_content: responseText,
          intent,
          confidence,
          includes_disclaimer: responseText.toLowerCase().includes('disclaimer') || 
                                responseText.toLowerCase().includes('not a substitute') ||
                                responseText.toLowerCase().includes('consult a veterinarian'),
          context: context || {},
          metadata: { source: usedBedrock ? 'bedrock' : 'simulation' }
        });
      } catch (e) {
        console.warn("Failed to save chat history:", e);
      }

      return c.json({
        success: true,
        conversationId: currentConversationId,
        response: responseText,
        intent,
        confidence,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('AI Chatbot Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/ai-chatbot/conversation/:conversationId
   * ✅ SQL-ONLY: Uses ai_chat_history table
   */
  app.get("/make-server-3dd53475/ai-chatbot/conversation/:conversationId", async (c) => {
    try {
      const conversationId = c.req.param('conversationId');
      
      // ✅ SQL: Get conversation history
      const { data: history, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching conversation history:', error);
        return c.json({ error: 'Failed to fetch conversation history' }, 500);
      }
      
      return c.json({ 
        success: true, 
        history: (history || []).map((msg: any) => ({
          role: msg.message_type === 'user' ? 'user' : 'assistant',
          content: msg.message_content,
          intent: msg.intent,
          confidence: msg.confidence,
          timestamp: msg.created_at
        }))
      });
    } catch (error) {
      console.error('Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}
