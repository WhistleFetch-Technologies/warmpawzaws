package com.warmpawz.booking.controller;

import com.warmpawz.booking.config.SecurityConfig;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.exception.ApiExceptionHandler;
import com.warmpawz.booking.service.BookingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = VendorBookingController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
@TestPropertySource(properties = "app.security.enabled=true")
class VendorBookingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BookingService bookingService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    private UUID bookingId;
    private UUID vendorIdFromJwt;
    private UUID spoofedVendorId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        vendorIdFromJwt = UUID.randomUUID();
        spoofedVendorId = UUID.randomUUID();
        when(jwtDecoder.decode(anyString())).thenReturn(vendorJwt(vendorIdFromJwt));
    }

    @Test
    void confirmWithoutAuthReturns401() throws Exception {
        mockMvc.perform(post("/vendor/bookings/{bookingId}/confirm", bookingId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void confirmWithJwtUsesVendorFromSubject() throws Exception {
        BookingResponse response = new BookingResponse();
        response.setId(bookingId);
        response.setVendorId(vendorIdFromJwt);
        when(bookingService.vendorConfirmBooking(eq(bookingId), eq(vendorIdFromJwt))).thenReturn(response);

        mockMvc.perform(post("/vendor/bookings/{bookingId}/confirm", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token"))
                .andExpect(status().isOk());

        verify(bookingService).vendorConfirmBooking(bookingId, vendorIdFromJwt);
    }

    @Test
    void confirmIgnoresSpoofedVendorHeader() throws Exception {
        BookingResponse response = new BookingResponse();
        response.setId(bookingId);
        when(bookingService.vendorConfirmBooking(eq(bookingId), eq(vendorIdFromJwt))).thenReturn(response);

        mockMvc.perform(post("/vendor/bookings/{bookingId}/confirm", bookingId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token")
                        .header("X-Vendor-Id", spoofedVendorId.toString()))
                .andExpect(status().isOk());

        verify(bookingService).vendorConfirmBooking(bookingId, vendorIdFromJwt);
    }

    private static Jwt vendorJwt(UUID vendorId) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("test-token")
                .header("alg", "HS256")
                .issuer("warmpawz-uat")
                .subject(vendorId.toString())
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .build();
    }
}
