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
import { BrandColors } from './src/theme';
import NotificationService from './src/services/NotificationService';

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
import ProblemGridScreen from './src/screens/ProblemGridScreen';
import VendorDiscoveryScreen from './src/screens/VendorDiscoveryScreen';
import ServiceSelectionScreen from './src/screens/ServiceSelectionScreen';
import TimeSlotSelectionScreen from './src/screens/TimeSlotSelectionScreen';
import PetSelectionScreen from './src/screens/PetSelectionScreen';
import AddressSelectionScreen from './src/screens/AddressSelectionScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import StaffTrackingScreen from './src/screens/StaffTrackingScreen';
import CancellationScreen from './src/screens/booking/CancellationScreen';
import RescheduleScreen from './src/screens/booking/RescheduleScreen';
import MedicalHistoryScreen from './src/screens/MedicalHistory';
import MedicineCatalogScreen from './src/screens/medicine/MedicineCatalogScreen';
import MedicineDetailScreen from './src/screens/medicine/MedicineDetailScreen';
import MedicineOrderScreen from './src/screens/medicine/MedicineOrderScreen';
import MealPlanBrowseScreen from './src/screens/nutritionist/MealPlanBrowseScreen';
import MealPlanDetailScreen from './src/screens/nutritionist/MealPlanDetailScreen';
import MealOrderScreen from './src/screens/nutritionist/MealOrderScreen';
import MealDeliveryTrackingScreen from './src/screens/nutritionist/MealDeliveryTrackingScreen';
import MedicineSearchScreen from './src/screens/medicine/MedicineSearchScreen';
import PrescriptionMedicineMatchScreen from './src/screens/medicine/PrescriptionMedicineMatchScreen';
import PuppyProfileBrowseScreen from './src/screens/puppy/PuppyProfileBrowseScreen';
import MealOrderScreen from './src/screens/nutritionist/MealOrderScreen';
import MealDeliveryTrackingScreen from './src/screens/nutritionist/MealDeliveryTrackingScreen';
import MedicineSearchScreen from './src/screens/medicine/MedicineSearchScreen';
import PrescriptionMedicineMatchScreen from './src/screens/medicine/PrescriptionMedicineMatchScreen';
import PuppyProfileBrowseScreen from './src/screens/puppy/PuppyProfileBrowseScreen';

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
  const navigationRef = React.useRef<any>(null);

  // Calculate initial route name ONCE - must be constant
  // Always start with Login - we'll navigate after auth state is determined
  const initialRouteName = 'Login';

  // Initialize notifications and register device token
  React.useEffect(() => {
    const initNotifications = async () => {
      await NotificationService.initialize();
      
      // Register device token after user is authenticated
      if (isAuthenticated && user?.id) {
        try {
          await NotificationService.registerDeviceToken(user.id, 'customer');
          console.log('✅ Device token registered for user:', user.id);
        } catch (error) {
          console.error('❌ Failed to register device token:', error);
        }
      }
    };
    
    initNotifications();
    
    // Register notification handlers
    NotificationService.onNotification('booking', (data) => {
      if (data.bookingId && navigationRef.current?.isReady()) {
        if (data.action === 'track_service') {
          navigationRef.current.navigate('StaffTracking', {
            bookingId: data.bookingId,
            staffId: data.data?.staffId || '',
            destination: data.data?.destination,
            staffName: data.data?.staffName || 'Service Provider',
          });
        } else {
          navigationRef.current.navigate('Bookings');
        }
      }
    });

    NotificationService.onNotification('payment', (data) => {
      if (data.bookingId && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('Bookings');
      }
    });

    NotificationService.onNotification('gps', (data) => {
      if (data.bookingId && navigationRef.current?.isReady()) {
        navigationRef.current.navigate('StaffTracking', {
          bookingId: data.bookingId,
          staffId: data.data?.staffId || '',
          destination: data.data?.destination,
          staffName: data.data?.staffName || 'Service Provider',
        });
      }
    });

    return () => {
      NotificationService.offNotification('booking');
      NotificationService.offNotification('payment');
      NotificationService.offNotification('gps');
    };
    // ✅ FIX: Add dependencies so handlers update when auth state changes
    // Note: navigationRef is stable (useRef), but included for completeness
  }, [isAuthenticated, user?.id]);

  // Handle navigation based on auth state after mount
  React.useEffect(() => {
    if (isLoading) {
      return; // Wait for auth state to be determined
    }

    if (!navigationRef.current?.isReady()) {
      return; // Wait for navigation to be ready
    }

    if (!isAuthenticated) {
      // User not authenticated - ensure we're on Login screen
      const currentRoute = navigationRef.current.getCurrentRoute();
      if (currentRoute?.name !== 'Login') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
      return;
    }

    // User is authenticated - check onboarding status
    if (user) {
      const hasCompletedOnboarding = user.onboardingComplete || user.hasCompletedOnboarding;
      
      if (!hasCompletedOnboarding) {
        setNeedsOnboarding(true);
        // Navigate to onboarding
        const currentRoute = navigationRef.current.getCurrentRoute();
        if (currentRoute?.name !== 'Onboarding') {
          navigationRef.current.reset({
            index: 0,
            routes: [{ name: 'Onboarding' }],
          });
        }
      } else {
        setNeedsOnboarding(false);
        // Navigate to main app
        const currentRoute = navigationRef.current.getCurrentRoute();
        if (currentRoute?.name !== 'MainTabs') {
          navigationRef.current.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
        }
      }
    }
  }, [isAuthenticated, isLoading, user]);

  if (isLoading) {
    return null; // Loading handled by AuthProvider
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Stack.Navigator
        initialRouteName={initialRouteName}
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
              journeyStage={props.route.params?.journeyStage || onboardingStage || undefined}
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
        <Stack.Screen 
          name="BookingDetail" 
          component={BookingDetailScreen}
          options={{ 
            title: 'Booking Details',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="ProblemGrid" 
          options={{ 
            title: 'Select Problem',
            headerStyle: { backgroundColor: BrandColors.primary.orange },
            headerTintColor: '#fff',
          }}
        >
          {(props) => <ProblemGridScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="VendorDiscovery" 
          options={{ 
            title: 'Service Providers',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <VendorDiscoveryScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="ServiceSelection" 
          options={{ 
            title: 'Select Service',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <ServiceSelectionScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="TimeSlotSelection" 
          options={{ 
            title: 'Select Time',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <TimeSlotSelectionScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="PetSelection" 
          options={{ 
            title: 'Select Pet',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <PetSelectionScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="AddressSelection" 
          options={{ 
            title: 'Select Address',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <AddressSelectionScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="Payment" 
          options={{ 
            title: 'Payment',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <PaymentScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="StaffTracking" 
          options={{ 
            title: 'Track Service Provider',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        >
          {(props) => <StaffTrackingScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen 
          name="Cancellation" 
          component={CancellationScreen}
          options={{ 
            title: 'Cancel Booking',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="Reschedule" 
          component={RescheduleScreen}
          options={{ 
            title: 'Reschedule Booking',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="CafeBooking" 
          component={CafeBookingScreen}
          options={{ 
            title: 'Cafe Reservation',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="ResortBooking" 
          component={ResortBookingScreen}
          options={{ 
            title: 'Resort Booking',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="InsurancePlans" 
          component={InsurancePlansScreen}
          options={{ 
            title: 'Insurance Plans',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="HolidayPackages" 
          component={HolidayPackagesScreen}
          options={{ 
            title: 'Holiday Packages',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="HolidayPackageDetail" 
          component={HolidayPackageDetailScreen}
          options={{ 
            title: 'Package Details',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="HolidayBooking" 
          component={HolidayBookingScreen}
          options={{ 
            title: 'Book Package',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MedicalHistory" 
          component={MedicalHistoryScreen}
          options={{ 
            title: 'Medical History',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MedicineCatalog" 
          component={MedicineCatalogScreen}
          options={{ 
            title: 'Medicine Catalog',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MedicineDetail" 
          component={MedicineDetailScreen}
          options={{ 
            title: 'Medicine Details',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MedicineOrder" 
          component={MedicineOrderScreen}
          options={{ 
            title: 'Place Order',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MealPlanBrowse" 
          component={MealPlanBrowseScreen}
          options={{ 
            title: 'Meal Plans',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MealPlanDetail" 
          component={MealPlanDetailScreen}
          options={{ 
            title: 'Meal Plan Details',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MealOrder" 
          component={MealOrderScreen}
          options={{ 
            title: 'Place Meal Order',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MealDeliveryTracking" 
          component={MealDeliveryTrackingScreen}
          options={{ 
            title: 'Track Delivery',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="MedicineSearch" 
          component={MedicineSearchScreen}
          options={{ 
            title: 'Search Medicines',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="PrescriptionMedicineMatch" 
          component={PrescriptionMedicineMatchScreen}
          options={{ 
            title: 'Matched Medicines',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="PuppyProfileBrowse" 
          component={PuppyProfileBrowseScreen}
          options={{ 
            title: 'Puppy Profiles',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="InsurancePurchase" 
          component={InsurancePurchaseScreen}
          options={{ 
            title: 'Purchase Insurance',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="InsuranceClaims" 
          component={InsuranceClaimsScreen}
          options={{ 
            title: 'Insurance Claims',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="NutritionistMenu" 
          component={NutritionistMenuScreen}
          options={{ 
            title: 'Menu',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="NutritionistOrder" 
          component={NutritionistOrderScreen}
          options={{ 
            title: 'Place Order',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="TrainingProgress" 
          component={TrainingProgressScreen}
          options={{ 
            title: 'Training Progress',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="TrainingSessionDetail" 
          component={TrainingSessionDetailScreen}
          options={{ 
            title: 'Session Details',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="BehaviorAssessment" 
          component={BehaviorAssessmentScreen}
          options={{ 
            title: 'Behavior Assessment',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="ProgressTracking" 
          component={ProgressTrackingScreen}
          options={{ 
            title: 'Track Progress',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="ProgressView" 
          component={ProgressViewScreen}
          options={{ 
            title: 'View Progress',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
        />
        <Stack.Screen 
          name="ProgressChart" 
          component={ProgressChartScreen}
          options={{ 
            title: 'Progress Chart',
            headerStyle: { backgroundColor: '#FFFFFF' },
            headerTintColor: BrandColors.primary.orange,
          }}
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

