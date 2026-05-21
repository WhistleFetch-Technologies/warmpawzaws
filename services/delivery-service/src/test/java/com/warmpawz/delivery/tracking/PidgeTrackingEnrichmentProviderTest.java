package com.warmpawz.delivery.tracking;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.warmpawz.delivery.dto.tracking.DeliveryTrackingEnrichmentDto;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class PidgeTrackingEnrichmentProviderTest {

	private final ObjectMapper mapper = new ObjectMapper();

	@Test
	void parseFulfillmentTracking_extractsRiderLocationAndEta() throws Exception {
		String json = """
				{
				  "data": {
				    "fulfillment": {
				      "status": "OUT_FOR_DELIVERY",
				      "track_code": "https://track.example/p/1",
				      "eta_minutes": 8,
				      "rider": {
				        "id": "r-99",
				        "name": "Rahul Kumar",
				        "mobile": "9876543210",
				        "vehicle_type": "Bike",
				        "vehicle_number": "KA01AB1234"
				      },
				      "logs": [
				        {
				          "status": "IN_TRANSIT",
				          "location": { "latitude": 12.9716, "longitude": 77.5946 }
				        }
				      ]
				    }
				  }
				}
				""";

		DeliveryTrackingEnrichmentDto dto = PidgeTrackingEnrichmentProvider.parseFulfillmentTracking(mapper.readTree(json));
		assertNotNull(dto);
		assertEquals("pidge", dto.getProvider());
		assertEquals("OUT_FOR_DELIVERY", dto.getProviderTrackingStatus());
		assertEquals(8, dto.getEtaMinutes());
		assertNotNull(dto.getRider());
		assertEquals("Rahul Kumar", dto.getRider().getRiderName());
		assertEquals("9876543210", dto.getRider().getRiderPhone());
		assertEquals("Bike", dto.getRider().getVehicleType());
		assertEquals("KA01AB1234", dto.getRider().getVehicleNumber());
		assertNotNull(dto.getLocation());
		assertEquals(12.9716, dto.getLocation().getLatitude(), 0.0001);
		assertEquals(77.5946, dto.getLocation().getLongitude(), 0.0001);
	}

	@Test
	void parseFulfillmentTracking_returnsNullWhenEmpty() throws Exception {
		assertNull(PidgeTrackingEnrichmentProvider.parseFulfillmentTracking(mapper.readTree("{}")));
	}

	@Test
	void shouldExposeRider_onlyActivePhases() {
		org.junit.jupiter.api.Assertions.assertTrue(
				DeliveryTrackingRiderVisibility.shouldExposeRider("on_the_way"));
		org.junit.jupiter.api.Assertions.assertFalse(
				DeliveryTrackingRiderVisibility.shouldExposeRider("preparing"));
		org.junit.jupiter.api.Assertions.assertFalse(
				DeliveryTrackingRiderVisibility.shouldExposeRider("delivered"));
	}
}
