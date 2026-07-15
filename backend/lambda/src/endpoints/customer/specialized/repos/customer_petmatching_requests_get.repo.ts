import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetmatchingRequestsGet0(requestsQuery) {
  return await query(requestsQuery, [customerId])
}

