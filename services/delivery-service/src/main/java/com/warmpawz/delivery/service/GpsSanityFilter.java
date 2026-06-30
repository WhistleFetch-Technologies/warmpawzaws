package com.warmpawz.delivery.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Rejects implausible Pidge GPS updates (teleports, post-pickup regression away from destination).
 */
public final class GpsSanityFilter {

	/** ~80 km/h urban cap expressed as km per minute. */
	private static final double MAX_KM_PER_MINUTE = 1.4d;
	/** Minimum regression away from destination to reject (km). */
	private static final double POST_PICKUP_REGRESSION_KM = 0.05d;
	/** Large position jump (km) that triggers regression check after pickup. */
	private static final double POST_PICKUP_LARGE_JUMP_KM = 0.3d;
	private static final double EARTH_RADIUS_KM = 6371d;

	private GpsSanityFilter() {}

	public record GpsPoint(double lat, double lng) {}

	public enum RejectReason {
		IMPLAUSIBLE_SPEED,
		POST_PICKUP_REGRESSION
	}

	public static Optional<RejectReason> rejectReason(
			BigDecimal lastLat,
			BigDecimal lastLng,
			Instant lastRecordedAt,
			BigDecimal newLat,
			BigDecimal newLng,
			Instant newAt,
			Instant pickedUpAt,
			GpsPoint destination) {
		if (!DeliveryLocationHistoryWriter.isValidCoord(newLat, newLng)) {
			return Optional.empty();
		}
		double nLat = newLat.doubleValue();
		double nLng = newLng.doubleValue();
		Instant effectiveNewAt = newAt != null ? newAt : Instant.now();

		if (lastLat != null && lastLng != null && DeliveryLocationHistoryWriter.isValidCoord(lastLat, lastLng)) {
			double distanceKm = haversineKm(lastLat.doubleValue(), lastLng.doubleValue(), nLat, nLng);
			if (distanceKm > 0.01d) {
				Instant effectiveLastAt = lastRecordedAt != null ? lastRecordedAt : effectiveNewAt;
				long elapsedSeconds = Math.max(1L, Duration.between(effectiveLastAt, effectiveNewAt).getSeconds());
				double minutes = elapsedSeconds / 60d;
				double kmPerMinute = distanceKm / minutes;
				if (kmPerMinute > MAX_KM_PER_MINUTE) {
					return Optional.of(RejectReason.IMPLAUSIBLE_SPEED);
				}
			}

			if (pickedUpAt != null && destination != null) {
				double lastToDest = haversineKm(
						lastLat.doubleValue(), lastLng.doubleValue(), destination.lat(), destination.lng());
				double newToDest = haversineKm(nLat, nLng, destination.lat(), destination.lng());
				double moveKm = distanceKm;
				if (newToDest > lastToDest + POST_PICKUP_REGRESSION_KM && moveKm > POST_PICKUP_LARGE_JUMP_KM) {
					return Optional.of(RejectReason.POST_PICKUP_REGRESSION);
				}
			}
		}

		return Optional.empty();
	}

	public static boolean shouldAccept(
			BigDecimal lastLat,
			BigDecimal lastLng,
			Instant lastRecordedAt,
			BigDecimal newLat,
			BigDecimal newLng,
			Instant newAt,
			Instant pickedUpAt,
			GpsPoint destination) {
		return rejectReason(lastLat, lastLng, lastRecordedAt, newLat, newLng, newAt, pickedUpAt, destination)
				.isEmpty();
	}

	static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
		double dLat = Math.toRadians(lat2 - lat1);
		double dLng = Math.toRadians(lng2 - lng1);
		double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
				+ Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
						* Math.sin(dLng / 2) * Math.sin(dLng / 2);
		return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	}
}
