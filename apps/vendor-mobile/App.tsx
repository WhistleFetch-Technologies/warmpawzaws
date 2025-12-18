/**
 * Warmpawz Vendor Mobile App
 * React Native Application for Android and iOS
 * Matches web app VendorLandingPage flow exactly
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import NotificationService from './src/services/NotificationService';

// Screens - Auth
import LoginScreen from './src/screens/auth/LoginScreen';

// Screens - Onboarding
import RoleSelectionScreen from './src/screens/onboarding/RoleSelectionScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import BusinessTypeSelectorScreen from './src/screens/onboarding/BusinessTypeSelectorScreen';
import SoloProviderOnboardingScreen from './src/screens/onboarding/SoloProviderOnboardingScreen';

// Screens - Status
import ApplicationSubmittedScreen from './src/screens/status/ApplicationSubmittedScreen';
import ApplicationPendingScreen from './src/screens/status/ApplicationPendingScreen';
import ApplicationClarificationScreen from './src/screens/status/ApplicationClarificationScreen';
import ApplicationRejectedScreen from './src/screens/status/ApplicationRejectedScreen';

// Screens - Setup
import SetupServicesScreen from './src/screens/setup/SetupServicesScreen';
import SetupAvailabilityScreen from './src/screens/setup/SetupAvailabilityScreen';
import SetupCompletedScreen from './src/screens/setup/SetupCompletedScreen';

// Screens - Dashboard
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import BookingsScreen from './src/screens/dashboard/BookingsScreen';
import BookingDetailScreen from './src/screens/dashboard/BookingDetailScreen';
import ServicesScreen from './src/screens/dashboard/ServicesScreen';
import ServiceDetailScreen from './src/screens/dashboard/ServiceDetailScreen';
import ProfileScreen from './src/screens/dashboard/ProfileScreen';
import EditProfileScreen from './src/screens/dashboard/EditProfileScreen';
import StartServiceScreen from './src/screens/StartServiceScreen';

// Screens - Staff
import StaffListScreen from './src/screens/staff/StaffListScreen';
import AddStaffScreen from './src/screens/staff/AddStaffScreen';
import StaffDetailScreen from './src/screens/staff/StaffDetailScreen';

// Screens - Schedule
import ScheduleManagementScreen from './src/screens/schedule/ScheduleManagementScreen';

// Screens - Prescription
import PrescriptionBuilderScreen from './src/screens/prescription/PrescriptionBuilderScreen';

// Screens - Video
import VideoCallScreen from './src/components/video/VideoCallScreen';

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

          if (route.name === 'Dashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'Bookings') {
            iconName = 'calendar-today';
          } else if (route.name === 'Services') {
            iconName = 'business-center';
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
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Bookings" component={BookingsScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Main App Component
function AppContent() {
  const { isAuthenticated, isLoading, vendor } = useAuth();
  const [session, setSession] = React.useState<any>(null);
  const navigationRef = React.useRef<any>(null);

  // Constant initial route
  const initialRouteName = 'Login';

  // Handle navigation based on vendor status
  React.useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!navigationRef.current?.isReady()) {
      return;
    }

    if (!isAuthenticated || !vendor) {
      const currentRoute = navigationRef.current.getCurrentRoute();
      if (currentRoute?.name !== 'Login') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
      return;
    }

    // Determine route based on vendor status
    const status = vendor.applicationStatus || vendor.status;
    const currentRoute = navigationRef.current.getCurrentRoute();

    if (status === 'submitted') {
      if (currentRoute?.name !== 'ApplicationSubmitted') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'ApplicationSubmitted', params: { applicationId: vendor.id } }],
        });
      }
    } else if (status === 'pending') {
      if (currentRoute?.name !== 'ApplicationPending') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'ApplicationPending' }],
        });
      }
    } else if (status === 'clarification') {
      if (currentRoute?.name !== 'ApplicationClarification') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ 
            name: 'ApplicationClarification', 
            params: { applicationId: vendor.id, notes: '' } 
          }],
        });
      }
    } else if (status === 'rejected') {
      if (currentRoute?.name !== 'ApplicationRejected') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ 
            name: 'ApplicationRejected', 
            params: { applicationId: vendor.id } 
          }],
        });
      }
    } else if (status === 'approved_services' || status === 'approved') {
      if (!vendor.setupCompleted) {
        if (currentRoute?.name !== 'SetupServices') {
          navigationRef.current.reset({
            index: 0,
            routes: [{ 
              name: 'SetupServices', 
              params: { vendorId: vendor.id, roleId: vendor.roleId } 
            }],
          });
        }
      } else if (currentRoute?.name !== 'MainTabs') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    } else if (vendor.setupCompleted || status === 'active') {
      if (currentRoute?.name !== 'MainTabs') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    } else if (!vendor.applicationStatus && !status) {
      // New vendor - show role selection
      if (currentRoute?.name !== 'RoleSelection') {
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'RoleSelection' }],
        });
      }
    }
  }, [isAuthenticated, isLoading, vendor]);

  if (isLoading) {
    return null;
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
        {/* Auth */}
        <Stack.Screen 
          name="Login" 
          options={{ headerShown: false }}
        >
          {(props) => (
            <LoginScreen
              {...props}
              onAuthSuccess={(sessionData) => {
                setSession(sessionData);
              }}
            />
          )}
        </Stack.Screen>

        {/* Onboarding */}
        <Stack.Screen 
          name="RoleSelection" 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Onboarding" 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="BusinessTypeSelector" 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="SoloProviderOnboarding" 
          options={{ headerShown: false }}
        />

        {/* Application Status */}
        <Stack.Screen 
          name="ApplicationSubmitted" 
          options={{ title: 'Application Submitted' }}
        />
        <Stack.Screen 
          name="ApplicationPending" 
          options={{ title: 'Under Review' }}
        />
        <Stack.Screen 
          name="ApplicationClarification" 
          options={{ title: 'Clarification Required' }}
        />
        <Stack.Screen 
          name="ApplicationRejected" 
          options={{ title: 'Application Rejected' }}
        />

        {/* Setup */}
        <Stack.Screen 
          name="SetupServices" 
          options={{ title: 'Setup Services' }}
        />
        <Stack.Screen 
          name="SetupAvailability" 
          options={{ title: 'Setup Availability' }}
        />
        <Stack.Screen 
          name="SetupCompleted" 
          options={{ headerShown: false }}
        />

        {/* Main App */}
        <Stack.Screen 
          name="MainTabs" 
          component={TabNavigator} 
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Dashboard" 
          component={DashboardScreen}
          options={{ title: 'Dashboard' }}
        />
        <Stack.Screen 
          name="BookingDetail" 
          options={{ title: 'Booking Details' }}
        >
          {(props) => (
            <BookingDetailScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="ServiceDetail" 
          options={{ title: 'Service Details' }}
        >
          {(props) => (
            <ServiceDetailScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="StaffList" 
          options={{ title: 'Staff Management' }}
        >
          {(props) => (
            <StaffListScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="AddStaff" 
          options={{ title: 'Add Staff Member' }}
        >
          {(props) => (
            <AddStaffScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="StaffDetail" 
          options={{ title: 'Staff Details' }}
        >
          {(props) => (
            <StaffDetailScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="Consultation" 
          options={{ title: 'Consultation' }}
        />
        <Stack.Screen 
          name="VideoCall" 
          options={{ headerShown: false, presentation: 'fullScreenModal' }}
        >
          {(props) => (
            <VideoCallScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="Chat" 
          options={{ title: 'Chat' }}
        />
        <Stack.Screen 
          name="EditProfile" 
          options={{ title: 'Edit Profile' }}
        >
          {(props) => (
            <EditProfileScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="ScheduleManagement" 
          options={{ title: 'Schedule Management' }}
        >
          {(props) => (
            <ScheduleManagementScreen {...props} />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="PrescriptionBuilder" 
          options={{ title: 'Prescription Builder' }}
        >
          {(props) => (
            <PrescriptionBuilderScreen {...props} />
          )}
        </Stack.Screen>
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

