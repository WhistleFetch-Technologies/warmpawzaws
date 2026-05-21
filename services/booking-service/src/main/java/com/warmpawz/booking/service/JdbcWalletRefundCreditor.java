package com.warmpawz.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Set;
import java.util.UUID;

/**
 * Port of Lambda {@code creditCustomerWalletForBookingRefund} for the canonical wallet schema.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JdbcWalletRefundCreditor implements WalletRefundCreditor {

    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void creditForBookingRefund(UUID customerId, UUID bookingId, BigDecimal refundAmount, int refundPercentage) {
        if (customerId == null || bookingId == null || refundAmount == null
                || refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("creditForBookingRefund: invalid parameters");
        }

        BigDecimal amount = refundAmount.setScale(2, RoundingMode.HALF_UP);
        String descriptionLegacy = "Refund for cancelled booking (" + refundPercentage + "%)";
        String description = descriptionLegacy + " [booking:" + bookingId + "]";

        Set<String> walletTxCols = loadColumns("wallet_transactions");
        boolean hasReferenceType = walletTxCols.contains("reference_type");
        boolean hasReferenceId = walletTxCols.contains("reference_id");
        boolean hasBookingId = walletTxCols.contains("booking_id");

        jdbcTemplate.update(
                """
                INSERT INTO customer_wallets (customer_id, balance, currency)
                VALUES (?, 0, 'INR')
                ON CONFLICT (customer_id) DO NOTHING
                """,
                customerId
        );

        jdbcTemplate.queryForObject(
                "SELECT id FROM customer_wallets WHERE customer_id = ? FOR UPDATE",
                UUID.class,
                customerId
        );

        if (hasBookingId && hasReferenceType) {
            Integer existing = jdbcTemplate.query(
                    """
                    SELECT 1 FROM wallet_transactions
                    WHERE customer_id = ?
                      AND booking_id = ?
                      AND transaction_type = 'credit'
                      AND COALESCE(reference_type, '') = 'booking_refund'
                    LIMIT 1
                    """,
                    rs -> rs.next() ? 1 : null,
                    customerId,
                    bookingId
            );
            if (existing != null) {
                log.info("event=wallet_refund_idempotent_skip customerId={} bookingId={}", customerId, bookingId);
                return;
            }
        }

        BigDecimal balanceAfter = jdbcTemplate.queryForObject(
                """
                UPDATE customer_wallets
                SET balance = balance + ?, updated_at = NOW()
                WHERE customer_id = ?
                RETURNING balance
                """,
                BigDecimal.class,
                amount,
                customerId
        );
        if (balanceAfter == null) {
            throw new IllegalStateException("customer_wallets row not found for customer " + customerId);
        }

        if (hasBookingId && hasReferenceType && hasReferenceId) {
            jdbcTemplate.update(
                    """
                    INSERT INTO wallet_transactions (
                        customer_id, transaction_type, amount, balance_after,
                        booking_id, reference_type, reference_id, description
                    ) VALUES (?, 'credit', ?, ?, ?, 'booking_refund', ?, ?)
                    """,
                    customerId,
                    amount,
                    balanceAfter,
                    bookingId,
                    bookingId,
                    description
            );
        } else if (hasBookingId) {
            jdbcTemplate.update(
                    """
                    INSERT INTO wallet_transactions (
                        customer_id, transaction_type, amount, balance_after, booking_id, description
                    ) VALUES (?, 'credit', ?, ?, ?, ?)
                    """,
                    customerId,
                    amount,
                    balanceAfter,
                    bookingId,
                    description
            );
        } else {
            jdbcTemplate.update(
                    """
                    INSERT INTO wallet_transactions (
                        customer_id, transaction_type, amount, balance_after, description
                    ) VALUES (?, 'credit', ?, ?, ?)
                    """,
                    customerId,
                    amount,
                    balanceAfter,
                    description
            );
        }

        try {
            jdbcTemplate.update(
                    "UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + ? WHERE id = ?",
                    amount,
                    customerId
            );
        } catch (Exception ex) {
            log.debug("event=legacy_wallet_balance_sync_skipped customerId={} error={}", customerId, ex.getMessage());
        }

        log.info("event=wallet_refund_credited customerId={} bookingId={} amount={} percentage={}",
                customerId, bookingId, amount, refundPercentage);
    }

    private Set<String> loadColumns(String tableName) {
        try {
            return Set.copyOf(jdbcTemplate.queryForList(
                    """
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = ?
                    """,
                    String.class,
                    tableName
            ));
        } catch (Exception ex) {
            return Set.of();
        }
    }
}
