package com.warmpawz.delivery.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shipments", indexes = {
		@Index(name = "idx_shipments_order_id", columnList = "order_id"),
		@Index(name = "idx_shipments_shipment_id", columnList = "shipment_id"),
		@Index(name = "idx_shipments_awb_code", columnList = "awb_code"),
		@Index(name = "idx_shipments_status", columnList = "status")
})
@Data
public class Shipment {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "order_id", nullable = false)
	private UUID orderId;

	@Column(name = "logistics_partner", nullable = false)
	private String logisticsPartner;

	@Column(name = "shipment_id")
	private String shipmentId;

	@Column(name = "awb_code")
	private String awbCode;

	private String status = "created";

	@Column(name = "tracking_url")
	private String trackingUrl;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "pickup_address", columnDefinition = "jsonb")
	private String pickupAddressJson;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "delivery_address", columnDefinition = "jsonb")
	private String deliveryAddressJson;

	@Column(name = "courier_name")
	private String courierName;

	@Column(name = "current_location")
	private String currentLocation;

	@Column(name = "estimated_delivery")
	private Instant estimatedDelivery;

	@Column(name = "shipped_at")
	private Instant shippedAt;

	@Column(name = "delivered_at")
	private Instant deliveredAt;

	@Column(name = "picked_up_at")
	private Instant pickedUpAt;

	@Column(name = "logistics_partner_id")
	private UUID logisticsPartnerId;

	@Column(name = "created_at", updatable = false, nullable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt = Instant.now();

	@Column(name = "fulfillment_type")
	private String fulfillmentType;

	@PreUpdate
	void touch() {
		updatedAt = Instant.now();
	}
}
