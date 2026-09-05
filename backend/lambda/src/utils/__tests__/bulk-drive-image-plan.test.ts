import {
  filterDisplayableProductImages,
  groupDriveIngestEnqueueJobs,
  planBulkDriveImages,
} from '../bulk-drive-image-plan';

const VENDOR = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const FILE_A = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const FILE_B = '1BbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('bulk-drive-image-plan', () => {
  it('keeps comma-separated HTTP URLs and does not enqueue ingest', () => {
    const plan = planBulkDriveImages(
      ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      [],
      VENDOR,
    );
    expect(plan.needsIngest).toBe(false);
    expect(plan.persistImages).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
    expect(plan.driveFileIds).toEqual([]);
  });

  it('does not persist Drive view URLs and keeps prior S3 until swap', () => {
    const priorS3 = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${VENDOR}/old.webp`;
    const plan = planBulkDriveImages(
      [
        `https://drive.google.com/uc?export=view&id=${FILE_A}`,
        `https://drive.google.com/uc?export=view&id=${FILE_B}`,
      ],
      [priorS3],
      VENDOR,
    );
    expect(plan.needsIngest).toBe(true);
    expect(plan.persistImages).toEqual([priorS3]);
    expect(plan.driveFileIds).toEqual([FILE_A, FILE_B]);
  });

  it('groups enqueue jobs once per folder across products', () => {
    const jobs = groupDriveIngestEnqueueJobs(VENDOR, [
      { productId: 'p1', fileIds: [FILE_A, FILE_B], folderId: 'folder1' },
      { productId: 'p1', fileIds: [FILE_A, FILE_B], folderId: 'folder1' },
      { productId: 'p2', fileIds: [FILE_A], folderId: 'folder2' },
    ]);
    expect(jobs).toHaveLength(2);
    const f1 = jobs.find((j) => j.folderId === 'folder1');
    expect(f1?.productIds).toEqual(['p1']);
    expect(jobs.find((j) => j.folderId === 'folder2')?.productIds).toEqual(['p2']);
  });

  it('HTTP rows enqueue nothing', () => {
    expect(groupDriveIngestEnqueueJobs(VENDOR, [{ productId: 'p1', fileIds: [] }])).toEqual([]);
  });

  it('strips Drive URLs from display lists and keeps HTTP plus S3', () => {
    expect(
      filterDisplayableProductImages([
        'https://cdn.example.com/a.jpg',
        `https://drive.google.com/uc?export=view&id=${FILE_A}`,
        `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${VENDOR}/x.webp`,
      ]),
    ).toEqual([
      'https://cdn.example.com/a.jpg',
      `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${VENDOR}/x.webp`,
    ]);
  });
});
