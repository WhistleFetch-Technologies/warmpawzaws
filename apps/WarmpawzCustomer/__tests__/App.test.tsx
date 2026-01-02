/**
 * App Component Test
 * Basic smoke test for app initialization
 */

describe('App', () => {
  it('should be defined', () => {
    // Basic smoke test - verify app module exists
    expect(require('../App')).toBeDefined();
  });
});

