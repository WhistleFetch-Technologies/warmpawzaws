/**
 * Bottom Tab Navigator
 * 5-tab navigation matching design reference
 * Updated with react-native-vector-icons for 100% design compliance
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, typography } from '../theme/colors';
import { CustomerHomeScreen } from '../screens/home/CustomerHomeScreen';
import { ServiceDiscoveryScreen } from '../screens/services/ServiceDiscoveryScreen';
import { ShopDashboardScreen } from '../screens/services/ShopDashboardScreen';
import { CommunityScreen } from '../screens/community/CommunityScreen';
import { CustomerProfileScreen } from '../screens/profile/CustomerProfileScreen';

const Tab = createBottomTabNavigator();

interface BottomTabNavigatorProps {
  phone: string;
  customerId?: string;
  onNavigate?: (screen: string, data?: any) => void;
  onProfileClick?: () => void;
  onPetClick?: (petId: string) => void;
  onAddPet?: () => void;
}

export function BottomTabNavigator({
  phone,
  customerId,
  onNavigate,
  onProfileClick,
  onPetClick,
  onAddPet,
}: BottomTabNavigatorProps) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: typography.fontSizes.xs,
          fontWeight: typography.fontWeights.medium,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Icon 
              name={focused ? 'paw' : 'paw-outline'} 
              size={24} 
              color={color} 
            />
          ),
          tabBarLabel: 'Home',
        }}
      >
        {(props) => (
          <CustomerHomeScreen
            {...props}
            phone={phone}
            onNavigate={onNavigate || (() => {})}
            onProfileClick={onProfileClick}
            onPetClick={onPetClick}
            onAddPet={onAddPet}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Services"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Icon 
              name={focused ? 'hand-heart' : 'hand-heart-outline'} 
              size={24} 
              color={color} 
            />
          ),
          tabBarLabel: 'Services',
        }}
      >
        {(props) => (
          <ServiceDiscoveryScreen
            {...props}
            phone={phone}
            onSelectVendor={(vendorId) => {
              onNavigate?.('ServiceDetail', { vendorId });
            }}
            onBack={() => {}}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Store"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Icon 
              name={focused ? 'shopping' : 'shopping-outline'} 
              size={24} 
              color={color} 
            />
          ),
          tabBarLabel: 'Store',
        }}
      >
        {(props) => (
          <ShopDashboardScreen
            {...props}
            phone={phone}
            onBack={() => {}}
            onNavigate={onNavigate || (() => {})}
            onViewBooking={() => {}}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Community"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Icon 
              name={focused ? 'forum' : 'forum-outline'} 
              size={24} 
              color={color} 
            />
          ),
          tabBarLabel: 'Community',
        }}
      >
        {(props) => (
          <CommunityScreen
            {...props}
            phone={phone}
            customerId={customerId}
            onNavigate={onNavigate || (() => {})}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Icon 
              name={focused ? 'account' : 'account-outline'} 
              size={24} 
              color={color} 
            />
          ),
          tabBarLabel: 'Profile',
        }}
      >
        {(props) => (
          <CustomerProfileScreen
            {...props}
            phone={phone}
            onBack={() => {}}
            onNavigate={onNavigate || (() => {})}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
