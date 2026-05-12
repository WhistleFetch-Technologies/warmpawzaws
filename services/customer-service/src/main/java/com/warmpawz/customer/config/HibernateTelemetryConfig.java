package com.warmpawz.customer.config;

import com.warmpawz.customer.telemetry.SqlCountingStatementInspector;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;

@Configuration
@RequiredArgsConstructor
public class HibernateTelemetryConfig {

    private final SqlCountingStatementInspector statementInspector;

    @Bean
    public HibernatePropertiesCustomizer hibernateSqlInspectorCustomizer() {
        return (Map<String, Object> props) ->
                props.put("hibernate.session_factory.statement_inspector", statementInspector);
    }
}
