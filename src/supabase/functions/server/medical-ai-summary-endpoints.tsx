/**
 * MEDICAL RECORDS AI SUMMARY ENDPOINTS
 * 
 * Generates AI-powered consultation summaries for doctors after booking completion
 * Uses AWS Bedrock (configured in admin portal) to generate summaries
 * 
 * Features:
 * - AI summary generation from consultation notes, prescriptions, vitals
 * - Medical record storage
 * - P2P access (vendor ↔ customer)
 * - Integration with booking lifecycle
 */

import { Hono } from "hono";
import * as kv from "./kv_store";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { sendSuccess, sendError } from "./response-utils";

export function registerMedicalAISummaryEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * Helper: Get AWS Bedrock Client
   */
  async function getBedrockClient() {
    const awsSettings = await kv.get('admin:settings:aws');
    
    if (!awsSettings?.bedrock?.enabled) {
      throw new Error('AWS Bedrock is not enabled. Please configure it in Admin Portal → Platform Settings → Cloud & Maps → AWS → AI');
    }

    if (!awsSettings.credentials?.accessKeyId || !awsSettings.credentials?.secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    const region = awsSettings.bedrock.region || 'ap-south-1';
    let modelId = awsSettings.bedrock.modelId || "us.amazon.nova-lite-v1:0";
    
    // Fix: Remap base Nova ID to US Cross-Region Inference Profile
    if (modelId === "amazon.nova-lite-v1:0") modelId = "us.amazon.nova-lite-v1:0";
    
    // Fix: US Inference Profiles are not accessible from ap-south-1
    if (modelId.startsWith('us.') && region === 'ap-south-1') {
      return new BedrockRuntimeClient({
        region: 'us-east-1',
        credentials: {
          accessKeyId: awsSettings.credentials.accessKeyId,
          secretAccessKey: awsSettings.credentials.secretAccessKey
        },
        requestHandler: new NodeHttpHandler({})
      });
    }

    return new BedrockRuntimeClient({
      region: region,
      credentials: {
        accessKeyId: awsSettings.credentials.accessKeyId,
        secretAccessKey: awsSettings.credentials.secretAccessKey
      },
      requestHandler: new NodeHttpHandler({})
    });
  }

  /**
   * POST /medical-records/:bookingId/generate-ai-summary
   * Generate AI summary for a completed consultation
   */
  app.post(`${BASE_PATH}/medical-records/:bookingId/generate-ai-summary`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, doctorId } = await c.req.json();

      console.log(`🤖 [AI-SUMMARY] Generating summary for booking: ${bookingId}`);

      // 1. Get booking details
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // 2. Verify booking is completed
      if (booking.status !== 'completed') {
        return sendError(c, 'Can only generate summary for completed bookings', 400);
      }

      // 3. Verify vendor/doctor has access
      if (booking.vendorId !== vendorId && booking.staffId !== doctorId) {
        return sendError(c, 'Unauthorized: You do not have access to this booking', 403);
      }

      // 4. Collect consultation data
      const petId = booking.petId || booking.petIds?.[0];
      const pet = await kv.get(`pet:${petId}`);
      
      // Get prescription if exists
      const prescription = await kv.get(`prescription:${bookingId}`);
      
      // Get chat messages if exists
      const chatMessages = await kv.get(`chat:booking:${bookingId}:messages`) || [];
      
      // Get vitals if exists
      const vitals = booking.vitals || booking.vitalSigns || {};

      // 5. Build context for AI
      const consultationContext = {
        pet: {
          name: pet?.name || booking.petName,
          type: pet?.type || booking.petType,
          breed: pet?.breed || booking.petBreed,
          age: pet?.age || booking.petAge
        },
        consultation: {
          date: booking.scheduledDate || booking.date,
          time: booking.scheduledTime || booking.time,
          serviceName: booking.serviceName,
          doctorName: booking.staffName || booking.vendorName,
          clinicName: booking.vendorBusinessName || booking.vendorName
        },
        symptoms: booking.symptoms || booking.complaints || [],
        diagnosis: prescription?.diagnosis || booking.diagnosis || '',
        medications: prescription?.medications || [],
        vitals: vitals,
        notes: booking.notes || booking.consultationNotes || '',
        chatHistory: chatMessages.slice(-10).map((msg: any) => ({
          sender: msg.senderName,
          message: msg.message,
          timestamp: msg.timestamp
        }))
      };

      // 6. Generate AI summary using Bedrock
      let aiSummary = null;
      try {
        const bedrockClient = await getBedrockClient();
        const awsSettings = await kv.get('admin:settings:aws');
        let modelId = awsSettings.bedrock.modelId || "us.amazon.nova-lite-v1:0";
        if (modelId === "amazon.nova-lite-v1:0") modelId = "us.amazon.nova-lite-v1:0";

        const systemPrompt = `You are a veterinary AI assistant. Generate a comprehensive medical summary for a pet consultation.

Generate a structured summary in JSON format with the following fields:
{
  "summary": "Brief overview of the consultation",
  "diagnosis": "Primary diagnosis or findings",
  "symptoms": ["List of symptoms observed"],
  "vitalSigns": { "temperature": "...", "heartRate": "...", "respiratoryRate": "...", "weight": "..." },
  "treatmentPlan": "Treatment plan and recommendations",
  "medications": ["List of prescribed medications"],
  "followUpInstructions": "Follow-up care instructions",
  "nextSteps": ["Recommended next steps"],
  "prognosis": "Expected outcome"
}

Be concise, professional, and medically accurate.`;

        const userPrompt = `Generate a medical summary for this consultation:

Pet: ${consultationContext.pet.name} (${consultationContext.pet.type}, ${consultationContext.pet.breed}, ${consultationContext.pet.age})
Date: ${consultationContext.consultation.date} at ${consultationContext.consultation.time}
Doctor: ${consultationContext.consultation.doctorName}
Clinic: ${consultationContext.consultation.clinicName}

Symptoms: ${consultationContext.symptoms.join(', ') || 'Not specified'}
Diagnosis: ${consultationContext.diagnosis || 'Pending'}
Medications: ${consultationContext.medications.join(', ') || 'None'}
Vitals: ${JSON.stringify(consultationContext.vitals)}
Notes: ${consultationContext.notes}

Chat History (last 10 messages):
${consultationContext.chatHistory.map((c: any) => `${c.sender}: ${c.message}`).join('\n')}

Generate the summary in JSON format.`;

        const payload = {
          messages: [
            {
              role: "user",
              content: [{ text: userPrompt }]
            }
          ],
          system: [{ text: systemPrompt }],
          inferenceConfig: {
            max_new_tokens: 2048,
            temperature: 0.3,
            top_p: 0.9
          }
        };

        const command = new InvokeModelCommand({
          modelId: modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload)
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        
        // Extract summary from response
        const summaryText = responseBody.output?.text || responseBody.content?.[0]?.text || '';
        
        // Parse JSON from response
        try {
          const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            aiSummary = JSON.parse(jsonMatch[0]);
          } else {
            // Fallback: create structured summary from text
            aiSummary = {
              summary: summaryText,
              diagnosis: consultationContext.diagnosis,
              symptoms: consultationContext.symptoms,
              vitalSigns: consultationContext.vitals,
              treatmentPlan: prescription?.instructions || '',
              medications: consultationContext.medications,
              followUpInstructions: prescription?.followUpInstructions || '',
              nextSteps: [],
              prognosis: 'Good'
            };
          }
        } catch (parseError) {
          console.error('Failed to parse AI response as JSON:', parseError);
          // Fallback structured summary
          aiSummary = {
            summary: summaryText,
            diagnosis: consultationContext.diagnosis,
            symptoms: consultationContext.symptoms,
            vitalSigns: consultationContext.vitals,
            treatmentPlan: prescription?.instructions || '',
            medications: consultationContext.medications,
            followUpInstructions: prescription?.followUpInstructions || '',
            nextSteps: [],
            prognosis: 'Good'
          };
        }

        console.log('✅ [AI-SUMMARY] AI summary generated successfully');
      } catch (bedrockError: any) {
        console.error('❌ [AI-SUMMARY] Bedrock error:', bedrockError);
        // Fallback: Create basic summary without AI
        aiSummary = {
          summary: `Consultation summary for ${consultationContext.pet.name} on ${consultationContext.consultation.date}`,
          diagnosis: consultationContext.diagnosis || 'Pending diagnosis',
          symptoms: consultationContext.symptoms,
          vitalSigns: consultationContext.vitals,
          treatmentPlan: prescription?.instructions || booking.notes || '',
          medications: consultationContext.medications,
          followUpInstructions: prescription?.followUpInstructions || '',
          nextSteps: ['Follow up as recommended'],
          prognosis: 'Good',
          aiGenerated: false,
          error: 'AI generation failed, using basic summary'
        };
      }

      // 7. Create medical record
      const medicalRecordId = `medical_record_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const medicalRecord = {
        id: medicalRecordId,
        bookingId: bookingId,
        petId: petId,
        customerId: booking.customerId || booking.customerPhone,
        vendorId: booking.vendorId,
        doctorId: booking.staffId || doctorId,
        recordType: 'consultation_summary',
        title: `Consultation Summary - ${consultationContext.pet.name}`,
        summary: aiSummary.summary,
        diagnosis: aiSummary.diagnosis,
        symptoms: aiSummary.symptoms || [],
        vitalSigns: aiSummary.vitalSigns || {},
        treatmentPlan: aiSummary.treatmentPlan,
        medications: aiSummary.medications || [],
        followUpInstructions: aiSummary.followUpInstructions,
        nextSteps: aiSummary.nextSteps || [],
        prognosis: aiSummary.prognosis,
        aiGenerated: aiSummary.aiGenerated !== false,
        consultationDate: consultationContext.consultation.date,
        consultationTime: consultationContext.consultation.time,
        doctorName: consultationContext.consultation.doctorName,
        clinicName: consultationContext.consultation.clinicName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 8. Save medical record
      await kv.set(`medical_record:${medicalRecordId}`, medicalRecord);
      
      // Add to pet's medical records
      const petRecordsKey = `pet:${petId}:medical_records`;
      const petRecords = await kv.get(petRecordsKey) || [];
      petRecords.unshift(medicalRecordId);
      await kv.set(petRecordsKey, petRecords);

      // Add to booking's medical records
      const bookingRecordsKey = `booking:${bookingId}:medical_records`;
      const bookingRecords = await kv.get(bookingRecordsKey) || [];
      bookingRecords.unshift(medicalRecordId);
      await kv.set(bookingRecordsKey, bookingRecords);

      // Link to prescription if exists
      if (prescription) {
        await kv.set(`prescription:${prescription.id}:medical_record:${medicalRecordId}`, true);
      }

      console.log(`✅ [AI-SUMMARY] Medical record created: ${medicalRecordId}`);

      return sendSuccess(c, {
        medicalRecordId,
        medicalRecord,
        aiGenerated: aiSummary.aiGenerated !== false
      });

    } catch (error: any) {
      console.error('❌ [AI-SUMMARY] Error:', error);
      return sendError(c, error.message || 'Failed to generate AI summary', 500);
    }
  });

  /**
   * GET /medical-records/:bookingId/summary
   * Get AI summary for a booking (P2P access: vendor ↔ customer)
   */
  app.get(`${BASE_PATH}/medical-records/:bookingId/summary`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const requesterId = c.req.header('X-User-Id');
      const requesterType = c.req.header('X-User-Type'); // 'vendor' | 'customer'

      console.log(`📋 [AI-SUMMARY] Fetching summary for booking: ${bookingId}`);

      // 1. Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // 2. Verify access (P2P: vendor or customer only)
      const isVendor = requesterType === 'vendor' && (booking.vendorId === requesterId || booking.staffId === requesterId);
      const isCustomer = requesterType === 'customer' && (booking.customerId === requesterId || booking.customerPhone === requesterId);
      
      if (!isVendor && !isCustomer) {
        return sendError(c, 'Unauthorized: Access denied', 403);
      }

      // 3. Get medical records for this booking
      const bookingRecordsKey = `booking:${bookingId}:medical_records`;
      const recordIds = await kv.get(bookingRecordsKey) || [];

      if (recordIds.length === 0) {
        return sendSuccess(c, {
          summary: null,
          message: 'No medical summary available. Generate one using POST /medical-records/:bookingId/generate-ai-summary'
        });
      }

      // 4. Get the most recent record
      const latestRecordId = recordIds[0];
      const medicalRecord = await kv.get(`medical_record:${latestRecordId}`);

      if (!medicalRecord) {
        return sendError(c, 'Medical record not found', 404);
      }

      return sendSuccess(c, {
        medicalRecord,
        isAIGenerated: medicalRecord.aiGenerated !== false
      });

    } catch (error: any) {
      console.error('❌ [AI-SUMMARY] Error:', error);
      return sendError(c, error.message || 'Failed to fetch summary', 500);
    }
  });
}

