package com.warmpawz.booking.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Booking Service API")
                        .version("1.0")
                        .description("Booking / appointment microservice (Warmpawz)"));
    }

    @Bean
    public OpenApiCustomizer publicServerOpenApiCustomizer(
            @Value("${warmpawz.openapi.public-server-url:}") String publicServerUrl) {
        return openApi -> {
            String u = publicServerUrl == null ? "" : publicServerUrl.trim();
            if (u.isEmpty()) {
                return;
            }
            while (u.endsWith("/")) {
                u = u.substring(0, u.length() - 1);
            }
            openApi.setServers(List.of(new Server().url(u).description("Public API (HTTPS)")));
        };
    }
}
