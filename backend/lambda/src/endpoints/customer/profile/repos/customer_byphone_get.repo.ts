import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerByphoneGet0(customerId) {
  return await select('customers', { id: customerId });
}

