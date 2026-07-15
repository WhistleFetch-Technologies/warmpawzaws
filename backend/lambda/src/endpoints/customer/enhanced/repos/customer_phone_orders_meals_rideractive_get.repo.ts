import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhoneOrdersMealsRideractiveGet0(customer, MEAL_ACTIVE_ORDERS_SQL) {
  return await query(MEAL_ACTIVE_ORDERS_SQL, [customer.id]);
}

