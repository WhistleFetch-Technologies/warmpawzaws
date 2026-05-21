package com.warmpawz.booking.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.booking.config.SecurityConfig;
import com.warmpawz.booking.dto.request.VerifyOtpRequest;
import com.warmpawz.booking.dto.response.BookingResponse;
import com.warmpawz.booking.exception.ApiExceptionHandler;
import com.warmpawz.booking.service.BookingService;
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

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = BookingOtpController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
@TestPropertySource(properties = "app.security.enabled=true")
class BookingOtpControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private BookingService bookingService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    private UUID bookingId;
    private UUID vendorId;

    @BeforeEach
    void setUp() {
        bookingId = UUID.randomUUID();
        vendorId = UUID.randomUUID();
        when(jwtDecoder.decode(any())).thenReturn(vendorJwt(vendorId));
    }

    @Test
    void verifyOtpWithoutAuthReturns401() throws Exception {
        VerifyOtpRequest body = new VerifyOtpRequest();
        body.setBookingId(bookingId);
        body.setOtp("1234");

        mockMvc.perform(post("/bookings/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void verifyOtpWithJwtPassesVendorFromSubject() throws Exception {
        BookingResponse response = new BookingResponse();
        response.setId(bookingId);
        when(bookingService.verifyOtp(any(VerifyOtpRequest.class), eq(vendorId))).thenReturn(response);

        VerifyOtpRequest body = new VerifyOtpRequest();
        body.setBookingId(bookingId);
        body.setOtp("1234");

        mockMvc.perform(post("/bookings/verify-otp")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk());

        verify(bookingService).verifyOtp(any(VerifyOtpRequest.class), eq(vendorId));
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
