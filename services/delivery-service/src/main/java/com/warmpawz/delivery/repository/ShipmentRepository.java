package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShipmentRepository extends JpaRepository<Shipment, UUID> {

	List<Shipment> findByLogisticsPartnerAndShipmentId(String logisticsPartner, String shipmentId);

	Optional<Shipment> findFirstByLogisticsPartnerAndShipmentId(String logisticsPartner, String shipmentId);

	List<Shipment> findByOrderId(UUID orderId);
}
