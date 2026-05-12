package com.warmpawz.delivery.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_tracking", indexes = {
		@Index(name = "idx_delivery_tracking_pharmacy", columnList = "pharmacy_order_id"),
		@Index(name = "idx_delivery_tracking_meal", columnList = "meal_order_id"),
		@Index(name = "idx_delivery_tracking_external_task_id", columnList = "external_task_id")
})
@Data
public class DeliveryTracking {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "pharmacy_order_id")
	private UUID pharmacyOrderId;

	@Column(name = "meal_order_id")
	private UUID mealOrderId;

	@Column(name = "subscription_delivery_id")
	private UUID subscriptionDeliveryId;

	@Column(name = "logistics_partner_id")
	private UUID logisticsPartnerId;

	@Column(name = "delivery_person_name")
	private String deliveryPersonName;

	@Column(name = "delivery_person_phone")
	private String deliveryPersonPhone;

	@Column(name = "delivery_person_photo")
	private String deliveryPersonPhoto;

	@Column(name = "vehicle_number")
	private String vehicleNumber;

	@Column(name = "current_lat", precision = 10, scale = 7)
	private BigDecimal currentLat;

	@Column(name = "current_lng", precision = 10, scale = 7)
	private BigDecimal currentLng;

	@Column(name = "last_location_update")
	private Instant lastLocationUpdate;

	@Column(length = 50)
	private String status = "assigned";

	@Column(name = "eta_to_pickup_minutes")
	private Integer etaToPickupMinutes;

	@Column(name = "eta_to_delivery_minutes")
	private Integer etaToDeliveryMinutes;

	@Column(name = "distance_remaining_km", precision = 5, scale = 2)
	private BigDecimal distanceRemainingKm;

	@Column(name = "assigned_at")
	private Instant assignedAt;

	@Column(name = "reached_pickup_at")
	private Instant reachedPickupAt;

	@Column(name = "picked_up_at")
	private Instant pickedUpAt;

	@Column(name = "delivered_at")
	private Instant deliveredAt;

	@Column(name = "delivery_photo")
	private String deliveryPhoto;

	@Column(name = "recipient_name")
	private String recipientName;

	@Column(name = "delivery_notes")
	private String deliveryNotes;

	@Column(name = "delivery_otp", length = 6)
	private String deliveryOtp;

	@Column(name = "otp_verified")
	private Boolean otpVerified = false;

	@Column(name = "created_at", updatable = false, nullable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt = Instant.now();

	@Column(name = "external_task_id")
	private String externalTaskId;

	@Column(name = "logistics_partner", length = 50)
	private String logisticsPartner = "warmpawz";

	@Column(name = "tracking_url")
	private String trackingUrl;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "metadata", columnDefinition = "jsonb")
	private String metadataJson = "{}";

	@PreUpdate
	void touch() {
		updatedAt = Instant.now();
	}
}
