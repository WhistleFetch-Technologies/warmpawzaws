package com.warmpawz.delivery.util;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/** Mirrors {@code extractPidgeOrderIdMap} in {@code pidge-logistics.ts}. */
public final class PidgeOrderIdMap {

	private PidgeOrderIdMap() {}

	public static Map<String, String> extract(JsonNode json) {
		if (json == null || !json.has("data")) {
			return Map.of();
		}
		JsonNode data = json.get("data");
		if (data.isTextual()) {
			try {
				data = new com.fasterxml.jackson.databind.ObjectMapper().readTree(data.asText());
			} catch (Exception e) {
				return Map.of();
			}
		}
		if (!data.isObject()) {
			return Map.of();
		}
		Map<String, String> out = new HashMap<>();
		Iterator<String> names = data.fieldNames();
		while (names.hasNext()) {
			String k = names.next();
			JsonNode v = data.get(k);
			if (v != null && !v.isNull()) {
				out.put(k, v.asText());
			}
		}
		return out;
	}

	public static String firstEntryPidgeId(Map<String, String> map) {
		if (map == null || map.isEmpty()) {
			return null;
		}
		String firstKey = map.keySet().iterator().next();
		return map.get(firstKey);
	}
}
