package com.warmpawz.booking.entity;

import com.warmpawz.booking.repository.BookingRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Persists a Lambda-minimal booking row against an H2 schema that mirrors prod-critical columns.
 */
@DataJpaTest
@EntityScan(basePackageClasses = Booking.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@EnableJpaRepositories(basePackageClasses = BookingRepository.class)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:booking_entity_schema;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.sql.init.mode=always",
        "spring.sql.init.schema-locations=classpath:schema/bookings-prod-h2.sql"
})
class BookingEntityPersistenceTest {

    @Autowired
    BookingRepository bookingRepository;

    @Test
    void persistMinimalBookingLikeLambdaCoreInsert() {
        UUID customerId = UUID.randomUUID();
        UUID vendorId = UUID.randomUUID();
        UUID serviceId = UUID.randomUUID();

        Booking booking = new Booking();
        booking.setCustomerId(customerId);
        booking.setVendorId(vendorId);
        booking.setServiceId(serviceId);
        booking.setBookingDate(LocalDate.now().plusDays(1));
        booking.setBookingTime(LocalTime.of(10, 0));
        booking.setStatus("pending_payment");
        booking.setServiceType("at_center");
        booking.setBasePrice(new BigDecimal("500.00"));
        booking.setTotalAmount(new BigDecimal("500.00"));

        Booking saved = bookingRepository.saveAndFlush(booking);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();

        Booking loaded = bookingRepository.findById(saved.getId()).orElseThrow();
        assertThat(loaded.getCustomerId()).isEqualTo(customerId);
        assertThat(loaded.getStatus()).isEqualTo("pending_payment");
        assertThat(loaded.getDiscountAmount()).isNull();
        assertThat(loaded.getTaxAmount()).isNull();
        assertThat(loaded.getPaymentStatus()).isNull();
        assertThat(loaded.getOtpVerified()).isNull();
    }

    @Test
    void cancelUpdateSetsCancellationFields() {
        Booking booking = minimalBooking("confirmed");
        Booking saved = bookingRepository.saveAndFlush(booking);

        saved.setStatus("cancelled");
        saved.setCancellationReason("customer request");
        saved.setCancelledAt(java.time.Instant.now());
        Booking updated = bookingRepository.saveAndFlush(saved);

        assertThat(updated.getStatus()).isEqualTo("cancelled");
        assertThat(updated.getCancellationReason()).isEqualTo("customer request");
        assertThat(updated.getCancelledAt()).isNotNull();
    }

    private static Booking minimalBooking(String status) {
        Booking booking = new Booking();
        booking.setCustomerId(UUID.randomUUID());
        booking.setVendorId(UUID.randomUUID());
        booking.setServiceId(UUID.randomUUID());
        booking.setBookingDate(LocalDate.now().plusDays(2));
        booking.setBookingTime(LocalTime.of(14, 30));
        booking.setStatus(status);
        booking.setServiceType("at_home");
        booking.setBasePrice(BigDecimal.ZERO);
        booking.setTotalAmount(BigDecimal.ZERO);
        return booking;
    }
}
