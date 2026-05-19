package com.warmpawz.booking.util;

import com.warmpawz.booking.exception.ForbiddenException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

public class JwtPrincipalUtil {

    private JwtPrincipalUtil() {}

    /**
     * Extracts the JWT {@code sub} claim as a UUID. Throws {@link ForbiddenException}
     * if the token is absent, the subject is missing, or it cannot be parsed as a UUID.
     */
    public static UUID extractUuid(Jwt jwt) {
        if (jwt == null) {
            throw new ForbiddenException("Authentication required");
        }
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new ForbiddenException("JWT subject is missing");
        }
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException e) {
            throw new ForbiddenException("JWT subject is not a valid identifier");
        }
    }

    /**
     * Asserts that the authenticated principal's UUID equals {@code requestedId}.
     * Throws {@link ForbiddenException} when the caller tries to access another principal's resource.
     */
    public static void requireSelf(Jwt jwt, UUID requestedId) {
        UUID principalId = extractUuid(jwt);
        if (!principalId.equals(requestedId)) {
            throw new ForbiddenException("Access denied: resource does not belong to the authenticated principal");
        }
    }
}
