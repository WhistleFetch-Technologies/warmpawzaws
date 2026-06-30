package com.warmpawz.delivery.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GpsSanityFilterTest {

	private static final GpsSanityFilter.GpsPoint CHURCH_ST =
			new GpsSanityFilter.GpsPoint(12.9756071, 77.6032193);

	@Test
	void acceptsNormalMoveWithinSpeedLimit() {
		Instant t0 = Instant.parse("2026-06-30T07:47:46Z");
		Instant t1 = Instant.parse("2026-06-30T07:48:46Z");
		assertTrue(GpsSanityFilter.shouldAccept(
				bd("12.9790398"),
				bd("77.6028111"),
				t0,
				bd("12.9785000"),
				bd("77.6030000"),
				t1,
				Instant.parse("2026-06-30T07:47:13Z"),
				CHURCH_ST));
	}

	@Test
	void rejectsKitchenTeleportAfterPickup() {
		Instant t0 = Instant.parse("2026-06-30T07:53:49Z");
		Instant t1 = Instant.parse("2026-06-30T07:54:49Z");
		assertFalse(GpsSanityFilter.shouldAccept(
				bd("12.9775817"),
				bd("77.5989900"),
				t0,
				bd("12.9807316"),
				bd("77.6056973"),
				t1,
				Instant.parse("2026-06-30T07:47:13Z"),
				CHURCH_ST));
	}

	@Test
	void rejectsImplausibleSpeed() {
		Instant t0 = Instant.parse("2026-06-30T07:50:00Z");
		Instant t1 = Instant.parse("2026-06-30T07:50:30Z");
		assertFalse(GpsSanityFilter.shouldAccept(
				bd("12.97"),
				bd("77.60"),
				t0,
				bd("13.50"),
				bd("77.60"),
				t1,
				null,
				null));
	}

	private static BigDecimal bd(String v) {
		return new BigDecimal(v);
	}
}
