package com.warmpawz.delivery.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_location_history", indexes = {
		@Index(name = "idx_location_history_tracking", columnList = "tracking_id, recorded_at")
})
@Data
public class DeliveryLocationHistory {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "tracking_id", nullable = false)
	private UUID trackingId;

	@Column(nullable = false, precision = 10, scale = 7)
	private BigDecimal lat;

	@Column(nullable = false, precision = 10, scale = 7)
	private BigDecimal lng;

	@Column(name = "accuracy_meters", precision = 6, scale = 2)
	private BigDecimal accuracyMeters;

	@Column(name = "speed_kmh", precision = 5, scale = 2)
	private BigDecimal speedKmh;

	private Integer heading;

	@Column(name = "recorded_at", nullable = false)
	private Instant recordedAt = Instant.now();

	/** e.g. pidge (webhook), partner_app (manual update-location). */
	@Column(length = 32)
	private String source;
}
