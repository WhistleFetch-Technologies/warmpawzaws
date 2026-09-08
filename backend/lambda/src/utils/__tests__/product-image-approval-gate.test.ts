import {
  IMAGE_APPROVAL_HOLD,
  applyImageApprovalHold,
  isProductImageReady,
  nextImageIngestRetryAt,
  shouldRetryImageIngest,
} from '../product-image-approval-gate';

const VENDOR = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const S3 = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/products/${VENDOR}/live.webp`;
const LH3 = 'https://lh3.googleusercontent.com/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

describe('product-image-approval-gate', () => {
  it('is not ready while ingest is processing or failed', () => {
    expect(isProductImageReady([S3], { image_ingest: { status: 'processing' } }, VENDOR)).toBe(
      false,
    );
    expect(isProductImageReady([S3], { image_ingest: { status: 'failed' } }, VENDOR)).toBe(false);
  });

  it('is ready when a managed S3 key is stored and ingest is ready', () => {
    expect(isProductImageReady([S3], { image_ingest: { status: 'ready' } }, VENDOR)).toBe(true);
  });

  it('is ready for ordinary HTTP images with no Drive ingest', () => {
    expect(isProductImageReady(['https://cdn.example.com/a.jpg'], {}, VENDOR)).toBe(true);
  });

  it('holds Drive previews out of admin until S3 is verified', () => {
    const held = applyImageApprovalHold({}, [LH3], VENDOR);
    expect(held.approval_hold).toBe(IMAGE_APPROVAL_HOLD);
    expect((held.image_ingest as { status?: string }).status).toBe('failed');
    expect(isProductImageReady([LH3], held, VENDOR)).toBe(false);
  });

  it('clears the hold when images are verified', () => {
    const cleared = applyImageApprovalHold(
      { approval_hold: IMAGE_APPROVAL_HOLD, image_ingest: { status: 'ready' } },
      [S3],
      VENDOR,
    );
    expect(cleared.approval_hold).toBeUndefined();
    expect(isProductImageReady([S3], cleared, VENDOR)).toBe(true);
  });

  it('retries failed ingest until the attempt cap and next_retry_at', () => {
    expect(
      shouldRetryImageIngest({
        approval_hold: IMAGE_APPROVAL_HOLD,
        image_ingest: { status: 'failed', attempt: 1 },
      }),
    ).toBe(true);
    expect(
      shouldRetryImageIngest({
        approval_hold: IMAGE_APPROVAL_HOLD,
        image_ingest: { status: 'failed', attempt: 5 },
      }),
    ).toBe(false);
    const later = nextImageIngestRetryAt(1, Date.now() + 60_000);
    expect(
      shouldRetryImageIngest(
        {
          approval_hold: IMAGE_APPROVAL_HOLD,
          image_ingest: { status: 'failed', attempt: 1, next_retry_at: later },
        },
        Date.now(),
      ),
    ).toBe(false);
  });
});
