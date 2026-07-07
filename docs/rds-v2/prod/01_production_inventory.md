# 01 — Production Database Inventory

**Generated:** 2026-07-07T08:11:52.811Z  
**Cluster:** warmpawz-prod-cluster (via RDS Proxy, read-only)  
**Database:** warmpawz

## Database version

```
PostgreSQL 15.12 on aarch64-unknown-linux-gnu, compiled by aarch64-unknown-linux-gnu-gcc (GCC) 10.5.0, 64-bit
```

## Aurora cluster (AWS describe)

| Attribute | Value |
|-----------|-------|
| Engine | aurora-postgresql 15.12 |
| Status | available |
| Serverless v2 | min 2 – max 8 ACU |
| HTTP Data API | Enabled |
| Storage encrypted | true |

## Object counts (public schema)

| Object type | Count |
|-------------|-------|
| Tables (incl. partitioned) | 313 |
| Views | 0 |
| Materialized views | 0 |
| Sequences | 1 |
| Enum types | 13 |
| Functions | 73 |
| Triggers | 39 |
| Indexes | 1279 |
| Foreign keys | 420 |
| Unique constraints | 239 |
| Check constraints | 1943 |
| Columns | 4340 |

## Schemas

- `pg_toast_temp_107`
- `pg_toast_temp_11`
- `pg_toast_temp_111`
- `pg_toast_temp_12`
- `pg_toast_temp_128`
- `pg_toast_temp_14`
- `pg_toast_temp_145`
- `pg_toast_temp_15`
- `pg_toast_temp_17`
- `pg_toast_temp_19`
- `pg_toast_temp_20`
- `pg_toast_temp_21`
- `pg_toast_temp_22`
- `pg_toast_temp_25`
- `pg_toast_temp_26`
- `pg_toast_temp_27`
- `pg_toast_temp_28`
- `pg_toast_temp_29`
- `pg_toast_temp_31`
- `pg_toast_temp_32`
- `pg_toast_temp_33`
- `pg_toast_temp_36`
- `pg_toast_temp_39`
- `pg_toast_temp_40`
- `pg_toast_temp_43`
- `pg_toast_temp_44`
- `pg_toast_temp_48`
- `pg_toast_temp_50`
- `pg_toast_temp_51`
- `pg_toast_temp_53`
- `pg_toast_temp_59`
- `pg_toast_temp_62`
- `pg_toast_temp_64`
- `pg_toast_temp_67`
- `pg_toast_temp_69`
- `pg_toast_temp_70`
- `pg_toast_temp_71`
- `pg_toast_temp_72`
- `pg_toast_temp_75`
- `pg_toast_temp_80`
- `pg_toast_temp_85`
- `pg_toast_temp_88`
- `pg_toast_temp_90`
- `pg_toast_temp_91`
- `pg_toast_temp_97`
- `public`

## Extensions

- **pg_trgm** 1.6 (public)
- **plpgsql** 1.0 (pg_catalog)
- **uuid-ossp** 1.1 (public)

## Key settings

- **max_connections** = 3443
- **random_page_cost** = 4
- **server_version** = 15.12
- **shared_buffers** = 3276808kB
- **work_mem** = 4096kB

## Artifacts

| File | Description |
|------|-------------|
| `_raw_prod_discovery.json` | Full catalog dump |
| `03_production_table_inventory.csv` | Per-table inventory |
| `07_production_fk_graph.json` | FK graph |
| `08_production_dependency_graph.json` | Combined dependency graph |

**Safety:** All queries executed inside `BEGIN READ ONLY` transactions. No DDL/DML.
