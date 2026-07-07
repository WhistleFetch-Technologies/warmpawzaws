/** @jest-environment jsdom */

import { act, render, screen } from '@testing-library/react';
import { createElement, Fragment } from 'react';
import { ViewportSection } from '../ViewportSection';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  emit(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: document.body,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
      ],
      this as unknown as IntersectionObserver
    );
  }
}

function flushLayoutReady() {
  act(() => {
    jest.runAllTimers();
  });
  act(() => {
    jest.runAllTimers();
  });
}

function renderDeferredSection() {
  return render(
    createElement(
      Fragment,
      null,
      createElement('div', { style: { height: '4000px' } }),
      createElement(
        ViewportSection,
        { placeholderMinHeight: 300 },
        createElement('div', { 'data-testid': 'deferred-section' }, 'Deferred content')
      )
    )
  );
}

describe('ViewportSection', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    MockIntersectionObserver.instances = [];
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not mount children before scroll and does not register IntersectionObserver yet', () => {
    renderDeferredSection();

    flushLayoutReady();

    expect(screen.queryByTestId('deferred-section')).toBeNull();
    expect(MockIntersectionObserver.instances).toHaveLength(0);
    expect(document.querySelector('div[style*="min-height: 300px"]')).toBeTruthy();
  });

  it('mounts once after scroll approaches the placeholder and never unmounts', () => {
    const rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function mockRect(this: HTMLElement) {
        const isPlaceholder = this.style.minHeight === '300px';
        return {
          top: isPlaceholder ? 700 : 0,
          bottom: isPlaceholder ? 1000 : 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    renderDeferredSection();

    flushLayoutReady();
    expect(screen.queryByTestId('deferred-section')).toBeNull();

    act(() => {
      window.scrollY = 120;
      window.dispatchEvent(new Event('scroll'));
    });

    expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0);
    expect(screen.getByTestId('deferred-section')).toBeTruthy();

    act(() => {
      MockIntersectionObserver.instances[0]?.emit(false);
    });

    expect(screen.getByTestId('deferred-section')).toBeTruthy();
    rectSpy.mockRestore();
  });
});
