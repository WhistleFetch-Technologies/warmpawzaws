package com.warmpawz.delivery.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public interface ExternalPartnerLogisticsService {

	JsonNode shiprocketCreateAdhoc(JsonNode orderData) throws Exception;

	JsonNode shiprocketTrackShipment(String shipmentId) throws Exception;

	JsonNode shiprocketGenerateAwb(JsonNode body) throws Exception;

	JsonNode delhiveryCreateOrder(JsonNode body) throws Exception;

	JsonNode delhiveryTrack(String waybill) throws Exception;

	JsonNode delhiveryCancelWaybill(String waybill) throws Exception;

	JsonNode dunzoCreateTask(JsonNode body) throws Exception;

	JsonNode dunzoGetTask(String taskId) throws Exception;

	JsonNode dunzoCancelTask(String taskId) throws Exception;

	ObjectMapper mapper();
}
