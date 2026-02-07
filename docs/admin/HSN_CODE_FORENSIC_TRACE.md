# HSN Code Create/Edit – Forensic Tracing

## Root cause (fixed)

- **Schema variance**: DB can have `hsn_code` (001/600) or `code` (213) or both. The code now detects the column via `information_schema` and uses the same column for duplicate check and write.
- **Duplicate on edit**: We only set the code in the UPDATE when the value actually changed. If it’s unchanged we don’t touch it, so the unique constraint isn’t triggered. We also run a pre-check (another row with same code, excluding current id) and return 409 before updating.
- **Create on code-only DB**: INSERT now uses the detected column; if the first attempt fails with “column does not exist”, we retry with the other column.

## CloudWatch logs (Lambda)

Search log group for your API Lambda for:

- `[HSN] Create success` – create succeeded (id, code, column used).
- `[HSN] Create rejected: duplicate code` – create blocked by pre-check (code, column).
- `[HSN] Update success` – update succeeded (id, column).
- `[HSN] Update rejected: duplicate code` – update blocked by pre-check (id, code, column).
- `[HSN] Create error:` / `[HSN] Update error:` – unexpected error (message).

Use these to confirm which column is used and when duplicates are rejected.

## API behavior (no hardcoding)

1. **Column detection**: `getHsnCodeColumn()` uses `information_schema.columns` (and fallback probe) so the same column is used for duplicate check and for INSERT/UPDATE.
2. **POST**: Pre-check with detected column; INSERT with that column; 409 on duplicate (pre-check or 23505); retry with other column if “column does not exist”.
3. **PUT**: Load current code with detected column; if `body.code === current` do not set code in payload; else pre-check, then set `updateData[column]`; 409 on duplicate; retry with other column if “column does not exist”.
