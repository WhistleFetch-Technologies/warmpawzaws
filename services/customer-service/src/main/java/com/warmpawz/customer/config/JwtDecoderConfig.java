package com.warmpawz.customer.config;

import com.nimbusds.jwt.JWTParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
@ConditionalOnProperty(prefix = "app.security", name = "enabled", havingValue = "true", matchIfMissing = true)
public class JwtDecoderConfig {

    private static final String UAT_ISSUER = "warmpawz-uat";

    @Bean
    @ConditionalOnMissingBean(JwtDecoder.class)
    JwtDecoder jwtDecoder(
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}") String cognitoIssuerUri,
            @Value("${spring.security.oauth2.resourceserver.jwt.audiences:}") String cognitoAudiences,
            @Value("${app.security.uat-jwt.enabled:false}") boolean uatJwtEnabled,
            @Value("${app.security.uat-jwt.secret:}") String uatJwtSecret,
            @Value("${app.security.uat-jwt.audience:warmpawz-api}") String uatAudience
    ) {
        JwtDecoder cognitoDecoder = buildCognitoDecoder(cognitoIssuerUri, cognitoAudiences);
        JwtDecoder uatDecoder = uatJwtEnabled ? buildUatDecoder(uatJwtSecret, uatAudience) : null;
        return token -> UAT_ISSUER.equals(readIssuer(token))
                ? decodeUatToken(uatDecoder, token)
                : cognitoDecoder.decode(token);
    }

    private JwtDecoder buildCognitoDecoder(String issuerUri, String audiences) {
        if (!hasText(issuerUri)) {
            return token -> {
                throw new JwtException("Cognito issuer is not configured");
            };
        }
        JwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuerUri);
        if (decoder instanceof NimbusJwtDecoder nimbusJwtDecoder && hasText(audiences)) {
            OAuth2TokenValidator<Jwt> validator = new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefaultWithIssuer(issuerUri),
                    new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.stream()
                            .anyMatch(configuredAudience -> containsAudience(audiences, configuredAudience)))
            );
            nimbusJwtDecoder.setJwtValidator(validator);
        }
        return decoder;
    }

    private JwtDecoder buildUatDecoder(String secret, String audience) {
        if (!hasText(secret)) {
            throw new IllegalStateException("APP_SECURITY_UAT_JWT_ENABLED=true requires UAT_JWT_SECRET");
        }
        SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                JwtValidators.createDefaultWithIssuer(UAT_ISSUER),
                new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(audience))
        ));
        return decoder;
    }

    private Jwt decodeUatToken(JwtDecoder uatDecoder, String token) {
        if (uatDecoder == null) {
            throw new JwtException("UAT JWT support is disabled");
        }
        return uatDecoder.decode(token);
    }

    private String readIssuer(String token) {
        try {
            return JWTParser.parse(token).getJWTClaimsSet().getIssuer();
        } catch (Exception ex) {
            throw new JwtException("Invalid JWT", ex);
        }
    }

    private boolean containsAudience(String configuredAudiences, String tokenAudience) {
        for (String configuredAudience : configuredAudiences.split(",")) {
            if (configuredAudience.trim().equals(tokenAudience)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
