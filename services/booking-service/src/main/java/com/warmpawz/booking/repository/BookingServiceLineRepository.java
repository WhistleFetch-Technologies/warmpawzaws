package com.warmpawz.booking.repository;

import com.warmpawz.booking.entity.BookingService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookingServiceLineRepository extends JpaRepository<BookingService, UUID> {
    List<BookingService> findByBookingId(UUID bookingId);

    void deleteByBookingId(UUID bookingId);
}
