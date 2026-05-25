package com.warmpawz.delivery.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeliveryLocationHistoryWriterTest {

	@Test
	void isValidCoord_rejectsNullIsland() {
		assertFalse(DeliveryLocationHistoryWriter.isValidCoord(
				BigDecimal.ZERO, BigDecimal.ZERO));
	}

	@Test
	void isValidCoord_acceptsBangalore() {
		assertTrue(DeliveryLocationHistoryWriter.isValidCoord(
				new BigDecimal("12.9716"), new BigDecimal("77.5946")));
	}

	@Test
	void coordsEqual_detectsDuplicate() {
		BigDecimal lat = new BigDecimal("12.9716000");
		BigDecimal lng = new BigDecimal("77.5946000");
		assertTrue(DeliveryLocationHistoryWriter.coordsEqual(lat, lng, lat, lng));
		assertFalse(DeliveryLocationHistoryWriter.coordsEqual(
				lat, lng, new BigDecimal("12.9720"), lng));
	}
}
