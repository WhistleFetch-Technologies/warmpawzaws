import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerHolidaypackagesGet0(packageQuery, params) {
  return await query(packageQuery, params)
}

