import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneOnboardingCompletePost0() {
  return await select('customers', { phone });
}

export async function dbCustomerPhoneOnboardingCompletePost1(customer) {
  return await update('customers', { id: customer.id }, {
        onboarding_status: 'COMPLETED',
        profile_completed: true,
        status: 'active',
      });
}

export async function dbCustomerPhoneOnboardingCompletePost2(customer) {
  return await query(
        `UPDATE customer_preferences SET
          onboarding_completed_at = NOW(),
          journey_type = COALESCE($1, journey_type)
        WHERE customer_id = $2`,
        [journeyType, customer.id]
      )
}

