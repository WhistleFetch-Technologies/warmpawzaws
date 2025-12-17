/**
 * Warmpawz Customer Mobile App
 * React Native Application for Android and iOS
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ServiceDetailScreen from './src/screens/ServiceDetailScreen';
import BookingConfirmationScreen from './src/screens/BookingConfirmationScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import UserProfileScreen from './src/screens/onboarding/UserProfileScreen';
import PetProfileScreen from './src/screens/onboarding/PetProfileScreen';

// Navigation
import ProtectedRoute from './src/navigation/ProtectedRoute';

// Types
import { RootStackParamList, TabParamList } from './src/types/navigation';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// Tab Navigator
function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Search') {
            iconName = 'search';
          } else if (route.name === 'Bookings') {
            iconName = 'calendar-today';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          } else {
            iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF8C42',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Main App Component
function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [session, setSession] = React.useState<any>(null);
  const [onboardingStage, setOnboardingStage] = React.useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = React.useState(false);

  React.useEffect(() => {
    // Check if user needs onboarding (new user or incomplete profile)
    if (isAuthenticated && user) {
      // For now, always show onboarding for new users
      // In production, check user.onboardingComplete from API
      setNeedsOnboarding(true);
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return null; // Loading handled by AuthProvider
  }

  // Determine initial route
  const getInitialRouteName = () => {
    if (!isAuthenticated) return 'Login';
    if (needsOnboarding && !onboardingStage) return 'Onboarding';
    if (needsOnboarding && onboardingStage) return 'UserProfile';
    return 'MainTabs';
  };

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Stack.Navigator
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FF8C42',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Login" 
          options={{ headerShown: false }}
        >
          {(props) => (
            <LoginScreen
              {...props}
              onAuthSuccess={(sessionData) => {
                setSession(sessionData);
                setNeedsOnboarding(true);
                props.navigation.replace('Onboarding');
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="Onboarding" 
          options={{ headerShown: false }}
        >
          {(props) => (
            <OnboardingScreen
              {...props}
              onComplete={(stage) => {
                setOnboardingStage(stage);
                props.navigation.navigate('UserProfile', { journeyStage: stage });
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="UserProfile" 
          options={{ headerShown: false }}
        >
          {(props) => (
            <UserProfileScreen
              {...props}
              session={session}
              journeyStage={props.route.params?.journeyStage || onboardingStage}
              onComplete={(profile) => {
                props.navigation.navigate('PetProfile', { prefillData: null });
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="PetProfile" 
          options={{ headerShown: false }}
        >
          {(props) => (
            <PetProfileScreen
              {...props}
              session={session}
              prefillData={props.route.params?.prefillData}
              onComplete={(pets) => {
                setNeedsOnboarding(false);
                props.navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs' }],
                });
              }}
            />
          )}
        </Stack.Screen>

        <Stack.Screen 
          name="MainTabs" 
          component={TabNavigator} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="ServiceDetail" 
          component={ServiceDetailScreen}
          options={{ title: 'Service Details' }}
        />
        <Stack.Screen 
          name="BookingConfirmation" 
          component={BookingConfirmationScreen}
          options={{ title: 'Booking Confirmation' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Main App Component with Auth Provider
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

