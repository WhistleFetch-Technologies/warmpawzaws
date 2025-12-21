/**
 * Warmpawz Customer App
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
import { CustomerAuthScreen } from './src/screens/auth/CustomerAuthScreen';
import { CustomerHomeScreen } from './src/screens/home/CustomerHomeScreen';
import { CustomerOnboardingScreen } from './src/screens/onboarding/CustomerOnboardingScreen';
import { CustomerPlanningJourneyScreen } from './src/screens/onboarding/CustomerPlanningJourneyScreen';
import { CustomerHavePetJourneyScreen } from './src/screens/onboarding/CustomerHavePetJourneyScreen';
import { CustomerUserProfileScreen } from './src/screens/onboarding/CustomerUserProfileScreen';
import { CustomerPetProfileScreen } from './src/screens/pets/CustomerPetProfileScreen';
import { ServiceDiscoveryScreen } from './src/screens/services/ServiceDiscoveryScreen';
import { ServiceDetailScreen } from './src/screens/services/ServiceDetailScreen';
import { BookingCreationScreen } from './src/screens/bookings/BookingCreationScreen';
import { BookingListScreen } from './src/screens/bookings/BookingListScreen';

// Import theme
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStage, setOnboardingStage] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

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
  };

  const handleOnboardingComplete = (stage: string) => {
    // Set the onboarding stage to navigate to appropriate screen
    setOnboardingStage(stage);
  };

  const handlePlanningJourneyComplete = () => {
    // Planning journey completed, show user profile
    setOnboardingStage(null);
    setShowUserProfile(true);
  };

  const handlePlanningJourneyBack = () => {
    // Go back to onboarding selection
    setOnboardingStage(null);
  };

  const handleHavePetJourneyComplete = () => {
    // Have pet journey completed, show user profile
    setOnboardingStage(null);
    setShowUserProfile(true);
  };

  const handleHavePetJourneyBack = () => {
    // Go back to onboarding selection
    setOnboardingStage(null);
  };

  const handleUserProfileComplete = (profile: any) => {
    // User profile completed, show pet profile screen
    setShowUserProfile(false);
    if (session) {
      setSession({ ...session, profile, showPetProfile: true });
    }
  };

  const handlePetProfileComplete = (pets: any[]) => {
    // Pet profile completed, mark onboarding as complete and go to home
    if (session) {
      setSession({ ...session, hasCompletedOnboarding: true, pets });
    }
  };

  const handleUserProfileBack = () => {
    // Go back to previous screen
    setShowUserProfile(false);
    // Return to the journey stage if it was set
    if (onboardingStage) {
      setOnboardingStage(onboardingStage);
    }
  };

  const handleNavigate = (screen: string, data?: any) => {
    // Handle navigation to different screens
    console.log('Navigate to:', screen, data);
    // Navigation handled via Stack Navigator
  };

  const handleServiceSelect = (serviceId: string, vendorId: string) => {
    // Navigate to service detail
    setSession({ ...session, navigationTarget: { screen: 'ServiceDetail', serviceId, vendorId } });
  };

  const handleBookService = (serviceId: string, vendorId: string) => {
    // Navigate to booking creation
    setSession({ ...session, navigationTarget: { screen: 'BookingCreation', serviceId, vendorId } });
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
                  {(props) => <CustomerAuthScreen {...props} onAuthSuccess={handleAuthSuccess} />}
                </Stack.Screen>
              ) : onboardingStage === 'planning' ? (
                <Stack.Screen name="PlanningJourney">
                  {(props) => (
                    <CustomerPlanningJourneyScreen
                      {...props}
                      phone={session.phone}
                      onComplete={handlePlanningJourneyComplete}
                      onBack={handlePlanningJourneyBack}
                    />
                  )}
                </Stack.Screen>
              ) : onboardingStage === 'have-pet' ? (
                <Stack.Screen name="HavePetJourney">
                  {(props) => (
                    <CustomerHavePetJourneyScreen
                      {...props}
                      phone={session.phone}
                      onComplete={handleHavePetJourneyComplete}
                      onBack={handleHavePetJourneyBack}
                    />
                  )}
                </Stack.Screen>
              ) : showUserProfile ? (
                <Stack.Screen name="UserProfile">
                  {(props) => (
                    <CustomerUserProfileScreen
                      {...props}
                      phone={session.phone}
                      journeyStage={onboardingStage || undefined}
                      onComplete={handleUserProfileComplete}
                      onBack={handleUserProfileBack}
                    />
                  )}
                </Stack.Screen>
              ) : session.showPetProfile ? (
                <Stack.Screen name="PetProfile">
                  {(props) => (
                    <CustomerPetProfileScreen
                      {...props}
                      phone={session.phone}
                      onComplete={handlePetProfileComplete}
                      onBack={() => setSession({ ...session, showPetProfile: false, showUserProfile: true })}
                    />
                  )}
                </Stack.Screen>
              ) : session.hasCompletedOnboarding ? (
                <>
                  <Stack.Screen name="Home">
                    {(props) => (
                      <CustomerHomeScreen
                        {...props}
                        phone={session.phone}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ServiceDiscovery">
                    {(props) => (
                      <ServiceDiscoveryScreen
                        {...props}
                        phone={session.phone}
                        onSelectVendor={handleServiceSelect}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ServiceDetail">
                    {(props) => (
                      <ServiceDetailScreen
                        {...props}
                        phone={session.phone}
                        serviceId={session.navigationTarget?.serviceId || ''}
                        vendorId={session.navigationTarget?.vendorId}
                        onBook={handleBookService}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingCreation">
                    {(props) => (
                      <BookingCreationScreen
                        {...props}
                        phone={session.phone}
                        vendorId={session.navigationTarget?.vendorId || ''}
                        serviceId={session.navigationTarget?.serviceId || ''}
                        onComplete={(bookingId) => {
                          setSession({ ...session, navigationTarget: null });
                          handleNavigate('BookingList');
                        }}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingList">
                    {(props) => (
                      <BookingListScreen
                        {...props}
                        phone={session.phone}
                        onSelectBooking={(bookingId) => handleNavigate('BookingDetail', { bookingId })}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                      />
                    )}
                  </Stack.Screen>
                </>
              ) : (
                <Stack.Screen name="Onboarding">
                  {(props) => (
                    <CustomerOnboardingScreen
                      {...props}
                      onComplete={handleOnboardingComplete}
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

