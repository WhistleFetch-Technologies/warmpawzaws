import { orderItemImageNeedsSigning } from '../sign-order-item-images';

describe('orderItemImageNeedsSigning', () => {
  it('signs S3 keys and private bucket URLs', () => {
    expect(orderItemImageNeedsSigning('products/vendor/kurta.webp')).toBe(true);
    expect(
      orderItemImageNeedsSigning(
        'https://warmpawz-prod-user-uploads-057442119249.s3.ap-south-1.amazonaws.com/products/v/bed.webp',
      ),
    ).toBe(true);
  });

  it('leaves public shop URLs and empty values alone', () => {
    expect(orderItemImageNeedsSigning('https://glenandspetstore.com/img/food.jpg')).toBe(false);
    expect(orderItemImageNeedsSigning('')).toBe(false);
    expect(orderItemImageNeedsSigning(null)).toBe(false);
  });
});
