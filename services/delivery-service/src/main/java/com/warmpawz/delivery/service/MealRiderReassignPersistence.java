package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.entity.DeliveryTracking;
import com.warmpawz.delivery.repository.DeliveryTrackingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Persists reassign intent in an independent transaction so Pidge webhooks can see
 * {@code meal_rider_reassign_requests} and {@code reassign_pending} before unallocate returns.
 */
@Service
@RequiredArgsConstructor
public class MealRiderReassignPersistence {

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;
	private final DeliveryTrackingRepository deliveryTrackingRepository;

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public MealRiderReassignPrepared prepareReassignPending(
			UUID mealOrderId,
			UUID trackingId,
			String pidgeOrderId,
			String adminId,
			UUID supportTicketId,
			String prevName,
			String prevPhone) {
		UUID reassignId = jdbc.queryForObject(
				"""
						INSERT INTO meal_rider_reassign_requests (
						  meal_order_id, delivery_tracking_id, pidge_order_id,
						  requested_by_admin_id, support_ticket_id, status,
						  previous_rider_name, previous_rider_phone
						) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
						RETURNING id
						""",
				UUID.class,
				mealOrderId,
				trackingId,
				pidgeOrderId,
				adminId,
				supportTicketId,
				prevName,
				prevPhone);

		Optional<DeliveryTracking> dtOpt = deliveryTrackingRepository.findById(trackingId);
		if (dtOpt.isPresent()) {
			DeliveryTracking dt = dtOpt.get();
			dt.setMetadataJson(
					DeliveryTrackingMetadataHelper.setReassignPending(
							dt.getMetadataJson(), objectMapper, reassignId, Instant.now()));
			dt.setUpdatedAt(Instant.now());
			deliveryTrackingRepository.save(dt);
		}

		return new MealRiderReassignPrepared(mealOrderId, reassignId, trackingId, pidgeOrderId, dtOpt);
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void markReassignFailed(UUID reassignId, UUID trackingId, String failureReason) {
		jdbc.update(
				"UPDATE meal_rider_reassign_requests SET status = 'failed', failure_reason = ?, completed_at = NOW() WHERE id = ?",
				failureReason,
				reassignId);
		deliveryTrackingRepository.findById(trackingId).ifPresent(dt -> {
			dt.setMetadataJson(
					DeliveryTrackingMetadataHelper.clearReassignPending(dt.getMetadataJson(), objectMapper));
			deliveryTrackingRepository.save(dt);
		});
	}
}
