package com.warmpawz.customer.dto.common;

import lombok.Data;

@Data
public class CommonResponse<T> {

    private boolean success;
    private T data;
    private String message;

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