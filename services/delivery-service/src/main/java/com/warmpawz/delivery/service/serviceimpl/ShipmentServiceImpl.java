package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.warmpawz.delivery.entity.Shipment;
import com.warmpawz.delivery.repository.ShipmentRepository;
import com.warmpawz.delivery.service.ShipmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ShipmentServiceImpl implements ShipmentService {

	private final ShipmentRepository shipmentRepository;

	@Override
	@Transactional
	public void recordPidgeShipmentIfResolvable(String orderIdKey, String pidgeOrderId) {
		if (orderIdKey == null || orderIdKey.isBlank() || pidgeOrderId == null || pidgeOrderId.isBlank()) {
			return;
		}
		try {
			UUID orderId = UUID.fromString(orderIdKey.trim());
			Shipment s = new Shipment();
			s.setOrderId(orderId);
			s.setLogisticsPartner("pidge");
			s.setShipmentId(pidgeOrderId.trim());
			s.setStatus("created");
			shipmentRepository.save(s);
		} catch (IllegalArgumentException e) {
			log.debug("Skipping shipments insert: orderId not a UUID: {}", orderIdKey);
		} catch (Exception e) {
			log.warn("shipments insert failed (non-fatal): {}", e.getMessage());
		}
	}

	@Override
	@Transactional
	public void markPidgeShipmentCancelled(String pidgeOrderId) {
		if (pidgeOrderId == null || pidgeOrderId.isBlank()) {
			return;
		}
		shipmentRepository.findFirstByLogisticsPartnerAndShipmentId("pidge", pidgeOrderId.trim()).ifPresent(s -> {
			s.setStatus("cancelled");
			shipmentRepository.save(s);
		});
	}

	@Override
	@Transactional
	public void recordShiprocketShipmentFromResponse(String orderIdStr, JsonNode shiprocketResult) {
		if (orderIdStr == null || orderIdStr.isBlank()) {
			return;
		}
		try {
			UUID orderId = UUID.fromString(orderIdStr.trim());
			Shipment s = new Shipment();
			s.setOrderId(orderId);
			s.setLogisticsPartner("shiprocket");
			JsonNode sid = shiprocketResult.path("shipment_id");
			if (!sid.isMissingNode() && !sid.isNull()) {
				s.setShipmentId(sid.asText());
			}
			JsonNode awb = shiprocketResult.path("awb_code");
			if (!awb.isMissingNode() && !awb.isNull()) {
				s.setAwbCode(awb.asText());
			}
			JsonNode tu = shiprocketResult.path("tracking_url");
			if (!tu.isMissingNode() && !tu.isNull()) {
				s.setTrackingUrl(tu.asText());
			}
			s.setStatus("created");
			shipmentRepository.save(s);
		} catch (IllegalArgumentException e) {
			log.debug("Skipping shiprocket shipment insert: orderId not UUID: {}", orderIdStr);
		} catch (Exception e) {
			log.warn("shiprocket shipments insert failed (non-fatal): {}", e.getMessage());
		}
	}
}
