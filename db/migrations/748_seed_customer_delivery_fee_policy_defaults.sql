-- Ensure customer delivery fee policy exists in all environments.
-- Single source of truth key: customer:delivery:fee_policy

INSERT INTO platform_settings (
  setting_key,
  setting_value,
  setting_type,
  description,
  is_public,
  created_at,
  updated_at
)
SELECT
  'customer:delivery:fee_policy',
  '{
    "version": 1,
    "maxServiceRadiusKm": 10,
    "zoneABoundaryKm": 5,
    "zones": {
      "zoneA": [
        { "minOrderInr": 0, "maxOrderInr": 1000, "deliveryFeeInr": 99 },
        { "minOrderInr": 1000, "maxOrderInr": 1500, "deliveryFeeInr": 49 },
        { "minOrderInr": 1500, "maxOrderInr": null, "deliveryFeeInr": 0 }
      ],
      "zoneB": [
        { "minOrderInr": 0, "maxOrderInr": 1000, "deliveryFeeInr": 149 },
        { "minOrderInr": 1000, "maxOrderInr": 1500, "deliveryFeeInr": 99 },
        { "minOrderInr": 1500, "maxOrderInr": 2000, "deliveryFeeInr": 49 },
        { "minOrderInr": 2000, "maxOrderInr": null, "deliveryFeeInr": 0 }
      ]
    },
    "surges": {
      "weekendInr": 15,
      "festivalMinInr": 25,
      "festivalMaxInr": 40,
      "rainMinInr": 10,
      "rainMaxInr": 15,
      "priorityNote": "Emergency / priority delivery may incur additional charges communicated at checkout."
    },
    "content": {
      "coverageSummary": "We currently offer deliveries within a maximum radius of 10 KM from the nearest fulfillment location.",
      "zoneADescription": "Zone A: Up to 5 KM radius from fulfillment.",
      "zoneBDescription": "Zone B: Beyond 5 KM up to 10 KM radius.",
      "surgeIntro": "The following charges may apply during peak operational conditions:",
      "rulesFreeDelivery": [
        "Order value meets the eligible slab",
        "Delivery address falls within the supported radius",
        "Standard delivery slot is selected",
        "Delivery partner availability is active"
      ],
      "rulesBeyond5Km": [
        "Subject to operational feasibility and rider availability",
        "Delivery timelines may extend up to 60–90 minutes",
        "Certain heavy, frozen, temperature-sensitive, or low-margin products may have delivery limitations"
      ],
      "rulesBeyond8Km": [
        "May be serviced through scheduled delivery slots only",
        "COD availability may be restricted for low-value orders",
        "Delivery acceptance depends on live serviceability conditions"
      ],
      "importantNotes": [
        "Delivery timelines are indicative and may vary due to weather, traffic, festivals, or operational demand.",
        "The company reserves the right to modify delivery charges, service radius, delivery timelines, or operational policies without prior notice."
      ]
    }
  }'::jsonb,
  'object',
  'Customer-facing delivery fee matrix (zones by distance + order value), surges, and policy copy',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings WHERE setting_key = 'customer:delivery:fee_policy'
);

UPDATE platform_settings
SET is_public = true,
    updated_at = NOW()
WHERE setting_key = 'customer:delivery:fee_policy'
  AND is_public IS DISTINCT FROM true;
