-- Backfill product_skus.images from legacy metadata.variants when SKU rows were created empty (1033).
-- Idempotent: only updates rows where images is null or empty array.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'product_skus'
    ) THEN
        RETURN;
    END IF;
END $$;

-- Match by option_values (size/color) when possible
UPDATE product_skus ps
SET images = matched.legacy_images,
    updated_at = now()
FROM (
    SELECT
        ps2.id,
        CASE
            WHEN jsonb_typeof(v.elem->'images') = 'array'
                 AND jsonb_array_length(v.elem->'images') > 0
            THEN v.elem->'images'
            ELSE '[]'::jsonb
        END AS legacy_images
    FROM product_skus ps2
    JOIN products p ON p.id = ps2.product_id
    JOIN LATERAL (
        SELECT elem
        FROM jsonb_array_elements(
            CASE
                WHEN p.metadata IS NOT NULL
                     AND jsonb_typeof(p.metadata->'variants') = 'array'
                THEN p.metadata->'variants'
                ELSE '[]'::jsonb
            END
        ) AS elem
        WHERE jsonb_strip_nulls(
            jsonb_build_object(
                'size',
                CASE
                    WHEN elem->>'size' IS NOT NULL AND TRIM(elem->>'size') <> ''
                    THEN TRIM(elem->>'size')
                    ELSE NULL
                END,
                'color',
                CASE
                    WHEN elem->>'color' IS NOT NULL AND TRIM(elem->>'color') <> ''
                    THEN TRIM(elem->>'color')
                    WHEN elem->>'colour' IS NOT NULL AND TRIM(elem->>'colour') <> ''
                    THEN TRIM(elem->>'colour')
                    ELSE NULL
                END
            )
        ) = ps2.option_values
    ) v ON true
    WHERE (
        ps2.images IS NULL
        OR ps2.images = '[]'::jsonb
        OR jsonb_array_length(ps2.images) = 0
    )
) matched
WHERE ps.id = matched.id
  AND matched.legacy_images <> '[]'::jsonb;

-- Fallback: match by sort_order index when option_values did not align
UPDATE product_skus ps
SET images = matched.legacy_images,
    updated_at = now()
FROM (
    SELECT
        ps2.id,
        CASE
            WHEN jsonb_typeof(v.elem->'images') = 'array'
                 AND jsonb_array_length(v.elem->'images') > 0
            THEN v.elem->'images'
            ELSE '[]'::jsonb
        END AS legacy_images
    FROM product_skus ps2
    JOIN products p ON p.id = ps2.product_id
    JOIN LATERAL (
        SELECT elem, ord
        FROM jsonb_array_elements(
            CASE
                WHEN p.metadata IS NOT NULL
                     AND jsonb_typeof(p.metadata->'variants') = 'array'
                THEN p.metadata->'variants'
                ELSE '[]'::jsonb
            END
        ) WITH ORDINALITY AS t(elem, ord)
    ) v ON v.ord = ps2.sort_order + 1
    WHERE (
        ps2.images IS NULL
        OR ps2.images = '[]'::jsonb
        OR jsonb_array_length(ps2.images) = 0
    )
) matched
WHERE ps.id = matched.id
  AND matched.legacy_images <> '[]'::jsonb
  AND (
      ps.images IS NULL
      OR ps.images = '[]'::jsonb
      OR jsonb_array_length(ps.images) = 0
  );
