package com.warmpawz.delivery.controller.advice;

import com.warmpawz.delivery.service.PidgeIntegrationService.PidgeHttpException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionAdvice {

	@ExceptionHandler(PidgeHttpException.class)
	public ResponseEntity<Map<String, Object>> pidgeHttp(PidgeHttpException ex) {
		HttpStatus s = HttpStatus.resolve(ex.getHttpStatus());
		if (s == null) {
			s = HttpStatus.BAD_GATEWAY;
		}
		Map<String, Object> body = new LinkedHashMap<>();
		body.put("success", false);
		body.put("error", ex.getMessage());
		if (ex.getResponseBody() != null && !ex.getResponseBody().isBlank()) {
			body.put("pidgeResponseBody", ex.getResponseBody());
		}
		return ResponseEntity.status(s).body(body);
	}

	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<Map<String, Object>> status(ResponseStatusException ex) {
		return ResponseEntity.status(ex.getStatusCode()).body(Map.of(
				"error",
				ex.getReason() != null ? ex.getReason() : (ex.getMessage() != null ? ex.getMessage() : "Error")));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<Map<String, Object>> badRequest(IllegalArgumentException ex) {
		return ResponseEntity.badRequest().body(Map.of("success", false, "error", ex.getMessage()));
	}

	@ExceptionHandler(IllegalStateException.class)
	public ResponseEntity<Map<String, Object>> badGateway(IllegalStateException ex) {
		return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("success", false, "error", ex.getMessage()));
	}
}
