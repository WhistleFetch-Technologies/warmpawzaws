package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.DeliveryLocationHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryLocationHistoryRepository extends JpaRepository<DeliveryLocationHistory, UUID> {

	List<DeliveryLocationHistory> findTop50ByTrackingIdOrderByRecordedAtDesc(UUID trackingId);

	Optional<DeliveryLocationHistory> findTop1ByTrackingIdOrderByRecordedAtDesc(UUID trackingId);
}
