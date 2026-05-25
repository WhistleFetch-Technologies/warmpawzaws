package com.warmpawz.delivery.dto.tracking;

import lombok.Builder;
import lombok.Value;

/** Provider-agnostic rider snapshot for customer tracking APIs. */
@Value
@Builder
public class RiderInfoDto {
	String riderName;
	String riderPhone;
	String riderId;
	String riderPhoto;
	String vehicleType;
	String vehicleNumber;
}
