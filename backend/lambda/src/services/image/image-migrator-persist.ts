/**
 * Persist lazy-migrated WebP keys back to source rows (display key only).
 */

import { query } from '../../database/rds-connection';

export type ImagePersistTarget =
  | { kind: 'scalar'; table: string; column: string; idColumn: string; id: string }
  | { kind: 'products_images'; productId: string; legacyValue: string }
  | { kind: 'product_skus_images'; skuId: string; legacyValue: string }
  | { kind: 'vendor_facility_photo'; vendorId: string; legacyValue: string };

function normalizeMatchValue(raw: string): string {
  return String(raw || '').trim();
}

async function replaceJsonbArrayString(
  table: string,
  column: string,
  idColumn: string,
  id: string,
  legacyValue: string,
  newKey: string,
): Promise<void> {
  const legacy = normalizeMatchValue(legacyValue);
  await query(
    `UPDATE ${table}
     SET ${column} = (
       SELECT COALESCE(jsonb_agg(
         CASE
           WHEN elem #>> '{}' = $2 OR elem->>'url' = $2 OR elem->>'src' = $2 OR elem->>'image_url' = $2
             THEN to_jsonb($3::text)
           ELSE elem
         END
       ), '[]'::jsonb)
       FROM jsonb_array_elements(COALESCE(${column}, '[]'::jsonb)) AS elem
     ),
     updated_at = NOW()
     WHERE ${idColumn} = $1::uuid`,
    [id, legacy, newKey],
  );
}

export async function persistMigratedImageKey(
  target: ImagePersistTarget,
  newKey: string,
): Promise<void> {
  const key = normalizeMatchValue(newKey);
  if (!key) return;

  try {
    switch (target.kind) {
      case 'scalar':
        await query(
          `UPDATE ${target.table}
           SET ${target.column} = $2, updated_at = NOW()
           WHERE ${target.idColumn} = $1::uuid`,
          [target.id, key],
        );
        break;
      case 'products_images':
        await replaceJsonbArrayString(
          'products',
          'images',
          'id',
          target.productId,
          target.legacyValue,
          key,
        );
        break;
      case 'product_skus_images':
        await replaceJsonbArrayString(
          'product_skus',
          'images',
          'id',
          target.skuId,
          target.legacyValue,
          key,
        );
        break;
      case 'vendor_facility_photo': {
        const legacy = normalizeMatchValue(target.legacyValue);
        await query(
          `UPDATE vendors
           SET metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{facility_photos}',
             (
               SELECT COALESCE(jsonb_agg(
                 CASE
                   WHEN elem #>> '{}' = $2 OR elem->>'url' = $2 OR elem->>'key' = $2
                     THEN to_jsonb($3::text)
                   ELSE elem
                 END
               ), '[]'::jsonb)
               FROM jsonb_array_elements(COALESCE(metadata->'facility_photos', '[]'::jsonb)) AS elem
             ),
             true
           ),
           updated_at = NOW()
           WHERE id = $1::uuid`,
          [target.vendorId, legacy, key],
        );
        break;
      }
      default:
        break;
    }
  } catch (err: unknown) {
    console.warn(
      '[image-migrator-persist] failed:',
      (err as Error)?.message || err,
      target,
    );
  }
}
