# Warmpawz RDS v2 — Database Modernization Program Charter

**Status:** Planning complete (10/10 enterprise architecture review)  
**Branch:** `docs/rds-v2-discovery`  
**Last updated:** 2026-07-07

---

## Program status

**Planning: 10/10** — signed off as enterprise architecture review. **No additional migration gates** beyond Gate J (closeout). Highest-value work is **disciplined execution** with living documents and full traceability.

**Hard rules (unchanged + freeze):**

- No `terraform apply`, no DDL on any cluster, no ETL until **Gates B0–B7** approved
- **Architecture Freeze** begins immediately after Gate B7 sign-off (see Governance)

---

## Principal architect reviews — incorporated

1. **Review 1:** Domain model, lineage, invariants, column disposition, runbooks, ADRs, observability, verification suites
2. **Review 2:** Architecture freeze, schema governance board, traceability matrix, schema revision ledger (not "v2" in SQL), data classification, domain ownership, migration metrics, archive manifest, completion definition, Gate J closeout

**Hard rule:** No infra/ETL until **B0–B7 + Architecture Freeze** signed.

---

## Current state (completed)

Discovery published on branch `docs/rds-v2-discovery`:

| Layer | Dev (Phase 0) | Prod (Phase 0B) |
|-------|---------------|-----------------|
| App dependency | [02-application-dependency-map.md](02-application-dependency-map.md) | [prod/09_production_table_usage.md](prod/09_production_table_usage.md) |
| Machine-readable | `_dependency-matrix.json` (268 Active in dev inventory) | `_raw_prod_discovery.json` (313 tables, **212** code-active) |
| Risk / FK | — | `prod/07_production_fk_graph.json`, `prod/15_production_risk_report.md` |

**Stakeholder decisions:**

- **v1 scope:** All **212 code-active** tables.
- **Prod cutover:** **AWS DMS CDC** → `legacy_staging` on v2; minimal write-freeze at final switch.

---

## Target documentation repository structure

```text
docs/rds-v2/
├── 00-program-charter.md          # this document
├── README.md
├── 01-discovery/                  # Phase 0 dev (reorg pending)
├── 02-prod-discovery/             # Phase 0B prod (reorg pending)
├── 03-drift-analysis/             # Gate C
├── 04-business-domain-model/      # Gate B1 — BLOCKS schema
├── 05-target-schema/              # Gate B2 naming + Gate B3 ER
├── 06-data-lineage/               # Gate B6
├── 07-business-invariants/        # Gate B5
├── 08-column-disposition/         # Gate B4
├── 09-etl-spec/                   # Gate B6
├── 10-cutover-runbook/            # Gate B7
├── 11-rollback-runbook/           # Gate B7
├── 12-observability/              # Gate B7
├── 13-verification/               # Gate B7 + E/F/H
├── 14-traceability-matrix/        # Gate B6
├── governance/                    # freeze, classification, DONE, metrics
├── 15-enterprise-closeout/        # Gate J
└── adr/                           # Gate B0
```

Supporting code (post Gate B7 + Architecture Freeze only):

```text
db/schema/                         # bounded-context DDL + schema_migrations ledger
db/etl/table-manifest.yaml
db/etl/archive-manifest.yaml
scripts/rds-v2-etl/
scripts/rds-v2-dependency-scan.js  # regenerate dev app matrix
scripts/rds-v2-column-scan.js
scripts/rds-v2-prod-discovery.js   # regenerate prod catalog (read-only)
```

**Naming note:** "v2" is a **program name** (cluster `warmpawz-*-cluster-v2`, docs `rds-v2/`). Inside PostgreSQL use **Schema Revision N** and `schema_migrations` ledger — never `schema_v2` as a schema name.

---

## Gated phase roadmap

| Gate | Deliverable | Blocks |
|------|-------------|--------|
| **C** | `03-drift-analysis/` | B1 |
| **B0** | `adr/ADR-001` … `ADR-005` | All design gates |
| **B1** | `04-business-domain-model/` | **B3, B4, B5** |
| **B2** | `05-target-schema/naming-standard.md` | B3, B4 |
| **B3** | `05-target-schema/` ER + disposition | B4, D DDL |
| **B4** | `08-column-disposition/` + data classification | B6 ETL |
| **B5** | `07-business-invariants/` | validate.js |
| **B6** | lineage + ETL spec + traceability + archive manifest | D ETL |
| **B7** | runbooks + verification + observability + **governance freeze** | **C infra, H cutover** |
| **C infra** | Terraform v2 dev | D |
| **D–I** | Schema SQL, ETL, cutover, repository | — |
| **J** | Enterprise closeout | Program DONE |

**Timeline:** Design gates B0–B7 ≈ 2–3 weeks. Implementation ≈ 10–14 weeks after B7.

---

## Architecture freeze (starts at Gate B7)

Documented in `governance/architecture-freeze.md`:

1. No new feature development may modify the **legacy** RDS schema
2. All schema changes require a new **ADR** + governance review
3. Any prod hotfix that changes legacy schema must be **back-ported** into the program
4. Any deviation **pauses** migration until reconciled

---

## ADRs (Gate B0)

| ADR | Title | Decision |
|-----|-------|----------|
| ADR-001 | DMS vs pg_dump | DMS → `legacy_staging`; reject pg_dump |
| ADR-002 | Greenfield schema | New cluster; reject migration replay |
| ADR-003 | Taxonomy redesign | categories → catalog → vendor_services FK chain |
| ADR-004 | Repository pattern | Phased `domains/*` repos |
| ADR-005 | Archive dating | `dating_*` → S3; exclude from `public` |

---

## ETL architecture

DMS full load + CDC → `legacy_staging` (1:1 v1) → transform → `public` (target schema) → validate invariants.

Load tiers T0–T6 (FK order). See charter sections in Cursor plan for invariants INV-001–010, cutover runbook template, observability alarms, verification suites, traceability matrix format, migration metrics scorecard, and DONE checklist.

---

## Recommended execution order

1. docs-reorg
2. Gate C — drift
3. Gate B0 — ADRs
4. Gate B1 — domain model + ownership
5. Gates B2–B4 — naming, schema, disposition + data classification
6. Gate B5 — invariants
7. Gate B6 — lineage, ETL spec, traceability, archive manifest
8. Gate B7 — runbooks, verification, observability, **governance + architecture freeze sign-off**
9. Gate C infra — only after step 8
10. Gates D → I
11. Gate J — closeout

**Do not provision cluster or write ETL until step 8 completes.**

---

## Assessment (final)

| Area | Rating |
|------|--------|
| Planning & governance | **10/10** |
| Discovery | 10/10 |
| Safety & rollback | 10/10 |
| ETL & traceability | 10/10 (upon B6 delivery) |
| Enterprise readiness | 10/10 |

This is the **Database Modernization Program Charter** — not a migration checklist.

For the full expanded charter (gate details, mermaid diagrams, risk register), see the Cursor plan artifact `rds_v2_safe_migration_b66617c8.plan.md` in the team plan store.
