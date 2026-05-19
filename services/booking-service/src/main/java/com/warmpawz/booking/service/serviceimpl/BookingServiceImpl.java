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
import com.warmpawz.booking.dto.response.BookingResponse;
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
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.service.RefundCalculationService;
import com.warmpawz.booking.service.SnsEventPublisher;
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
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
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
    private final SnsEventPublisher snsEventPublisher;
    private final RefundCalculationService refundCalculationService;

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
        String bookingTime = request.getBookingTime();
        int startMinutes = parseTimeToMinutes(bookingTime);

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

        List<Booking> overlapping = bookingRepository.findOverlappingBookings(
                request.getVendorId(),
                request.getBookingDate(),
                request.getStaffId(),
                startMinutes,
                endMinutes
        );
        if (!overlapping.isEmpty()) {
            throw new ConflictException("This time slot is not available");
        }

        String initialStatus;
        boolean isFree = request.getTotalAmount() == null || request.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0;
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
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setTaxAmount(BigDecimal.ZERO);
        booking.setTotalAmount(request.getTotalAmount() != null ? request.getTotalAmount() : BigDecimal.ZERO);
        booking.setDurationMinutes(effectiveDuration);
        booking.setTotalDurationMinutes(effectiveDuration);
        booking.setPackagePurchaseId(request.getPackagePurchaseId());
        booking.setIsPackageSession(request.getPackagePurchaseId() != null);
        booking.setCheckOutDate(request.getCheckOutDate());
        booking.setCheckOutTime(request.getCheckOutTime());
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

        snsEventPublisher.publishBookingCreated(
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

        snsEventPublisher.publishBookingStatusUpdated(
                updated.getId(), currentStatus, newStatus,
                updated.getCustomerId(), updated.getVendorId());

        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    public BookingResponse cancelBooking(UUID bookingId, CancelBookingRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        String currentStatus = booking.getStatus();
        Set<String> cancellableStatuses = Set.of(
                BookingStatus.PENDING,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED
        );
        if (!cancellableStatuses.contains(currentStatus)) {
            throw new BadRequestException("Cannot cancel a booking that is " + currentStatus);
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(request.getReason());
        booking.setCancelledAt(Instant.now());
        Booking updated = bookingRepository.save(booking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(updated.getId());
        history.setFromStatus(currentStatus);
        history.setToStatus(BookingStatus.CANCELLED);
        history.setReason(request.getReason());
        history.setChangedBy(request.getCustomerId());
        history.setChangedByType("customer");
        statusHistoryRepository.save(history);

        log.warn("event=booking_cancelled bookingId={} reason={}", bookingId, request.getReason());

        snsEventPublisher.publishBookingStatusUpdated(
                updated.getId(), currentStatus, BookingStatus.CANCELLED,
                updated.getCustomerId(), updated.getVendorId());

        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public RefundPreviewResponse previewRefund(UUID bookingId) {
        return previewRefund(bookingId, "customer");
    }

    @Override
    @Transactional(readOnly = true)
    public RefundPreviewResponse previewRefund(UUID bookingId, String cancelledByType) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        if (NON_REFUNDABLE_STATUSES.contains(booking.getStatus())) {
            throw new BadRequestException("Booking cannot be refunded");
        }

        return refundCalculationService.calculateRefund(booking, cancelledByType);
    }

    @Override
    public BookingResponse cancelBookingWithRefund(UUID bookingId, CancelBookingRequest request) {
        if (request == null) {
            request = new CancelBookingRequest();
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        String currentStatus = booking.getStatus();
        Set<String> cancellableStatuses = Set.of(
                BookingStatus.PENDING,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED
        );
        if (!cancellableStatuses.contains(currentStatus)) {
            throw new BadRequestException("Cannot cancel a booking that is " + currentStatus);
        }

        RefundPreviewResponse refund = refundCalculationService.calculateRefund(booking, "customer");

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(request.getReason());
        booking.setCancelledAt(Instant.now());
        Booking updated = bookingRepository.save(booking);

        BookingStatusHistory history = new BookingStatusHistory();
        history.setBookingId(updated.getId());
        history.setFromStatus(currentStatus);
        history.setToStatus(BookingStatus.CANCELLED);
        history.setReason(request.getReason());
        history.setChangedBy(request.getCustomerId());
        history.setChangedByType("customer");
        statusHistoryRepository.save(history);

        log.info("event=booking_cancelled_with_refund bookingId={} refundAmount={} refundPercentage={}",
                bookingId, refund.getRefundAmount(), refund.getRefundPercentage());

        snsEventPublisher.publishBookingStatusUpdated(
                updated.getId(), currentStatus, BookingStatus.CANCELLED,
                updated.getCustomerId(), updated.getVendorId());

        return BookingMapper.toBookingResponse(updated);
    }

    @Override
    public BookingResponse rescheduleBooking(UUID bookingId, RescheduleBookingRequest request) {
        Booking original = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));

        String currentStatus = original.getStatus();
        Set<String> reschedulableStatuses = Set.of(
                BookingStatus.PENDING,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.CONFIRMED
        );
        if (!reschedulableStatuses.contains(currentStatus)) {
            throw new BadRequestException("Cannot reschedule a booking that is " + currentStatus);
        }

        int startMinutes = parseTimeToMinutes(request.getNewTime());
        int effectiveDuration = original.getDurationMinutes() != null ? original.getDurationMinutes() : 30;
        int endMinutes = startMinutes + effectiveDuration;

        List<Booking> slotConflicts = bookingRepository.findOverlappingBookings(
                original.getVendorId(),
                request.getNewDate(),
                original.getStaffId(),
                startMinutes,
                endMinutes
        ).stream()
                .filter(b -> !b.getId().equals(bookingId))
                .toList();

        if (!slotConflicts.isEmpty()) {
            throw new ConflictException("The requested time slot is already booked");
        }

        original.setStatus(BookingStatus.RESCHEDULED);
        original.setRescheduleReason(request.getReason());
        bookingRepository.save(original);

        BookingStatusHistory oldHistory = new BookingStatusHistory();
        oldHistory.setBookingId(original.getId());
        oldHistory.setFromStatus(currentStatus);
        oldHistory.setToStatus(BookingStatus.RESCHEDULED);
        oldHistory.setReason(request.getReason());
        oldHistory.setChangedByType("customer");
        statusHistoryRepository.save(oldHistory);

        Booking newBooking = new Booking();
        newBooking.setCustomerId(original.getCustomerId());
        newBooking.setCustomerPhone(original.getCustomerPhone());
        newBooking.setVendorId(original.getVendorId());
        newBooking.setServiceId(original.getServiceId());
        newBooking.setStaffId(original.getStaffId());
        newBooking.setPetId(original.getPetId());
        newBooking.setBookingDate(request.getNewDate());
        newBooking.setBookingTime(request.getNewTime());
        newBooking.setStatus(BookingStatus.CONFIRMED);
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
        newBooking.setPackagePurchaseId(original.getPackagePurchaseId());
        newBooking.setIsPackageSession(original.getIsPackageSession());
        newBooking.setFlowVariant(original.getFlowVariant());
        newBooking.setNotes(original.getNotes());
        newBooking.setSubscriptionId(original.getSubscriptionId());
        newBooking.setRescheduledFromBookingId(original.getId());
        newBooking.setRescheduleReason(request.getReason());
        Booking savedNew = bookingRepository.save(newBooking);

        List<com.warmpawz.booking.entity.BookingService> originalServiceLines =
                serviceLineRepository.findByBookingId(original.getId());
        for (com.warmpawz.booking.entity.BookingService line : originalServiceLines) {
            com.warmpawz.booking.entity.BookingService copy = new com.warmpawz.booking.entity.BookingService();
            copy.setBookingId(savedNew.getId());
            copy.setServiceId(line.getServiceId());
            copy.setServiceName(line.getServiceName());
            copy.setPrice(line.getPrice());
            copy.setDurationMinutes(line.getDurationMinutes());
            copy.setQuantity(line.getQuantity() != null ? line.getQuantity() : 1);
            serviceLineRepository.save(copy);
        }

        BookingStatusHistory newHistory = new BookingStatusHistory();
        newHistory.setBookingId(savedNew.getId());
        newHistory.setFromStatus(null);
        newHistory.setToStatus(BookingStatus.CONFIRMED);
        newHistory.setReason("Rescheduled from " + original.getId());
        newHistory.setChangedByType("customer");
        statusHistoryRepository.save(newHistory);

        log.info("event=booking_rescheduled originalId={} newId={}", original.getId(), savedNew.getId());
        return BookingMapper.toBookingResponse(savedNew);
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
        BookingResponse response = transitionVendorPendingBooking(
                bookingId, vendorId, BookingStatus.CONFIRMED, "vendor_confirmed_booking");
        snsEventPublisher.publishBookingStatusUpdated(
                response.getId(), BookingStatus.PENDING, BookingStatus.CONFIRMED,
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
        Set<String> cancellableStatuses = Set.of(BookingStatus.PENDING, BookingStatus.CONFIRMED);
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
    public OtpResponse generateOtp(GenerateOtpRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new NotFoundException("Booking not found: " + request.getBookingId()));

        if ("tele".equals(booking.getServiceStyle())
                || (request.getServiceStyle() != null && "tele".equals(request.getServiceStyle()))) {
            throw new BadRequestException("OTP not required for tele bookings");
        }

        String otp = String.format("%04d", new Random().nextInt(10000));
        booking.setOtpCode(otp);
        booking.setOtpExpiresAt(Instant.now().plus(24, ChronoUnit.HOURS));
        booking.setOtpVerified(false);
        bookingRepository.save(booking);

        log.info("event=otp_generated bookingId={}", booking.getId());
        return new OtpResponse(booking.getId(), "OTP generated", booking.getOtpExpiresAt());
    }

    @Override
    public BookingResponse verifyOtp(VerifyOtpRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new NotFoundException("Booking not found: " + request.getBookingId()));

        if (booking.getOtpCode() == null) {
            throw new BadRequestException("No OTP generated for this booking");
        }
        if (booking.getOtpExpiresAt() != null && Instant.now().isAfter(booking.getOtpExpiresAt())) {
            throw new BadRequestException("OTP has expired");
        }
        if (!booking.getOtpCode().equals(request.getOtp())) {
            throw new BadRequestException("Invalid OTP");
        }

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

        List<Booking> slotConflicts = bookingRepository.findActiveBookingsAtSlot(
                request.getVendorId(), request.getSelectedDate(), request.getSelectedTime());
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
        newBooking.setBookingTime(request.getSelectedTime());
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

        if (!RESCHEDULABLE_STATUSES.contains(currentStatus)) {
            canReschedule = false;
            reason = "Booking is not in a reschedulable state";
        } else if (booking.getBookingDate().isBefore(LocalDate.now())) {
            canReschedule = false;
            reason = "Cannot reschedule a past booking";
        }

        LocalTime time = LocalTime.parse(booking.getBookingTime());
        ZonedDateTime bookingDateTime = LocalDateTime.of(booking.getBookingDate(), time)
                .atZone(ZoneOffset.UTC);
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
        if (!BookingStatus.PENDING.equals(currentStatus)) {
            throw new BadRequestException("Can only confirm pending bookings");
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
        if (!BookingStatus.PENDING.equals(currentStatus)) {
            throw new BadRequestException("Can only reject pending bookings");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancellationReason(reason);
        booking.setCancelledAt(Instant.now());
        Booking updated = bookingRepository.save(booking);
        saveVendorStatusHistory(updated.getId(), currentStatus, BookingStatus.CANCELLED, reason, vendorId);
        log.info("event={} bookingId={} vendorId={}", logEvent, bookingId, vendorId);
        return BookingMapper.toBookingResponse(updated);
    }

    private Booking requireVendorBooking(UUID bookingId, UUID vendorId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new NotFoundException("Booking not found: " + bookingId));
        if (!booking.getVendorId().equals(vendorId)) {
            throw new NotFoundException("Booking not found: " + bookingId);
        }
        return booking;
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

    private int parseTimeToMinutes(String bookingTime) {
        String[] parts = bookingTime.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    private String minutesToTime(int minutes) {
        return String.format("%02d:%02d", minutes / 60, minutes % 60);
    }
}
