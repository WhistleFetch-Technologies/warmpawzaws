import React from 'react';
import { render } from '@testing-library/react';
import { VendorHeroPhotoCarousel } from '../VendorHeroPhotoCarousel';

const FRAME = 'relative aspect-[5/4] w-full max-h-[420px] overflow-hidden';

describe('VendorHeroPhotoCarousel', () => {
  it('reserves the frame when photos are empty', () => {
    const { getByTestId, container } = render(
      React.createElement(VendorHeroPhotoCarousel, {
        photos: [],
        name: 'Healing Tails',
        frameClassName: FRAME,
      }),
    );
    const empty = getByTestId('vendor-hero-empty');
    expect(empty.className).toContain('aspect-[5/4]');
    expect(container.firstChild).not.toBeNull();
  });

  it('reserves the frame when every photo is junk', () => {
    const { getByTestId } = render(
      React.createElement(VendorHeroPhotoCarousel, {
        photos: ['', '   '],
        name: 'Healing Tails',
        frameClassName: FRAME,
      }),
    );
    expect(getByTestId('vendor-hero-empty').className).toContain('relative');
  });
});
