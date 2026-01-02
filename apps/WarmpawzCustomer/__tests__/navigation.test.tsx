/**
 * Navigation Tests
 * Tests for navigation structure and registration
 */

describe('Navigation', () => {
  it('BottomTabNavigator should be defined', () => {
    const { BottomTabNavigator } = require('../src/navigation/BottomTabNavigator');
    expect(BottomTabNavigator).toBeDefined();
  });

  it('should export navigation components', () => {
    const navigation = require('../src/navigation/BottomTabNavigator');
    expect(navigation).toHaveProperty('BottomTabNavigator');
  });
});

