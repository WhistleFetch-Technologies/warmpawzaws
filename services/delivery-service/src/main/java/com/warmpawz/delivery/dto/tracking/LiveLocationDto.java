package com.warmpawz.delivery.dto.tracking;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class LiveLocationDto {
	Double latitude;
	Double longitude;
}
