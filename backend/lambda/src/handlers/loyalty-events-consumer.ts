import type { SQSHandler, SQSRecord, SQSBatchItemFailure } from 'aws-lambda';
import { query, insert } from '../database/rds-connection';
import { loyaltyPointsService } from 'src/lib/services/loyalty&reward/loyalty-points-service';
import { processVendorReferralFirstBookingReward, processVendorReferralApprovalReward } from 'src/lib/services/referral-service';

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

// Moved vendor approval referral handler into referral-service to keep consumer minimal

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

	// Build per-entity groups to avoid races for same entity while preserving cross-entity parallelism
	const grouped = new Map<string, SQSRecord[]>();
	for (const rec of event.Records) {
		let key = `unknown:${rec.messageId}`;
		try {
			const parsed = parseEventFromRecord(rec);
			if (parsed?.entity?.id && parsed?.entity?.type) {
				key = `${parsed.entity.type}:${parsed.entity.id}`;
			}
		} catch { /* ignore */ }
		if (!grouped.has(key)) grouped.set(key, []);
		grouped.get(key)!.push(rec);
	}

	const processRecord = async (rec: SQSRecord) => {
		try {
			const evt = parseEventFromRecord(rec);
			if (!evt) {

				return;
			}
			if (evt.eventType !== 'ActionOccurred' || !evt.eventId) {

				return;
			}


			// Idempotency
			const seen = await query(`SELECT 1 FROM processed_events WHERE event_id = $1 LIMIT 1`, [evt.eventId]);
			if ((seen as any).rowCount > 0) {
				return;
			}
			console.log('evt------------------------------------------------------------------------------>>>>.>', evt);
			// Special handling for referrals
			if (evt.actionName === 'vendor_refer_friend_who_joins') {
				if (evt.reference?.type === 'booking') {
					try {
						await processVendorReferralFirstBookingReward({
							eventId: evt.eventId,
							bookingId: evt.reference?.id,
						});
					} catch (specErr: any) {
						console.error('[LOYALTY CONSUMER][vendor_refer_friend_who_joins][booking] handler error', {
							eventId: evt.eventId,
							error: String(specErr?.message || specErr),
						});
						throw specErr;
					}
				} else if (evt.reference?.type === 'vendor_application_approval') {
					try {
						await processVendorReferralApprovalReward({
							eventId: evt.eventId,
							applicationId: evt.reference?.id,
							vendorId: evt.entity?.type === 'vendor' ? evt.entity.id : undefined,
						});
					} catch (specErr: any) {
						console.error('[LOYALTY CONSUMER][vendor_refer_friend_who_joins][approval] handler error', {
							eventId: evt.eventId,
							error: String(specErr?.message || specErr),
						});
						throw specErr;
					}
				} else {
					console.info('[LOYALTY CONSUMER][vendor_refer_friend_who_joins] Unsupported reference type', {
						eventId: evt.eventId,
						reference: evt.reference,
					});
				}
			} else if (evt.actionName === 'vendor_refer_customer_first_booking') {
				console.info('[LOYALTY CONSUMER] customer referral first booking path requires vendor mapping; skipping for now', {
					eventId: evt.eventId,
					reference: evt.reference,
				});
			} else {
				// Default: award based on entity type
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
					// Only swallow genuine loyalty_transactions duplicate errors.
					// Do NOT swallow profile/wallet creation conflicts – those are
					// concurrent-upsert errors that should be retried.
					const msg = String(awardErr?.message || '');
					const isDupTxn =
						msg.includes('loyalty_transactions') &&
						(msg.includes('duplicate key value') ||
							msg.includes('unique constraint') ||
							msg.includes('already exists'));
					if (!isDupTxn) {
						throw awardErr;
					}
					console.info('[LOYALTY CONSUMER] award deduplicated (treated as success)', {
						eventId: evt.eventId,
						message: msg.slice(0, 180),
					});
				}
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
	};

	// Run each entity group sequentially; groups in parallel
	await Promise.all(
		Array.from(grouped.values()).map(async (records) => {
			for (const rec of records) {
				await processRecord(rec);
			}
		})
	);

	return { batchItemFailures: failures };
};

