import {
  BANNER_S3_PREFIX,
  bannerS3KeyForId,
  extractBannerS3Key,
  isManagedBannerS3Image,
} from '../banner-s3-image';

describe('banner-s3-image', () => {
  const bannerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('bannerS3KeyForId builds deterministic key', () => {
    expect(bannerS3KeyForId(bannerId)).toBe(`${BANNER_S3_PREFIX}${bannerId}.webp`);
  });

  it('extractBannerS3Key reads raw key', () => {
    const key = bannerS3KeyForId(bannerId);
    expect(extractBannerS3Key(key)).toBe(key);
  });

  it('extractBannerS3Key reads virtual-hosted S3 URL', () => {
    const key = bannerS3KeyForId(bannerId);
    const url = `https://warmpawz-dev-uploads.s3.ap-south-1.amazonaws.com/${key}`;
    expect(extractBannerS3Key(url)).toBe(key);
  });

  it('extractBannerS3Key returns null for external URLs', () => {
    expect(extractBannerS3Key('https://cdn.example.com/banner.jpg')).toBeNull();
    expect(extractBannerS3Key(null)).toBeNull();
    expect(extractBannerS3Key('')).toBeNull();
  });

  it('isManagedBannerS3Image detects managed keys and URLs only', () => {
    expect(isManagedBannerS3Image(bannerS3KeyForId(bannerId))).toBe(true);
    expect(isManagedBannerS3Image('https://cdn.example.com/x.jpg')).toBe(false);
    expect(isManagedBannerS3Image('uploads/other/file.jpg')).toBe(false);
  });
});
