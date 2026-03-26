import type { SQSHandler, SQSRecord, SQSBatchItemFailure } from 'aws-lambda';
import { query, insert } from '../database/rds-connection';
import { loyaltyPointsService } from 'src/lib/services/loyalty&reward/loyalty-points-service';

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
				if (!evt) {
					console.warn('[LOYALTY CONSUMER] skip: unable to parse event', {
						messageId: rec.messageId,
						bodyStart: rec.body?.slice(0, 200),
					});
					return;
				}
				if (evt.eventType !== 'ActionOccurred' || !evt.eventId) {
					console.warn('[LOYALTY CONSUMER] skip: not ActionOccurred or missing eventId', {
						eventType: (evt as any)?.eventType,
						eventId: (evt as any)?.eventId,
					});
					return;
				}

				console.info('[LOYALTY CONSUMER] parsed event', {
					eventId: evt.eventId,
					actionName: evt.actionName,
					entity: evt.entity,
					reference: evt.reference,
				});

				// Idempotency
				console.info('[LOYALTY CONSUMER] idempotency check', { eventId: evt.eventId });
				const seen = await query(`SELECT 1 FROM processed_events WHERE event_id = $1 LIMIT 1`, [evt.eventId]);
				if (seen.rowCount > 0) {
					console.info('[LOYALTY CONSUMER] already processed', { eventId: evt.eventId });
					return;
				}


				const customerId = evt.entity.type === 'vendor' ? undefined : evt.entity.id;
				const vendorId = evt.entity.type === 'vendor' ? evt.entity.id : undefined;

				try {
					console.info('[LOYALTY CONSUMER] awarding points', {
						eventId: evt.eventId,
						customerId,
						vendorId,
						actionName: evt.actionName,
						amount: evt.amount,
						reference: evt.reference,
					});
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
					console.info('[LOYALTY CONSUMER] award deduplicated (treated as success)', {
						eventId: evt.eventId,
						message: msg.slice(0, 180),
					});
				}

				// Mark processed on success
				console.info('[LOYALTY CONSUMER] inserting processed_events', {
					eventId: evt.eventId,
					actionName: evt.actionName,
					entityType: evt.entity.type,
					entityId: evt.entity.id,
					reference: evt.reference,
				});
				await insert('processed_events', {
					event_id: evt.eventId,
					action_name: evt.actionName,
					entity_type: evt.entity.type,
					entity_id: evt.entity.id,
					reference_type: evt.reference?.type || null,
					reference_id: evt.reference?.id || null,
				});
				console.info('[LOYALTY CONSUMER] processed OK', { eventId: evt.eventId });
			} catch (err) {
				let parsedEventId: string | undefined;
				try {
					const b = JSON.parse(rec.body);
					parsedEventId = b?.detail?.eventId || b?.eventId;
				} catch {
					parsedEventId = undefined;
				}
				console.error('[LOYALTY CONSUMER] record failed:', rec.messageId, {
					eventId: parsedEventId,
					bodyStart: rec.body?.slice(0, 200),
				}, err);
				failures.push({ itemIdentifier: rec.messageId });
			}
		})
	);

	return { batchItemFailures: failures };
};

