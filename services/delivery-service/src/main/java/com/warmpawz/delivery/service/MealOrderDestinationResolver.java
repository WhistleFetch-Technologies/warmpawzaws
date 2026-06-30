package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Resolves meal order drop-off coordinates from {@code meal_orders.delivery_address}. */
@Service
@RequiredArgsConstructor
public class MealOrderDestinationResolver {

	private final JdbcTemplate jdbc;
	private final ObjectMapper objectMapper;

	public Optional<GpsSanityFilter.GpsPoint> resolveDestination(UUID mealOrderId) {
		if (mealOrderId == null) {
			return Optional.empty();
		}
		List<Map<String, Object>> rows = jdbc.queryForList(
				"SELECT delivery_address::text AS delivery_address FROM meal_orders WHERE id = ? LIMIT 1",
				mealOrderId);
		if (rows.isEmpty() || rows.get(0).get("delivery_address") == null) {
			return Optional.empty();
		}
		return parseDeliveryAddress(String.valueOf(rows.get(0).get("delivery_address")));
	}

	private Optional<GpsSanityFilter.GpsPoint> parseDeliveryAddress(String raw) {
		if (raw == null || raw.isBlank()) {
			return Optional.empty();
		}
		try {
			JsonNode node = objectMapper.readTree(raw);
			Double lat = readCoord(node, "lat", "latitude");
			Double lng = readCoord(node, "lng", "longitude", "lon");
			if (lat == null || lng == null) {
				return Optional.empty();
			}
			return Optional.of(new GpsSanityFilter.GpsPoint(lat, lng));
		} catch (Exception e) {
			return Optional.empty();
		}
	}

	private static Double readCoord(JsonNode node, String... keys) {
		for (String key : keys) {
			if (node.has(key) && !node.get(key).isNull()) {
				double v = node.get(key).asDouble(Double.NaN);
				if (Double.isFinite(v)) {
					return v;
				}
			}
		}
		return null;
	}
}
