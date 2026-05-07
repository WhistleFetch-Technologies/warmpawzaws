package com.warmpawz.customer.config;

import com.warmpawz.customer.service.idempotency.DbIdempotencyProvider;
import com.warmpawz.customer.service.idempotency.IdempotencyProvider;
import com.warmpawz.customer.service.idempotency.MemoryIdempotencyProvider;
import com.warmpawz.customer.service.idempotency.RedisIdempotencyProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@Slf4j
public class IdempotencyConfig {

    @Bean
    public IdempotencyProvider idempotencyProvider(
            IdempotencyProperties properties,
            MemoryIdempotencyProvider memoryProvider,
            DbIdempotencyProvider dbProvider,
            ObjectProvider<RedisIdempotencyProvider> redisProvider
    ) {
        String configured = properties.getProvider() == null ? "db" : properties.getProvider().trim().toLowerCase();
        return switch (configured) {
            case "redis" -> {
                RedisIdempotencyProvider redis = redisProvider.getIfAvailable();
                if (redis == null) {
                    log.warn("event=idempotency_provider_fallback from=redis to=db reason=redis_not_available");
                    yield dbProvider;
                }
                yield redis;
            }
            case "memory" -> memoryProvider;
            case "db" -> dbProvider;
            default -> {
                log.warn("event=idempotency_provider_fallback from={} to=db reason=unknown_provider", configured);
                yield dbProvider;
            }
        };
    }
}
