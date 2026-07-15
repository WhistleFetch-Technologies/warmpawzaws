import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhonePreferencesPost0(customer) {
  return await query(
        `SELECT id FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      )
}

export async function dbCustomerPhonePreferencesPost1(preferencesData, JSON, customer) {
  return await query(
          `UPDATE customer_preferences SET
            journey_type = COALESCE($1, journey_type),
            home_type = COALESCE($2, home_type),
            outdoor_space = COALESCE($3, outdoor_space),
            work_schedule = COALESCE($4, work_schedule),
            activity_level = COALESCE($5, activity_level),
            travel_frequency = COALESCE($6, travel_frequency),
            monthly_budget = COALESCE($7, monthly_budget),
            service_preferences = COALESCE($8, service_preferences),
            has_children = COALESCE($9, has_children),
            has_other_pets = COALESCE($10, has_other_pets),
            other_pet_types = COALESCE($11, other_pet_types),
            updated_at = NOW()
          WHERE customer_id = $12`,
          [
            preferencesData.journey_type,
            preferencesData.home_type,
            preferencesData.outdoor_space,
            preferencesData.work_schedule,
            preferencesData.activity_level,
            preferencesData.travel_frequency,
            preferencesData.monthly_budget,
            JSON.stringify(preferencesData.service_preferences),
            preferencesData.has_children,
            preferencesData.has_other_pets,
            preferencesData.other_pet_types,
            customer.id,
          ]
        );
}

export async function dbCustomerPhonePreferencesPost2(customer, preferencesData, JSON, journey_type, home_type, outdoor_space, work_schedule, activity_level, travel_frequency, monthly_budget, service_preferences, has_children, has_other_pets, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) {
  return await query(
          `INSERT INTO customer_preferences (
            customer_id, journey_type, home_type, outdoor_space,
            work_schedule, activity_level, travel_frequency,
            monthly_budget, service_preferences, has_children,
            has_other_pets, other_pet_types
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            customer.id,
            preferencesData.journey_type,
            preferencesData.home_type,
            preferencesData.outdoor_space,
            preferencesData.work_schedule,
            preferencesData.activity_level,
            preferencesData.travel_frequency,
            preferencesData.monthly_budget,
            JSON.stringify(preferencesData.service_preferences),
            preferencesData.has_children,
            preferencesData.has_other_pets,
            preferencesData.other_pet_types,
          ]
        );
}

export async function dbCustomerPhonePreferencesPost3(customer, journeyType, livingSpace, lifestyle, budget, servicePreferences) {
  return await update('customers', { id: customer.id }, {
        preferences: {
          ...customer.preferences,
          journeyType,
          livingSpace,
          lifestyle,
          budget,
          servicePreferences,
        },
      });
}

