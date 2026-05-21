package com.warmpawz.booking.service.serviceimpl;

import com.warmpawz.booking.dto.request.CancelBookingRequest;
import com.warmpawz.booking.dto.request.CreateBookingRequest;
import com.warmpawz.booking.dto.request.CreateFollowUpRequest;
import com.warmpawz.booking.dto.request.GenerateOtpRequest;
import com.warmpawz.booking.dto.request.RescheduleBookingRequest;
import com.warmpawz.booking.dto.request.UpdateBookingStatusRequest;
import com.warmpawz.booking.dto.request.VendorCancelBookingRequest;
import com.warmpawz.booking.dto.request.VerifyOtpRequest;
import com.warmpawz.booking.dto.response.AvailableSlotResponse;
import com.warmpawz.booking.dto.response.BookingRefundInfo;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.CancelBookingResult;
import com.warmpawz.booking.dto.response.OtpResponse;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.dto.response.ReschedulePolicyResponse;
import com.warmpawz.booking.entity.Booking;
import com.warmpawz.booking.entity.BookingStatusHistory;
import com.warmpawz.booking.enums.BookingStatus;
import com.warmpawz.booking.exception.BadRequestException;
import com.warmpawz.booking.exception.ConflictException;
import com.warmpawz.booking.exception.NotFoundException;
import com.warmpawz.booking.mapper.BookingMapper;
import com.warmpawz.booking.repository.BookingRepository;
import com.warmpawz.booking.repository.BookingServiceLineRepository;
import com.warmpawz.booking.repository.BookingStatusHistoryRepository;
import com.warmpawz.booking.service.BookingOtpProtection;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.service.BookingCancelRefundService;
import com.warmpawz.booking.service.RefundCalculationService;
import com.warmpawz.booking.service.BookingEventPublisher;
import com.warmpawz.booking.util.BookingOtpServiceTypes;
import com.warmpawz.booking.util.BookingOtpUtil;
import com.warmpawz.booking.util.BookingTimeUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final BookingStatusHistoryRepository statusHistoryRepository;
    private final BookingServiceLineRepository serviceLineRepository;
    private final BookingEventPublisher bookingEventPublisher;
    private final RefundCalculationService refundCalculationService;
    private final BookingCancelRefundService bookingCancelRefundService;
    private final BookingOtpProtection bookingOtpProtection;

    /** Allowed transitions: from-status → set of valid to-statuses */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            BookingStatus.PENDING, Set.of(BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.PENDING_PAYMENT),
            BookingStatus.PENDING_PAYMENT, Set.of(BookingStatus.CONFIRMED, BookingStatus.CANCELLED),
            BookingStatus.CONFIRMED, Set.of(BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED, BookingStatus.RESCHEDULED,
                    BookingStatus.NO_SHOW, BookingStatus.VENDOR_ON_WAY),
            BookingStatus.IN_PROGRESS, Set.of(BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.ARRIVED),
            BookingStatus.VENDOR_ON_WAY, Set.of(BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED),
            BookingStatus.ARRIVED, Set.of(BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED, BookingStatus.CANCELLED),
            BookingStatus.SCHEDULED, Set.of(BookingStatus.CONFIRMED, BookingStatus.CANCELLED)
    );

    private static final Set<String> TERMINAL_STATUSES = Set.of(
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW,
            BookingStatus.RESCHEDULED,
            BookingStatus.PARTIALLY_COMPLETED
    );

    private static final List<String> VENDOR_LIST_EXCLUDED_STATUSES = List.of(BookingStatus.PENDING_PAYMENT);

    private static final Set<String> RESCHEDULABLE_STATUSES = Set.of(
            BookingStatus.PENDING,
            BookingStatus.PENDING_PAYMENT,
            BookingStatus.CONFIRMED
    );

    private static final Set<String> NON_REFUNDABLE_STATUSES = Set.of(
            BookingStatus.COMPLETED,
            BookingStatus.CANCELLED,
            BookingStatus.NO_SHOW
    );

    private static final int DEFAULT_MIN_NOTICE_HOURS = 2;
    private static final int SLOT_START_MINUTES = 8 * 60;
    private static final int SLOT_END_MINUTES = 20 * 60;
    private static final int SLOT_INTERVAL_MINUTES = 30;

    @Override
    public BookingResponse createBooking(CreateBookingRequest request) {
        LocalTime bookingTime = BookingTimeUtil.parseBookingTime(request.getBookingTime());
        int startMinutes = BookingTimeUtil.toMinutes(bookingTime);

        int effectiveDuration = 30;
        if (request.getSelectedServices() != null && !request.getSelectedServices().isEmpty()) {
            effectiveDuration = request.getSelectedServices().stream()
                    .mapToInt(s -> s.getDurationMinutes() != null ? s.getDurationMinutes() : 30)
                    .sum();
        }
        int endMinutes = startMinutes + effectiveDuration;

        Instant windowStart = Instant.now().minus(5, ChronoUnit.MINUTES);
        List<Booking> duplicates = bookingRepository.findRecentDuplicates(
                request.getCustomerId(),
                request.getVendorId(),
                request.getBookingDate(),
                bookingTime,
                request.getStaffId(),
                windowStart
        );
        if (!duplicates.isEmpty()) {
            log.info("event=booking_duplicate_detected bookingId={} customerId={}", duplicates.get(0).getId(), request.getCustomerId());
            return BookingMapper.toBookingResponse(duplicates.get(0));
        }

        // Reuse unpaid booking for the same slot (e.g. customer tapped Pay again after a failed Razorpay step).
        List<Booking> atSlot = bookingRepository.findActiveBookingsAtSlot(
                request.getVendorId(),
                request.getBookingDate(),
                bookingTime
        );
        for (Booking existing : atSlot) {
            if (isReusableBookingForCustomer(existing, request.getCustomerId())) {
                log.info("event=booking_reuse_existing bookingId={} customerId={} status={}",
                        existing.getId(), request.getCustomerId(), existing.getStatus());
                return BookingMapper.toBookingResponse(existing);
            }
        }

        List<Booking> overlapping = bookingRepository.findOverlappingBookings(
                request.getVendorId(),
                request.getBookingDate(),
                request.getStaffId(),
                startMinutes,
                endMinutes
        );
        if (!overlapping.isEmpty()) {
            Optional<Booking> ownReusable = overlapping.stream()
                    .filter(b -> isReusableBookingForCustomer(b, request.getCustomerId()))
                    .findFirst();
            if (ownReusable.isPresent()) {
                log.info("event=booking_reuse_existing_overlap bookingId={} customerId={}",
                        ownReusable.get().getId(), request.getCustomerId());
                return BookingMapper.toBookingResponse(ownReusable.get());
            }
            throw new ConflictException("This time slot is not available");
        }

        BigDecimal payableAmount = resolvePayableAmount(request);

        String initialStatus;
        boolean isFree = payableAmount.compareTo(BigDecimal.ZERO) <= 0;
        boolean isPackage = request.getPackagePurchaseId() != null;
        if (isFree || isPackage) {
            initialStatus = BookingStatus.CONFIRMED;
        } else {
            initialStatus = BookingStatus.PENDING_PAYMENT;
        }

        Booking booking = new Booking();
        booking.setCustomerId(request.getCustomerId());
        booking.setCustomerPhone(request.getCustomerPhone());
        booking.setVendorId(request.getVendorId());
        booking.setServiceId(request.getServiceId());
        booking.setStaffId(request.getStaffId());
        booking.setPetId(request.getPetId());
        booking.setBookingDate(request.getBookingDate());
        booking.setBookingTime(bookingTime);
        booking.setStatus(initialStatus);
        booking.setServiceType(request.getServiceType());
        booking.setServiceStyle(request.getServiceStyle());
        String resolvedAddress = request.getAddress();
        if (resolvedAddress == null || resolvedAddress.isBlank()) {
            String line1 = request.getAddressLine1();
            String line2 = request.getAddressLine2();
            if (line1 != null && !line1.isBlank()) {
                resolvedAddress = line2 != null && !line2.isBlank()
                        ? line1.trim() + ", " + line2.trim()
                        : line1.trim();
            }
        }
        booking.setAddress(resolvedAddress);
        booking.setAddressLine1(request.getAddressLine1());
        booking.setAddressLine2(request.getAddressLine2());
        booking.setCity(request.getCity());
        booking.setState(request.getState());
        booking.setPincode(request.getPincode());
        booking.setLatitude(request.getLatitude());
        booking.setLongitude(request.getLongitude());
        booking.setBasePrice(request.getAmount() != null ? request.getAmount() : BigDecimal.ZERO);
        booking.setTotalAmount(payableAmount);
        booking.setDurationMinutes(effectiveDuration);
        booking.setTotalDurationMinutes(effectiveDuration);
        booking.setPackagePurchaseId(request.getPackagePurchaseId());
        if (request.getPackagePurchaseId() != null) {
            booking.setIsPackageSession(Boolean.TRUE);
        }
        booking.setCheckOutDate(request.getCheckOutDate());
        if (request.getCheckOutTime() != null && !request.getCheckOutTime().isBlank()) {
            booking.setCheckOutTime(BookingTimeUtil.parseBookingTime(request.getCheckOutTime()));
        }
        booking.setFlowVariant(request.getFlowVariant());
        booking.setNotes(request.getNotes());
        booking.setSubscriptionId(request.getSubscriptionId());

        Booking saved = bookingRepository.save(booking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(saved.getId());
        history.setFromStatus(null);
        history.setToStatus(saved.getStatus());
        history.setChangedBy(request.getCustomerId().toString());
        history.setChangedByType("customer");
        statusHistoryRepository.save(history);

        if (request.getSelectedServices() != null && !request.getSelectedServices().isEmpty()) {
            for (CreateBookingRequest.SelectedServiceItem item : request.getSelectedServices()) {
                com.warmpawz.booking.entity.BookingService line = new com.warmpawz.booking.entity.BookingService();
                line.setBookingId(saved.getId());
                line.setServiceId(item.getServiceId());
                line.setServiceName(item.getServiceName());
                line.setPrice(item.getPrice());
                line.setDurationMinutes(item.getDurationMinutes());
                line.setQuantity(item.getQuantity() != null ? item.getQuantity() : 1);
                serviceLineRepository.save(line);
            }
        }

        log.info("event=booking_created bookingId={} customerId={} vendorId={} status={}",
                saved.getId(), saved.getCustomerId(), saved.getVendorId(), saved.getStatus());

        bookingEventPublisher.publishBookingCreatedAfterCommit(
                saved.getId(), saved.getCustomerId(), saved.getVendorId(),
                saved.getStatus(), saved.getTotalAmount());

        return BookingMapper.toBookingResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getBookingById(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        return BookingMapper.toBookingResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getBookingByIdForCustomer(UUID bookingId, UUID customerId) {
        Booking booking = bookingRepository.findByIdAndCustomerId(bookingId, customerId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        return BookingMapper.toBookingResponse(booking);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BookingResponse> getBookingsByCustomer(UUID customerId, int page, int size, String status) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Booking> bookingsPage;
        if (status != null && !status.isBlank()) {
            bookingsPage = bookingRepository.findByCustomerIdAndStatusAndIsPackageSessionFalse(
                    customerId, status, pageable);
        } else {
            bookingsPage = bookingRepository.findByCustomerIdAndIsPackageSessionFalse(customerId, pageable);
        }
        return bookingsPage.map(BookingMapper::toBookingResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BookingResponse> getBookingsByCustomerAndPet(UUID customerId, UUID petId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Booking> bookingsPage = bookingRepository.findByCustomerIdAndPetIdAndIsPackageSessionFalse(
                customerId, petId, pageable);
        return bookingsPage.map(BookingMapper::toBookingResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingStatusHistory> getBookingHistory(UUID bookingId) {
        bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        return statusHistoryRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
    }

    @Override
    public BookingResponse updateBookingStatusForVendor(UUID bookingId, UUID vendorId, UpdateBookingStatusRequest request) {
        requireVendorBooking(bookingId, vendorId);
        return updateBookingStatus(bookingId, request);
    }

    @Override
    public BookingResponse updateBookingStatus(UUID bookingId, UpdateBookingStatusRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        String currentStatus = booking.getStatus();
        String newStatus = request.getStatus();

        if (TERMINAL_STATUSES.contains(currentStatus)) {
            throw new BadRequestException("Cannot transition from terminal status: " + currentStatus);
        }

        Set<String> allowed = ALLOWED_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(newStatus)) {
            throw new BadRequestException(
                    "Invalid status transition from '" + currentStatus + "' to '" + newStatus + "'");
        }

        booking.setStatus(newStatus);
        if (BookingStatus.COMPLETED.equals(newStatus)) {
            booking.setCompletedAt(Instant.now());
        }

        Booking updated = bookingRepository.save(booking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(updated.getId());
        history.setFromStatus(currentStatus);
        history.setToStatus(newStatus);
        history.setReason(request.getReason());
        history.setChangedBy(request.getActorId());
        history.setChangedByType(request.getActorType());
        statusHistoryRepository.save(history);

        log.info("event=booking_status_updated bookingId={} from={} to={}", bookingId, currentStatus, newStatus);

        bookingEventPublisher.publishBookingStatusUpdatedAfterCommit(
                updated.getId(), currentStatus, newStatus,
                updated.getCustomerId(), updated.getVendorId());

        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    public CancelBookingResult cancelBooking(UUID bookingId, UUID customerId, CancelBookingRequest request) {
        return cancelBookingInternal(bookingId, customerId, request);
    }

    @Override
    @Transactional(readOnly = true)
    public RefundPreviewResponse previewRefund(UUID bookingId, UUID customerId) {
        return previewRefund(bookingId, customerId, "customer");
    }

    @Override
    @Transactional(readOnly = true)
    public RefundPreviewResponse previewRefund(UUID bookingId, UUID customerId, String cancelledByType) {
        Booking booking = requireCustomerBooking(bookingId, customerId);

        if (NON_REFUNDABLE_STATUSES.contains(booking.getStatus())) {
            throw new BadRequestException("Booking cannot be refunded");
        }

        return refundCalculationService.calculateRefund(booking, cancelledByType);
    }

    @Override
    public CancelBookingResult cancelBookingWithRefund(UUID bookingId, UUID customerId, CancelBookingRequest request) {
        return cancelBookingInternal(bookingId, customerId, request);
    }

    private CancelBookingResult cancelBookingInternal(UUID bookingId, UUID customerId, CancelBookingRequest request) {
        if (request == null) {
            request = new CancelBookingRequest();
        }

        Booking booking = requireCustomerBooking(bookingId, customerId);

        String currentStatus = booking.getStatus();
        Set<String> cancellableStatuses = Set.of(
                BookingStatus.PENDING,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED
        );
        if (!cancellableStatuses.contains(currentStatus)) {
            throw new BadRequestException("Cannot cancel a booking that is " + currentStatus);
        }

        RefundPreviewResponse refundPreview = refundCalculationService.calculateRefund(booking, "customer");

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(request.getReason());
        booking.setCancelledAt(Instant.now());
        Booking updated = bookingRepository.save(booking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(updated.getId());
        history.setFromStatus(currentStatus);
        history.setToStatus(BookingStatus.CANCELLED);
        history.setReason(request.getReason());
        history.setChangedBy(customerId.toString());
        history.setChangedByType("customer");
        statusHistoryRepository.save(history);

        log.info("event=booking_cancelled bookingId={} reason={} refundAmount={} refundPercentage={}",
                bookingId, request.getReason(), refundPreview.getRefundAmount(), refundPreview.getRefundPercentage());

        bookingEventPublisher.publishBookingStatusUpdatedAfterCommit(
                updated.getId(), currentStatus, BookingStatus.CANCELLED,
                updated.getCustomerId(), updated.getVendorId());

        BookingRefundInfo refundInfo = bookingCancelRefundService.processRefundAfterCancel(
                updated, customerId, request, refundPreview);

        return new CancelBookingResult(BookingMapper.toBookingResponse(updated), refundInfo);
    }

    @Override
    public BookingResponse rescheduleBooking(UUID bookingId, UUID customerId, RescheduleBookingRequest request) {
        Booking booking = requireCustomerBooking(bookingId, customerId);

        String currentStatus = booking.getStatus();
        if (!RESCHEDULABLE_STATUSES.contains(currentStatus)) {
            throw new BadRequestException("Cannot reschedule a booking that is " + currentStatus);
        }

        String reason = request.getReason() != null && !request.getReason().isBlank()
                ? request.getReason()
                : "Customer reschedule request";

        LocalTime newTime = BookingTimeUtil.parseBookingTime(request.getNewTime());
        int startMinutes = BookingTimeUtil.toMinutes(newTime);
        int effectiveDuration = booking.getDurationMinutes() != null ? booking.getDurationMinutes() : 30;
        int endMinutes = startMinutes + effectiveDuration;

        List<Booking> slotConflicts = bookingRepository.findOverlappingBookings(
                booking.getVendorId(),
                request.getNewDate(),
                booking.getStaffId(),
                startMinutes,
                endMinutes
        ).stream()
                .filter(b -> !b.getId().equals(bookingId))
                .toList();

        if (!slotConflicts.isEmpty()) {
            throw new ConflictException("The requested time slot is already booked");
        }

        LocalDate oldDate = booking.getBookingDate();
        LocalTime oldTime = booking.getBookingTime();

        booking.setBookingDate(request.getNewDate());
        booking.setBookingTime(newTime);
        booking.setRescheduleReason(reason);
        booking.setRescheduledFromBookingId(bookingId);

        if (booking.getCheckOutTime() != null) {
            booking.setCheckOutTime(newTime.plusMinutes(effectiveDuration));
        }

        String noteEntry = "Rescheduled: " + reason;
        if (booking.getNotes() == null || booking.getNotes().isBlank()) {
            booking.setNotes(noteEntry);
        } else {
            booking.setNotes(booking.getNotes() + " | " + noteEntry);
        }

        Booking updated = bookingRepository.save(booking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(updated.getId());
        history.setFromStatus(currentStatus);
        history.setToStatus(currentStatus);
        history.setReason(String.format(
                "Rescheduled to %s %s: %s", request.getNewDate(), request.getNewTime(), reason));
        history.setChangedBy(customerId.toString());
        history.setChangedByType("customer");
        statusHistoryRepository.save(history);

        bookingEventPublisher.publishBookingStatusUpdatedAfterCommit(
                updated.getId(), currentStatus, currentStatus,
                updated.getCustomerId(), updated.getVendorId());

        log.info("event=booking_rescheduled bookingId={} oldDate={} oldTime={} newDate={} newTime={}",
                bookingId, oldDate, oldTime, request.getNewDate(), request.getNewTime());
        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getFollowUpEligibleBookings(UUID customerId) {
        Instant thirtyDaysAgo = Instant.now().minus(30, ChronoUnit.DAYS);
        List<Booking> bookings = bookingRepository.findFollowUpEligible(customerId, thirtyDaysAgo);
        return BookingMapper.toBookingResponseList(bookings);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<BookingResponse> getBookingsByVendor(UUID vendorId, int page, int size, String status) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Booking> bookingsPage;
        if (status != null && !status.isBlank()) {
            bookingsPage = bookingRepository.findByVendorIdAndStatus(vendorId, status, pageable);
        } else {
            bookingsPage = bookingRepository.findByVendorIdAndStatusNotInOrderByBookingDateAscBookingTimeAsc(
                    vendorId, VENDOR_LIST_EXCLUDED_STATUSES, pageable);
        }
        return bookingsPage.map(BookingMapper::toBookingResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<BookingResponse> getTodayBookingsForVendor(UUID vendorId) {
        List<Booking> bookings = bookingRepository.findTodayBookingsForVendor(vendorId, LocalDate.now());
        return BookingMapper.toBookingResponseList(bookings);
    }

    @Override
    @Transactional(readOnly = true)
    public BookingResponse getBookingDetailsForVendor(UUID bookingId, UUID vendorId) {
        if (vendorId != null) {
            Booking booking = bookingRepository.findByIdAndVendorId(bookingId, vendorId)
                    .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
            return BookingMapper.toBookingResponse(booking);
        }
        return getBookingById(bookingId);
    }

    @Override
    public BookingResponse vendorConfirmBooking(UUID bookingId, UUID vendorId) {
        Booking booking = requireVendorBooking(bookingId, vendorId);
        String previousStatus = booking.getStatus();
        BookingResponse response = transitionVendorPendingBooking(
                bookingId, vendorId, BookingStatus.CONFIRMED, "vendor_confirmed_booking");
        bookingEventPublisher.publishBookingStatusUpdatedAfterCommit(
                response.getId(), previousStatus, BookingStatus.CONFIRMED,
                response.getCustomerId(), response.getVendorId());
        return response;
    }

    @Override
    public BookingResponse vendorAcceptBooking(UUID bookingId, UUID vendorId) {
        return transitionVendorPendingBooking(
                bookingId, vendorId, BookingStatus.CONFIRMED, "vendor_accepted_booking");
    }

    @Override
    public BookingResponse vendorRejectBooking(UUID bookingId, UUID vendorId, String reason) {
        return cancelVendorBooking(bookingId, vendorId, reason, "vendor_rejected_booking");
    }

    @Override
    public BookingResponse vendorDeclineBooking(UUID bookingId, UUID vendorId, String reason) {
        return cancelVendorBooking(bookingId, vendorId, reason, "vendor_declined_booking");
    }

    @Override
    public BookingResponse vendorCancelBooking(UUID bookingId, UUID vendorId, VendorCancelBookingRequest request) {
        Booking booking = requireVendorBooking(bookingId, vendorId);
        String currentStatus = booking.getStatus();
        Set<String> cancellableStatuses = Set.of(BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED);
        if (!cancellableStatuses.contains(currentStatus)) {
            throw new BadRequestException("Cannot cancel a booking that is " + currentStatus);
        }
        if (request.getVendorCancellationReason() == null || request.getVendorCancellationReason().isBlank()) {
            throw new BadRequestException("Vendor cancellation reason is required");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(request.getVendorCancellationReason());
        booking.setCancelledAt(Instant.now());
        Booking updated = bookingRepository.save(booking);

        saveVendorStatusHistory(updated.getId(), currentStatus, BookingStatus.CANCELLED,
                request.getVendorCancellationReason(), vendorId);

        log.info("event=vendor_cancelled_booking bookingId={} vendorId={}", bookingId, vendorId);
        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    public OtpResponse generateOtp(GenerateOtpRequest request, UUID principalId) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new NotFoundException("Booking not found: " + request.getBookingId()));
        requireBookingCustomerOrVendor(booking, principalId);

        if (BookingOtpServiceTypes.isTeleBooking(booking, request.getServiceStyle())) {
            throw new BadRequestException("OTP not required for tele consultations");
        }

        if (hasActiveOtp(booking)) {
            log.info("event=otp_retrieved bookingId={}", booking.getId());
            return new OtpResponse(booking.getId(), "Existing OTP retrieved", booking.getOtpExpiresAt());
        }

        bookingOtpProtection.assertGenerateAllowed(booking.getId());
        String otp = BookingOtpUtil.generateOtpCode();
        booking.setOtpCode(otp);
        booking.setOtpExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        booking.setOtpVerified(false);
        bookingRepository.save(booking);
        bookingOtpProtection.recordGenerate(booking.getId());

        log.info("event=otp_generated bookingId={}", booking.getId());
        return new OtpResponse(booking.getId(), "OTP generated", booking.getOtpExpiresAt());
    }

    @Override
    public BookingResponse verifyOtp(VerifyOtpRequest request, UUID vendorId) {
        Booking booking = requireVendorBooking(request.getBookingId(), vendorId);

        if (booking.getOtpCode() == null) {
            throw new BadRequestException("No OTP generated for this booking");
        }
        if (booking.getOtpExpiresAt() != null && Instant.now().isAfter(booking.getOtpExpiresAt())) {
            throw new BadRequestException("OTP has expired");
        }

        bookingOtpProtection.assertVerifyAllowed(booking.getId());

        String providedOtp = request.getOtp() != null ? request.getOtp().trim() : "";
        String expectedOtp = booking.getOtpCode().trim();
        if (!BookingOtpUtil.constantTimeEquals(expectedOtp, providedOtp)) {
            bookingOtpProtection.recordFailedVerify(booking.getId(), booking.getOtpExpiresAt());
            throw new BadRequestException("Invalid OTP");
        }

        bookingOtpProtection.resetVerifyAttempts(booking.getId());

        String previousStatus = booking.getStatus();
        booking.setOtpVerified(true);
        booking.setOtpVerifiedAt(Instant.now());
        if (BookingStatus.CONFIRMED.equals(previousStatus)) {
            booking.setStatus(BookingStatus.IN_PROGRESS);
        }
        Booking updated = bookingRepository.save(booking);

        if (!previousStatus.equals(updated.getStatus())) {
            BookingStatusHistory history = new BookingStatusHistory();
            history.setBookingId(updated.getId());
            history.setFromStatus(previousStatus);
            history.setToStatus(updated.getStatus());
            history.setChangedByType("system");
            statusHistoryRepository.save(history);
        }

        log.info("event=otp_verified bookingId={}", booking.getId());
        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AvailableSlotResponse> getAvailableSlots(UUID vendorId, LocalDate date,
                                                         String serviceStyle, Integer durationMinutes) {
        int duration = durationMinutes != null ? durationMinutes : 30;
        List<AvailableSlotResponse> slots = new ArrayList<>();
        for (int startMinutes = SLOT_START_MINUTES; startMinutes < SLOT_END_MINUTES;
             startMinutes += SLOT_INTERVAL_MINUTES) {
            int endMinutes = startMinutes + duration;
            String time = minutesToTime(startMinutes);
            List<Booking> overlapping = bookingRepository.findOverlappingBookings(
                    vendorId, date, null, startMinutes, endMinutes);
            if (overlapping.isEmpty()) {
                slots.add(new AvailableSlotResponse(time, true, null));
            } else {
                slots.add(new AvailableSlotResponse(time, false, "booked"));
            }
        }
        return slots;
    }

    @Override
    public BookingResponse createFollowUp(CreateFollowUpRequest request) {
        Booking original = bookingRepository.findById(request.getOriginalBookingId())
                .orElseThrow(() -> new NotFoundException("Booking not found: " + request.getOriginalBookingId()));

        if (!BookingStatus.COMPLETED.equals(original.getStatus())) {
            throw new BadRequestException("Follow-up can only be created for completed bookings");
        }

        LocalTime selectedTime = BookingTimeUtil.parseBookingTime(request.getSelectedTime());
        List<Booking> slotConflicts = bookingRepository.findActiveBookingsAtSlot(
                request.getVendorId(), request.getSelectedDate(), selectedTime);
        if (!slotConflicts.isEmpty()) {
            throw new ConflictException("The requested time slot is already booked");
        }

        Booking newBooking = new Booking();
        newBooking.setCustomerId(original.getCustomerId());
        newBooking.setCustomerPhone(
                request.getCustomerPhone() != null ? request.getCustomerPhone() : original.getCustomerPhone());
        newBooking.setVendorId(original.getVendorId());
        newBooking.setServiceId(original.getServiceId());
        newBooking.setStaffId(request.getStaffId() != null ? request.getStaffId() : original.getStaffId());
        newBooking.setPetId(request.getPetId() != null ? request.getPetId() : original.getPetId());
        newBooking.setBookingDate(request.getSelectedDate());
        newBooking.setBookingTime(selectedTime);
        newBooking.setStatus(BookingStatus.PENDING);
        newBooking.setServiceType(original.getServiceType());
        newBooking.setServiceStyle(original.getServiceStyle());
        newBooking.setAddress(original.getAddress());
        newBooking.setAddressLine1(original.getAddressLine1());
        newBooking.setAddressLine2(original.getAddressLine2());
        newBooking.setCity(original.getCity());
        newBooking.setState(original.getState());
        newBooking.setPincode(original.getPincode());
        newBooking.setLatitude(original.getLatitude());
        newBooking.setLongitude(original.getLongitude());
        newBooking.setBasePrice(original.getBasePrice());
        newBooking.setDiscountAmount(original.getDiscountAmount());
        newBooking.setTaxAmount(original.getTaxAmount());
        newBooking.setTotalAmount(original.getTotalAmount());
        newBooking.setDurationMinutes(original.getDurationMinutes());
        newBooking.setTotalDurationMinutes(original.getTotalDurationMinutes());
        newBooking.setNotes(request.getNotes());
        Booking saved = bookingRepository.save(newBooking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(saved.getId());
        history.setFromStatus(null);
        history.setToStatus(BookingStatus.PENDING);
        history.setChangedBy(original.getCustomerId().toString());
        history.setChangedByType("customer");
        statusHistoryRepository.save(history);

        List<com.warmpawz.booking.entity.BookingService> originalServiceLines =
                serviceLineRepository.findByBookingId(original.getId());
        for (com.warmpawz.booking.entity.BookingService line : originalServiceLines) {
            com.warmpawz.booking.entity.BookingService copy = new com.warmpawz.booking.entity.BookingService();
            copy.setBookingId(saved.getId());
            copy.setServiceId(line.getServiceId());
            copy.setServiceName(line.getServiceName());
            copy.setPrice(line.getPrice());
            copy.setDurationMinutes(line.getDurationMinutes());
            copy.setQuantity(line.getQuantity() != null ? line.getQuantity() : 1);
            serviceLineRepository.save(copy);
        }

        log.info("event=followup_created originalId={} newId={}", original.getId(), saved.getId());
        return BookingMapper.toBookingResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public ReschedulePolicyResponse getReschedulePolicy(UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        String currentStatus = booking.getStatus();
        boolean canReschedule = true;
        String reason = null;

        ZoneId vendorZone = resolveVendorZone(booking.getVendorTimezone());

        if (!RESCHEDULABLE_STATUSES.contains(currentStatus)) {
            canReschedule = false;
            reason = "Booking is not in a reschedulable state";
        } else if (booking.getBookingDate().isBefore(LocalDate.now(vendorZone))) {
            canReschedule = false;
            reason = "Cannot reschedule a past booking";
        }

        ZonedDateTime bookingDateTime = LocalDateTime.of(booking.getBookingDate(), booking.getBookingTime())
                .atZone(vendorZone);
        long hoursUntilBooking = ChronoUnit.HOURS.between(Instant.now(), bookingDateTime.toInstant());

        if (canReschedule && hoursUntilBooking < DEFAULT_MIN_NOTICE_HOURS) {
            canReschedule = false;
            reason = "Too close to booking time";
        }

        return new ReschedulePolicyResponse(
                booking.getId(),
                currentStatus,
                canReschedule,
                reason,
                hoursUntilBooking,
                DEFAULT_MIN_NOTICE_HOURS
        );
    }

    private BookingResponse transitionVendorPendingBooking(
            UUID bookingId, UUID vendorId, String newStatus, String logEvent) {
        Booking booking = requireVendorBooking(bookingId, vendorId);
        String currentStatus = booking.getStatus();
        boolean isConfirmable = BookingStatus.PENDING.equals(currentStatus)
                || BookingStatus.PENDING_PAYMENT.equals(currentStatus);
        if (!isConfirmable) {
            throw new BadRequestException("Can only confirm pending or pending_payment bookings");
        }

        booking.setStatus(newStatus);
        Booking updated = bookingRepository.save(booking);
        saveVendorStatusHistory(updated.getId(), currentStatus, newStatus, null, vendorId);
        log.info("event={} bookingId={} vendorId={}", logEvent, bookingId, vendorId);
        return BookingMapper.toBookingResponse(updated);
    }

    private BookingResponse cancelVendorBooking(
            UUID bookingId, UUID vendorId, String reason, String logEvent) {
        Booking booking = requireVendorBooking(bookingId, vendorId);
        String currentStatus = booking.getStatus();
        boolean isRejectable = BookingStatus.PENDING.equals(currentStatus)
                || BookingStatus.PENDING_PAYMENT.equals(currentStatus);
        if (!isRejectable) {
            throw new BadRequestException("Can only reject pending or pending_payment bookings");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(reason);
        booking.setCancelledAt(Instant.now());
        Booking updated = bookingRepository.save(booking);
        saveVendorStatusHistory(updated.getId(), currentStatus, BookingStatus.CANCELLED, reason, vendorId);
        log.info("event={} bookingId={} vendorId={}", logEvent, bookingId, vendorId);
        return BookingMapper.toBookingResponse(updated);
    }

    private Booking requireCustomerBooking(UUID bookingId, UUID customerId) {
        return bookingRepository.findByIdAndCustomerId(bookingId, customerId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
    }

    private Booking requireVendorBooking(UUID bookingId, UUID vendorId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        if (!booking.getVendorId().equals(vendorId)) {
            throw new NotFoundException("Booking not found: " + bookingId);
        }
        return booking;
    }

    private void requireBookingCustomerOrVendor(Booking booking, UUID principalId) {
        boolean customer = booking.getCustomerId().equals(principalId);
        boolean vendor = booking.getVendorId().equals(principalId);
        if (!customer && !vendor) {
            throw new NotFoundException("Booking not found: " + booking.getId());
        }
    }

    private static boolean hasActiveOtp(Booking booking) {
        if (booking.getOtpCode() == null || booking.getOtpCode().isBlank()) {
            return false;
        }
        Instant expiresAt = booking.getOtpExpiresAt();
        return expiresAt == null || Instant.now().isBefore(expiresAt);
    }

    private void saveVendorStatusHistory(
            UUID bookingId, String fromStatus, String toStatus, String reason, UUID vendorId) {
        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(bookingId);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setReason(reason);
        history.setChangedBy(vendorId.toString());
        history.setChangedByType("vendor");
        statusHistoryRepository.save(history);
    }

    /**
     * Customer-web sends {@code amount}; some clients also send {@code totalAmount}.
     * Treating null totalAmount as free incorrectly created {@code confirmed} bookings and caused 409s.
     */
    private static BigDecimal resolvePayableAmount(CreateBookingRequest request) {
        if (request.getTotalAmount() != null) {
            return request.getTotalAmount();
        }
        if (request.getAmount() != null) {
            return request.getAmount();
        }
        return BigDecimal.ZERO;
    }

    private static boolean isReusableBookingForCustomer(Booking booking, UUID customerId) {
        if (!customerId.equals(booking.getCustomerId())) {
            return false;
        }
        if (BookingStatus.PENDING_PAYMENT.equals(booking.getStatus())) {
            return true;
        }
        return BookingStatus.CONFIRMED.equals(booking.getStatus())
                && booking.getPaymentStatus() != null
                && "pending".equalsIgnoreCase(booking.getPaymentStatus());
    }

    private int parseTimeToMinutes(String bookingTime) {
        String[] parts = bookingTime.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    private String minutesToTime(int minutes) {
        return String.format("%02d:%02d", minutes / 60, minutes % 60);
    }

    private static ZoneId resolveVendorZone(String vendorTimezone) {
        if (vendorTimezone != null && !vendorTimezone.isBlank()) {
            try {
                return ZoneId.of(vendorTimezone);
            } catch (Exception ignored) {
                // fall through to UTC default
            }
        }
        return ZoneOffset.UTC;
    }
}
