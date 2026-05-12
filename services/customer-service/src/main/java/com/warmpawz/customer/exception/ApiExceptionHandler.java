package com.warmpawz.customer.exception;

import com.warmpawz.customer.dto.common.CommonResponse;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

@ControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<CommonResponse<Map<String, Object>>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new HashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.put(error.getField(), error.getDefaultMessage());
        }
        Map<String, Object> data = Map.of("errors", fields);
        return build(HttpStatus.BAD_REQUEST, "Validation failed", data);
    }

    @ExceptionHandler({NotFoundException.class, EntityNotFoundException.class})
    public ResponseEntity<CommonResponse<Map<String, Object>>> handleNotFound(Exception ex) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), Map.of());
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<CommonResponse<Map<String, Object>>> handleConflict(ConflictException ex) {
        return build(HttpStatus.CONFLICT, ex.getMessage(), Map.of());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<CommonResponse<Map<String, Object>>> handleConstraintConflict(DataIntegrityViolationException ex) {
        return build(HttpStatus.CONFLICT, "Request conflicts with existing resource", Map.of());
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<CommonResponse<Map<String, Object>>> handleBadRequest(BadRequestException ex) {
        Map<String, Object> data = new HashMap<>(ex.getDetails());
        CommonResponse<Map<String, Object>> body = new CommonResponse<>();
        body.setSuccess(false);
        body.setMessage(ex.getMessage());
        body.setData(data.isEmpty() ? Map.of() : data);
        Object count = ex.getDetails().get("activeBookingsCount");
        if (count instanceof Number n) {
            body.setActiveBookingsCount(n.longValue());
        }
        Object err = ex.getDetails().get("error");
        if (err != null) {
            body.setError(Objects.toString(err, null));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<CommonResponse<Map<String, Object>>> handleFallback(Exception ex) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Unexpected server error", Map.of());
    }

    private ResponseEntity<CommonResponse<Map<String, Object>>> build(
            HttpStatus status,
            String message,
            Map<String, Object> data
    ) {
        CommonResponse<Map<String, Object>> body = new CommonResponse<>();
        body.setSuccess(false);
        body.setMessage(message);
        body.setData(data);
        return ResponseEntity.status(status).body(body);
    }
}
