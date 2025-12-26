/**
 * MEDICAL RECORDS AI SUMMARY ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Generates AI-powered consultation summaries for doctors after booking completion
 * Uses AWS Bedrock (configured in admin portal) to generate summaries
 * 
 * Features:
 * - AI summary generation from consultation notes, prescriptions, vitals
 * - Medical record storage
 * - P2P access (vendor ↔ customer)
 * - Integration with booking lifecycle
 * 
 * Date: 2025-01-27
 * Migration: KV to SQL (15 KV operations → 0)
 * Endpoints: 2
 */

import { Hono } from "npm:hono";
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getPlatformSettingsRepository } from '../../lib/repositories/platform-settings.ts';
import { BedrockRuntimeClient, InvokeModelCommand } from "npm:@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "npm:@smithy/node-http-handler";
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerMedicalAISummaryEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const db = getDbClient();

  /**
   * Helper: Get AWS Bedrock Client
   */
  async function getBedrockClient() {
    // ✅ SQL: Get AWS settings from platform_settings
    const settingsRepo = getPlatformSettingsRepository();
    const awsSettings = await settingsRepo.getSetting('aws');
    
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

      // ✅ SQL: Get booking details
      const booking = await getBookingsRepository().findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // 2. Verify booking is completed
      if (booking.status !== 'completed') {
        return sendError(c, 'Can only generate summary for completed bookings', 400);
      }

      // 3. Verify vendor/doctor has access
      if (booking.vendor_id !== vendorId && booking.staff_id !== doctorId) {
        return sendError(c, 'Unauthorized: You do not have access to this booking', 403);
      }

      // ✅ SQL: Get pet details
      const petId = booking.pet_id;
      const pet = petId ? await getPetsRepository().findById(petId) : null;
      
      // ✅ SQL: Get prescription if exists
      const { data: prescriptionData } = await db
        .from('prescription_submissions')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();
      
      const prescription = prescriptionData ? {
        id: prescriptionData.id,
        diagnosis: prescriptionData.diagnosis,
        medications: prescriptionData.medications || [],
        instructions: prescriptionData.instructions,
        followUpInstructions: prescriptionData.follow_up_instructions
      } : null;
      
      // ✅ SQL: Get chat messages if exists (from chat table or metadata)
      const chatMessages: any[] = [];
      // Note: Chat messages might be in a separate table or in booking metadata
      const bookingMetadata = booking.metadata as any;
      if (bookingMetadata?.chatMessages) {
        chatMessages.push(...bookingMetadata.chatMessages);
      }
      
      // Get vitals from booking metadata
      const vitals = bookingMetadata?.vitals || bookingMetadata?.vitalSigns || {};

      // 5. Build context for AI
      const consultationContext = {
        pet: {
          name: pet?.name || bookingMetadata?.petName,
          type: pet?.species || bookingMetadata?.petType,
          breed: pet?.breed || bookingMetadata?.petBreed,
          age: pet?.age_years ? `${pet.age_years} years` : bookingMetadata?.petAge
        },
        consultation: {
          date: booking.booking_date,
          time: booking.booking_time,
          serviceName: booking.service_name,
          doctorName: bookingMetadata?.staffName || bookingMetadata?.vendorName,
          clinicName: bookingMetadata?.vendorBusinessName || bookingMetadata?.vendorName
        },
        symptoms: bookingMetadata?.symptoms || bookingMetadata?.complaints || [],
        diagnosis: prescription?.diagnosis || bookingMetadata?.diagnosis || '',
        medications: prescription?.medications || [],
        vitals: vitals,
        notes: bookingMetadata?.notes || bookingMetadata?.consultationNotes || '',
        chatHistory: chatMessages.slice(-10).map((msg: any) => ({
          sender: msg.senderName || msg.sender,
          message: msg.message || msg.text,
          timestamp: msg.timestamp || msg.created_at
        }))
      };

      // 6. Generate AI summary using Bedrock
      let aiSummary = null;
      try {
        const bedrockClient = await getBedrockClient();
        const settingsRepo = getPlatformSettingsRepository();
        const awsSettings = await settingsRepo.getSetting('aws');
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
          treatmentPlan: prescription?.instructions || consultationContext.notes || '',
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
        booking_id: bookingId,
        pet_id: petId,
        customer_id: booking.customer_id,
        vendor_id: booking.vendor_id,
        doctor_id: booking.staff_id || doctorId,
        record_type: 'consultation_summary',
        title: `Consultation Summary - ${consultationContext.pet.name}`,
        summary: aiSummary.summary,
        diagnosis: aiSummary.diagnosis,
        symptoms: aiSummary.symptoms || [],
        vital_signs: aiSummary.vitalSigns || {},
        treatment_plan: aiSummary.treatmentPlan,
        medications: aiSummary.medications || [],
        follow_up_instructions: aiSummary.followUpInstructions,
        next_steps: aiSummary.nextSteps || [],
        prognosis: aiSummary.prognosis,
        ai_generated: aiSummary.aiGenerated !== false,
        consultation_date: consultationContext.consultation.date,
        consultation_time: consultationContext.consultation.time,
        doctor_name: consultationContext.consultation.doctorName,
        clinic_name: consultationContext.consultation.clinicName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // ✅ SQL: Save medical record to medical_records table (or use platform_settings if table doesn't exist)
      // Check if medical_records table exists, otherwise use platform_settings
      try {
        await db
          .from('medical_records')
          .insert(medicalRecord);
      } catch (tableError: any) {
        // If table doesn't exist, use platform_settings
        if (tableError.message?.includes('does not exist') || tableError.code === '42P01') {
          console.warn('⚠️ medical_records table not found, using platform_settings');
          const settingsRepo = getPlatformSettingsRepository();
          await settingsRepo.setSetting(`medical_record:${medicalRecordId}`, medicalRecord, 'object');
        } else {
          throw tableError;
        }
      }

      // ✅ SQL: Update booking metadata with medical record reference
      const updatedMetadata = {
        ...bookingMetadata,
        medical_records: [...(bookingMetadata?.medical_records || []), medicalRecordId]
      };
      await getBookingsRepository().update(bookingId, {
        metadata: updatedMetadata
      });

      // ✅ SQL: Update pet metadata if pet exists
      if (petId && pet) {
        const petMetadata = (pet.metadata as any) || {};
        const petRecords = petMetadata.medical_records || [];
        petRecords.unshift(medicalRecordId);
        
        await getPetsRepository().update(petId, {
          metadata: {
            ...petMetadata,
            medical_records: petRecords
          }
        });
      }

      console.log(`✅ [AI-SUMMARY] Medical record created: ${medicalRecordId}`);

      return sendSuccess(c, {
        medicalRecordId,
        medicalRecord: {
          id: medicalRecord.id,
          bookingId: medicalRecord.booking_id,
          petId: medicalRecord.pet_id,
          summary: medicalRecord.summary,
          diagnosis: medicalRecord.diagnosis,
          aiGenerated: medicalRecord.ai_generated
        },
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

      // ✅ SQL: Get booking
      const booking = await getBookingsRepository().findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // 2. Verify access (P2P: vendor or customer only)
      const isVendor = requesterType === 'vendor' && (booking.vendor_id === requesterId || booking.staff_id === requesterId);
      const isCustomer = requesterType === 'customer' && booking.customer_id === requesterId;
      
      if (!isVendor && !isCustomer) {
        return sendError(c, 'Unauthorized: Access denied', 403);
      }

      // ✅ SQL: Get medical records for this booking
      const bookingMetadata = booking.metadata as any;
      const recordIds = bookingMetadata?.medical_records || [];

      if (recordIds.length === 0) {
        return sendSuccess(c, {
          summary: null,
          message: 'No medical summary available. Generate one using POST /medical-records/:bookingId/generate-ai-summary'
        });
      }

      // ✅ SQL: Get the most recent record
      const latestRecordId = recordIds[0];
      
      // Try to get from medical_records table first
      let medicalRecord: any = null;
      try {
        const { data: recordData } = await db
          .from('medical_records')
          .select('*')
          .eq('id', latestRecordId)
          .single();
        
        if (recordData) {
          medicalRecord = {
            id: recordData.id,
            bookingId: recordData.booking_id,
            petId: recordData.pet_id,
            summary: recordData.summary,
            diagnosis: recordData.diagnosis,
            symptoms: recordData.symptoms,
            vitalSigns: recordData.vital_signs,
            treatmentPlan: recordData.treatment_plan,
            medications: recordData.medications,
            followUpInstructions: recordData.follow_up_instructions,
            nextSteps: recordData.next_steps,
            prognosis: recordData.prognosis,
            aiGenerated: recordData.ai_generated,
            consultationDate: recordData.consultation_date,
            consultationTime: recordData.consultation_time,
            doctorName: recordData.doctor_name,
            clinicName: recordData.clinic_name,
            createdAt: recordData.created_at,
            updatedAt: recordData.updated_at
          };
        }
      } catch (tableError: any) {
        // If table doesn't exist, get from platform_settings
        if (tableError.message?.includes('does not exist') || tableError.code === '42P01') {
          const settingsRepo = getPlatformSettingsRepository();
          medicalRecord = await settingsRepo.getSetting(`medical_record:${latestRecordId}`);
        } else {
          throw tableError;
        }
      }

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

  console.log('✅ Medical AI summary endpoints registered (SQL-only)');
}

