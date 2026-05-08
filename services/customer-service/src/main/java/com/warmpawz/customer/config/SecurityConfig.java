package com.warmpawz.customer.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {

    /**
     * Matches API Gateway dev CORS (customer/admin/vendor web + local + CloudFront).
     * Preflight sends custom headers (e.g. x-uat-mode); without them here Spring returns 403
     * "Invalid CORS request" and the browser surfaces a CORS / failed-to-fetch error.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowCredentials(true);
        config.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "https://*.warmpawz.com",
                "https://*.cloudfront.net"
        ));
        config.setAllowedMethods(Arrays.asList(
                HttpMethod.GET.name(),
                HttpMethod.POST.name(),
                HttpMethod.PUT.name(),
                HttpMethod.PATCH.name(),
                HttpMethod.DELETE.name(),
                HttpMethod.OPTIONS.name(),
                HttpMethod.HEAD.name()
        ));
        config.setAllowedHeaders(Arrays.asList(
                "Authorization",
                "Content-Type",
                "X-Api-Key",
                "X-Uat-Mode",
                "X-Uat-Token",
                "X-Requested-With",
                "X-Customer-Phone"
        ));
        config.setExposedHeaders(List.of("Content-Length", "X-Request-Id"));
        config.setMaxAge(86400L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    @ConditionalOnProperty(prefix = "app.security", name = "enabled", havingValue = "false")
    SecurityFilterChain openFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "app.security", name = "enabled", havingValue = "true", matchIfMissing = true)
    SecurityFilterChain jwtFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html", "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/customer/**", "/customers/**", "/pets/**").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
