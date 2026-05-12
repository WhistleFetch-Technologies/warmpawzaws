package com.warmpawz.customer.controller;

import com.warmpawz.customer.config.SecurityConfig;
import com.warmpawz.customer.exception.ApiExceptionHandler;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.IdempotencyService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.beans.factory.annotation.Autowired;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CustomerController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
@TestPropertySource(properties = "app.security.enabled=true")
class CustomerSecurityEnabledTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    @MockitoBean
    private IdempotencyService idempotencyService;

    @Test
    void protectedCustomerReadRequiresAuthWhenEnabled() throws Exception {
        mockMvc.perform(get("/customer/by-phone").param("phone", "9999999999"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void swaggerDocsRemainPublicWhenEnabled() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(result -> assertNotEquals(401, result.getResponse().getStatus()));
    }
}
