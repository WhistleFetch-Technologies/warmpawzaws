package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.DeliveryTracking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryTrackingRepository extends JpaRepository<DeliveryTracking, UUID> {

	List<DeliveryTracking> findByPharmacyOrderIdOrderByCreatedAtDesc(UUID pharmacyOrderId);

	List<DeliveryTracking> findByMealOrderIdOrderByCreatedAtDesc(UUID mealOrderId);

	Optional<DeliveryTracking> findFirstByExternalTaskIdAndLogisticsPartner(String externalTaskId, String logisticsPartner);

	List<DeliveryTracking> findByLogisticsPartnerAndExternalTaskId(String logisticsPartner, String externalTaskId);
}
