package com.warmpawz.delivery.service;

import com.warmpawz.delivery.entity.DeliveryLocationHistory;
import com.warmpawz.delivery.repository.DeliveryLocationHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Append GPS history for delivery_tracking rows. Skips null/invalid coords and consecutive duplicates.
 */
@Service
@RequiredArgsConstructor
public class DeliveryLocationHistoryWriter {

	private static final BigDecimal COORD_EPS = new BigDecimal("0.0000001");

	private final DeliveryLocationHistoryRepository locationHistoryRepository;

	@Transactional
	public void appendIfChanged(UUID trackingId, BigDecimal lat, BigDecimal lng, String source, Instant recordedAt) {
		if (trackingId == null || lat == null || lng == null) {
			return;
		}
		if (!isValidCoord(lat, lng)) {
			return;
		}

		Optional<DeliveryLocationHistory> lastOpt =
				locationHistoryRepository.findTop1ByTrackingIdOrderByRecordedAtDesc(trackingId);
		if (lastOpt.isPresent()) {
			DeliveryLocationHistory last = lastOpt.get();
			if (coordsEqual(last.getLat(), last.getLng(), lat, lng)) {
				return;
			}
		}

		DeliveryLocationHistory row = new DeliveryLocationHistory();
		row.setTrackingId(trackingId);
		row.setLat(lat);
		row.setLng(lng);
		row.setSource(source);
		row.setRecordedAt(recordedAt != null ? recordedAt : Instant.now());
		locationHistoryRepository.save(row);
	}

	static boolean isValidCoord(BigDecimal lat, BigDecimal lng) {
		if (lat == null || lng == null) {
			return false;
		}
		double la = lat.doubleValue();
		double ln = lng.doubleValue();
		if (!Double.isFinite(la) || !Double.isFinite(ln)) {
			return false;
		}
		if (la < -90 || la > 90 || ln < -180 || ln > 180) {
			return false;
		}
		return !(la == 0d && ln == 0d);
	}

	static boolean coordsEqual(BigDecimal aLat, BigDecimal aLng, BigDecimal bLat, BigDecimal bLng) {
		if (aLat == null || aLng == null || bLat == null || bLng == null) {
			return false;
		}
		return aLat.subtract(bLat).abs().compareTo(COORD_EPS) <= 0
				&& aLng.subtract(bLng).abs().compareTo(COORD_EPS) <= 0;
	}
}
