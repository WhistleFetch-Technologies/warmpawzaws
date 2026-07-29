/** @jest-environment jsdom */

import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { DiscoveryProviderAvatar } from '../DiscoveryProviderAvatar';

describe('DiscoveryProviderAvatar', () => {
  it('uses img alt text when photo is provided', () => {
    render(
      createElement(DiscoveryProviderAvatar, {
        name: 'Happy Paws',
        photo: 'https://example.com/photo.jpg',
      }),
    );

    expect(screen.getByRole('img', { name: 'Happy Paws' }).tagName).toBe('IMG');
  });

  it('exposes an accessible label on the initial-letter fallback', () => {
    render(createElement(DiscoveryProviderAvatar, { name: 'Happy Paws' }));

    expect(screen.queryByRole('img', { name: 'Happy Paws' })).toBeNull();
    expect(screen.getByRole('img', { name: 'Avatar for Happy Paws' })).toBeTruthy();
    expect(screen.getByText('H')).toBeTruthy();
  });
});
