package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.UUID;

/** Read/write {@code delivery_tracking.metadata} JSON flags (reassign, rider task, etc.). */
public final class DeliveryTrackingMetadataHelper {

	private DeliveryTrackingMetadataHelper() {}

	public static boolean isReassignPending(String metadataJson, ObjectMapper mapper) {
		return readBool(metadataJson, "reassign_pending", mapper);
	}

	public static String setReassignPending(
			String metadataJson,
			ObjectMapper mapper,
			UUID reassignRequestId,
			Instant requestedAt) {
		ObjectNode root = readRoot(metadataJson, mapper);
		root.put("reassign_pending", true);
		root.put("reassign_requested_at", requestedAt != null ? requestedAt.toString() : Instant.now().toString());
		if (reassignRequestId != null) {
			root.put("reassign_request_id", reassignRequestId.toString());
		}
		return writeRoot(root, mapper);
	}

	public static String clearReassignPending(String metadataJson, ObjectMapper mapper) {
		ObjectNode root = readRoot(metadataJson, mapper);
		root.put("reassign_pending", false);
		root.remove("reassign_requested_at");
		root.remove("reassign_request_id");
		return writeRoot(root, mapper);
	}

	private static boolean readBool(String metadataJson, String key, ObjectMapper mapper) {
		try {
			if (metadataJson == null || metadataJson.isBlank()) {
				return false;
			}
			var node = mapper.readTree(metadataJson);
			return node.has(key) && node.get(key).asBoolean(false);
		} catch (Exception e) {
			return false;
		}
	}

	private static ObjectNode readRoot(String metadataJson, ObjectMapper mapper) {
		try {
			if (metadataJson == null || metadataJson.isBlank()) {
				return mapper.createObjectNode();
			}
			return (ObjectNode) mapper.readTree(metadataJson);
		} catch (Exception e) {
			return mapper.createObjectNode();
		}
	}

	private static String writeRoot(ObjectNode root, ObjectMapper mapper) {
		try {
			return mapper.writeValueAsString(root);
		} catch (Exception e) {
			return "{}";
		}
	}
}
