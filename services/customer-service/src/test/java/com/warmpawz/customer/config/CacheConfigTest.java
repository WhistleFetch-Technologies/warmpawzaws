package com.warmpawz.customer.config;

import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class CacheConfigTest {

    private final CacheConfig cacheConfig = new CacheConfig();

    @Test
    void redisDisabledSelectsCaffeineWithoutConnectingToRedis() {
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);

        CacheManager manager = cacheConfig.cacheManager(60, 60, 100, 100, false, true, redisConnectionFactory);

        assertInstanceOf(CaffeineCacheManager.class, manager);
        verifyNoInteractions(redisConnectionFactory);
    }

    @Test
    void redisEnabledFallsBackToCaffeineWhenRedisIsUnreachable() {
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        when(redisConnectionFactory.getConnection()).thenThrow(new IllegalStateException("down"));

        CacheManager manager = cacheConfig.cacheManager(60, 60, 100, 100, true, true, redisConnectionFactory);

        assertInstanceOf(CaffeineCacheManager.class, manager);
    }

    @Test
    void redisEnabledFailsFastWhenFallbackDisabledAndRedisIsUnreachable() {
        RedisConnectionFactory redisConnectionFactory = mock(RedisConnectionFactory.class);
        when(redisConnectionFactory.getConnection()).thenThrow(new IllegalStateException("down"));

        assertThrows(IllegalStateException.class,
                () -> cacheConfig.cacheManager(60, 60, 100, 100, true, false, redisConnectionFactory));
    }
}
