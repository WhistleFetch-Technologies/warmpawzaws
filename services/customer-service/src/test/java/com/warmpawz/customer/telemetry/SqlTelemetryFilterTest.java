package com.warmpawz.customer.telemetry;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.env.MockEnvironment;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SqlTelemetryFilterTest {

    @Test
    void queryCounterTracksAndPublishesMetrics() throws Exception {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("app.sql.metrics-enabled", "true")
                .withProperty("app.sql.warn-threshold", "1");
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        SqlTelemetryFilter filter = new SqlTelemetryFilter(environment, Optional.of(registry));
        SqlCountingStatementInspector inspector = new SqlCountingStatementInspector();

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/customer/by-phone");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> {
            inspector.inspect("select 1");
            inspector.inspect("select 2");
        });

        assertEquals(2.0, registry.get("sql_queries_per_request")
                .tags("endpoint", "/customer/by-phone", "method", "GET", "status", "200")
                .summary().totalAmount());
    }
}
