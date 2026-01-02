/**
 * Component Tests
 * Tests for key UI components
 */

describe('Components', () => {
  it('should export all required components', () => {
    // Verify component exports
    expect(require('../src/navigation/BottomTabNavigator')).toHaveProperty('BottomTabNavigator');
    expect(require('../src/screens/home/CustomerHomeScreen')).toHaveProperty('CustomerHomeScreen');
    expect(require('../src/screens/auth/CustomerAuthScreen')).toHaveProperty('CustomerAuthScreen');
  });
});

