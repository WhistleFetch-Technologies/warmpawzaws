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
      const { ticketId, message, agentName, agentId } = await c.req.json();
      
      if (!ticketId || !message) {
        return c.json({ error: "ticketId and message are required" }, 400);
      }
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);
      
      const replyMessage = {
        id: Date.now().toString(),
        sender: agentName || 'Support Agent',
        senderId: agentId || 'agent',
        content: message,
        timestamp: new Date().toISOString(),
        role: 'agent' as const
      };

      ticket.messages = [...(ticket.messages || []), replyMessage];
      ticket.updatedAt = new Date().toISOString();
      ticket.status = ticket.status === 'open' ? 'in_progress' : ticket.status;
      
      await kv.set(`ticket:${ticketId}`, ticket);
      
      // Send notification to customer
      await sendTicketNotification(kv, {
        ticketId,
        type: 'ticket_reply',
        customerEmail: ticket.customerEmail,
        customerPhone: ticket.customerPhone
      });
      
      return c.json({ success: true, message: replyMessage });
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
      ticket.resolvedAt = new Date().toISOString();
      await kv.set(`ticket:${ticketId}`, ticket);
      
      return c.json({ success: true });
    } catch (error) {
      console.error('Close ticket error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get Ticket Details
  app.get("/make-server-3dd53475/crm/tickets/:ticketId", async (c) => {
    try {
      const ticketId = c.req.param('ticketId');
      const ticket = await kv.get(`ticket:${ticketId}`);
      
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);
      
      return c.json({ ticket });
    } catch (error) {
      console.error('Get ticket error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Agent Actions (Refund, Partial Refund, Escalate, etc.)
  app.post("/make-server-3dd53475/crm/action", async (c) => {
    try {
      const { ticketId, action, amount, reason, note, assignTo } = await c.req.json();
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);
      
      const actionMsg = {
        id: Date.now().toString(),
        sender: 'System',
        content: '',
        timestamp: new Date().toISOString(),
        role: 'system' as const,
        action: action,
        metadata: { amount, reason, note, assignTo }
      };

      switch (action) {
        case 'refund':
          actionMsg.content = `Full refund of ₹${amount} processed. ${reason || ''}`;
          ticket.status = 'resolved';
          ticket.resolvedAt = new Date().toISOString();
          break;
        case 'partial_refund':
          actionMsg.content = `Partial refund of ₹${amount} processed. ${reason || ''}`;
          ticket.status = 'in_progress';
          break;
        case 'escalate':
          actionMsg.content = `Ticket escalated. ${reason || ''}`;
          ticket.status = 'escalated';
          ticket.priority = 'high';
          break;
        case 'resolve':
          actionMsg.content = `Ticket marked as resolved. ${reason || ''}`;
          ticket.status = 'resolved';
          ticket.resolvedAt = new Date().toISOString();
          break;
        case 'reopen':
          actionMsg.content = `Ticket reopened. ${reason || ''}`;
          ticket.status = 'open';
          break;
        case 'assign':
          actionMsg.content = `Ticket assigned to ${assignTo}.`;
          ticket.assignedTo = assignTo;
          ticket.assignedAgent = assignTo;
          break;
        case 'add_note':
          actionMsg.content = `Note added: ${note}`;
          break;
      }

      ticket.messages = [...(ticket.messages || []), actionMsg];
      ticket.updatedAt = new Date().toISOString();
      
      await kv.set(`ticket:${ticketId}`, ticket);
      
      return c.json({ success: true, message: 'Action completed successfully', ticket });
    } catch (error) {
      console.error('Action error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get Customer Context
  app.get("/make-server-3dd53475/crm/customer/:customerId/context", async (c) => {
    try {
      const customerId = c.req.param('customerId');
      
      // Fetch customer data
      const customer = await kv.get(`customer:${customerId}`);
      
      // Fetch orders
      const orders = await kv.getByPrefix(`order:customer:${customerId}:`) || [];
      const recentOrders = orders
        .slice(0, 5)
        .map((o: any) => ({
          id: o.id || o.orderId,
          date: o.createdAt || o.orderDate,
          amount: o.totalAmount || o.amount || 0,
          status: o.status || 'unknown'
        }));

      // Fetch bookings
      const bookings = await kv.getByPrefix(`booking:customer:${customerId}:`) || [];
      const recentBookings = bookings
        .slice(0, 5)
        .map((b: any) => ({
          id: b.id || b.bookingId,
          date: b.createdAt || b.bookingDate,
          service: b.serviceName || b.serviceType || 'Service',
          status: b.status || 'unknown'
        }));

      const context = {
        id: customerId,
        name: customer?.name || customer?.fullName,
        phone: customer?.phone || customer?.phoneNumber,
        email: customer?.email,
        totalOrders: orders.length,
        totalSpent: orders.reduce((sum: number, o: any) => sum + (o.totalAmount || o.amount || 0), 0),
        lastOrderDate: orders[0]?.createdAt || orders[0]?.orderDate,
        recentOrders,
        recentBookings
      };

      return c.json({ context });
    } catch (error) {
      console.error('Get customer context error:', error);
      return c.json({ context: null, error: String(error) }, 500);
    }
  });

  // Get AI Conversation History
  app.get("/make-server-3dd53475/ai-chatbot/conversation/:conversationId", async (c) => {
    try {
      const conversationId = c.req.param('conversationId');
      const conversation = await kv.get(`ai_conversation:${conversationId}`);
      
      if (!conversation) {
        return c.json({ messages: [] });
      }

      return c.json({ messages: conversation.messages || [] });
    } catch (error) {
      console.error('Get AI conversation error:', error);
      return c.json({ messages: [], error: String(error) }, 500);
    }
  });

  // Get Support Stats
  app.get("/make-server-3dd53475/crm/stats", async (c) => {
    try {
      const list1 = await kv.get('tickets:list') || [];
      const list2 = await kv.get('support:tickets:all') || [];
      const uniqueIds = [...new Set([...list1, ...list2])];
      
      const tickets = [];
      for (const id of uniqueIds) {
        const t = await kv.get(`ticket:${id}`);
        if (t) tickets.push(t);
      }

      const stats = {
        open: tickets.filter((t: any) => t.status === 'open').length,
        inProgress: tickets.filter((t: any) => t.status === 'in_progress').length,
        resolved: tickets.filter((t: any) => t.status === 'resolved').length,
        escalated: tickets.filter((t: any) => t.status === 'escalated').length,
        avgResponseTime: 15, // Mock - calculate from actual data
        satisfaction: 85 // Mock - calculate from ratings
      };

      return c.json({ stats });
    } catch (error) {
      console.error('Get stats error:', error);
      return c.json({ stats: null, error: String(error) }, 500);
    }
  });

  // Process Refund via Razorpay
  app.post("/make-server-3dd53475/crm/refund/process", async (c) => {
    try {
      const { ticketId, amount, reason, orderId, paymentId } = await c.req.json();
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);

      // Get order to find payment ID
      let actualPaymentId = paymentId;
      if (orderId && !actualPaymentId) {
        const order = await kv.get(`order:${orderId}`);
        actualPaymentId = order?.razorpayPaymentId || order?.paymentId;
      }

      if (!actualPaymentId) {
        return c.json({ error: "Payment ID not found" }, 400);
      }

      // Get payment settings
      const paymentSettings = await kv.get('admin:settings:payment') || {};
      const razorpayKeyId = paymentSettings.razorpay?.keyId || Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = paymentSettings.razorpay?.keySecret || Deno.env.get('RAZORPAY_KEY_SECRET');

      if (!razorpayKeyId || !razorpayKeySecret) {
        return c.json({ error: "Payment gateway not configured" }, 500);
      }

      // Process refund via Razorpay API
      const refundUrl = `https://api.razorpay.com/v1/payments/${actualPaymentId}/refund`;
      const refundResponse = await fetch(refundUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${razorpayKeyId}:${razorpayKeySecret}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to paise
          notes: {
            reason: reason || 'Support agent refund',
            ticketId: ticketId
          }
        })
      });

      if (!refundResponse.ok) {
        const errorData = await refundResponse.json();
        return c.json({ error: errorData.error?.description || 'Refund processing failed' }, 500);
      }

      const refundData = await refundResponse.json();

      // Update ticket with refund info
      ticket.refund = {
        status: 'processing',
        razorpayRefundId: refundData.id,
        amount: amount,
        processedAt: new Date().toISOString()
      };
      await kv.set(`ticket:${ticketId}`, ticket);

      // Send email notification
      await sendTicketNotification(kv, {
        ticketId,
        type: 'refund_processed',
        customerEmail: ticket.customerEmail,
        customerPhone: ticket.customerPhone,
        amount,
        refundId: refundData.id
      });

      return c.json({ success: true, refundId: refundData.id, refund: refundData });
    } catch (error) {
      console.error('Refund processing error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Submit Satisfaction Survey
  app.post("/make-server-3dd53475/crm/survey", async (c) => {
    try {
      const { ticketId, rating, feedback } = await c.req.json();
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);

      ticket.satisfactionRating = rating;
      ticket.satisfactionFeedback = feedback;
      ticket.surveySubmittedAt = new Date().toISOString();
      await kv.set(`ticket:${ticketId}`, ticket);

      // Update stats
      const allTickets = await kv.getByPrefix('ticket:') || [];
      const ratedTickets = allTickets.filter((t: any) => t.satisfactionRating);
      const avgRating = ratedTickets.length > 0
        ? Math.round((ratedTickets.reduce((sum: number, t: any) => sum + (t.satisfactionRating || 0), 0) / ratedTickets.length) * 20)
        : 0;

      return c.json({ success: true, averageRating: avgRating });
    } catch (error) {
      console.error('Survey submission error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get Agent Performance Metrics
  app.get("/make-server-3dd53475/crm/analytics/agents", async (c) => {
    try {
      const allTickets = await kv.getByPrefix('ticket:') || [];
      
      // Group by agent
      const agentStats: Record<string, any> = {};
      
      allTickets.forEach((ticket: any) => {
        const agentId = ticket.assignedAgent || ticket.assignedTo || 'unassigned';
        if (!agentStats[agentId]) {
          agentStats[agentId] = {
            agentId,
            agentName: agentId,
            totalTickets: 0,
            resolved: 0,
            avgResponseTime: 0,
            avgResolutionTime: 0,
            satisfaction: 0
          };
        }
        
        agentStats[agentId].totalTickets++;
        if (ticket.status === 'resolved') {
          agentStats[agentId].resolved++;
        }
        if (ticket.satisfactionRating) {
          const currentAvg = agentStats[agentId].satisfaction || 0;
          const count = agentStats[agentId].resolved || 1;
          agentStats[agentId].satisfaction = Math.round(((currentAvg * (count - 1)) + (ticket.satisfactionRating * 20)) / count);
        }
      });

      // Calculate averages
      Object.values(agentStats).forEach((stats: any) => {
        stats.resolutionRate = stats.totalTickets > 0 
          ? Math.round((stats.resolved / stats.totalTickets) * 100) 
          : 0;
      });

      return c.json({ metrics: Object.values(agentStats) });
    } catch (error) {
      console.error('Get agent metrics error:', error);
      return c.json({ metrics: [], error: String(error) }, 500);
    }
  });

  // Automated Ticket Routing
  app.post("/make-server-3dd53475/crm/tickets/auto-route", async (c) => {
    try {
      const { ticketId } = await c.req.json();
      
      const ticket = await kv.get(`ticket:${ticketId}`);
      if (!ticket) return c.json({ error: "Ticket not found" }, 404);

      // Routing logic based on category and priority
      let assignedAgent = null;
      
      // Get available agents
      const agents = await kv.get('support:agents') || [
        { id: 'agent_1', name: 'Support Agent 1', specialties: ['general', 'billing'], workload: 0 },
        { id: 'agent_2', name: 'Support Agent 2', specialties: ['technical', 'order'], workload: 0 },
        { id: 'agent_3', name: 'Support Agent 3', specialties: ['refund', 'billing'], workload: 0 }
      ];

      // Route based on category
      if (ticket.category === 'refund' || ticket.category === 'billing') {
        assignedAgent = agents.find((a: any) => a.specialties?.includes('billing') || a.specialties?.includes('refund'));
      } else if (ticket.category === 'technical') {
        assignedAgent = agents.find((a: any) => a.specialties?.includes('technical'));
      } else if (ticket.category === 'order') {
        assignedAgent = agents.find((a: any) => a.specialties?.includes('order'));
      }

      // If no category match, assign to agent with lowest workload
      if (!assignedAgent) {
        assignedAgent = agents.reduce((min: any, agent: any) => 
          (agent.workload || 0) < (min.workload || 0) ? agent : min
        );
      }

      // Update ticket
      ticket.assignedTo = assignedAgent.id;
      ticket.assignedAgent = assignedAgent.name;
      ticket.status = 'in_progress';
      await kv.set(`ticket:${ticketId}`, ticket);

      // Send notification to agent
      await sendTicketNotification(kv, {
        ticketId,
        type: 'ticket_assigned',
        agentId: assignedAgent.id,
        agentEmail: assignedAgent.email
      });

      return c.json({ success: true, assignedAgent: assignedAgent.id });
    } catch (error) {
      console.error('Auto-route error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Helper: Send Ticket Notifications
  async function sendTicketNotification(kv: any, data: {
    ticketId: string;
    type: string;
    customerEmail?: string;
    customerPhone?: string;
    agentId?: string;
    agentEmail?: string;
    amount?: number;
    refundId?: string;
  }) {
    try {
      const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const notification = {
        id: notificationId,
        ticketId: data.ticketId,
        type: data.type,
        recipientEmail: data.customerEmail || data.agentEmail,
        recipientPhone: data.customerPhone,
        channels: { email: true, sms: !!data.customerPhone, inApp: true },
        status: 'pending',
        createdAt: new Date().toISOString(),
        data: {
          amount: data.amount,
          refundId: data.refundId
        }
      };

      await kv.set(`notification:${notificationId}`, notification);
      
      // Queue for email/SMS sending (would integrate with actual notification service)
      console.log(`📧 Notification queued: ${notificationId} for ticket ${data.ticketId}`);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }
}