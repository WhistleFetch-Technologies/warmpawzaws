import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerServicesPlatform0(information_schema) {
  return await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'service_catalog'
        )`
      )
}

export async function dbCustomerServicesPlatform1(fallbackQuery, fallbackParams) {
  return await query(fallbackQuery, fallbackParams)
}

export async function dbCustomerServicesPlatform2(queryText, params) {
  return await query(queryText, params)
}

