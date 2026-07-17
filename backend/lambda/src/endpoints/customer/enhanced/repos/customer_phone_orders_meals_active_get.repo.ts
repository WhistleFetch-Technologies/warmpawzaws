import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneOrdersMealsActiveGet0(customer, MEAL_ACTIVE_ORDERS_SQL) {
  return await query(MEAL_ACTIVE_ORDERS_SQL, [customer.id]);
}

