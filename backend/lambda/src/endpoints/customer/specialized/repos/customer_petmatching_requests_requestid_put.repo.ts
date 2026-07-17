import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPetmatchingRequestsRequestidPut0(requestId, updateData) {
  return await update('mating_requests', { id: requestId }, updateData);
}

