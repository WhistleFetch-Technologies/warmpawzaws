package com.warmpawz.customer.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GoogleAddressResult {
    private String addressLine1;
    private String addressLine2;
    private String city;
    private String state;
    private String pincode;
    private String formattedAddress;
    private String placeId;
    private Double latitude;
    private Double longitude;
}
