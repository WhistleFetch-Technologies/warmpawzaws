# 13 — Production Repository Mapping

Warmpawz uses **endpoint-centric** data access, not a classical repository layer.

| Layer | Module | Role |
|-------|--------|------|
| Gateway | `database/rds-connection.ts` | All RDS I/O |
| Only explicit repo | `teleCommunication/repository/repository.telecommunication.ts` | Video/tele sessions |
| Primary | `endpoints/**/*.ts` | Business logic + SQL |
| Workers | `jobs/*.ts` | Async processors |
| Migrations | `db/migrations/*.sql` | Historical DDL |

## Highest-coupling endpoint modules (prod-relevant)

| Module | Representative tables |
|--------|----------------------|
| bookings-enhanced.booking.ts | bookings, booking_services, package_sessions |
| service-discovery.customer.ts | service_catalog, vendor_services, vendors |
| admin-advanced.ts | cross-domain admin tables |
| vendor-schedule.ts | vendor_availability_v2, vendor_holidays* |
| settlements.ts + settlement-processor | settlements, payouts, vendors |
