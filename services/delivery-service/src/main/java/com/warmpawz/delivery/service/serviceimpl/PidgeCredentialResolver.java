package com.warmpawz.delivery.service.serviceimpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.config.PidgeProperties;
import com.warmpawz.delivery.entity.LogisticsPartner;
import com.warmpawz.delivery.repository.LogisticsPartnerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PidgeCredentialResolver {

	private final LogisticsPartnerRepository logisticsPartnerRepository;
	private final PidgeProperties props;
	private final ObjectMapper objectMapper;

	public record ResolvedPidgeCredentials(String username, String password, String baseUrl) {}

	public ResolvedPidgeCredentials resolveRequired() {
		return resolve().orElseThrow(() -> new IllegalStateException(
				"Pidge credentials not configured. Enable a logistics_partners row (partner_type=pidge, email + api_key) or set PIDGE_USERNAME / PIDGE_PASSWORD."));
	}

	public Optional<ResolvedPidgeCredentials> resolve() {
		Optional<LogisticsPartner> row = logisticsPartnerRepository
				.findFirstByPartnerTypeIgnoreCaseAndEnabledTrue("pidge");
		if (row.isPresent()) {
			LogisticsPartner p = row.get();
			String u = p.getEmail() != null ? p.getEmail().trim() : "";
			String pw = p.getApiKey() != null ? p.getApiKey().trim() : "";
			if (p.getPassword() != null && !p.getPassword().isBlank()) {
				pw = p.getPassword().trim();
			}
			if (StringUtils.hasText(u) && StringUtils.hasText(pw)) {
				String base = StringUtils.hasText(p.getBaseUrl()) ? trimSlash(p.getBaseUrl()) : props.resolvedApiBase();
				return Optional.of(new ResolvedPidgeCredentials(u, pw, base));
			}
		}
		if (StringUtils.hasText(props.getUsername()) && StringUtils.hasText(props.getPassword())) {
			return Optional.of(new ResolvedPidgeCredentials(
					props.getUsername().trim(),
					props.getPassword().trim(),
					props.resolvedApiBase()));
		}
		return Optional.empty();
	}

	/**
	 * Brand/channel defaults merged from partner.config JSON + env (monolith {@code getPidgeOrderDefaults}).
	 */
	public com.warmpawz.delivery.service.PidgeOrderPayloadBuilder.BrandDefaults brandDefaults() {
		Optional<LogisticsPartner> row = logisticsPartnerRepository
				.findFirstByPartnerTypeIgnoreCaseAndEnabledTrue("pidge");
		String brandCode = envOrEmpty(props.getBrandCode());
		String loc = envOrEmpty(props.getBrandLocationCode());
		String name = StringUtils.hasText(props.getBrandName()) ? props.getBrandName() : "WarmPawz";
		String channel = StringUtils.hasText(props.getChannel()) ? props.getChannel() : "warmpawz";
		String country = StringUtils.hasText(props.getDefaultCountry()) ? props.getDefaultCountry() : "India";
		if (row.isPresent() && StringUtils.hasText(row.get().getConfig())) {
			try {
				JsonNode c = objectMapper.readTree(row.get().getConfig());
				if (c.hasNonNull("brandCode")) {
					brandCode = c.get("brandCode").asText(brandCode);
				}
				if (c.has("brand") && c.get("brand").isObject()) {
					JsonNode b = c.get("brand");
					if (b.hasNonNull("code")) brandCode = b.get("code").asText(brandCode);
					if (b.hasNonNull("location_code")) loc = b.get("location_code").asText(loc);
					if (b.hasNonNull("name")) name = b.get("name").asText(name);
				}
				if (c.hasNonNull("brandLocationCode")) loc = c.get("brandLocationCode").asText(loc);
				if (c.hasNonNull("channel")) channel = c.get("channel").asText(channel);
				if (c.hasNonNull("default_country")) country = c.get("default_country").asText(country);
			} catch (Exception ignored) {
				// keep env defaults
			}
		}
		return new com.warmpawz.delivery.service.PidgeOrderPayloadBuilder.BrandDefaults(brandCode, loc, name, channel, country);
	}

	private static String envOrEmpty(String s) {
		return s == null ? "" : s;
	}

	private static String trimSlash(String u) {
		return u.replaceAll("/$", "");
	}
}
