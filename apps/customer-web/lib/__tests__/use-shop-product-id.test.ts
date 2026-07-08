/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useShopProductId } from '../use-shop-product-id';

const mockUseParams = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: () => mockUseSearchParams(),
}));

function mockSearchParams(values: Record<string, string | null>) {
  return {
    get: (key: string) => values[key] ?? null,
  };
}

describe('useShopProductId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers productId from query over placeholder route param', () => {
    mockUseParams.mockReturnValue({ productId: 'placeholder' });
    mockUseSearchParams.mockReturnValue(
      mockSearchParams({ productId: 'abc-123' }),
    );

    const { result } = renderHook(() => useShopProductId());
    expect(result.current).toBe('abc-123');
  });

  it('falls back to route param when query is empty', () => {
    mockUseParams.mockReturnValue({ productId: 'real-product-id' });
    mockUseSearchParams.mockReturnValue(mockSearchParams({}));

    const { result } = renderHook(() => useShopProductId());
    expect(result.current).toBe('real-product-id');
  });

  it('ignores placeholder route param without query', () => {
    mockUseParams.mockReturnValue({ productId: 'placeholder' });
    mockUseSearchParams.mockReturnValue(mockSearchParams({}));

    const { result } = renderHook(() => useShopProductId());
    expect(result.current).toBe('');
  });

  it('accepts product_id query alias', () => {
    mockUseParams.mockReturnValue({ productId: 'placeholder' });
    mockUseSearchParams.mockReturnValue(
      mockSearchParams({ product_id: 'alias-id' }),
    );

    const { result } = renderHook(() => useShopProductId());
    expect(result.current).toBe('alias-id');
  });
});
