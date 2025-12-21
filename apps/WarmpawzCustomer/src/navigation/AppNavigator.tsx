/**
 * App Navigator
 * Centralized navigation structure
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Auth & Onboarding
import { CustomerAuthScreen } from '../screens/auth/CustomerAuthScreen';
import { CustomerOnboardingScreen } from '../screens/onboarding/CustomerOnboardingScreen';
import { CustomerPlanningJourneyScreen } from '../screens/onboarding/CustomerPlanningJourneyScreen';
import { CustomerHavePetJourneyScreen } from '../screens/onboarding/CustomerHavePetJourneyScreen';
import { CustomerUserProfileScreen } from '../screens/onboarding/CustomerUserProfileScreen';
import { CustomerPetProfileScreen } from '../screens/pets/CustomerPetProfileScreen';

// Home & Services
import { CustomerHomeScreen } from '../screens/home/CustomerHomeScreen';
import { ServiceDiscoveryScreen } from '../screens/services/ServiceDiscoveryScreen';

// Bookings
// import { BookingListScreen } from '../screens/bookings/BookingListScreen';
// import { BookingCreationScreen } from '../screens/bookings/BookingCreationScreen';
// import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';

// Profile
// import { CustomerProfileScreen } from '../screens/profile/CustomerProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export function AppNavigator({ session, onboardingStage, showUserProfile }: any) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <Stack.Screen name="Auth">
          {(props) => <CustomerAuthScreen {...props} />}
        </Stack.Screen>
      ) : onboardingStage === 'planning' ? (
        <Stack.Screen name="PlanningJourney">
          {(props) => <CustomerPlanningJourneyScreen {...props} phone={session.phone} />}
        </Stack.Screen>
      ) : onboardingStage === 'have-pet' ? (
        <Stack.Screen name="HavePetJourney">
          {(props) => <CustomerHavePetJourneyScreen {...props} phone={session.phone} />}
        </Stack.Screen>
      ) : showUserProfile ? (
        <Stack.Screen name="UserProfile">
          {(props) => <CustomerUserProfileScreen {...props} phone={session.phone} />}
        </Stack.Screen>
      ) : session.hasCompletedOnboarding ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabsNavigator} />
          <Stack.Screen name="ServiceDiscovery" component={ServiceDiscoveryScreen} />
          <Stack.Screen name="PetProfile" component={CustomerPetProfileScreen} />
        </>
      ) : (
        <Stack.Screen name="Onboarding">
          {(props) => <CustomerOnboardingScreen {...props} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF8C42',
        tabBarInactiveTintColor: '#9ca3af',
      }}
    >
      <Tab.Screen name="Home" component={CustomerHomeScreen} />
      {/* <Tab.Screen name="Bookings" component={BookingListScreen} /> */}
      {/* <Tab.Screen name="Profile" component={CustomerProfileScreen} /> */}
    </Tab.Navigator>
  );
}

