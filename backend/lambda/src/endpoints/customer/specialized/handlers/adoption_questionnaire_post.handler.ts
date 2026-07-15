import type { Context } from 'hono';
/**
 * ============================================================================
 * SPECIALIZED SERVICE FLOWS - 360 DEGREE CUSTOMER-VENDOR MATCHING
 * ============================================================================
 * 
 * Complete end-to-end flows for specialized pet services:
 * - Adoption: Pet catalog, adoption requests, applications
 * - Breeder: Puppy listings, purchase inquiries, reservations
 * - Peer to Peer: Pet matching, match requests, messaging
 * - Pet Holidays: Package builder, bookings, itinerary
 * - Relocation: Quote calculator, booking, tracking
 * 
 * Date: 2026-01-19
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../../../../database/rds-connection';
import { isValidUUID } from '../../../../types/entities';

export async function adoptionQuestionnairePostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const {
        customerPhone,
        customerId,
        petId,
        vendorId,
        experience,
        livingSituation,
        otherPets,
        timeCommitment,
        reason,
        additionalInfo,
      } = body;

      if (!customerPhone && !customerId) {
        return c.json({ error: 'Customer phone or ID is required' }, 400);
      }

      // Get customer ID from phone if not provided
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId && customerPhone) {
        const customers = await query(`SELECT id FROM customers WHERE phone = $1`, [customerPhone]);
        if (customers.rows.length > 0) {
          resolvedCustomerId = customers.rows[0].id;
        }
      }

      // Get pet and vendor info
      let resolvedVendorId = vendorId;
      if (petId && !resolvedVendorId) {
        const pets = await query(`SELECT vendor_id FROM pets WHERE id = $1`, [petId]);
        if (pets.rows.length > 0) {
          resolvedVendorId = pets.rows[0].vendor_id;
        }
      }

      // Create adoption application
      const application = await insert('adoption_applications', {
        customer_id: resolvedCustomerId,
        customer_phone: customerPhone,
        pet_id: petId,
        vendor_id: resolvedVendorId,
        experience: experience,
        living_situation: livingSituation,
        other_pets: otherPets,
        time_commitment: timeCommitment,
        reason: reason,
        additional_info: additionalInfo,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      }).catch(async () => {
        // Table might not exist, create it
        await query(`
          CREATE TABLE IF NOT EXISTS adoption_applications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID,
            customer_phone VARCHAR(20),
            pet_id UUID,
            vendor_id UUID,
            experience VARCHAR(50),
            living_situation VARCHAR(50),
            other_pets VARCHAR(50),
            time_commitment VARCHAR(50),
            reason TEXT,
            additional_info TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            submitted_at TIMESTAMP DEFAULT NOW(),
            reviewed_at TIMESTAMP,
            reviewer_notes TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('adoption_applications', {
          customer_id: resolvedCustomerId,
          customer_phone: customerPhone,
          pet_id: petId,
          vendor_id: resolvedVendorId,
          experience: experience,
          living_situation: livingSituation,
          other_pets: otherPets,
          time_commitment: timeCommitment,
          reason: reason,
          additional_info: additionalInfo,
          status: 'pending',
        });
      });

      return c.json({
        success: true,
        applicationId: application[0]?.id,
        message: 'Adoption application submitted successfully',
      });
    } catch (error: any) {
      console.error('Error submitting adoption application:', error);
      return c.json({ error: error.message }, 500);
    }
}
