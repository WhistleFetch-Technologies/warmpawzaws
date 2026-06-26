package com.warmpawz.delivery.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "pidge.rider-location-poll")
public class PidgeRiderLocationPollProperties {

	/**
	 * When true, delivery-service polls Pidge for rider GPS on active orders on a fixed delay.
	 */
	private boolean enabled = false;

	/**
	 * Milliseconds between poll cycles (default 60s — within Pidge 1 call / 30s / order limit).
	 */
	private long intervalMs = 60_000L;
}
