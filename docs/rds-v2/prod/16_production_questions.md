# 16 — Production Discovery Questions

Awaiting approval before next phase (prod vs dev drift comparison).

1. Which migration-only tables with **prod rows > 0** are still business-required?
2. Confirm canonical table for duplicate pairs (coupon_usage/usages, vendor_holidays/enhanced).
3. Is the dating feature retired in production?
4. Are `*_backup` tables required for compliance/audit retention?
5. What is acceptable downtime/write-freeze window for prod cutover?
6. Should `search_index` be rebuilt vs migrated in v2?
7. Is full ecommerce in v2 core scope?
8. Retain staff tables if solo-vendor model is final?
9. Prod tables with rows but zero code refs — batch jobs outside Lambda?
10. Old prod cluster retention period after cutover (14 vs 30 days)?
