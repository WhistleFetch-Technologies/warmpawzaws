package com.warmpawz.customer.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(
            @Value("${app.cache.read-ttl-seconds:30}") long readTtlSeconds,
            @Value("${app.cache.idempotency-ttl-seconds:60}") long idempotencyTtlSeconds,
            @Value("${app.cache.read-max-size:1000}") long readMaxSize,
            @Value("${app.cache.idempotency-max-size:5000}") long idempotencyMaxSize
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
}
