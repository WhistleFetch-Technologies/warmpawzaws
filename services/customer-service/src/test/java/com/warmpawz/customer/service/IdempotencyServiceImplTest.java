package com.warmpawz.customer.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.customer.config.IdempotencyProperties;
import com.warmpawz.customer.dto.common.CommonResponse;
import com.warmpawz.customer.exception.ConflictException;
import com.warmpawz.customer.service.idempotency.MemoryIdempotencyProvider;
import com.warmpawz.customer.service.serviceimpl.IdempotencyServiceImpl;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IdempotencyServiceImplTest {

    @Test
    void sameKeyAndPayloadReplaysResponse() {
        IdempotencyServiceImpl service = newService();
        CommonResponse<Map<String, String>> first = service.execute("POST:/customer", "key-1", Map.of("a", "b"),
                () -> CommonResponse.success(Map.of("id", "1")), CommonResponse.class);
        CommonResponse<Map<String, String>> replay = service.execute("POST:/customer", "key-1", Map.of("a", "b"),
                () -> CommonResponse.success(Map.of("id", "2")), CommonResponse.class);
        assertEquals(first.getData(), replay.getData());
    }

    @Test
    void sameKeyDifferentPayloadReturnsConflict() {
        IdempotencyServiceImpl service = newService();
        service.execute("POST:/customer", "key-2", Map.of("a", "b"),
                () -> CommonResponse.success(Map.of("id", "1")), CommonResponse.class);
        assertThrows(ConflictException.class, () -> service.execute("POST:/customer", "key-2", Map.of("a", "c"),
                () -> CommonResponse.success(Map.of("id", "2")), CommonResponse.class));
    }

    @Test
    void inProgressConflictAfterTimeout() {
        MemoryIdempotencyProvider provider = new MemoryIdempotencyProvider();
        IdempotencyProperties props = new IdempotencyProperties();
        props.setTtlSeconds(300);
        props.setInProgressWaitMillis(10);
        props.setInProgressPollMillis(1);
        IdempotencyServiceImpl service = new IdempotencyServiceImpl(provider, new ObjectMapper(), props);
        provider.reserve("post:/customer", "key-3", "x", "h", Instant.now().plusSeconds(10));
        assertThrows(ConflictException.class, () -> service.execute("POST:/customer", "key-3", Map.of("a", "b"),
                () -> CommonResponse.success(Map.of("id", "2")), CommonResponse.class));
    }

    private IdempotencyServiceImpl newService() {
        IdempotencyProperties props = new IdempotencyProperties();
        props.setTtlSeconds(300);
        props.setInProgressWaitMillis(20);
        props.setInProgressPollMillis(1);
        return new IdempotencyServiceImpl(new MemoryIdempotencyProvider(), new ObjectMapper(), props);
    }
}
