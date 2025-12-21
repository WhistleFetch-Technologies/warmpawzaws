/**
 * Warmpawz Vendor App
 * Main entry point - Identical functionality to web app
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';

// Import screens
import { VendorAuthScreen } from './src/screens/auth/VendorAuthScreen';
import { VendorLandingScreen } from './src/screens/landing/VendorLandingScreen';
import { VendorRoleSelectionScreen } from './src/screens/onboarding/VendorRoleSelectionScreen';
import { VendorOnboardingScreen } from './src/screens/onboarding/VendorOnboardingScreen';
import { VendorDashboardScreen } from './src/screens/dashboard/VendorDashboardScreen';
import { VendorServiceManagementScreen } from './src/screens/services/VendorServiceManagementScreen';
import { VendorBookingManagementScreen } from './src/screens/bookings/VendorBookingManagementScreen';
import { StaffManagementScreen } from './src/screens/staff/StaffManagementScreen';

// Import theme
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [vendorData, setVendorData] = useState<any>(null);
  const [navigationTarget, setNavigationTarget] = useState<any>(null);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        // TODO: Check AsyncStorage for existing session
        // For now, always show auth screen
        setIsLoading(false);
      } catch (error) {
        console.error('Session check error:', error);
        setIsLoading(false);
      }
    };
    
    checkSession();
    
    // Cleanup
    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleAuthSuccess = (authSession: any) => {
    setSession(authSession);
    
    // Check if new vendor or existing
    if (authSession.isNewUser || !authSession.profile) {
      setShowRoleSelection(true);
    } else {
      setVendorData(authSession.profile);
    }
  };

  const handleRoleSelect = (roleId: string) => {
    setShowRoleSelection(false);
    setSelectedRoleId(roleId);
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = (data: any) => {
    setShowOnboarding(false);
    setVendorData(data);
    setSession({ ...session, vendorId: data.vendorId, profile: data });
  };

  const handleNavigateToDashboard = () => {
    setNavigationTarget({ screen: 'Dashboard' });
  };

  const handleNavigateToOnboarding = (roleId: string) => {
    setSelectedRoleId(roleId);
    setShowOnboarding(true);
  };

  const handleNavigate = (screen: string, data?: any) => {
    setNavigationTarget({ screen, ...data });
  };

  if (isLoading) {
    return null; // TODO: Add loading screen
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider>
          <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
          <NavigationContainer>
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              {!session ? (
                <Stack.Screen name="Auth">
                  {(props) => <VendorAuthScreen {...props} onAuthSuccess={handleAuthSuccess} />}
                </Stack.Screen>
              ) : showRoleSelection ? (
                <Stack.Screen name="RoleSelection">
                  {(props) => (
                    <VendorRoleSelectionScreen
                      {...props}
                      onRoleSelect={handleRoleSelect}
                    />
                  )}
                </Stack.Screen>
              ) : showOnboarding ? (
                <Stack.Screen name="Onboarding">
                  {(props) => (
                    <VendorOnboardingScreen
                      {...props}
                      phone={session.phone}
                      roleId={selectedRoleId}
                      onComplete={handleOnboardingComplete}
                      onBack={() => {
                        setShowOnboarding(false);
                        setShowRoleSelection(true);
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Dashboard' ? (
                <Stack.Screen name="Dashboard">
                  {(props) => (
                    <VendorDashboardScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      vendorData={vendorData || session.profile}
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Services' ? (
                <Stack.Screen name="ServiceManagement">
                  {(props) => (
                    <VendorServiceManagementScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={() => setNavigationTarget(null)}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Bookings' ? (
                <Stack.Screen name="BookingManagement">
                  {(props) => (
                    <VendorBookingManagementScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={() => setNavigationTarget(null)}
                      onSelectBooking={(bookingId) => handleNavigate('BookingDetail', { bookingId })}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Staff' ? (
                <Stack.Screen name="StaffManagement">
                  {(props) => (
                    <StaffManagementScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={() => setNavigationTarget(null)}
                    />
                  )}
                </Stack.Screen>
              ) : (
                <Stack.Screen name="Landing">
                  {(props) => (
                    <VendorLandingScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      phone={session.phone}
                      initialVendorData={vendorData || session.profile}
                      onNavigateToDashboard={handleNavigateToDashboard}
                      onNavigateToOnboarding={handleNavigateToOnboarding}
                    />
                  )}
                </Stack.Screen>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

