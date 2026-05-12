package com.warmpawz.customer.controller;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.warmpawz.customer.config.JwtDecoderConfig;
import com.warmpawz.customer.config.SecurityConfig;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.exception.ApiExceptionHandler;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.IdempotencyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CustomerController.class)
@Import({SecurityConfig.class, JwtDecoderConfig.class, ApiExceptionHandler.class})
@TestPropertySource(properties = {
        "app.security.enabled=true",
        "app.security.uat-jwt.enabled=true",
        "app.security.uat-jwt.secret=test-uat-secret-must-be-at-least-32-bytes"
})
class CustomerUatJwtSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @MockitoBean
    private IdempotencyService idempotencyService;

    @Test
    void acceptsUatJwtWhenFeatureFlagIsEnabled() throws Exception {
        CustomerResponse response = new CustomerResponse();
        response.setId(UUID.randomUUID());
        response.setPhone("9999999999");
        response.setName("UAT Customer");
        when(customerService.getCustomerByPhone("9999999999")).thenReturn(response);

        mockMvc.perform(get("/customer/by-phone")
                        .param("phone", "9999999999")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + signedUatToken()))
                .andExpect(status().isOk());
    }

    private String signedUatToken() throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(UUID.randomUUID().toString())
                .issuer("warmpawz-uat")
                .audience("warmpawz-api")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(60)))
                .claim("token_use", "access")
                .claim("phone_number", "9999999999")
                .claim("custom:user_type", "customer")
                .build();
        SignedJWT jwt = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.HS256).type(JOSEObjectType.JWT).build(),
                claims
        );
        jwt.sign(new MACSigner("test-uat-secret-must-be-at-least-32-bytes".getBytes(StandardCharsets.UTF_8)));
        return jwt.serialize();
    }
}
