package com.warmpawz.booking;

import com.warmpawz.booking.service.BookingService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "app.security.enabled=false",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration",
        "app.idempotency.provider=memory",
        "app.sns.enabled=false"
})
class ApplicationTests {

    @MockBean
    RedisConnectionFactory redisConnectionFactory;

    @Autowired
    BookingService bookingService;

    @Test
    void contextLoads() {
    }

    @Test
    void coreBeansAreWired() {
        assertThat(bookingService).isNotNull();
    }
}
