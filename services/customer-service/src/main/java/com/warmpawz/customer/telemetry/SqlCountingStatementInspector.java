package com.warmpawz.customer.telemetry;

import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.springframework.stereotype.Component;

@Component
public class SqlCountingStatementInspector implements StatementInspector {

    @Override
    public String inspect(String sql) {
        SqlQueryCounterContext.incrementAndGet();
        return sql;
    }
}
