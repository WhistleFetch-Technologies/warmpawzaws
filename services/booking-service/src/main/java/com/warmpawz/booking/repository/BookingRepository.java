package com.warmpawz.booking.repository;

import com.warmpawz.booking.entity.Booking;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    Optional<Booking> findByIdAndCustomerId(UUID id, UUID customerId);

    Optional<Booking> findByIdAndVendorId(UUID id, UUID vendorId);

    List<Booking> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    Page<Booking> findByCustomerIdAndStatusNotIn(UUID customerId, List<String> excludedStatuses, Pageable pageable);

    Page<Booking> findByCustomerId(UUID customerId, Pageable pageable);

    Page<Booking> findByCustomerIdAndIsPackageSessionFalse(UUID customerId, Pageable pageable);

    Page<Booking> findByCustomerIdAndStatusAndIsPackageSessionFalse(
            UUID customerId, String status, Pageable pageable);

    Page<Booking> findByCustomerIdAndPetIdAndIsPackageSessionFalse(
            UUID customerId, UUID petId, Pageable pageable);

    Page<Booking> findByVendorId(UUID vendorId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT b FROM Booking b
            WHERE b.vendorId = :vendorId
              AND b.bookingDate = :bookingDate
              AND b.status NOT IN ('cancelled', 'no_show', 'rescheduled')
              AND (:staffId IS NULL AND b.staffId IS NULL
                   OR b.staffId = :staffId)
              AND (
                (:startMinutes < (CAST(SUBSTRING(b.bookingTime, 1, 2) AS integer) * 60
                                  + CAST(SUBSTRING(b.bookingTime, 4, 2) AS integer)
                                  + COALESCE(b.durationMinutes, b.totalDurationMinutes, 30)))
                AND
                ((CAST(SUBSTRING(b.bookingTime, 1, 2) AS integer) * 60
                  + CAST(SUBSTRING(b.bookingTime, 4, 2) AS integer)) < :endMinutes)
              )
            """)
    List<Booking> findOverlappingBookings(
            @Param("vendorId") UUID vendorId,
            @Param("bookingDate") LocalDate bookingDate,
            @Param("staffId") UUID staffId,
            @Param("startMinutes") int startMinutes,
            @Param("endMinutes") int endMinutes
    );

    @Query("""
            SELECT b FROM Booking b
            WHERE b.customerId = :customerId
              AND b.vendorId = :vendorId
              AND b.bookingDate = :bookingDate
              AND b.bookingTime = :bookingTime
              AND (:staffId IS NULL OR b.staffId = :staffId)
              AND b.status NOT IN ('cancelled', 'no_show', 'rescheduled')
              AND b.createdAt >= :windowStart
            """)
    List<Booking> findRecentDuplicates(
            @Param("customerId") UUID customerId,
            @Param("vendorId") UUID vendorId,
            @Param("bookingDate") LocalDate bookingDate,
            @Param("bookingTime") String bookingTime,
            @Param("staffId") UUID staffId,
            @Param("windowStart") Instant windowStart
    );

    @Query("SELECT b FROM Booking b WHERE b.customerId = :customerId AND b.status = 'completed' " +
           "AND b.completedAt >= :afterDate ORDER BY b.completedAt DESC")
    List<Booking> findFollowUpEligible(
            @Param("customerId") UUID customerId,
            @Param("afterDate") Instant afterDate
    );

    Page<Booking> findByVendorIdAndStatusNotInOrderByBookingDateAscBookingTimeAsc(
            UUID vendorId, List<String> excludedStatuses, Pageable pageable);

    @Query("""
            SELECT b FROM Booking b WHERE b.vendorId = :vendorId
              AND b.bookingDate = :today
              AND b.status NOT IN ('cancelled','no_show','rescheduled')
              ORDER BY b.bookingTime ASC
            """)
    List<Booking> findTodayBookingsForVendor(
            @Param("vendorId") UUID vendorId,
            @Param("today") LocalDate today);

    Page<Booking> findByVendorIdAndStatus(UUID vendorId, String status, Pageable pageable);

    @Query("""
            SELECT b FROM Booking b
            WHERE b.vendorId = :vendorId
              AND b.bookingDate = :bookingDate
              AND b.bookingTime = :bookingTime
              AND b.status NOT IN ('cancelled', 'no_show', 'rescheduled')
            """)
    List<Booking> findActiveBookingsAtSlot(
            @Param("vendorId") UUID vendorId,
            @Param("bookingDate") LocalDate bookingDate,
            @Param("bookingTime") String bookingTime);
}
