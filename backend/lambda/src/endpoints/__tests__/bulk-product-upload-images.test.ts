import fs from 'fs';
import path from 'path';

const BULK_UPLOAD_SRC = path.join(__dirname, '..', 'bulk-product-upload.ts');

describe('bulk-product-upload image passthrough', () => {
  it('does not import or call product-image-ingest (URLs stored as-is)', () => {
    const src = fs.readFileSync(BULK_UPLOAD_SRC, 'utf8');
    expect(src).not.toContain('product-image-ingest');
    expect(src).not.toContain('ingestExternalProductImageUrls');
    expect(src).toContain('skipImageIngest: true');
    expect(src).toContain('planBulkDriveImages');
    expect(src).toContain('invokeDriveImageIngestWorker');
  });
});
