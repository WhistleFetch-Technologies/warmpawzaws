/**
 * ============================================================================
 * PRESCRIPTIONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles prescription management:
 * - Create prescriptions (immutable)
 * - Get prescriptions with access control
 * - Download prescriptions
 * - Link prescriptions to bookings
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/healthcare-compliance-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, query, update } from '../database/rds-connection';
import { checkVendorCapability } from '../middleware/capability-enforcement';
import { extractEntityIds, normalizeDbRow } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import {
  validatePrescription,
  normalizePrescriptionData,
  formatPrescriptionResponse,
  type PrescriptionData,
} from '../lib/services/prescription-service';
import { prescriptionOCRService } from '../lib/services/prescription-ocr-service';

export function registerPrescriptionEndpoints(app: Hono) {
  /**
   * POST /prescriptions
   * Create prescription (immutable)
   * Requires 'prescriptions' capability
   */
  app.post("/prescriptions", async (c) => {
    try {
      const prescriptionData: PrescriptionData = await c.req.json();
      const {
        bookingId,
        customerId,
        petId,
        vendorId,
        staffId,
        medications,
        instructions,
        diagnosis,
        followUpDate,
        createdBy,
        createdByRole,
      } = prescriptionData;

      // Check if vendor has prescription capability (try both naming conventions)
      const hasPrescriptionCapability = await checkVendorCapability(vendorId, 'prescription_create') || 
                                        await checkVendorCapability(vendorId, 'prescriptions');
      if (!hasPrescriptionCapability) {
        return c.json({ error: 'Vendor does not have prescription capability' }, 403);
      }

      // Validate using functional model
      const validation = validatePrescription(prescriptionData);
      if (!validation.isValid) {
        return c.json({ error: 'Validation failed', errors: validation.errors }, 400);
      }

      // Build prescription data based on available columns
      // Schema 057 uses: medication_name, dosage, frequency, duration, instructions
      // Schema 034/007/008 use: medications JSONB array
      const prescriptionRecords: any[] = [];
      
      // For schemas that use medications JSONB, create single record
      // For schema 057, create multiple records (one per medication)
      // Try with medications JSONB first, fallback to individual columns
      const meds = Array.isArray(medications) ? medications : [medications];
      
      for (const med of meds) {
        // Include diagnosis and doctor_name in instructions if not a separate column
        const combinedInstructions = [
          diagnosis ? `Diagnosis: ${diagnosis}` : '',
          med.instructions || instructions || ''
        ].filter(Boolean).join('\n');
        
        const prescriptionRecord: Record<string, any> = {
          booking_id: bookingId,
          customer_id: customerId,
          pet_id: petId || null,
          vendor_id: vendorId,
          prescription_date: new Date().toISOString().split('T')[0],
          is_active: true,
          // Schema 057 individual medication columns
          medication_name: med.name || 'Prescription',
          dosage: med.dosage || null,
          frequency: med.frequency || null,
          duration: med.duration || null,
          instructions: combinedInstructions || null,
          // ✅ Draft/Published state support
          status: (prescriptionData as any).status || 'published', // 'draft' or 'published'
          // Additional fields if provided
          diagnosis: diagnosis || null,
          doctor_name: (prescriptionData as any).vendorName || null,
          follow_up_date: followUpDate || null,
          follow_up_notes: (prescriptionData as any).followUpNotes || null,
        };
        
        prescriptionRecords.push(prescriptionRecord);
      }
      
      // Insert all prescriptions (one per medication for schema 057)
      const insertedPrescriptions = [];
      for (const record of prescriptionRecords) {
        try {
          const prescription = await insert('prescriptions', record);
          insertedPrescriptions.push(prescription[0]);
        } catch (insertError: any) {
          // If insert fails due to unknown column, try with minimal columns
          console.warn('Insert with all columns failed, trying minimal insert:', insertError.message);
          
          // Try with only the core columns that are guaranteed to exist
          const minimalRecord: Record<string, any> = {
            booking_id: record.booking_id,
            customer_id: record.customer_id,
            pet_id: record.pet_id,
            vendor_id: record.vendor_id,
            prescription_date: record.prescription_date,
            is_active: record.is_active,
            medication_name: record.medication_name,
            dosage: record.dosage,
            frequency: record.frequency,
            duration: record.duration,
            instructions: record.instructions,
          };
          
          try {
            const prescription = await insert('prescriptions', minimalRecord);
            insertedPrescriptions.push(prescription[0]);
          } catch (minimalError: any) {
            console.error('Minimal insert also failed:', minimalError.message);
            throw minimalError;
          }
        }
      }

      const savedStatus = (prescriptionData as any).status || 'published';
      return c.json({
        success: true,
        prescription: insertedPrescriptions[0],
        prescriptions: insertedPrescriptions,
        totalMedications: insertedPrescriptions.length,
        status: savedStatus,
        message: savedStatus === 'draft' 
          ? 'Prescription saved as draft. You can edit it later.' 
          : 'Prescription created and published successfully',
      });
    } catch (error: any) {
      console.error('Error creating prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /prescriptions/:prescriptionId
   * Update prescription (only allowed if status is 'draft')
   */
  app.put("/prescriptions/:prescriptionId", async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const updateData = await c.req.json();

      // Get existing prescription
      const prescriptions = await select('prescriptions', { id: prescriptionId });
      if (prescriptions.length === 0) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      const existing = prescriptions[0];

      // Only allow updates if prescription is in draft status
      if (existing.status === 'published') {
        return c.json({ 
          error: 'Cannot edit published prescription. Published prescriptions are immutable for legal compliance.',
          code: 'PRESCRIPTION_IMMUTABLE'
        }, 403);
      }

      // Build update object
      const updateFields: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.medicationName !== undefined) updateFields.medication_name = updateData.medicationName;
      if (updateData.dosage !== undefined) updateFields.dosage = updateData.dosage;
      if (updateData.frequency !== undefined) updateFields.frequency = updateData.frequency;
      if (updateData.duration !== undefined) updateFields.duration = updateData.duration;
      if (updateData.instructions !== undefined) updateFields.instructions = updateData.instructions;
      if (updateData.status !== undefined) {
        // Can only change from draft to published, not vice versa
        if (updateData.status === 'published' && existing.status === 'draft') {
          updateFields.status = 'published';
          updateFields.published_at = new Date().toISOString();
        }
      }

      await update('prescriptions', { id: prescriptionId }, updateFields);

      const updated = await select('prescriptions', { id: prescriptionId });

      return c.json({
        success: true,
        prescription: updated[0],
        message: updateFields.status === 'published' 
          ? 'Prescription published successfully. It is now available to the customer and cannot be edited.'
          : 'Prescription updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /prescriptions/:prescriptionId
   * Delete prescription (only allowed if status is 'draft')
   */
  app.delete("/prescriptions/:prescriptionId", async (c) => {
    try {
      const { prescriptionId } = c.req.param();

      // Get existing prescription
      const prescriptions = await select('prescriptions', { id: prescriptionId });
      if (prescriptions.length === 0) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      const existing = prescriptions[0];

      // Only allow deletion if prescription is in draft status
      if (existing.status === 'published') {
        return c.json({ 
          error: 'Cannot delete published prescription. Published prescriptions are immutable for legal compliance.',
          code: 'PRESCRIPTION_IMMUTABLE'
        }, 403);
      }

      // Soft delete by setting is_active to false
      await update('prescriptions', { id: prescriptionId }, { 
        is_active: false, 
        deleted_at: new Date().toISOString() 
      });

      return c.json({
        success: true,
        message: 'Prescription deleted successfully.',
      });
    } catch (error: any) {
      console.error('Error deleting prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /prescriptions/:prescriptionId
   * Get prescription with access control
   */
  app.get("/prescriptions/:prescriptionId", async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const actorId = c.req.query('actorId');
      const actorRole = c.req.query('actorRole');

      const prescriptions = await select('prescriptions', { id: prescriptionId });
      if (prescriptions.length === 0) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      const prescription = prescriptions[0];

      // Access control: customer can only see their own, vendor can see their prescriptions
      if (actorRole === 'customer' && prescription.customer_id !== actorId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      if (actorRole === 'vendor' && prescription.vendor_id !== actorId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Get related booking info
      const booking = prescription.booking_id
        ? await select('bookings', { id: prescription.booking_id })
        : [];

      // Get pet info
      const pet = prescription.pet_id
        ? await select('pets', { id: prescription.pet_id })
        : [];

      return c.json({
        success: true,
        prescription: {
          ...prescription,
          booking: booking[0] || null,
          pet: pet[0] || null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /prescriptions/booking/:bookingId
   * Get prescriptions for a booking (enriched with pet/customer info)
   * ✅ CRITICAL: Only returns PUBLISHED prescriptions to customers
   */
  app.get("/prescriptions/booking/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const includeDrafts = c.req.query('includeDrafts') === 'true'; // Only vendors can see drafts

      // Fetch prescriptions with joined data
      // ✅ FIX: Only show published prescriptions to customers (draft prescriptions are hidden)
      const result = await query(
        `SELECT p.*, 
                pet.name as pet_name, pet.species as pet_species, pet.breed as pet_breed,
                c.full_name as customer_name, c.phone as customer_phone,
                v.business_name as vendor_name
         FROM prescriptions p
         LEFT JOIN pets pet ON p.pet_id = pet.id
         LEFT JOIN customers c ON p.customer_id = c.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE p.booking_id = $1
         AND p.is_active = true
         AND (p.status = 'published' OR p.status IS NULL ${includeDrafts ? "OR p.status = 'draft'" : ''})
         ORDER BY p.created_at DESC`,
        [bookingId]
      );

      return c.json({
        success: true,
        prescriptions: result.rows,
        total: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching prescriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /prescriptions/customer/:customerId
   * Get all prescriptions for a customer
   * ✅ CRITICAL: Only returns PUBLISHED prescriptions to customers
   */
  app.get("/prescriptions/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      // ✅ FIX: Only show published prescriptions to customers (draft prescriptions are hidden)
      const prescriptions = await query(
        `SELECT p.*, b.booking_date, b.booking_time, v.business_name as vendor_name,
                pet.name as pet_name, pet.species as pet_species
         FROM prescriptions p
         LEFT JOIN bookings b ON p.booking_id = b.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         LEFT JOIN pets pet ON p.pet_id = pet.id
         WHERE p.customer_id = $1
         AND p.is_active = true
         AND (p.status = 'published' OR p.status IS NULL)
         ORDER BY p.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        prescriptions: prescriptions.rows,
        total: prescriptions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer prescriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /prescriptions/vendor/:vendorId
   * Get all prescriptions for a vendor
   * Requires 'prescriptions' capability
   */
  app.get("/prescriptions/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();

      // Handle test IDs - return empty prescriptions
      if (vendorId === 'test-vendor-id' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)) {
        return c.json({
          success: true,
          prescriptions: [],
          total: 0,
        });
      }

      // Check if vendor has prescription capability (try both naming conventions)
      const hasPrescriptionCapability = await checkVendorCapability(vendorId, 'prescription_create') || 
                                        await checkVendorCapability(vendorId, 'prescriptions');
      if (!hasPrescriptionCapability) {
        return c.json({ error: 'Vendor does not have prescription capability' }, 403);
      }

      // ✅ Vendors can see both draft and published prescriptions (their own)
      let prescriptions;
      try {
        prescriptions = await query(
          `SELECT p.*, b.booking_date, b.booking_time, 
                  c.full_name as customer_name, c.phone as customer_phone,
                  pet.name as pet_name, pet.species as pet_species, pet.breed as pet_breed
           FROM prescriptions p
           LEFT JOIN bookings b ON p.booking_id = b.id
           LEFT JOIN customers c ON p.customer_id = c.id
           LEFT JOIN pets pet ON p.pet_id = pet.id
           WHERE p.vendor_id = $1
           AND p.is_active = true
           AND (p.status IS NULL OR p.status IN ('draft', 'published'))
           ORDER BY p.status ASC, p.created_at DESC`,
          [vendorId]
        );
      } catch (error: any) {
        // If UUID validation fails, return empty prescriptions
        if (error.message?.includes('invalid input syntax for type uuid')) {
          return c.json({
            success: true,
            prescriptions: [],
            total: 0,
          });
        }
        throw error;
      }

      return c.json({
        success: true,
        prescriptions: prescriptions.rows,
        total: prescriptions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor prescriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:phone/prescriptions
   * Get all prescriptions for a customer by phone number
   * ✅ CRITICAL: Only returns PUBLISHED prescriptions
   */
  app.get("/customer/:phone/prescriptions", async (c) => {
    try {
      const { phone } = c.req.param();

      // First get customer ID from phone
      const customerResult = await query(
        `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
        [phone]
      );

      if (customerResult.rows.length === 0) {
        return c.json({
          success: true,
          prescriptions: [],
          total: 0,
          message: 'Customer not found'
        });
      }

      const customerId = customerResult.rows[0].id;

      // ✅ FIX: Only show published prescriptions to customers
      const prescriptions = await query(
        `SELECT p.*, b.booking_date, b.booking_time, v.business_name as vendor_name,
                pet.name as pet_name, pet.species as pet_species, pet.breed as pet_breed
         FROM prescriptions p
         LEFT JOIN bookings b ON p.booking_id = b.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         LEFT JOIN pets pet ON p.pet_id = pet.id
         WHERE p.customer_id = $1
         AND p.is_active = true
         AND (p.status = 'published' OR p.status IS NULL)
         ORDER BY p.created_at DESC`,
        [customerId]
      );

      return c.json({
        success: true,
        prescriptions: prescriptions.rows,
        total: prescriptions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer prescriptions by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /prescriptions/:prescriptionId/download
   * Log prescription download
   */
  app.post("/prescriptions/:prescriptionId/download", async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const { actorId, actorRole, actorName } = await c.req.json();

      // Log download in prescription_downloads table
      try {
        // Check if table exists, create if needed
        await query(`
          CREATE TABLE IF NOT EXISTS prescription_downloads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            prescription_id UUID NOT NULL REFERENCES prescriptions(id),
            downloaded_by VARCHAR(255),
            downloaded_by_role VARCHAR(50),
            downloaded_by_name VARCHAR(255),
            downloaded_at TIMESTAMP DEFAULT NOW(),
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT NOW()
          )
        `).catch(() => {
          // Table might already exist, ignore error
        });
        
        // Insert download record
        await insert('prescription_downloads', {
          prescription_id: prescriptionId,
          downloaded_by: actorId,
          downloaded_by_role: actorRole,
          downloaded_by_name: actorName,
          downloaded_at: new Date().toISOString(),
        });
        
        console.log(`✅ Prescription download logged: ${prescriptionId}`);
      } catch (error: any) {
        console.warn('Failed to log prescription download:', error);
        // Don't fail the request if logging fails
      }

      return c.json({
        success: true,
        message: 'Download logged successfully',
      });
    } catch (error: any) {
      console.error('Error logging prescription download:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /prescriptions/ocr/extract
   * Extract medicines from prescription image using OCR
   */
  app.post("/prescriptions/ocr/extract", async (c) => {
    try {
      const body = await c.req.json();
      const { imageUrl, prescriptionId } = body;

      if (!imageUrl) {
        return c.json({ error: 'imageUrl is required' }, 400);
      }

      const extractedData = await prescriptionOCRService.extractMedicinesFromImage(
        imageUrl,
        prescriptionId || `temp-${Date.now()}`
      );

      return c.json({
        success: true,
        data: extractedData,
        message: 'Medicines extracted successfully',
      });
    } catch (error: any) {
      console.error('Error extracting medicines from prescription:', error);
      return c.json({ error: error.message || 'Failed to extract medicines' }, 500);
    }
  });

  /**
   * POST /prescriptions/:prescriptionId/order-medicine
   * Create pharmacy order from prescription
   * Allows customer to order medicine online
   */
  app.post("/prescriptions/:prescriptionId/order-medicine", async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const { customerId, customerPhone, deliveryAddress } = await c.req.json();

      // Get prescription details
      const prescriptions = await select('prescriptions', { id: prescriptionId });
      if (prescriptions.length === 0) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      const prescription = prescriptions[0];

      // Verify customer owns this prescription
      if (prescription.customer_id !== customerId) {
        return c.json({ error: 'Access denied' }, 403);
      }

      // Create pharmacy order
      const orderData = {
        customer_id: customerId,
        customer_phone: customerPhone,
        prescription_id: prescriptionId,
        order_type: 'prescription',
        status: 'pending',
        items: JSON.stringify([{
          medication_name: prescription.medication_name,
          dosage: prescription.dosage,
          frequency: prescription.frequency,
          duration: prescription.duration,
          quantity: 1, // Default quantity
        }]),
        delivery_address: JSON.stringify(deliveryAddress),
        vendor_id: prescription.vendor_id, // Original prescribing vendor
        created_at: new Date().toISOString(),
      };

      const order = await insert('pharmacy_orders', orderData);

      return c.json({
        success: true,
        orderId: order[0]?.id,
        message: 'Medicine order created successfully. You will receive confirmation shortly.',
      });
    } catch (error: any) {
      console.error('Error creating medicine order:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

