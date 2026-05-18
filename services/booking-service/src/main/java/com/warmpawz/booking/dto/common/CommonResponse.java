package com.warmpawz.booking.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommonResponse<T> {

    private boolean success;
    private T data;
    private String message;
    private Object booking;
    private Object bookings;
    private Object pagination;

    /** Optional; mirrors Lambda error bodies. */
    private Long activeBookingsCount;

    /** Optional; mirrors Lambda {@code error} string on some routes. */
    private String error;

    public static <T> CommonResponse<T> success(T data) {
        CommonResponse<T> response = new CommonResponse<>();
        response.setSuccess(true);
        response.setData(data);
        return response;
    }

    public static <T> CommonResponse<T> success(T data, String message) {
        CommonResponse<T> response = new CommonResponse<>();
        response.setSuccess(true);
        response.setData(data);
        response.setMessage(message);
        return response;
    }

    public static <T> CommonResponse<T> message(String message) {
        CommonResponse<T> response = new CommonResponse<>();
        response.setSuccess(true);
        response.setMessage(message);
        return response;
    }
}
