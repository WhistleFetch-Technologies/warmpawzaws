#!/usr/bin/env bash
# Role/Style Discovery Audit: counts + enrichment status per role and service style.
# Roles: Groomer, Vet, Walker, Nutritionist, Diagnostics, Trainer (solo + business).
# Styles: at_home, at_center, tele.
# Enrichment: photo, description, price/duration, specialization, nextAvailable, distance.

set -euo pipefail

API_BASE="${API_BASE:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
LAT="${LAT:-12.9716}"
LNG="${LNG:-77.5946}"

# Role names (solo vs business by naming: *_solo vs center/clinic)
ROLES=(
  "veterinarian"
  "vet_clinic"
  "vet_solo"
  "pet_groomer"
  "groomer_center"
  "groomer_solo"
  "pet_trainer"
  "trainer_center"
  "trainer_solo"
  "walker"
  "pet_walker"
  "walker_solo"
  "nutritionist"
  "nutritionist_solo"
  "diagnostics_center"
)

STYLES=("at_home" "at_center" "tele")

call() {
  curl -sS "$1"
}

# Count items from discover-services (vendors or providers)
count() {
  jq -r '(.vendors // .providers // .services // .results // []) | length' 2>/dev/null || echo "0"
}

# Enrichment from first item: photo, price, duration, specialization, nextAvailable, distance
enrich() {
  jq -r '
    (.vendors // .providers // .services // .results // []) as $arr |
    if ($arr|length)==0 then "no_items" else
      $arr[0] as $first |
      {
        hasPhoto: (($first.photoUrl // $first.photo // $first.vendorProfileImage) != null),
        hasPrice: (($first.price // $first.priceMin // $first.base_price) != null),
        hasDuration: (($first.featuredOfferings[0].duration // $first.durationMinutes // $first.duration) != null),
        hasSpec: ((($first.specializations // $first.specializationIds // []) | length) > 0),
        hasNext: (($first.nextAvailable // $first.nextAvailableSlot) != null),
        hasDistance: (($first.distance // $first.distanceKm) != null)
      } | tojson
    end
  ' 2>/dev/null || echo "no_items"
}

echo "=============================================="
echo "Discovery audit: role | style | count | enrichment"
echo "=============================================="
printf "%-20s %-10s %5s  %s\n" "ROLE" "STYLE" "COUNT" "ENRICHMENT (photo,price,dur,spec,next,dist)"
echo "----------------------------------------------"

for role in "${ROLES[@]}"; do
  for style in "${STYLES[@]}"; do
    url="$API_BASE/customer/discover-services?roleId=$role&serviceStyle=$style&latitude=$LAT&longitude=$LNG"
    res="$(call "$url")"
    c="$(echo "$res" | count)"
    e="$(echo "$res" | enrich)"
    if [ "$e" = "no_items" ]; then
      enrich_short="n/a"
    else
      photo=$(echo "$e" | jq -r '.hasPhoto')
      price=$(echo "$e" | jq -r '.hasPrice')
      dur=$(echo "$e" | jq -r '.hasDuration')
      spec=$(echo "$e" | jq -r '.hasSpec')
      next=$(echo "$e" | jq -r '.hasNext')
      dist=$(echo "$e" | jq -r '.hasDistance')
      enrich_short="P:$photo Pr:$price D:$dur Sp:$spec N:$next Di:$dist"
    fi
    printf "%-20s %-10s %5s  %s\n" "$role" "$style" "$c" "$enrich_short"
  done
done

echo "----------------------------------------------"
echo "Enrichment legend: P=photo Pr=price D=duration Sp=specialization N=nextAvailable Di=distance (true/false)"
echo ""
echo "=============================================="
echo "By-style audit (same roles): style filter only"
echo "=============================================="
for role in "${ROLES[@]}"; do
  for style in "${STYLES[@]}"; do
    url="$API_BASE/customer/services/by-style?style=$style&roleId=$role&latitude=$LAT&longitude=$LNG"
    res="$(call "$url")"
    c="$(echo "$res" | jq -r '(.providers // .vendors // []) | length' 2>/dev/null || echo "0")"
    printf "by-style %-15s %-10s %5s\n" "$role" "$style" "$c"
  done
done

echo ""
echo "=============================================="
echo "Advanced availability sample (first 2 vendors per role/style with count>0)"
echo "GET /customer/vendor/:vendorId/available-slots?date=...&serviceStyle=...&totalDuration=30"
echo "=============================================="
TODAY="$(date +%Y-%m-%d)"
for role in "${ROLES[@]}"; do
  for style in "${STYLES[@]}"; do
    url="$API_BASE/customer/discover-services?roleId=$role&serviceStyle=$style&latitude=$LAT&longitude=$LNG"
    res="$(call "$url")"
    c="$(echo "$res" | count)"
    if [ "${c:-0}" -gt 0 ] 2>/dev/null; then
      # Get first 2 vendor IDs
      ids="$(echo "$res" | jq -r '(.vendors // .providers)[] | .id // .vendorId' 2>/dev/null | head -2)"
      idx=0
      for vid in $ids; do
        [ -z "$vid" ] && continue
        slot_url="$API_BASE/customer/vendor/$vid/available-slots?date=$TODAY&serviceStyle=$style&totalDuration=30"
        slot_res="$(call "$slot_url")"
        slot_count="$(echo "$slot_res" | jq -r '(.slots // .availableSlots // []) | length' 2>/dev/null || echo "0")"
        printf "  %-15s %-10s vendor=%s slots=%s\n" "$role" "$style" "${vid:0:8}..." "$slot_count"
        idx=$((idx+1))
        [ "$idx" -ge 2 ] && break
      done
    fi
  done
done

echo ""
echo "Done. Use API_BASE=... LAT=... LNG=... to override."
