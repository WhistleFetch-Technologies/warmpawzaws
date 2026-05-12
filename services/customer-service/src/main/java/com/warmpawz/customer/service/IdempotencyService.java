package com.warmpawz.customer.service;

import java.util.Optional;
import java.util.function.Supplier;

public interface IdempotencyService {

    <T> Optional<T> getCachedResponse(String route, String idempotencyKey, Object payload, Class<T> type);

    void cacheResponse(String route, String idempotencyKey, Object payload, Object response);

    <T> T execute(String route, String idempotencyKey, Object payload, Supplier<T> action, Class<T> type);
}
