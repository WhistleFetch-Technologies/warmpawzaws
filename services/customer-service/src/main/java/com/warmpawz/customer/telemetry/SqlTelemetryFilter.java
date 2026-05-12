package com.warmpawz.customer.telemetry;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.env.Environment;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@RequiredArgsConstructor
@Slf4j
public class SqlTelemetryFilter extends OncePerRequestFilter {

    private final Environment environment;
    private final Optional<MeterRegistry> meterRegistry;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        boolean metricsEnabled = environment.getProperty("app.sql.metrics-enabled", Boolean.class, true);
        int warnThreshold = environment.getProperty("app.sql.warn-threshold", Integer.class, 20);
        if (!metricsEnabled) {
            filterChain.doFilter(request, response);
            return;
        }
        SqlQueryCounterContext.begin();
        try {
            filterChain.doFilter(request, response);
        } finally {
            int queryCount = SqlQueryCounterContext.getCount();
            SqlQueryCounterContext.clear();
            String endpoint = request.getRequestURI();
            String method = request.getMethod();
            String status = String.valueOf(response.getStatus());
            String requestId = request.getHeader("X-Request-Id");
            if (requestId == null || requestId.isBlank()) {
                requestId = UUID.randomUUID().toString();
            }

            meterRegistry.ifPresent(registry -> {
                registry.summary("sql_queries_per_request", "endpoint", endpoint, "method", method, "status", status)
                        .record(queryCount);
                registry.counter("sql_queries_per_request_requests_total", "endpoint", endpoint, "method", method, "status", status)
                        .increment();
            });

            if (queryCount > warnThreshold) {
                log.warn("event=sql_request_summary endpoint={} method={} status={} requestId={} queryCount={} threshold={}",
                        endpoint, method, status, requestId, queryCount, warnThreshold);
            } else {
                log.info("event=sql_request_summary endpoint={} method={} status={} requestId={} queryCount={}",
                        endpoint, method, status, requestId, queryCount);
            }
        }
    }
}
