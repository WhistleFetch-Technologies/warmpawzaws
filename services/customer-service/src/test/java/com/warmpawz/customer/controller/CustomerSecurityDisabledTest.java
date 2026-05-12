package com.warmpawz.customer.controller;

import com.warmpawz.customer.config.SecurityConfig;
import com.warmpawz.customer.dto.response.CustomerResponse;
import com.warmpawz.customer.exception.ApiExceptionHandler;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.IdempotencyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = CustomerController.class)
@Import({SecurityConfig.class, ApiExceptionHandler.class})
@TestPropertySource(properties = "app.security.enabled=false")
class CustomerSecurityDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CustomerService customerService;

    @MockitoBean
    private IdempotencyService idempotencyService;

    @Test
    void customerReadIsOpenWhenSecurityDisabled() throws Exception {
        CustomerResponse response = new CustomerResponse();
        response.setPhone("9999999999");
        when(customerService.getCustomerByPhone("9999999999")).thenReturn(response);

        mockMvc.perform(get("/customer/by-phone").param("phone", "9999999999"))
                .andExpect(status().isOk());
    }
}
