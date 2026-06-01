import { buildPublicS3ObjectUrl } from '../s3-presign-upload';

describe('s3-presign-upload', () => {
  it('builds virtual-hosted public object URLs', () => {
    expect(
      buildPublicS3ObjectUrl(
        'warmpawz-dev-user-uploads-057442119249',
        'ecommerce/categories/1780309330899_oj53p9r1e.webp',
        'ap-south-1'
      )
    ).toBe(
      'https://warmpawz-dev-user-uploads-057442119249.s3.ap-south-1.amazonaws.com/ecommerce/categories/1780309330899_oj53p9r1e.webp'
    );
  });
});
