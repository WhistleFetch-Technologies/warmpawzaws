package com.warmpawz.delivery.service;

public interface ShipmentService {

	void recordPidgeShipmentIfResolvable(String orderIdKey, String pidgeOrderId);

	void markPidgeShipmentCancelled(String pidgeOrderId);

	void recordShiprocketShipmentFromResponse(String orderIdStr, com.fasterxml.jackson.databind.JsonNode shiprocketResult);
}
