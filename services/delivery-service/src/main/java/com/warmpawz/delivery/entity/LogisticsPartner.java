package com.warmpawz.delivery.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "logistics_partners", indexes = {
		@Index(name = "idx_logistics_partners_partner_id", columnList = "partner_id"),
		@Index(name = "idx_logistics_partners_partner_type", columnList = "partner_type")
})
@Data
public class LogisticsPartner {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(name = "partner_id", nullable = false, unique = true)
	private String partnerId;

	@Column(name = "partner_name", nullable = false)
	private String partnerName;

	@Column(name = "partner_type", nullable = false)
	private String partnerType;

	private String email;

	private String password;

	@Column(name = "api_key")
	private String apiKey;

	@Column(name = "api_secret")
	private String apiSecret;

	private Boolean enabled = true;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(columnDefinition = "jsonb")
	private String config = "{}";

	@Column(name = "base_url")
	private String baseUrl;

	@Column(name = "webhook_secret")
	private String webhookSecret;

	private Integer priority = 100;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "service_areas", columnDefinition = "jsonb")
	private String serviceAreas = "[]";

	@Column(name = "created_at", updatable = false, nullable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt = Instant.now();

	@PreUpdate
	void touch() {
		updatedAt = Instant.now();
	}
}
