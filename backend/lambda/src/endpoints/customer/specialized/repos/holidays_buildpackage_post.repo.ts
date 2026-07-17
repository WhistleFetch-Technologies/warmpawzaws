import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbHolidaysBuildpackagePost0(customerId, destination, startDate, endDate, durationDays, numberOfPets, petTypes, activities, accommodationType, specialRequests, estimatedPrice) {
  return await insert('holiday_custom_requests', {
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
      })
}

export async function dbHolidaysBuildpackagePost1() {
  return await query(`
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
}

