package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.DeliveryTracking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryTrackingRepository extends JpaRepository<DeliveryTracking, UUID> {

	List<DeliveryTracking> findByPharmacyOrderIdOrderByCreatedAtDesc(UUID pharmacyOrderId);

	List<DeliveryTracking> findByMealOrderIdOrderByCreatedAtDesc(UUID mealOrderId);

	Optional<DeliveryTracking> findFirstByExternalTaskIdAndLogisticsPartner(String externalTaskId, String logisticsPartner);

	List<DeliveryTracking> findByLogisticsPartnerAndExternalTaskId(String logisticsPartner, String externalTaskId);

	/** Same ordering as Lambda logistics-webhooks (latest row wins). */
	Optional<DeliveryTracking> findFirstByLogisticsPartnerAndExternalTaskIdOrderByCreatedAtDesc(
			String logisticsPartner, String externalTaskId);

	/**
	 * Active Pidge meal/pharmacy rows eligible for background rider GPS polling.
	 */
	@Query("""
			SELECT t FROM DeliveryTracking t
			WHERE LOWER(t.logisticsPartner) = 'pidge'
			AND t.externalTaskId IS NOT NULL AND TRIM(t.externalTaskId) <> ''
			AND t.status IN ('heading_to_pickup', 'at_pickup', 'picked_up', 'on_the_way', 'nearby')
			""")
	List<DeliveryTracking> findActivePidgeTrackingsForLocationPoll();
}
