import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneSubscriptionsActiveGet0(normalizedPhone) {
  return await select('customers', { phone: normalizedPhone });
}

export async function dbCustomerPhoneSubscriptionsActiveGet1(subscriptionsQuery, params) {
  return await query(subscriptionsQuery, params);
}

