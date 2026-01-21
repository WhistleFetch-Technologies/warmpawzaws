# Complete Default Sections - Implementation Plan
## Replace 22 Default Sections with Functional Components

**Date:** 2026-01-28  
**Status:** 📋 **PLANNING**  
**Goal:** Complete all 22 remaining default sections with functional dashboard components

---

## Strategy

For capabilities without direct API endpoints, we'll use:
1. **Service Styles (Bookings)**: Filter bookings by `service_style` field
2. **Specialized Services**: Use parent service APIs (cafe, resort, insurance, adoption, training, nutrition)
3. **Settings/Configuration**: Show configuration status
4. **Dashboard**: Skip (already the main dashboard)

---

## Implementation Plan

### Service Styles (8 capabilities)
These filter bookings by service_style:
1. **centre_booking** - Count bookings with `service_style = 'centre_booking'`
2. **home_services** - Count bookings with `service_style = 'home_services'`
3. **tele_consultation** - Count bookings with `service_style = 'tele_consultation'`
4. **reservations** - Count bookings with `service_style = 'reservations'` (cafe tables)
5. **checkin_checkout** - Count bookings with `service_style = 'checkin_checkout'` (resort)
6. **route_tracking** - Count active GPS tracking sessions (similar to gps_tracking)
7. **service_radius** - Show configured service radius (from vendor profile/settings)
8. **tour_schedule** - Count upcoming tours from holiday packages

### Specialized Services (9 capabilities)
Use parent service APIs:
9. **menu** - Count menu items (use cafe API or services API)
10. **vehicles** - Count vehicles (use ambulance/vehicles API)
11. **boarding** - Count boarding capacity/bookings (use resort API)
12. **policies** - Count active insurance policies
13. **claims** - Count pending insurance claims
14. **pet_profiles** - Count pet profiles (use adoption/pets API)
15. **lineage** - Count lineage records (use adoption/lineage API)
16. **progress_tracking** - Count active training progress (use training/progress API)
17. **food_delivery** - Count active delivery orders (use nutrition/delivery API)

### E-commerce (1 capability)
18. **seller_hub** - Count products/orders (use products/orders API)

### Operations (1 capability)
19. **settings** - Show settings configuration status

### Other (1 capability)
20. **dashboard** - Skip (main dashboard, always visible)

---

## Implementation Pattern

All sections will:
- Load data from APIs (direct or filtered)
- Display summary statistics
- Show loading states
- Handle errors gracefully
- Link to full management pages
- Follow Warmpawz design standards
