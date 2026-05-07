package com.warmpawz.customer.dto.request;

import lombok.Data;

@Data
public class DeactivateCustomerRequest {
    private String reason;
    private Boolean permanentDelete;
}
