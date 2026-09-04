import { nextDriveIngestBatch, DRIVE_INGEST_BATCH_SIZE } from '../drive-image-ingest-invoke';
import { groupBackfillJobs, runDriveIngestHop } from '../drive-image-ingest-worker';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const VENDOR = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('drive-image-ingest-worker', () => {
  it('splits 8 file ids into 3+3+2 hops', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `id${i}`);
    const first = nextDriveIngestBatch(ids);
    expect(first.batch).toHaveLength(DRIVE_INGEST_BATCH_SIZE);
    expect(first.rest).toHaveLength(5);
    const second = nextDriveIngestBatch(first.rest);
    expect(second.batch).toHaveLength(3);
    expect(second.rest).toHaveLength(2);
    const third = nextDriveIngestBatch(second.rest);
    expect(third.batch).toHaveLength(2);
    expect(third.rest).toHaveLength(0);
  });

  it('dedupes the same fileId before batching', () => {
    const { batch, rest } = nextDriveIngestBatch(['a', 'a', 'b', 'b', 'c', 'c', 'd']);
    expect(batch).toEqual(['a', 'b', 'c']);
    expect(rest).toEqual(['d']);
  });

  it('groups backfill targets that share the same file set', () => {
    const jobs = groupBackfillJobs([
      { vendorId: VENDOR, productId: 'p1', fileIds: ['f1', 'f2'] },
      { vendorId: VENDOR, productId: 'p2', fileIds: ['f2', 'f1'] },
      { vendorId: VENDOR, productId: 'p3', fileIds: ['f9'] },
    ]);
    expect(jobs).toHaveLength(2);
    const shared = jobs.find((j) => j.remainingFileIds.includes('f1'));
    expect(shared?.productIds.sort()).toEqual(['p1', 'p2']);
  });

  it('writes S3 keys and self-invokes the next hop', async () => {
    const invokeNext = jest.fn().mockResolvedValue({ invoked: true, hop: 2, capped: false });
    const writeImages = jest.fn().mockResolvedValue(undefined);
    const result = await runDriveIngestHop(
      {
        job: 'drive-image-ingest',
        vendorId: VENDOR,
        productIds: ['p1'],
        remainingFileIds: ['file1', 'file2', 'file3', 'file4'],
        completedKeys: [],
        hop: 1,
      },
      {
        downloadFile: async () => ({ ok: true, buffer: TINY_PNG, mime: 'image/png' }),
        uploadKey: async (_v, _b, _m) => `products/${VENDOR}/new.webp`,
        loadProducts: async () => [{ id: 'p1', vendor_id: VENDOR, images: [], metadata: {} }],
        writeImages,
        invokeNext,
        deleteManaged: async () => undefined,
        cleanupRemoved: async () => undefined,
      },
    );
    expect(result.nextHop).toBe(true);
    expect(invokeNext).toHaveBeenCalledTimes(1);
    expect(invokeNext.mock.calls[0][0].remainingFileIds).toEqual(['file4']);
    expect(writeImages).toHaveBeenCalled();
  });

  it('deletes hop-created keys and does not write when the product is gone', async () => {
    const writeImages = jest.fn();
    const deleteManaged = jest.fn().mockResolvedValue(undefined);
    const result = await runDriveIngestHop(
      {
        job: 'drive-image-ingest',
        vendorId: VENDOR,
        productIds: ['gone'],
        remainingFileIds: ['file1'],
        completedKeys: ['products/x/old.webp'],
        hop: 1,
      },
      {
        loadProducts: async () => [],
        writeImages,
        deleteManaged,
        invokeNext: jest.fn(),
        downloadFile: async () => ({ ok: true, buffer: TINY_PNG, mime: 'image/png' }),
        uploadKey: async () => 'should-not-run',
      },
    );
    expect(result.status).toBe('deleted');
    expect(writeImages).not.toHaveBeenCalled();
    expect(deleteManaged).toHaveBeenCalledWith(['products/x/old.webp'], VENDOR);
  });

  it('cleans previous S3 when ingest finishes with new keys', async () => {
    const cleanupRemoved = jest.fn().mockResolvedValue(undefined);
    const prior = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${VENDOR}/old.webp`;
    await runDriveIngestHop(
      {
        job: 'drive-image-ingest',
        vendorId: VENDOR,
        productIds: ['p1'],
        remainingFileIds: ['file1'],
        completedKeys: [],
        hop: 1,
      },
      {
        downloadFile: async () => ({ ok: true, buffer: TINY_PNG, mime: 'image/png' }),
        uploadKey: async () => `products/${VENDOR}/new.webp`,
        loadProducts: async () => [
          { id: 'p1', vendor_id: VENDOR, images: [prior], metadata: {} },
        ],
        writeImages: async () => undefined,
        invokeNext: jest.fn(),
        deleteManaged: async () => undefined,
        cleanupRemoved,
      },
    );
    expect(cleanupRemoved).toHaveBeenCalledWith([prior], [`products/${VENDOR}/new.webp`], VENDOR);
  });
});
