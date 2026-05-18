package com.warmpawz.booking.repository;

import com.warmpawz.booking.entity.BookingStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookingStatusHistoryRepository extends JpaRepository<BookingStatusHistory, UUID> {
    List<BookingStatusHistory> findByBookingIdOrderByCreatedAtAsc(UUID bookingId);
}
