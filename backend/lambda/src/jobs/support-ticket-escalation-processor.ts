/**
 * EventBridge / cron entry: evaluate support escalation rules in batch.
 * Wire EventBridge to POST /crm/tickets/escalation-batch with x-internal-cron-secret.
 */

import { processSupportTicketEscalationBatch } from '../endpoints/supportCrm/support-ticket-escalation-processor';

export async function runSupportTicketEscalationProcessor(): Promise<{
  evaluated: number;
  fired: number;
  skipped: number;
}> {
  const batch = await processSupportTicketEscalationBatch();
  return {
    evaluated: batch.evaluated,
    fired: batch.fired,
    skipped: batch.skipped,
  };
}
