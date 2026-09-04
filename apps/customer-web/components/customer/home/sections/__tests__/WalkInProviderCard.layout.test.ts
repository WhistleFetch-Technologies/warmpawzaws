import { WALK_IN_CARD_IMAGE_CLASS } from '../WalkInProviderCard';
import { fillImageStyle } from '@/components/shared/CachedImage';

describe('WalkInProviderCard image layout', () => {
  it('uses cover + center so view-all and carousel fill the photo band', () => {
    expect(WALK_IN_CARD_IMAGE_CLASS).toBe('object-cover object-center');
  });
});

describe('fillImageStyle', () => {
  it('applies absolute fill when fill is true', () => {
    expect(fillImageStyle(true)).toEqual({
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
    });
  });

  it('leaves style unchanged when fill is false', () => {
    expect(fillImageStyle(false, { opacity: 0.5 })).toEqual({ opacity: 0.5 });
  });
});
