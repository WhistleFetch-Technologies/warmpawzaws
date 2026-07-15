import type { Context } from 'hono';
import * as holidays_buildpackage_postRepo from '../repos/holidays_buildpackage_post.repo';
import { Hono } from 'hono';
import { isValidUUID } from '../../../../types/entities';

export async function executeholidaysBuildpackagePost(c: Context) {
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
      const customPackage = await holidays_buildpackage_postRepo.dbHolidaysBuildpackagePost0(customerId, destination, startDate, endDate, durationDays, numberOfPets, JSON, accommodationType, specialRequests, estimatedPrice).catch(async () => {
        // Create table if not exists
        await holidays_buildpackage_postRepo.dbHolidaysBuildpackagePost1()
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