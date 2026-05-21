package com.warmpawz.booking.controller;

import com.warmpawz.booking.config.SecurityConfig;
import com.warmpawz.booking.dto.response.BookingRefundInfo;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.dto.response.CancelBookingResult;
import com.warmpawz.booking.dto.response.RefundPreviewResponse;
import com.warmpawz.booking.exception.ApiExceptionHandler;
import com.warmpawz.booking.exception.NotFoundException;
import com.warmpawz.booking.service.BookingService;
import com.warmpawz.booking.service.IdempotencyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = BookingController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
@TestPropertySource(properties = "app.security.enabled=true")
class BookingControllerCustomerAuthTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BookingService bookingService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private IdempotencyService idempotencyService;

    private UUID bookingId;
    private UUID customerIdFromJwt;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        customerIdFromJwt = UUID.randomUUID();
        when(jwtDecoder.decode(anyString())).thenReturn(customerJwt(customerIdFromJwt));
    }

    @Test
    void cancelWithoutAuthReturns401() throws Exception {
        mockMvc.perform(post("/bookings/{bookingId}/cancel", bookingId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cancelWithJwtUsesCustomerFromSubject() throws Exception {
        RefundPreviewResponse preview = samplePreview();
        BookingResponse booking = new BookingResponse();
        booking.setId(bookingId);
        when(bookingService.previewRefund(eq(bookingId), eq(customerIdFromJwt))).thenReturn(preview);
        when(bookingService.cancelBooking(eq(bookingId), eq(customerIdFromJwt), any()))
                .thenReturn(new CancelBookingResult(booking, null));

        mockMvc.perform(post("/bookings/{bookingId}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Changed plans\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refund.message").value("Full refund — cancelled more than 24 hours before"))
                .andExpect(jsonPath("$.data.booking.id").value(bookingId.toString()));

        verify(bookingService).previewRefund(bookingId, customerIdFromJwt);
        verify(bookingService).cancelBooking(eq(bookingId), eq(customerIdFromJwt), any());
    }

    @Test
    void cancelWrongCustomerReturns404() throws Exception {
        RefundPreviewResponse preview = samplePreview();
        when(bookingService.previewRefund(eq(bookingId), eq(customerIdFromJwt))).thenReturn(preview);
        doThrow(new NotFoundException("Booking not found: " + bookingId))
                .when(bookingService).cancelBooking(eq(bookingId), eq(customerIdFromJwt), any());

        mockMvc.perform(post("/bookings/{bookingId}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Test\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void calculateRefundWithJwtUsesCustomerFromSubject() throws Exception {
        RefundPreviewResponse preview = samplePreview();
        when(bookingService.previewRefund(eq(bookingId), eq(customerIdFromJwt))).thenReturn(preview);

        mockMvc.perform(post("/bookings/{bookingId}/calculate-refund", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refund.refundAmount").value(100))
                .andExpect(jsonPath("$.data.refund.refundPercentage").value(100));

        verify(bookingService).previewRefund(bookingId, customerIdFromJwt);
    }

    @Test
    void cancelWithExecutedRefundReturnsWalletStatus() throws Exception {
        RefundPreviewResponse preview = samplePreview();
        BookingResponse booking = new BookingResponse();
        booking.setId(bookingId);
        BookingRefundInfo refund = BookingRefundInfo.builder()
                .amount(BigDecimal.valueOf(100))
                .percentage(100)
                .method("wallet")
                .status("completed")
                .message("₹100.00 credited to your wallet")
                .build();
        when(bookingService.previewRefund(eq(bookingId), eq(customerIdFromJwt))).thenReturn(preview);
        when(bookingService.cancelBooking(eq(bookingId), eq(customerIdFromJwt), any()))
                .thenReturn(new CancelBookingResult(booking, refund));

        mockMvc.perform(post("/bookings/{bookingId}/cancel", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Test\",\"refundMethod\":\"wallet\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.refund.status").value("completed"))
                .andExpect(jsonPath("$.data.refund.method").value("wallet"))
                .andExpect(jsonPath("$.data.refund.message").value("₹100.00 credited to your wallet"));
    }

    @Test
    void calculateRefundWithoutAuthReturns401() throws Exception {
        mockMvc.perform(post("/bookings/{bookingId}/calculate-refund", bookingId))
                .andExpect(status().isUnauthorized());
    }

    private static RefundPreviewResponse samplePreview() {
        return new RefundPreviewResponse(
                UUID.randomUUID(),
                "confirmed",
                BigDecimal.valueOf(100),
                BigDecimal.valueOf(100),
                BigDecimal.ZERO,
                100,
                "wallet",
                "full",
                "Full refund — cancelled more than 24 hours before",
                48L
        );
    }

    private static Jwt customerJwt(UUID customerId) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("test-token")
                .header("alg", "HS256")
                .issuer("warmpawz-uat")
                .subject(customerId.toString())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build();
    }
}
