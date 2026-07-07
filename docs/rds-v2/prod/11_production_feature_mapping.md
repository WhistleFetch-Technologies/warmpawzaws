# 11 — Production Feature Mapping

| Feature | Tables | Code-active | Est. total rows (sum) |
|---------|--------|-------------|------------------------|
| Other | 135 | 77 | 5828607 |
| Vendor | 35 | 26 | 1317672 |
| Notifications | 18 | 15 | 547050 |
| Customer | 16 | 15 | 648718 |
| Delivery | 16 | 12 | 835619 |
| Support | 9 | 9 | 499782 |
| Admin | 14 | 9 | 491545 |
| Loyalty | 8 | 8 | 344791 |
| Ecommerce | 9 | 7 | 475136 |
| Booking | 11 | 6 | 360993 |
| Staff | 7 | 6 | 196608 |
| Payments | 6 | 5 | 328166 |
| Wallet | 4 | 4 | 180526 |
| Diagnostics | 3 | 3 | 212992 |
| Analytics | 2 | 2 | 104105 |
| Search | 2 | 2 | 1406 |
| RBAC | 2 | 2 | 845 |
| Pharmacy | 4 | 2 | 172044 |
| AI | 2 | 2 | 131117 |
| Tele | 5 | 1 | 180288 |
| Insurance | 1 | 1 | 40960 |
| Dating | 6 | 0 | 294912 |

## Critical cross-feature dependencies

- **Booking** → vendors, customers, vendor_services, payments, settlements, notifications
- **Discovery** → service_catalog, vendor_services, specialization_master, search_index
- **Ecommerce** → orders, products, payments, settlements
- **Vendor onboarding** → vendors, vendor_identity, roles, vendor_onboarding_applications
