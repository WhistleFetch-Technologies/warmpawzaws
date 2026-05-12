package com.warmpawz.delivery.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shipment_tracking_events")
@Data
public class ShipmentTrackingEvent {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "shipment_id", nullable = false)
	private UUID shipmentId;

	@Column(name = "event_type", nullable = false, length = 100)
	private String eventType;

	@Column(name = "event_description")
	private String eventDescription;

	private String location;

	private Instant timestamp = Instant.now();

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String metadata = "{}";

	@Column(name = "created_at", updatable = false)
	private Instant createdAt = Instant.now();

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "raw_data", columnDefinition = "jsonb")
	private String rawData;
}
