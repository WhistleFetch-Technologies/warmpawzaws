# Warmpawz RDS v2 — Database Modernization Program

Read **[00-program-charter.md](00-program-charter.md)** first.

## Completed artifacts (Phase 0 / 0B)

### Dev application discovery (Phase 0)

| File | Description |
|------|-------------|
| [02-application-dependency-map.md](02-application-dependency-map.md) | Executive summary + dependency analysis |
| [_dependency-matrix.json](_dependency-matrix.json) | Per-table status (421 tables) |
| [_dependency-scan.json](_dependency-scan.json) | Summary, feature map, endpoint prefixes |
| [_endpoint-table-map.json](_endpoint-table-map.json) | Route → table heuristic map |
| [_column-usage-top80.json](_column-usage-top80.json) | Column refs for top 80 active tables |
| [_duplicate-analysis.json](_duplicate-analysis.json) | Duplicate pair comparison |

Regenerate: `node scripts/rds-v2-dependency-scan.js && node scripts/rds-v2-column-scan.js`

### Prod catalog discovery (Phase 0B, read-only)

| File | Description |
|------|-------------|
| [prod/01_production_inventory.md](prod/01_production_inventory.md) | Object counts, extensions |
| [prod/02_production_schema_summary.md](prod/02_production_schema_summary.md) | Scale, largest tables |
| [prod/03_production_table_inventory.csv](prod/03_production_table_inventory.csv) | Per-table inventory |
| [prod/04_production_row_counts.csv](prod/04_production_row_counts.csv) | Row counts |
| [prod/05_production_table_sizes.csv](prod/05_production_table_sizes.csv) | On-disk sizes |
| [prod/06_production_column_inventory.csv](prod/06_production_column_inventory.csv) | All columns |
| [prod/07_production_fk_graph.json](prod/07_production_fk_graph.json) | FK graph |
| [prod/08_production_dependency_graph.json](prod/08_production_dependency_graph.json) | Combined deps |
| [prod/09](prod/09_production_table_usage.md)–[16](prod/16_production_questions.md) | Usage, risk, debt, questions |
| [prod/_raw_prod_discovery.json](prod/_raw_prod_discovery.json) | Full catalog dump |

Regenerate: `ENVIRONMENT=prod node scripts/rds-v2-prod-discovery.js`

### RCA baselines (scripts/)

| File | Description |
|------|-------------|
| `scripts/_rca-performance-master-dev.json` | Dev Lambda/RDS RCA |
| `scripts/_rca-performance-master-prod.json` | Prod RCA |
| `scripts/_rca-rds-schema-prod.json` | Prod FK/cascade extended |

## Pending gates (design — no implementation yet)

See [00-program-charter.md](00-program-charter.md) for Gates C, B0–B7, D–J.

## Safety

- Discovery scripts are **read-only** on production (RDS Data API / SELECT only).
- No cluster provisioning, DDL, or ETL until Architecture Freeze sign-off at Gate B7.
