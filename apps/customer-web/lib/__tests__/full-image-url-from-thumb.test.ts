import { fullImageUrlFromThumbSrc, isDerivedThumbImageSrc } from '../full-image-url-from-thumb';

describe('fullImageUrlFromThumbSrc', () => {
  it('maps derived thumb webp to the sibling full object', () => {
    expect(
      fullImageUrlFromThumbSrc(
        'https://bucket.s3.amazonaws.com/media/vendor/v1/profile_abc.thumb.webp?X-Amz-Signature=x',
      ),
    ).toBe(
      'https://bucket.s3.amazonaws.com/media/vendor/v1/profile_abc.webp?X-Amz-Signature=x',
    );
  });

  it('returns null when src is not a derived thumb', () => {
    expect(fullImageUrlFromThumbSrc('https://bucket.s3.amazonaws.com/media/vendor/v1/profile_abc.webp')).toBeNull();
    expect(isDerivedThumbImageSrc('https://bucket.s3.amazonaws.com/x.webp')).toBe(false);
    expect(isDerivedThumbImageSrc('https://bucket.s3.amazonaws.com/x.thumb.webp')).toBe(true);
  });
});
