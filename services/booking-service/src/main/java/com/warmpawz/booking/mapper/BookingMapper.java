package com.warmpawz.booking.mapper;

import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.util.BookingTimeUtil;

import java.time.Instant;
import java.util.List;

public final class BookingMapper {

    private BookingMapper() {
    }

    public static BookingResponse toBookingResponse(Booking booking) {
        if (booking == null) {
            return null;
        }
        BookingResponse r = new BookingResponse();
        r.setId(booking.getId());
        r.setCustomerId(booking.getCustomerId());
        r.setCustomerPhone(booking.getCustomerPhone());
        r.setVendorId(booking.getVendorId());
        r.setStaffId(booking.getStaffId());
        r.setServiceId(booking.getServiceId());
        r.setPetId(booking.getPetId());
        r.setBookingDate(booking.getBookingDate());
        r.setBookingTime(BookingTimeUtil.formatBookingTime(booking.getBookingTime()));
        r.setStatus(booking.getStatus());
        r.setServiceType(booking.getServiceType());
        r.setServiceStyle(booking.getServiceStyle());
        r.setAddress(booking.getAddress());
        r.setAddressLine1(booking.getAddressLine1());
        r.setAddressLine2(booking.getAddressLine2());
        r.setCity(booking.getCity());
        r.setState(booking.getState());
        r.setPincode(booking.getPincode());
        r.setLatitude(booking.getLatitude());
        r.setLongitude(booking.getLongitude());
        r.setBasePrice(booking.getBasePrice());
        r.setDiscountAmount(booking.getDiscountAmount());
        r.setTaxAmount(booking.getTaxAmount());
        r.setTotalAmount(booking.getTotalAmount());
        r.setPaymentStatus(booking.getPaymentStatus());
        r.setPaymentId(booking.getPaymentId());
        r.setOtpVerified(booking.getOtpVerified());
        r.setNotes(booking.getNotes());
        r.setCancellationReason(booking.getCancellationReason());
        r.setRescheduleReason(booking.getRescheduleReason());
        r.setRescheduledFromBookingId(booking.getRescheduledFromBookingId());
        r.setPackagePurchaseId(booking.getPackagePurchaseId());
        r.setIsPackageSession(booking.getIsPackageSession());
        r.setDurationMinutes(booking.getDurationMinutes());
        r.setTotalDurationMinutes(booking.getTotalDurationMinutes());
        r.setFlowVariant(booking.getFlowVariant());
        r.setVendorTimezone(booking.getVendorTimezone());
        r.setSubscriptionId(booking.getSubscriptionId());
        r.setRoomId(booking.getRoomId() != null ? booking.getRoomId().toString() : null);
        r.setSelectedServices(booking.getSelectedServices());
        if (booking.getEstimatedArrival() != null) {
            r.setEstimatedArrival(instantToString(booking.getEstimatedArrival()));
        }
        r.setCheckOutDate(booking.getCheckOutDate());
        r.setCheckOutTime(BookingTimeUtil.formatBookingTime(booking.getCheckOutTime()));
        r.setCreatedAt(instantToString(booking.getCreatedAt()));
        r.setUpdatedAt(instantToString(booking.getUpdatedAt()));
        r.setCompletedAt(instantToString(booking.getCompletedAt()));
        r.setCancelledAt(instantToString(booking.getCancelledAt()));
        r.setSettledAt(instantToString(booking.getSettledAt()));
        return r;
    }

    public static List<BookingResponse> toBookingResponseList(List<Booking> bookings) {
        if (bookings == null) {
            return List.of();
        }
        return bookings.stream().map(BookingMapper::toBookingResponse).toList();
    }

    private static String instantToString(Instant instant) {
        return instant != null ? instant.toString() : null;
    }
}
