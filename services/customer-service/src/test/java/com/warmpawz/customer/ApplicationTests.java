package com.warmpawz.customer;

import com.warmpawz.customer.service.CustomerAddressService;
import com.warmpawz.customer.service.CustomerPreferenceService;
import com.warmpawz.customer.service.CustomerProfileCompletionService;
import com.warmpawz.customer.service.CustomerService;
import com.warmpawz.customer.service.PetService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.security.enabled=false",
        "spring.autoconfigure.exclude=" +
                "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration," +
                "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration",
        "app.idempotency.provider=memory"
})
class ApplicationTests {

    @Autowired
    private CustomerService customerService;

    @Autowired
    private CustomerAddressService customerAddressService;

    @Autowired
    private PetService petService;

    @Autowired
    private CustomerPreferenceService customerPreferenceService;

    @Autowired
    private CustomerProfileCompletionService customerProfileCompletionService;

    @Test
    void contextLoads() {
    }

    @Test
    void coreBeansAreWired() {
        assertThat(customerService).isNotNull();
        assertThat(customerAddressService).isNotNull();
        assertThat(petService).isNotNull();
        assertThat(customerPreferenceService).isNotNull();
        assertThat(customerProfileCompletionService).isNotNull();
    }
}
