package com.warmpawz.delivery.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Internal fleet driver (table {@code delivery_partners}) — not the same as {@link LogisticsPartner}.
 */
@Entity
@Table(
		name = "delivery_partners",
		indexes = {
				@Index(name = "idx_delivery_partners_partner_id", columnList = "partner_id"),
				@Index(name = "idx_delivery_partners_vendor_id", columnList = "vendor_id")
		}
)
@Data
public class CourierPartner {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "partner_id", nullable = false, unique = true)
	private String partnerId;

	@Column(name = "vendor_id")
	private UUID vendorId;

	@Column(nullable = false)
	private String name;

	@Column(nullable = false)
	private String phone;

	@Column(name = "vehicle_type", nullable = false)
	private String vehicleType;

	@Column(name = "vehicle_number", nullable = false)
	private String vehicleNumber;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "current_location", nullable = false, columnDefinition = "jsonb")
	private String currentLocationJson = "{}";

	@Column(nullable = false)
	private String status = "available";

	/** Matches Postgres {@code numeric} columns (avoid {@code Double} which maps to {@code float8} and fails validate). */
	@JdbcTypeCode(SqlTypes.NUMERIC)
	private BigDecimal rating;

	@Column(name = "total_deliveries")
	private Integer totalDeliveries = 0;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	@Column(name = "created_at", updatable = false, nullable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt = Instant.now();

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}
}
