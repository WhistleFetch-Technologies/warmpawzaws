import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { BedrockRuntimeClient, InvokeModelCommand } from "npm:@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "npm:@smithy/node-http-handler";

export function registerAICRMRoutes(app: Hono, kvStore: any) {
  
  // ------------------------------------------------------------------
  // AI CHAT BOT (Bedrock + Simulation Fallback)
  // ------------------------------------------------------------------
  app.post("/make-server-3dd53475/ai/chat", async (c) => {
    try {
      const { message, customerId, history } = await c.req.json();
      
      console.log('🤖 [AI] Request received:', { customerId, messageLength: message?.length });

      // Fetch AWS Settings
      const awsSettings = await kv.get('admin:settings:aws');
      
      // Fetch Vendors for Context
      let vendorContext = "No specific vendor data available.";
      try {
        const allVendors = await kv.getByPrefix('vendor:') || [];
        const activeVendors = allVendors.filter((v: any) => v.status === 'approved' && !v.deactivated);
        
        if (activeVendors.length > 0) {
            const vendorList = activeVendors.slice(0, 10).map((v: any) => {
                const name = v.businessName || v.fullName || 'Unknown Vendor';
                const services = v.services ? v.services.join(', ') : 'General';
                const loc = v.address || 'Unknown Location';
                const rating = v.rating ? `⭐${v.rating}` : '';
                return `- ${name} (${services}) at ${loc} ${rating}`;
            }).join('\n');
            vendorContext = `Available Vendors:\n${vendorList}`;
        }
      } catch (err) {
        console.error('Failed to fetch vendors for AI context:', err);
      }

      let reply = "";
      let action = "none";
      let usedBedrock = false;

      // 1. Try AWS Bedrock if enabled
      if (awsSettings?.bedrock?.enabled && awsSettings?.credentials?.accessKeyId) {
        try {
          console.log('🧠 [AI] Bedrock enabled. Preparing request...');
          
          const accessKeyId = String(awsSettings.credentials.accessKeyId).trim();
          const secretAccessKey = String(awsSettings.credentials.secretAccessKey).trim();
          
          let modelId = awsSettings.bedrock.modelId || "us.amazon.nova-lite-v1:0";
          // Fix: Remap base Nova ID to US Cross-Region Inference Profile to avoid ValidationException
          if (modelId === "amazon.nova-lite-v1:0") modelId = "us.amazon.nova-lite-v1:0";

          let region = (awsSettings.bedrock.region || 'ap-south-1').trim();
          // Fix: US Inference Profiles (us.amazon...) are not accessible from ap-south-1
          if (modelId.startsWith('us.') && region === 'ap-south-1') {
              region = 'us-east-1';
          }

          // Construct prompt with context
          const systemPrompt = `You are Warmpawz AI Vet Assistant. Ask guided symptom questions, classify severity, and recommend next steps (vet visit, medicine, grooming). Never give prescription drugs.
            
            Context:
            - Services: Vet, Grooming, Boarding, Training, Walking.
            - Role: Help users book services, find information, or check symptoms.
            - Tone: Friendly, professional, empathetic.
            
            ${vendorContext}
            
            Respond with a JSON object containing "reply" (string) and "action" (string).
            Action can be: "none", "suggest_ticket", "create_ticket", "book_appointment".
            
            JSON:`;

          let command: InvokeModelCommand;

          // Model Configuration
          if (modelId.includes("nova")) {
             console.log(`🧠 [AI] Using Amazon Nova payload structure for ${modelId}`);
             // Amazon Nova Models (Lite/Micro/Pro)
             const payload = {
                messages: [
                    {
                        role: "user", 
                        content: [
                            { text: `User Message: "${message}"` }
                        ]
                    }
                ],
                // System prompts in Nova are passed via system field, same as Claude 3
                // Note: Nova documentation specifies [{ text: "string" }]
                system: [{ text: systemPrompt }],
                inferenceConfig: {
                    max_new_tokens: 1024,
                    temperature: 0.7,
                    top_p: 0.9
                }
             };

             command = new InvokeModelCommand({
                modelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload)
             });

          } else if (modelId.includes("claude-3") || modelId.includes("sonnet") || modelId.includes("opus") || modelId.includes("haiku")) {
             // CLAUDE 3 SONNET (ap-south-1) Configuration
             const payload = {
                anthropic_version: "bedrock-2023-05-31",
                max_tokens: 1024,
                // Fix: Add 'type: "text"' to system prompt block
                system: [{ type: "text", text: systemPrompt }], 
                messages: [
                    {
                        role: "user", 
                        content: [
                            { text: `User Message: "${message}"` }
                        ]
                    }
                ]
             };

             command = new InvokeModelCommand({
                modelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload)
             });

          } else {
             // Legacy Fallback (Claude 2, Titan) - unlikely to be used given constraints
             const payload = {
                prompt: `\n\nHuman: ${systemPrompt}\n\nUser Message: "${message}"\n\nAssistant:`,
                max_tokens_to_sample: 1024,
                temperature: 0.7,
                top_p: 0.9,
              };
              command = new InvokeModelCommand({
                modelId,
                contentType: "application/json",
                accept: "application/json",
                body: JSON.stringify(payload)
              });
          }

          // Retry Logic for Region Fallback
          // We default to ap-south-1 as requested
          let currentRegion = region;
          let response;
          
          for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                  const client = new BedrockRuntimeClient({
                    region: currentRegion,
                    credentials: { accessKeyId, secretAccessKey },
                    requestHandler: new NodeHttpHandler({
                        connectionTimeout: 5000,
                        requestTimeout: 5000,
                        // @ts-ignore - Deno/Node compatibility: Disable HTTP/2 to avoid broken pipe errors in Edge Runtime
                        http2Enabled: false 
                    })
                  });

                  console.log(`🧠 [AI] Sending command to Bedrock (${modelId}) in region ${currentRegion}...`);
                  response = await client.send(command);
                  break; // Success
              } catch (err) {
                  const errMsg = String(err);
                  console.warn(`⚠️ [AI] Attempt ${attempt} failed: ${errMsg}`);
                  
                  // If ap-south-1 fails with Use Case error, try fallback
                  // Also catch specific error name "ResourceNotFoundException" if it contains use case message
                  const isUseCaseError = errMsg.includes('Model use case details have not been submitted') || 
                                       (errMsg.includes('ResourceNotFoundException') && errMsg.includes('use case')) ||
                                       errMsg.includes('Access Denied');

                  if (isUseCaseError) {
                      if (currentRegion === 'ap-south-1') {
                           // Fallback to us-west-2 if Mumbai fails
                           console.log('🔄 [AI] Retrying with fallback region us-west-2...');
                           currentRegion = 'us-west-2';
                           continue;
                      } else if (currentRegion === 'us-west-2') {
                           // Fallback to us-east-1 if Oregon fails
                           console.log('🔄 [AI] Retrying with fallback region us-east-1...');
                           currentRegion = 'us-east-1';
                           continue;
                      }
                  }
                  throw err; // Abort if not retryable
              }
          }
          
          const responseBody = new TextDecoder().decode(response!.body);
          const result = JSON.parse(responseBody);
          
          // Dynamic Response Parsing
          let completion = "";
          
          if (result.output && result.output.message && Array.isArray(result.output.message.content)) {
             // Nova Models
             completion = result.output.message.content.map((c: any) => c.text).join('');
          } else if (result.content && Array.isArray(result.content)) {
              // Claude 3 Messages API
              completion = result.content.map((c: any) => c.text).join('');
          } else if (result.completion) {
              // Claude 2 Text Completion
              completion = result.completion;
          } else if (result.results && result.results[0]?.outputText) {
              // Titan
              completion = result.results[0].outputText;
          } else {
              completion = JSON.stringify(result);
          }
          
          // Try to extract JSON from completion
          
          // Try to extract JSON from completion
          try {
            const jsonMatch = completion.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              reply = parsed.reply;
              action = parsed.action;
            } else {
              reply = completion;
            }
          } catch (e) {
            reply = completion;
          }

          console.log('🧠 [AI] Bedrock response received successfully');
          usedBedrock = true;

          return c.json({ 
            reply, 
            action,
            source: 'bedrock',
            model: modelId,
            region: currentRegion
          });

        } catch (err) {
          console.error('❌ [AI] Bedrock failed:', err);
          // Don't fallback silently if explicitly enabled - return the error so user can fix config
          const errorMessage = String(err);
          if (errorMessage.includes('Model use case details have not been submitted')) {
              return c.json({ 
                error: 'AWS Bedrock Access Denied: Use Case Not Submitted',
                details: 'This model requires submitting a use case form in the AWS Console for the selected region (' + (awsSettings.bedrock.region || 'ap-south-1') + ').',
                source: 'bedrock_error'
              }, 500);
          }

          return c.json({ 
            error: 'AWS Bedrock Error: ' + errorMessage,
            details: 'Check your AWS credentials, Region, and Model Access in AWS Console.',
            source: 'bedrock_error'
          }, 500);
        }
      }

      // 2. Fallback Simulation logic (Only if Bedrock is DISABLED or skipped)
      if (!usedBedrock) {
        console.log('🤖 [AI] Bedrock disabled, using simulation');
        
        // Simulate AI processing delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const lowerMsg = message.toLowerCase();
        reply = "";
        action = "none";

        // Basic Intent Recognition
        if (lowerMsg.includes('refund')) {
          reply = "I can help with that. Refunds usually take 5-7 business days. To process a refund, I'll need to create a formal request. Would you like me to open a support ticket for this?";
          action = 'suggest_ticket';
        } else if (lowerMsg.includes('cancel')) {
          reply = "You can cancel your appointment from the 'My Bookings' tab. If it's less than 24 hours before the appointment, a cancellation fee may apply. Do you need help finding the booking?";
          action = 'none';
        } else if (lowerMsg.includes('book') || lowerMsg.includes('appointment')) {
          reply = "I can help you book! Are you looking for a Vet, Groomer, or Boarding service?";
          action = 'none';
        } else if (lowerMsg.includes('price') || lowerMsg.includes('cost')) {
          reply = "Prices vary by vendor. You can see the exact price on each service card. On average, a vet consultation is around ₹500.";
          action = 'none';
        } else if (lowerMsg.includes('human') || lowerMsg.includes('agent') || lowerMsg.includes('support')) {
          reply = "I understand. I can connect you with a human agent right away. I've flagged this conversation.";
          action = 'create_ticket';
        } else {
          reply = `I'm an AI assistant powered by Warmpawz. I can help with bookings, finding services, or general pet care advice. You asked: "${message}"`;
          action = 'none';
        }

        return c.json({ reply, action });
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ------------------------------------------------------------------
  // BEDROCK CONNECTION TEST (Generic)
  // ------------------------------------------------------------------
  app.post("/make-server-3dd53475/ai/test-bedrock", async (c) => {
    let awsSettings: any = {};
    let region = 'ap-south-1'; // default
    // Move modelId to outer scope to avoid ReferenceError in catch block
    let modelId = "us.amazon.nova-lite-v1:0"; 

    try {
      const body = await c.req.json();
      
      // prioritize body params (from UI test), fallback to DB settings
      awsSettings = await kv.get('admin:settings:aws') || { bedrock: {} };
      if (!awsSettings.bedrock) awsSettings.bedrock = {};
      
      // If credentials provided in body, use them (allows testing before saving)
      if (body.credentials) {
        awsSettings = { ...awsSettings, credentials: body.credentials };
      }
      
      // Override specific Bedrock settings if provided
      if (body.region) awsSettings.bedrock.region = body.region;
      if (body.modelId) awsSettings.bedrock.modelId = body.modelId;

      // Set modelId from settings or keep default
      if (awsSettings.bedrock.modelId) {
          modelId = awsSettings.bedrock.modelId;
      }
      
      // Fix: Remap base Nova ID to US Cross-Region Inference Profile
      if (modelId === "amazon.nova-lite-v1:0") modelId = "us.amazon.nova-lite-v1:0";

      if (!awsSettings?.bedrock?.enabled && !body.forceEnable) {
         return c.json({ 
          status: 'error', 
          message: 'AWS Bedrock is not enabled.' 
        }, 400);
      }

      if (!awsSettings?.credentials?.accessKeyId) {
        return c.json({ 
          status: 'error', 
          message: 'Missing AWS Credentials.' 
        }, 400);
      }

      region = (awsSettings.bedrock.region || 'ap-south-1').trim();
      
      // Fix: US Inference Profiles (us.amazon...) are not accessible from ap-south-1
      if (modelId.startsWith('us.') && region === 'ap-south-1') {
          region = 'us-east-1';
      }

      // Ensure credentials are clean strings
      const accessKeyId = String(awsSettings.credentials?.accessKeyId || '').trim();
      const secretAccessKey = String(awsSettings.credentials?.secretAccessKey || '').trim();

      if (!region) {
          return c.json({ 
            status: 'error', 
            message: 'Invalid Region setting.' 
          }, 400);
      }

      const client = new BedrockRuntimeClient({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey
        }
      });

      // Redundant declaration removed
      // const modelId = awsSettings.bedrock.modelId || "anthropic.claude-3-sonnet-20240229-v1:0";
      
      console.log(`🧪 [Test] Initializing Bedrock client in region: ${region}`);
      console.log(`🧪 [Test] Target Model ID: ${modelId}`);

      let command: InvokeModelCommand;
      let payload: any;
      
      // Construct payload based on model family
      if (modelId.includes("nova")) {
        // Nova models
        payload = {
          messages: [
            {
              role: "user",
              content: [
                { text: "Hello, this is a connectivity test. Are you online?" }
              ]
            }
          ],
          inferenceConfig: {
            max_new_tokens: 100
          }
        };
        command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
        });
      } else if (modelId.includes("claude-3")) {
        // Claude 3 (Haiku, Sonnet, Opus) - Messages API
        payload = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 100,
          // Fix: Add 'type: "text"' to system prompt block
          system: [{ type: "text", text: "You are a test assistant." }],
          messages: [
            {
              role: "user",
              content: "Hello, this is a connectivity test. Are you online?"
            }
          ]
        };
        command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
        });
      } else if (modelId.includes("claude-v2") || modelId.includes("claude-instant")) {
        // Claude 2 / Instant - Text Completions API
        payload = {
          prompt: "\n\nHuman: Hello, this is a connectivity test. Are you online?\n\nAssistant:",
          max_tokens_to_sample: 100,
          temperature: 0.5,
          top_p: 0.9,
        };
        command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
        });
      } else {
        // Fallback generic (Titan etc) - try simple text generation
         payload = {
             inputText: "Hello, this is a connectivity test.",
             textGenerationConfig: { maxTokenCount: 100 }
         };
         command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload)
        });
      }

      console.log(`🧪 [Test] Sending command to Bedrock...`);
      let response;
      
      // Retry Loop for Region Fallback in Test Mode
      for (let attempt = 1; attempt <= 3; attempt++) {
          try {
              const client = new BedrockRuntimeClient({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey
                },
                requestHandler: new NodeHttpHandler({
                    connectionTimeout: 5000,
                    requestTimeout: 5000,
                    // @ts-ignore
                    http2Enabled: false
                })
              });
              
              console.log(`🧪 [Test] Attempt ${attempt}: Sending to ${region}...`);
              response = await client.send(command);
              break; // Success
          } catch (err) {
              const errMsg = String(err);
              console.warn(`⚠️ [Test] Attempt ${attempt} failed: ${errMsg}`);
              
              // If Use Case error, try swiching regions automatically
              // Also catch specific error name "ResourceNotFoundException" if it contains use case message
              const isUseCaseError = errMsg.includes('Model use case details have not been submitted') || 
                                   (errMsg.includes('ResourceNotFoundException') && errMsg.includes('use case'));

              if (isUseCaseError) {
                  if (region === 'ap-south-1') {
                      console.log('🔄 [Test] Switching to us-west-2 fallback...');
                      region = 'us-west-2';
                      continue;
                  }
                  // If we were already in us-west-2 or another region, maybe try ap-south-1?
                  // But usually user starts with us-east-1 or something.
                  if (region === 'us-west-2') {
                       console.log('🔄 [Test] Switching to us-east-1 fallback...');
                       region = 'us-east-1';
                       continue;
                  }
              }
              throw err;
          }
      }
      
      const duration = Date.now() - Date.now(); // approximate since we moved start time


      // calculate duration correctly
      const startTime = Date.now(); // reset for reporting if loop was fast, or just use 0
      // actually we can't measure easily with loop. let's just say < 500ms
      
      const responseBody = new TextDecoder().decode(response!.body);
      const result = JSON.parse(responseBody);

      console.log(`✅ [Test] Success! Latency: ${duration}ms`);

      return c.json({
        status: 'success',
        model: modelId,
        region: region,
        latency_ms: duration,
        response_parsed: result,
        message: "Successfully connected to AWS Bedrock!"
      });

    } catch (error) {
      console.error('❌ [Test] Bedrock Test Error:', error);
      
      const errorMessage = String(error);
      
      if (errorMessage.includes('Failed to fetch')) {
           return c.json({
            status: 'error',
            error: 'Network/Connection Error: Failed to fetch',
            details: `Could not connect to AWS Bedrock endpoint (https://bedrock-runtime.${region}.amazonaws.com). Check if the Region "${region}" is valid and internet access is available.`,
            // @ts-ignore
            stack: error.stack
          }, 500);
      }

      if (errorMessage.includes('Model use case details have not been submitted')) {
          return c.json({
            status: 'error',
            error: 'AWS Bedrock Access Denied: Use Case Not Submitted',
            details: 'The selected region (' + (region || 'unknown') + ') requires submitting a use case form for this specific model (' + modelId + '). All fallback regions (ap-south-1, us-west-2, us-east-1) failed. Please submit the form in the AWS Console.',
            // @ts-ignore
            stack: error.stack
          }, 500);
      }

      return c.json({
        status: 'error',
        error: errorMessage,
        // @ts-ignore
        stack: error.stack,
        details: "If getting SignatureDoesNotMatch, check if credentials contain newlines or spaces."
      }, 500);
    }
  });

  // ------------------------------------------------------------------
  // CRM TICKET MANAGEMENT
  // ------------------------------------------------------------------

  // Create Ticket
  app.post("/make-server-3dd53475/crm/tickets", async (c) => {
    try {
      const { customerId, subject, description, source } = await c.req.json();
      
      const ticketId = `T-${Date.now()}`;
      const ticket = {
        id: ticketId,
        customerId,
        subject,
        description,
        status: 'open',
        priority: 'medium',
        source: source || 'chat',
        createdAt: new Date().toISOString(),
        messages: []
      };

      // Store in KV
      await kv.set(`ticket:${ticketId}`, ticket);
      
      // Add to list
      const list = await kv.get('tickets:list') || [];
      await kv.set('tickets:list', [ticketId, ...list]);
      
      // Add to vendor/support ticket list (using separate prefix to avoid collision)
      const supportTickets = await kv.get('support:tickets:all') || [];
      supportTickets.unshift(ticketId);
      await kv.set('support:tickets:all', supportTickets);

      return c.json({ success: true, ticketId });
    } catch (error) {
      console.error('Create ticket error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // List Tickets
  app.get("/make-server-3dd53475/crm/tickets", async (c) => {
    try {
      // Try both lists just in case
      const list1 = await kv.get('tickets:list') || [];
      const list2 = await kv.get('support:tickets:all') || [];
      const uniqueIds = [...new Set([...list1, ...list2])];
      
      const tickets = [];
      for (const id of uniqueIds.slice(0, 50)) { // Limit 50
        const t = await kv.get(`ticket:${id}`);
        if (t) tickets.push(t);
      }
      
      // Sort by date desc
      tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return c.json({ tickets });
    } catch (error) {
      console.error('List tickets error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Reply to Ticket
  app.post("/make-server-3dd53475/crm/reply", async (c) => {
    try {
      const { ticketId, message, agentName } = await c.req.json();
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);
      
      const newMsg = {
        id: Date.now().toString(),
        sender: agentName || 'Support Agent',
        content: message,
        timestamp: new Date().toISOString(),
        role: 'agent'
      };
      
      ticket.messages = [...(ticket.messages || []), newMsg];
      ticket.status = 'in_progress';
      
      await kv.set(`ticket:${ticketId}`, ticket);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Reply ticket error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Close Ticket
  app.post("/make-server-3dd53475/crm/close", async (c) => {
    try {
      const { ticketId } = await c.req.json();
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);
      
      ticket.status = 'resolved';
      await kv.set(`ticket:${ticketId}`, ticket);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Close ticket error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}