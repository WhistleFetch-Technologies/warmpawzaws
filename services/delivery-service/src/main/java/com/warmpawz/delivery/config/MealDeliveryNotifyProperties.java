package com.warmpawz.delivery.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "warmpawz.meal-delivery-notify")
public class MealDeliveryNotifyProperties {

	/**
	 * Warmpawz API Gateway base URL (same as PUBLIC_API_BASE_URL), e.g. https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com
	 */
	private String apiBaseUrl = "";

	/**
	 * Shared secret for POST /internal/meal-delivery/notify (header X-Meal-Delivery-Notify-Secret).
	 * Must match Lambda env MEAL_DELIVERY_NOTIFY_SECRET.
	 */
	private String secret = "";
}
