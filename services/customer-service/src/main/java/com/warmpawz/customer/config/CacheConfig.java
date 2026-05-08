package com.warmpawz.customer.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Callable;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
@Slf4j
public class CacheConfig {

    @Bean
    @Primary
    public CacheManager cacheManager(
            @Value("${app.cache.read-ttl-seconds:60}") long readTtlSeconds,
            @Value("${app.cache.idempotency-ttl-seconds:60}") long idempotencyTtlSeconds,
            @Value("${app.cache.read-max-size:1000}") long readMaxSize,
            @Value("${app.cache.idempotency-max-size:5000}") long idempotencyMaxSize,
            @Value("${app.cache.redis.enabled:false}") boolean redisCacheEnabled,
            @Value("${app.cache.redis.fallback-to-caffeine-on-error:true}") boolean fallbackToCaffeineOnError,
            RedisConnectionFactory redisConnectionFactory
    ) {
        CaffeineCacheManager caffeineManager = buildCaffeineManager(
                readTtlSeconds,
                idempotencyTtlSeconds,
                readMaxSize,
                idempotencyMaxSize
        );
        if (!redisCacheEnabled) {
            log.info("event=cache_backend_selected backend=caffeine reason=redis_disabled");
            return caffeineManager;
        }

        RedisCacheManager redisManager = buildRedisManager(
                redisConnectionFactory,
                readTtlSeconds,
                idempotencyTtlSeconds
        );
        if (!fallbackToCaffeineOnError) {
            log.info("event=cache_backend_selected backend=redis fallback=false");
            return redisManager;
        }
        log.info("event=cache_backend_selected backend=redis fallback=true");
        return new FallbackCacheManager(redisManager, caffeineManager);
    }

    private CaffeineCacheManager buildCaffeineManager(
            long readTtlSeconds,
            long idempotencyTtlSeconds,
            long readMaxSize,
            long idempotencyMaxSize
    ) {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.registerCustomCache(CacheNames.CUSTOMER_BY_ID, Caffeine.newBuilder()
                .expireAfterWrite(readTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(readMaxSize)
                .recordStats()
                .build());
        manager.registerCustomCache(CacheNames.CUSTOMER_BY_PHONE, Caffeine.newBuilder()
                .expireAfterWrite(readTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(readMaxSize)
                .recordStats()
                .build());
        manager.registerCustomCache(CacheNames.PETS_BY_CUSTOMER_ID, Caffeine.newBuilder()
                .expireAfterWrite(readTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(readMaxSize)
                .recordStats()
                .build());
        manager.registerCustomCache(CacheNames.PETS_BY_PHONE, Caffeine.newBuilder()
                .expireAfterWrite(readTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(readMaxSize)
                .recordStats()
                .build());
        manager.registerCustomCache(CacheNames.ADDRESSES_BY_CUSTOMER_ID, Caffeine.newBuilder()
                .expireAfterWrite(readTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(readMaxSize)
                .recordStats()
                .build());
        manager.registerCustomCache(CacheNames.ADDRESSES_BY_PHONE, Caffeine.newBuilder()
                .expireAfterWrite(readTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(readMaxSize)
                .recordStats()
                .build());
        manager.registerCustomCache(CacheNames.IDEMPOTENCY_RESPONSE, Caffeine.newBuilder()
                .expireAfterWrite(idempotencyTtlSeconds, TimeUnit.SECONDS)
                .maximumSize(idempotencyMaxSize)
                .recordStats()
                .build());
        return manager;
    }

    private RedisCacheManager buildRedisManager(
            RedisConnectionFactory redisConnectionFactory,
            long readTtlSeconds,
            long idempotencyTtlSeconds
    ) {
        GenericJackson2JsonRedisSerializer serializer = new GenericJackson2JsonRedisSerializer();
        RedisCacheConfiguration baseConfig = RedisCacheConfiguration.defaultCacheConfig()
                .computePrefixWith(cacheName -> cacheName + "::")
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(serializer));

        RedisCacheConfiguration readConfig = baseConfig.entryTtl(Duration.ofSeconds(readTtlSeconds));
        RedisCacheConfiguration idempotencyConfig = baseConfig.entryTtl(Duration.ofSeconds(idempotencyTtlSeconds));

        Map<String, RedisCacheConfiguration> configs = Map.of(
                CacheNames.CUSTOMER_BY_ID, readConfig,
                CacheNames.CUSTOMER_BY_PHONE, readConfig,
                CacheNames.PETS_BY_CUSTOMER_ID, readConfig,
                CacheNames.PETS_BY_PHONE, readConfig,
                CacheNames.ADDRESSES_BY_CUSTOMER_ID, readConfig,
                CacheNames.ADDRESSES_BY_PHONE, readConfig,
                CacheNames.IDEMPOTENCY_RESPONSE, idempotencyConfig
        );

        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(readConfig)
                .withInitialCacheConfigurations(configs)
                .build();
    }

    private static final class FallbackCacheManager implements CacheManager {
        private final CacheManager primary;
        private final CacheManager fallback;

        private FallbackCacheManager(CacheManager primary, CacheManager fallback) {
            this.primary = primary;
            this.fallback = fallback;
        }

        @Override
        public org.springframework.cache.Cache getCache(String name) {
            org.springframework.cache.Cache primaryCache = primary.getCache(name);
            org.springframework.cache.Cache fallbackCache = fallback.getCache(name);
            if (primaryCache == null) {
                return fallbackCache;
            }
            if (fallbackCache == null) {
                return primaryCache;
            }
            return new FallbackCache(primaryCache, fallbackCache, name);
        }

        @Override
        public Collection<String> getCacheNames() {
            Set<String> cacheNames = new LinkedHashSet<>(primary.getCacheNames());
            cacheNames.addAll(fallback.getCacheNames());
            return cacheNames;
        }
    }

    private static final class FallbackCache implements org.springframework.cache.Cache {
        private final org.springframework.cache.Cache primary;
        private final org.springframework.cache.Cache fallback;
        private final String cacheName;

        private FallbackCache(org.springframework.cache.Cache primary, org.springframework.cache.Cache fallback, String cacheName) {
            this.primary = primary;
            this.fallback = fallback;
            this.cacheName = cacheName;
        }

        @Override
        public String getName() {
            return primary.getName();
        }

        @Override
        public Object getNativeCache() {
            return primary.getNativeCache();
        }

        @Override
        public ValueWrapper get(Object key) {
            try {
                return primary.get(key);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=get reason={}", cacheName, ex.getClass().getSimpleName());
                return fallback.get(key);
            }
        }

        @Override
        public <T> T get(Object key, Class<T> type) {
            try {
                return primary.get(key, type);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=get_typed reason={}", cacheName, ex.getClass().getSimpleName());
                return fallback.get(key, type);
            }
        }

        @Override
        public <T> T get(Object key, Callable<T> valueLoader) {
            try {
                return primary.get(key, valueLoader);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=get_loader reason={}", cacheName, ex.getClass().getSimpleName());
                return fallback.get(key, valueLoader);
            }
        }

        @Override
        public void put(Object key, Object value) {
            try {
                primary.put(key, value);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=put reason={}", cacheName, ex.getClass().getSimpleName());
                fallback.put(key, value);
            }
        }

        @Override
        public ValueWrapper putIfAbsent(Object key, Object value) {
            try {
                return primary.putIfAbsent(key, value);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=put_if_absent reason={}", cacheName, ex.getClass().getSimpleName());
                return fallback.putIfAbsent(key, value);
            }
        }

        @Override
        public void evict(Object key) {
            try {
                primary.evict(key);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=evict reason={}", cacheName, ex.getClass().getSimpleName());
                fallback.evict(key);
            }
        }

        @Override
        public boolean evictIfPresent(Object key) {
            try {
                return primary.evictIfPresent(key);
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=evict_if_present reason={}", cacheName, ex.getClass().getSimpleName());
                return fallback.evictIfPresent(key);
            }
        }

        @Override
        public void clear() {
            try {
                primary.clear();
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=clear reason={}", cacheName, ex.getClass().getSimpleName());
                fallback.clear();
            }
        }

        @Override
        public boolean invalidate() {
            try {
                return primary.invalidate();
            } catch (RuntimeException ex) {
                log.warn("event=cache_operation_fallback cache={} op=invalidate reason={}", cacheName, ex.getClass().getSimpleName());
                return fallback.invalidate();
            }
        }
    }
}
