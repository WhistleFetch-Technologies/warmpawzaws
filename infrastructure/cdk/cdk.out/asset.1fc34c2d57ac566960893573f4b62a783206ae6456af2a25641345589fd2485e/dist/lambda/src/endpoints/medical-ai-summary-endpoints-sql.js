"use strict";
/**
 * ============================================================================
 * MEDICAL AI SUMMARY ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Generates AI-powered consultation summaries for doctors after booking completion
 * Uses AWS Bedrock for medical report summarization
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMedicalAISummaryEndpoints = registerMedicalAISummaryEndpoints;
const response_utils_1 = require("./response-utils");
const db_1 = require("../lib/db");
const repositories_1 = require("../lib/repositories");
const bedrock_client_1 = require("../lib/utils/bedrock-client");
const BASE_PATH = '/make-server-3dd53475';
function registerMedicalAISummaryEndpoints(app) {
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
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // Verify booking is completed
            if (booking.status !== 'completed') {
                return (0, response_utils_1.sendError)(c, 'Can only generate summary for completed bookings', 400);
            }
            // Verify vendor/doctor has access
            if (booking.vendor_id !== vendorId && booking.staff_id !== doctorId) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized: You do not have access to this booking', 403);
            }
            // ✅ SQL: Get pet details
            const petsRepo = (0, repositories_1.getPetsRepository)();
            const pet = booking.pet_id ? await petsRepo.findById(booking.pet_id) : null;
            // ✅ SQL: Get prescription if exists
            const pool = await (0, db_1.getDbClient)();
            const prescriptionResult = await pool.query('SELECT * FROM prescription_submissions WHERE booking_id = $1 LIMIT 1', [bookingId]);
            const prescription = prescriptionResult.rows[0] || null;
            // ✅ SQL: Get consultation notes (from booking metadata or consultation_notes table)
            const consultationNotes = booking.metadata?.consultation_notes || booking.notes || '';
            // Build context for AI
            const consultationContext = {
                pet: {
                    name: pet?.name || 'Unknown',
                    type: pet?.type || 'Unknown',
                    breed: pet?.breed || 'Unknown',
                    age: pet?.age || 'Unknown',
                },
                consultation: {
                    date: booking.booking_date || booking.scheduled_date || '',
                    time: booking.booking_time || booking.scheduled_time || '',
                    serviceName: booking.service_name || '',
                    doctorName: booking.staff_name || '',
                    clinicName: booking.vendor_name || '',
                },
                symptoms: booking.metadata?.symptoms || [],
                diagnosis: prescription?.diagnosis || booking.metadata?.diagnosis || '',
                medications: prescription?.medications || [],
                vitals: booking.metadata?.vitals || {},
                notes: consultationNotes,
            };
            // Generate AI summary using Bedrock
            let aiSummary = null;
            try {
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

Generate the summary in JSON format.`;
                const completion = await (0, bedrock_client_1.invokeBedrock)(userPrompt, systemPrompt, {
                    maxTokens: 2048,
                    temperature: 0.3,
                    topP: 0.9,
                });
                // Extract JSON from response
                try {
                    const jsonMatch = completion.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiSummary = JSON.parse(jsonMatch[0]);
                        aiSummary.aiGenerated = true;
                    }
                    else {
                        throw new Error('No JSON found in response');
                    }
                }
                catch (parseError) {
                    console.error('Failed to parse AI response as JSON:', parseError);
                    aiSummary = {
                        summary: completion,
                        diagnosis: consultationContext.diagnosis,
                        symptoms: consultationContext.symptoms,
                        vitalSigns: consultationContext.vitals,
                        treatmentPlan: prescription?.instructions || consultationContext.notes,
                        medications: consultationContext.medications,
                        followUpInstructions: prescription?.follow_up_instructions || '',
                        nextSteps: [],
                        prognosis: 'Good',
                        aiGenerated: true,
                    };
                }
                console.log('✅ [AI-SUMMARY] AI summary generated successfully');
            }
            catch (bedrockError) {
                console.error('❌ [AI-SUMMARY] Bedrock error:', bedrockError);
                // Fallback: Create basic summary without AI
                aiSummary = {
                    summary: `Consultation summary for ${consultationContext.pet.name} on ${consultationContext.consultation.date}`,
                    diagnosis: consultationContext.diagnosis || 'Pending diagnosis',
                    symptoms: consultationContext.symptoms,
                    vitalSigns: consultationContext.vitals,
                    treatmentPlan: prescription?.instructions || consultationContext.notes,
                    medications: consultationContext.medications,
                    followUpInstructions: prescription?.follow_up_instructions || '',
                    nextSteps: ['Follow up as recommended'],
                    prognosis: 'Good',
                    aiGenerated: false,
                    error: 'AI generation failed, using basic summary',
                };
            }
            // ✅ SQL: Create medical record
            const medicalRecordId = `medical_record_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const now = new Date().toISOString();
            const medicalRecord = {
                id: medicalRecordId,
                booking_id: bookingId,
                pet_id: booking.pet_id,
                customer_id: booking.customer_id,
                vendor_id: booking.vendor_id,
                doctor_id: booking.staff_id || doctorId,
                record_type: 'consultation_summary',
                title: `Consultation Summary - ${consultationContext.pet.name}`,
                summary: aiSummary.summary,
                diagnosis: aiSummary.diagnosis,
                symptoms: JSON.stringify(aiSummary.symptoms || []),
                vital_signs: JSON.stringify(aiSummary.vitalSigns || {}),
                treatment_plan: aiSummary.treatmentPlan,
                medications: JSON.stringify(aiSummary.medications || []),
                follow_up_instructions: aiSummary.followUpInstructions,
                next_steps: JSON.stringify(aiSummary.nextSteps || []),
                prognosis: aiSummary.prognosis,
                ai_generated: aiSummary.aiGenerated !== false,
                consultation_date: consultationContext.consultation.date,
                consultation_time: consultationContext.consultation.time,
                doctor_name: consultationContext.consultation.doctorName,
                clinic_name: consultationContext.consultation.clinicName,
                created_at: now,
                updated_at: now,
            };
            // Save medical record
            await (0, db_1.insertQuery)('medical_records', medicalRecord);
            console.log(`✅ [AI-SUMMARY] Medical record created: ${medicalRecordId}`);
            return (0, response_utils_1.sendSuccess)(c, {
                medicalRecordId,
                medicalRecord: {
                    ...medicalRecord,
                    symptoms: aiSummary.symptoms,
                    vitalSigns: aiSummary.vitalSigns,
                    medications: aiSummary.medications,
                    nextSteps: aiSummary.nextSteps,
                },
                aiGenerated: aiSummary.aiGenerated !== false,
            });
        }
        catch (error) {
            console.error('❌ [AI-SUMMARY] Error:', error);
            return (0, response_utils_1.sendError)(c, error.message || 'Failed to generate AI summary', 500);
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
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, 'Booking not found', 404);
            }
            // Verify access (P2P: vendor or customer only)
            const isVendor = requesterType === 'vendor' && (booking.vendor_id === requesterId || booking.staff_id === requesterId);
            const isCustomer = requesterType === 'customer' && booking.customer_id === requesterId;
            if (!isVendor && !isCustomer) {
                return (0, response_utils_1.sendError)(c, 'Unauthorized: Access denied', 403);
            }
            // ✅ SQL: Get medical records for this booking
            const pool = await (0, db_1.getDbClient)();
            const recordsResult = await pool.query('SELECT * FROM medical_records WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1', [bookingId]);
            if (recordsResult.rows.length === 0) {
                return (0, response_utils_1.sendSuccess)(c, {
                    summary: null,
                    message: 'No medical summary available. Generate one using POST /medical-records/:bookingId/generate-ai-summary',
                });
            }
            const record = recordsResult.rows[0];
            const medicalRecord = {
                ...record,
                symptoms: typeof record.symptoms === 'string' ? JSON.parse(record.symptoms) : record.symptoms,
                vitalSigns: typeof record.vital_signs === 'string' ? JSON.parse(record.vital_signs) : record.vital_signs,
                medications: typeof record.medications === 'string' ? JSON.parse(record.medications) : record.medications,
                nextSteps: typeof record.next_steps === 'string' ? JSON.parse(record.next_steps) : record.next_steps,
            };
            return (0, response_utils_1.sendSuccess)(c, {
                medicalRecord,
                isAIGenerated: medicalRecord.ai_generated !== false,
            });
        }
        catch (error) {
            console.error('❌ [AI-SUMMARY] Error:', error);
            return (0, response_utils_1.sendError)(c, error.message || 'Failed to fetch summary', 500);
        }
    });
}
//# sourceMappingURL=medical-ai-summary-endpoints-sql.js.map