/**
 * EventBridge / cron entry: assign unassigned support tickets in batch.
 * Wire EventBridge to POST /crm/tickets/auto-assign-batch with x-internal-cron-secret.
 */

import { assignSupportTicketBatch } from '../endpoints/supportCrm/support-ticket-auto-assign';

export async function processSupportTicketAutoAssignBatch(): Promise<{
  routed: number;
  skipped: number;
}> {
  const batch = await assignSupportTicketBatch({ updateSweeperStats: true });
  return { routed: batch.routed, skipped: batch.skipped };
}
