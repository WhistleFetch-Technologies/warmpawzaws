package com.warmpawz.delivery.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "pidge")
public class PidgeProperties {

	/**
	 * Pidge API host, no trailing slash.
	 */
	private String apiBase = "https://api.pidge.in";

	private String username = "";
	private String password = "";
	private String brandCode = "";
	private String brandLocationCode = "";
	private String brandName = "WarmPawz";
	private String channel = "warmpawz";
	private String defaultCountry = "India";

	/**
	 * When true, create-order requests omit the {@code brand} object. Pidge allows {@code brand} only for
	 * aggregator accounts; store/vendor logins must not send it (error {@code argument.payload.brand.invalid}).
	 */
	private boolean omitBrandInCreateOrder = false;

	/**
	 * Shown on GET /webhooks/pidge as the URL to register in Pidge.
	 */
	private String publicApiBaseUrl = "https://YOUR_API_GATEWAY_OR_DOMAIN";

	private String webhookBearerToken = "";

	public String resolvedApiBase() {
		if (apiBase == null || apiBase.isBlank()) {
			return "https://api.pidge.in";
		}
		return apiBase.replaceAll("/$", "");
	}
}
