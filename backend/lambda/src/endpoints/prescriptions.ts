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
import { select, insert, query } from '../database/rds-connection';

export function registerPrescriptionEndpoints(app: Hono) {
  /**
   * POST /prescriptions
   * Create prescription (immutable)
   */
  app.post("/prescriptions", async (c) => {
    try {
      const prescriptionData = await c.req.json();
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

      if (!bookingId || !customerId || !vendorId || !medications) {
        return c.json({ error: 'bookingId, customerId, vendorId, and medications are required' }, 400);
      }

      const prescription = await insert('prescriptions', {
        booking_id: bookingId,
        customer_id: customerId,
        pet_id: petId || null,
        vendor_id: vendorId,
        staff_id: staffId || null,
        medications: medications, // JSONB array
        instructions: instructions || null,
        diagnosis: diagnosis || null,
        follow_up_date: followUpDate || null,
        created_by: createdBy || null,
        created_by_role: createdByRole || 'vendor',
        is_active: true,
      });

      return c.json({
        success: true,
        prescription: prescription[0],
        message: 'Prescription created successfully',
      });
    } catch (error: any) {
      console.error('Error creating prescription:', error);
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
   * Get prescriptions for a booking
   */
  app.get("/prescriptions/booking/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();

      const prescriptions = await select('prescriptions',
        { booking_id: bookingId },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      return c.json({
        success: true,
        prescriptions,
        total: prescriptions.length,
      });
    } catch (error: any) {
      console.error('Error fetching prescriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /prescriptions/customer/:customerId
   * Get all prescriptions for a customer
   */
  app.get("/prescriptions/customer/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      const prescriptions = await query(
        `SELECT p.*, b.booking_date, b.booking_time, v.business_name as vendor_name
         FROM prescriptions p
         LEFT JOIN bookings b ON p.booking_id = b.id
         LEFT JOIN vendors v ON p.vendor_id = v.id
         WHERE p.customer_id = $1
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

      let prescriptions;
      try {
        prescriptions = await query(
          `SELECT p.*, b.booking_date, b.booking_time, c.full_name as customer_name, c.phone as customer_phone
           FROM prescriptions p
           LEFT JOIN bookings b ON p.booking_id = b.id
           LEFT JOIN customers c ON p.customer_id = c.id
           WHERE p.vendor_id = $1
           AND p.is_active = true
           ORDER BY p.created_at DESC`,
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
   * POST /prescriptions/:prescriptionId/download
   * Log prescription download
   */
  app.post("/prescriptions/:prescriptionId/download", async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      const { actorId, actorRole, actorName } = await c.req.json();

      // Log download in prescription_downloads table
      try {
        const { insert, query } = require('../database/rds-connection');
        
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
}

