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

export async function holidaysBuildpackagePostHandler(c: Context) {
    try {
      const body = await c.req.json();
      const {
        customerId,
        destination,
        startDate,
        endDate,
        numberOfPets,
        petTypes,
        accommodationType,
        activities,
        specialRequests,
      } = body;

      // Calculate duration
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate estimated price based on selections
      let basePrice = 5000; // Base per pet per day
      if (accommodationType === 'premium') basePrice = 8000;
      if (accommodationType === 'luxury') basePrice = 12000;

      const activityCost = (activities?.length || 0) * 1500;
      const estimatedPrice = (basePrice * durationDays * (numberOfPets || 1)) + activityCost;

      // Save custom package request
      const customPackage = await insert('holiday_custom_requests', {
        customer_id: customerId,
        destination: destination,
        start_date: startDate,
        end_date: endDate,
        duration_days: durationDays,
        number_of_pets: numberOfPets || 1,
        pet_types: JSON.stringify(petTypes || ['dog']),
        accommodation_type: accommodationType || 'standard',
        activities: JSON.stringify(activities || []),
        special_requests: specialRequests,
        estimated_price: estimatedPrice,
        status: 'pending_quote',
      }).catch(async () => {
        // Create table if not exists
        await query(`
          CREATE TABLE IF NOT EXISTS holiday_custom_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID,
            destination VARCHAR(255),
            start_date DATE,
            end_date DATE,
            duration_days INTEGER,
            number_of_pets INTEGER DEFAULT 1,
            pet_types JSONB,
            accommodation_type VARCHAR(50),
            activities JSONB,
            special_requests TEXT,
            estimated_price DECIMAL(10,2),
            final_price DECIMAL(10,2),
            status VARCHAR(50) DEFAULT 'pending_quote',
            vendor_id UUID,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        return insert('holiday_custom_requests', {
          customer_id: customerId,
          destination: destination,
          start_date: startDate,
          end_date: endDate,
          duration_days: durationDays,
          number_of_pets: numberOfPets || 1,
          pet_types: JSON.stringify(petTypes || ['dog']),
          accommodation_type: accommodationType || 'standard',
          activities: JSON.stringify(activities || []),
          special_requests: specialRequests,
          estimated_price: estimatedPrice,
          status: 'pending_quote',
        });
      });

      return c.json({
        success: true,
        customPackage: {
          ...customPackage[0],
          estimatedPrice,
          durationDays,
        },
        message: 'Custom package request submitted. We will send you quotes shortly.',
      });
    } catch (error: any) {
      console.error('Error building custom package:', error);
      return c.json({ error: error.message }, 500);
    }
}
