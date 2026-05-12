package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.ShipmentTrackingEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ShipmentTrackingEventRepository extends JpaRepository<ShipmentTrackingEvent, UUID> {
}
