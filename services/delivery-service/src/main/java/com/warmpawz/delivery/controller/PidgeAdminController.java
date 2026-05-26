package com.warmpawz.delivery.controller;

import com.warmpawz.delivery.service.PidgeIntegrationService;
import com.warmpawz.delivery.service.serviceimpl.PidgeCredentialResolver;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * POST /admin/logistics/pidge/vendor-login — Lambda {@code logistics-management.ts}.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Pidge admin")
public class PidgeAdminController {

	private final PidgeIntegrationService pidge;
	private final PidgeCredentialResolver credentialResolver;

	public record VendorLoginBody(String username, String password, String baseUrl) {}

	@PostMapping("/admin/logistics/pidge/vendor-login")
	public ResponseEntity<Map<String, Object>> vendorLogin(@RequestBody(required = false) VendorLoginBody body) {
		pidge.clearTokenCache();

		var stored = credentialResolver.resolve();
		String username = body != null && body.username() != null && !body.username().isBlank()
				? body.username().trim()
				: stored.map(PidgeCredentialResolver.ResolvedPidgeCredentials::username).orElse(null);
		String password = body != null && body.password() != null && !body.password().isBlank()
				? body.password().trim()
				: stored.map(PidgeCredentialResolver.ResolvedPidgeCredentials::password).orElse(null);
		String baseUrl = body != null && body.baseUrl() != null && !body.baseUrl().isBlank()
				? body.baseUrl().trim().replaceAll("/$", "")
				: stored.map(PidgeCredentialResolver.ResolvedPidgeCredentials::baseUrl).orElse(null);

		if (username == null || username.isBlank() || password == null || password.isBlank() || baseUrl == null || baseUrl.isBlank()) {
			return ResponseEntity.status(400).body(Map.of(
					"success", false,
					"error",
					"Pidge username and password required. Configure logistics_partners (pidge) or PIDGE_* env."));
		}

		String token = pidge.fetchVendorToken(username, password, baseUrl);
		return ResponseEntity.ok(Map.of(
				"success", true,
				"token", token,
				"authorization", "Bearer " + token));
	}
}
