import type { SQSHandler, SQSRecord, SQSBatchItemFailure } from 'aws-lambda';
import { query, insert } from '../database/rds-connection';

// Avoid circular import at module init by dynamic import inside handler for heavy deps.

type ActionOccurred = {
	eventId: string;
	eventType: 'ActionOccurred';
	occurredAt: string;
	actionName: string;
	entity: { type: 'customer' | 'vendor' | 'auto'; id: string };
	actor?: { type: string; id: string };
	amount?: number;
	reference?: { type: string; id?: string };
	metadata?: Record<string, any>;
};

function parseEventFromRecord(rec: SQSRecord): ActionOccurred | null {
	try {
		const body = JSON.parse(rec.body);
		// EventBridge → SQS wraps the event under "detail"
		return (body?.detail as ActionOccurred) || (body as ActionOccurred);
	} catch {
		return null;
	}
}

export const handler: SQSHandler = async (event) => {
	const failures: SQSBatchItemFailure[] = [];

	await Promise.all(
		event.Records.map(async (rec) => {
			try {
				const evt = parseEventFromRecord(rec);
				if (!evt || evt.eventType !== 'ActionOccurred' || !evt.eventId) {
					return;
				}

				// Idempotency
				const seen = await query(`SELECT 1 FROM processed_events WHERE event_id = $1 LIMIT 1`, [evt.eventId]);
				if (seen.rowCount > 0) {
					return;
				}

				const { loyaltyPointsService } = await import('../lib/services/loyalty&reward/loyalty-points-service');

				const customerId = evt.entity.type === 'vendor' ? undefined : evt.entity.id;
				const vendorId = evt.entity.type === 'vendor' ? evt.entity.id : undefined;

				try {
					await loyaltyPointsService.awardPoints({
						customerId,
						vendorId,
						actionName: evt.actionName,
						amount: evt.amount,
						referenceType: evt.reference?.type,
						referenceId: evt.reference?.id,
						description: `Action ${evt.actionName}`,
						metadata: evt.metadata || {},
					});
				} catch (awardErr: any) {
					// Treat unique-violation on business key as success (already awarded)
					const msg = String(awardErr?.message || '');
					const isDup =
						msg.includes('duplicate key value') ||
						msg.includes('unique constraint') ||
						msg.includes('already exists');
					if (!isDup) {
						throw awardErr;
					}
				}

				// Mark processed on success
				await insert('processed_events', {
					event_id: evt.eventId,
					action_name: evt.actionName,
					entity_type: evt.entity.type,
					entity_id: evt.entity.id,
					reference_type: evt.reference?.type || null,
					reference_id: evt.reference?.id || null,
				});
			} catch (err) {
				console.error('[LOYALTY CONSUMER] record failed:', rec.messageId, err);
				failures.push({ itemIdentifier: rec.messageId });
			}
		})
	);

	return { batchItemFailures: failures };
};

