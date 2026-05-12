package com.warmpawz.customer.dto.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommonResponse<T> {

    private boolean success;
    private T data;
    private String message;
    private Object customer;
    private Object profile;
    private Object address;
    private Object addresses;
    private Object pet;
    private Object pets;
    private Object pagination;

    /** Optional; mirrors Lambda error bodies (e.g. pet delete with active bookings). */
    private Long activeBookingsCount;

    /** Optional; mirrors Lambda {@code error} string on some customer routes. */
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