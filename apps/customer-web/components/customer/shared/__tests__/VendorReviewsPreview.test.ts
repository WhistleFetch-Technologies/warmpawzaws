/** @jest-environment jsdom */

import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { VendorReviewsPreview } from '../VendorReviewsPreview';

const reviews = [
  { id: 'r1', customerName: 'Asha', rating: 5, comment: 'Wonderful vet', date: '2026-10-05T10:00:00Z' },
  { id: 'r2', customerName: 'Ravi', rating: 4, comment: 'Quick Pay Bill', date: '2026-10-03T10:00:00Z' },
  { id: 'r3', customerName: 'Meera', rating: 3, comment: 'Okay', date: '2026-10-01T10:00:00Z' },
];

describe('VendorReviewsPreview', () => {
  it('renders nothing when there are no reviews', () => {
    const { container } = render(
      createElement(VendorReviewsPreview, { reviews: [], onSeeAll: jest.fn() })
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows the latest 2 reviews with the average and opens the Reviews tab', () => {
    const onSeeAll = jest.fn();
    render(
      createElement(VendorReviewsPreview, { reviews, averageRating: 4, totalReviews: 3, onSeeAll })
    );
    expect(screen.getByText('Recent reviews')).toBeTruthy();
    expect(screen.getByText('Wonderful vet')).toBeTruthy();
    expect(screen.getByText('Quick Pay Bill')).toBeTruthy();
    expect(screen.queryByText('Okay')).toBeNull();
    expect(screen.getByText('4.0')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /see all reviews/i }));
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });
});
