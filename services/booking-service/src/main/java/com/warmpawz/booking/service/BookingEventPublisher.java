package com.warmpawz.booking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingEventPublisher {

    private final SnsEventPublisher snsEventPublisher;

    public void publishBookingCreatedAfterCommit(
            UUID bookingId, UUID customerId, UUID vendorId, String status, BigDecimal totalAmount) {
        runAfterCommit(() -> snsEventPublisher.publishBookingCreated(
                bookingId, customerId, vendorId, status, totalAmount));
    }

    public void publishBookingStatusUpdatedAfterCommit(
            UUID bookingId, String fromStatus, String toStatus, UUID customerId, UUID vendorId) {
        runAfterCommit(() -> snsEventPublisher.publishBookingStatusUpdated(
                bookingId, fromStatus, toStatus, customerId, vendorId));
    }

    private static void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
