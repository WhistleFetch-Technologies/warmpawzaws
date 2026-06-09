# Search taxonomy import

Phase 1 loads keywords from your **business spreadsheet** (source of truth). Do not hand-edit SQL seeds.

## Spreadsheet columns (only)

| Column | Required |
|--------|----------|
| Category | Yes |
| Subcategory | No (leave blank when N/A) |
| Keyword | Yes |

Export as UTF-8 CSV and save as:

`db/seed/search-taxonomy.csv`

## Validate (required before import)

```bash
node scripts/validate-search-taxonomy-spreadsheet.js
# Report: scripts/reports/search-taxonomy-validation-report.json
```

Must show **0 unmapped** keywords. Skipped rows (e.g. `at home service`) are intentional.

## Import

```bash
# After validation passes
node scripts/import-search-taxonomy-spreadsheet.js
```

Resolution rules: `scripts/lib/search-taxonomy-import-rules.js` (category / subcategory / keyword → `hub_slug`).

## Re-import

Safe to re-run: upserts on `(hub_slug, keyword_normalized)`.
