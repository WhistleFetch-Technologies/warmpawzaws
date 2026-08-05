import {
  popShellEntry,
  pushShellEntry,
  resetShellStack,
  shellCanPop,
  shellCurrentScreen,
} from '../shell-stack';

describe('shell-stack', () => {
  type Screen =
    | 'home'
    | 'vet'
    | 'vet-all-doctors'
    | 'vet-doctor-details'
    | 'vet-clinic-list'
    | 'vet-clinic-profile';

  it('pushes forward when screen is new', () => {
    const h = pushShellEntry([{ screen: 'home' }], 'vet');
    expect(shellCurrentScreen(h)).toBe('vet');
    expect(h).toHaveLength(2);
  });

  it('no-ops duplicate top screen with same key', () => {
    const h = pushShellEntry(
      [{ screen: 'home' }, { screen: 'vet-clinic-profile', key: 'clinic:a' }],
      'vet-clinic-profile',
      { key: 'clinic:a' },
    );
    expect(h).toHaveLength(2);
  });

  it('pushes same screen type with different entity key', () => {
    const h = pushShellEntry(
      [{ screen: 'home' }, { screen: 'vet' }, { screen: 'vet-clinic-profile', key: 'clinic:a' }],
      'vet-clinic-profile',
      { mode: 'push', key: 'clinic:b' },
    );
    expect(h).toHaveLength(4);
    expect(h[3].key).toBe('clinic:b');
  });

  it('no-ops duplicate top screen without key', () => {
    const h = pushShellEntry([{ screen: 'home' }, { screen: 'vet' }], 'vet');
    expect(h).toHaveLength(2);
  });

  it('popToIfExists when navigating to earlier screen', () => {
    const start = [
      { screen: 'home' as Screen },
      { screen: 'vet' as Screen },
      { screen: 'vet-clinic-list' as Screen },
    ];
    const h = pushShellEntry(start, 'vet');
    expect(shellCurrentScreen(h)).toBe('vet');
    expect(h).toHaveLength(2);
  });

  it('push mode always appends even if screen exists in history', () => {
    const start = [
      { screen: 'home' as Screen },
      { screen: 'vet' as Screen },
      { screen: 'vet-clinic-list' as Screen },
    ];
    const h = pushShellEntry(start, 'vet', { mode: 'push' });
    expect(h).toHaveLength(4);
    expect(shellCurrentScreen(h)).toBe('vet');
  });

  it('reset mode clears history', () => {
    const h = pushShellEntry(
      [{ screen: 'home' }, { screen: 'vet' }],
      'home',
      { mode: 'reset' },
    );
    expect(h).toEqual([{ screen: 'home' }]);
  });

  it('focuses existing entry by key', () => {
    const start = [
      { screen: 'home' as Screen },
      { screen: 'vet-clinic-profile' as Screen, key: 'vendor:44' },
      { screen: 'vet-clinic-list' as Screen },
    ];
    const h = pushShellEntry(start, 'vet-clinic-profile', { key: 'vendor:44' });
    expect(h).toHaveLength(2);
    expect(shellCurrentScreen(h)).toBe('vet-clinic-profile');
  });

  it('popShellEntry removes top', () => {
    const h = popShellEntry([{ screen: 'home' }, { screen: 'vet' }]);
    expect(shellCurrentScreen(h)).toBe('home');
  });

  it('popShellEntry at root is no-op', () => {
    const h = popShellEntry([{ screen: 'home' }]);
    expect(h).toHaveLength(1);
  });

  it('resetShellStack returns single entry', () => {
    expect(resetShellStack('home')).toEqual([{ screen: 'home' }]);
  });

  it('shellCanPop', () => {
    expect(shellCanPop([{ screen: 'home' }])).toBe(false);
    expect(shellCanPop([{ screen: 'home' }, { screen: 'vet' }])).toBe(true);
  });

  describe('vet Featured Vets View All', () => {
    it('pushes vet-all-doctors from vet hub on first visit', () => {
      const h = pushShellEntry(
        [{ screen: 'home' as Screen }, { screen: 'vet' as Screen }],
        'vet-all-doctors',
      );
      expect(shellCurrentScreen(h)).toBe('vet-all-doctors');
      expect(h.map((e) => e.screen)).toEqual(['home', 'vet', 'vet-all-doctors']);
    });

    it('back from vet-all-doctors pops to vet', () => {
      const start = [
        { screen: 'home' as Screen },
        { screen: 'vet' as Screen },
        { screen: 'vet-all-doctors' as Screen },
      ];
      const h = popShellEntry(start);
      expect(shellCurrentScreen(h)).toBe('vet');
    });

    it('doctor drill-down from vet-all-doctors pushes with route key', () => {
      const start = [
        { screen: 'home' as Screen },
        { screen: 'vet' as Screen },
        { screen: 'vet-all-doctors' as Screen },
      ];
      const h = pushShellEntry(start, 'vet-doctor-details', {
        mode: 'push',
        key: 'doctor:doc-1',
      });
      expect(shellCurrentScreen(h)).toBe('vet-doctor-details');
      expect(h).toHaveLength(4);
      expect(h[3].key).toBe('doctor:doc-1');
    });
  });

  describe('shop order tracking (embedded ecommerce)', () => {
    type ShopScreen = 'order_success' | 'order_tracking' | 'order_detail' | 'order_history';
    const orderKey = 'order:ord-42';

    it('success → track → back pops to success (no detail ping-pong)', () => {
      let h = pushShellEntry([{ screen: 'order_success' as ShopScreen }], 'order_tracking', {
        mode: 'push',
        key: orderKey,
      });
      expect(shellCurrentScreen(h)).toBe('order_tracking');
      h = popShellEntry(h);
      expect(shellCurrentScreen(h)).toBe('order_success');
      expect(h.map((e) => e.screen)).toEqual(['order_success']);
    });

    it('detail → track with key focuses existing tracking instead of stacking', () => {
      const start = [
        { screen: 'order_success' as ShopScreen },
        { screen: 'order_tracking' as ShopScreen, key: orderKey },
        { screen: 'order_detail' as ShopScreen },
      ];
      const h = pushShellEntry(start, 'order_tracking', { mode: 'push', key: orderKey });
      expect(shellCurrentScreen(h)).toBe('order_tracking');
      expect(h.map((e) => e.screen)).toEqual(['order_success', 'order_tracking']);
    });

    it('broken back-to-detail then track causes ping-pong (regression guard)', () => {
      let h = pushShellEntry([{ screen: 'order_success' as ShopScreen }], 'order_tracking', {
        mode: 'push',
        key: orderKey,
      });
      // Old bug: onBack called setCurrentScreen('order_detail') instead of pop
      h = pushShellEntry(h, 'order_detail');
      expect(shellCurrentScreen(h)).toBe('order_detail');
      h = pushShellEntry(h, 'order_tracking');
      expect(shellCurrentScreen(h)).toBe('order_tracking');
      h = pushShellEntry(h, 'order_detail');
      expect(shellCurrentScreen(h)).toBe('order_detail');
      // Stack grows / oscillates — fixed handlers use popShellEntry on back instead
      expect(h.length).toBeGreaterThan(2);
    });
  });
});
