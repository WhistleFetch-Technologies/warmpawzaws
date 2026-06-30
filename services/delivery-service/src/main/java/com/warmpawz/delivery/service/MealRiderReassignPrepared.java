package com.warmpawz.delivery.service;

import com.warmpawz.delivery.entity.DeliveryTracking;

import java.util.Optional;
import java.util.UUID;

/** Committed reassign state returned before any external Pidge call. */
public record MealRiderReassignPrepared(
		UUID mealOrderId,
		UUID reassignId,
		UUID trackingId,
		String pidgeOrderId,
		Optional<DeliveryTracking> tracking) {}
