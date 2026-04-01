/**
 * Warmpawz Customer App
 * Main entry point - Identical functionality to web app
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
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
import { VetServiceRouter } from './src/screens/services/VetServiceRouter';
import { GroomingServiceRouter } from './src/screens/services/GroomingServiceRouter';
import { TrainingServiceRouter } from './src/screens/services/TrainingServiceRouter';
import { BoardingServiceRouter } from './src/screens/services/BoardingServiceRouter';
import { WalkerServiceScreen } from './src/screens/services/WalkerServiceScreen';
import { AdoptionServiceRouter } from './src/screens/services/AdoptionServiceRouter';
import { InsuranceServicesScreen } from './src/screens/services/InsuranceServicesScreen';
import { NutritionistServiceScreen } from './src/screens/services/NutritionistServiceScreen';
import { PetCafeServicesScreen } from './src/screens/services/PetCafeServicesScreen';
import { MealPlanOrderScreen } from './src/screens/services/MealPlanOrderScreen';
import { PharmacyStoreScreen } from './src/screens/services/PharmacyStoreScreen';
import { ShopDashboardScreen } from './src/screens/services/ShopDashboardScreen';
import { ResortServicesScreen } from './src/screens/services/ResortServicesScreen';
import { BookingCreationScreen } from './src/screens/bookings/BookingCreationScreen';
import { BookingDetailScreen } from './src/screens/bookings/BookingDetailScreen';
import { BookingConfirmationScreen } from './src/screens/bookings/BookingConfirmationScreen';
import { RescheduleBookingScreen } from './src/screens/bookings/RescheduleBookingScreen';
import { CancelBookingScreen } from './src/screens/bookings/CancelBookingScreen';
import { CustomerPetsPageScreen } from './src/screens/pets/CustomerPetsPageScreen';
import { CustomerProfileScreen } from './src/screens/profile/CustomerProfileScreen';
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { PaymentMethodsScreen } from './src/screens/settings/PaymentMethodsScreen';
import { AddressesScreen } from './src/screens/settings/AddressesScreen';
import { HelpSupportScreen } from './src/screens/settings/HelpSupportScreen';
import { OrderHistoryScreen } from './src/screens/orders/OrderHistoryScreen';
import { OrderDetailScreen } from './src/screens/orders/OrderDetailScreen';
import { OrderTrackingScreen } from './src/screens/orders/OrderTrackingScreen';
import { MealPlanOrdersScreen } from './src/screens/orders/MealPlanOrdersScreen';
import { WalletScreen } from './src/screens/wallet/WalletScreen';
import { RewardsLoyaltyScreen } from './src/screens/rewards/RewardsLoyaltyScreen';
import { ReferralSystemScreen } from './src/screens/rewards/ReferralSystemScreen';
import { NotificationsScreen } from './src/screens/notifications/NotificationsScreen';
import { BookingListScreen } from './src/screens/bookings/BookingListScreen';
// Batch 1: New screens
import { EmergencyBookingScreen } from './src/screens/bookings/EmergencyBookingScreen';
import { BookingTimelineScreen } from './src/screens/bookings/BookingTimelineScreen';
import { ShoppingCartScreen } from './src/screens/shop/ShoppingCartScreen';
import { CheckoutScreen } from './src/screens/shop/CheckoutScreen';
import { ProductDetailScreen } from './src/screens/shop/ProductDetailScreen';
import { OrderReturnScreen } from './src/screens/orders/OrderReturnScreen';
import { PaymentFailureRecoveryScreen } from './src/screens/payments/PaymentFailureRecoveryScreen';
import { ChatScreen } from './src/screens/chat/ChatScreen';
import { SubscriptionsScreen } from './src/screens/subscriptions/SubscriptionsScreen';
import { ProblemDiscoveryScreen } from './src/screens/services/ProblemDiscoveryScreen';
// Batch 2: New screens
import { GPSTrackingScreen } from './src/screens/logistics/GPSTrackingScreen';
import { VideoConsultationScreen } from './src/screens/consultation/VideoConsultationScreen';
import { MapsRouteScreen } from './src/screens/logistics/MapsRouteScreen';
import { OrderSuccessScreen } from './src/screens/orders/OrderSuccessScreen';
import { AppointmentListScreen } from './src/screens/appointments/AppointmentListScreen';
import { AppointmentDetailScreen } from './src/screens/appointments/AppointmentDetailScreen';
import { AppointmentRescheduleScreen } from './src/screens/appointments/AppointmentRescheduleScreen';
import { AddressBookScreen } from './src/screens/settings/AddressBookScreen';
import { PackageBookingScreen } from './src/screens/bookings/PackageBookingScreen';
import { PrescriptionViewScreen } from './src/screens/medical/PrescriptionViewScreen';
// Batch 3: New screens
import { LiveTrackingDashboardScreen } from './src/screens/logistics/LiveTrackingDashboardScreen';
import { WalletTopUpScreen } from './src/screens/wallet/WalletTopUpScreen';
import { TransactionHistoryScreen } from './src/screens/wallet/TransactionHistoryScreen';
import { CouponApplyScreen } from './src/screens/payments/CouponApplyScreen';
import { NotificationCenterScreen } from './src/screens/notifications/NotificationCenterScreen';
// Batch 4: New screens
import { ServiceSearchScreen } from './src/screens/services/ServiceSearchScreen';
import { VendorProfileScreen } from './src/screens/vendors/VendorProfileScreen';
import { ServiceBookingFlowScreen } from './src/screens/bookings/ServiceBookingFlowScreen';
// Bottom Tab Navigator
import { BottomTabNavigator } from './src/navigation/BottomTabNavigator';
// Batch 5: New screens
import { BookingOTPScreen } from './src/screens/bookings/BookingOTPScreen';
import { BookingCheckInScreen } from './src/screens/bookings/BookingCheckInScreen';
import { BookingFeedbackScreen } from './src/screens/bookings/BookingFeedbackScreen';
import { BookingReceiptScreen } from './src/screens/bookings/BookingReceiptScreen';
import { EditAddressScreen } from './src/screens/settings/EditAddressScreen';
import { AddAddressScreen } from './src/screens/settings/AddAddressScreen';
import { ChangePasswordScreen } from './src/screens/settings/ChangePasswordScreen';
import { EditProfileScreen } from './src/screens/profile/EditProfileScreen';
import { WishlistScreen } from './src/screens/shop/WishlistScreen';
import { OrderInvoiceScreen } from './src/screens/orders/OrderInvoiceScreen';
// Phase 3: AI Chatbot
import { AIChatbotScreen } from './src/screens/ai-chatbot/AIChatbotScreen';

// Import theme
import { colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

const navigationRef = createNavigationContainerRef();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStage, setOnboardingStage] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        // Initialize API service with network monitoring
        const { ApiService } = require('./src/services/api');
        await ApiService.initialize();
        
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
    console.log('Navigate to:', screen, data);
    if (!navigationRef.isReady()) return;
    // Bottom tabs: use merge so stack returns to MainTabs and the correct tab is focused (names match BottomTabNavigator Tab.Screen).
    if (screen === 'MainTabs' && data && typeof data === 'object' && typeof data.screen === 'string') {
      const tabParams: { screen: string; params?: object } = { screen: data.screen };
      if (data.params != null && typeof data.params === 'object') {
        tabParams.params = data.params;
      }
      navigationRef.dispatch(
        CommonActions.navigate({
          name: 'MainTabs',
          params: tabParams,
          merge: true,
        })
      );
      return;
    }
    if (data === undefined || data === null) {
      (navigationRef.navigate as (name: string) => void)(screen);
    } else {
      (navigationRef.navigate as (name: string, params: object) => void)(screen, data);
    }
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
          <NavigationContainer ref={navigationRef}>
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
                  <Stack.Screen name="MainTabs">
                    {(props) => (
                      <BottomTabNavigator
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onNavigate={handleNavigate}
                        // Home header avatar: stack CustomerProfile; My Bookings footer also uses CustomerProfile so Back returns to BookingList.
                        onProfileClick={() => handleNavigate('CustomerProfile')}
                        onPetClick={(petId) => handleNavigate('PetProfileDashboard', { petId })}
                        onAddPet={() => handleNavigate('CustomerPetsPage')}
                      />
                    )}
                  </Stack.Screen>
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
                  <Stack.Screen name="VetServiceRouter">
                    {(props) => (
                      <VetServiceRouter
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                        onViewBooking={(bookingId, petId) => {
                          handleNavigate('BookingDetail', { bookingId, petId });
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="GroomingServiceRouter">
                    {(props) => (
                      <GroomingServiceRouter
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                        onViewBooking={(bookingId, petId) => {
                          handleNavigate('BookingDetail', { bookingId, petId });
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="TrainingServiceRouter">
                    {(props) => (
                      <TrainingServiceRouter
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                        onViewBooking={(bookingId, petId) => {
                          handleNavigate('BookingDetail', { bookingId, petId });
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BoardingServiceRouter">
                    {(props) => (
                      <BoardingServiceRouter
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                        onViewBooking={(bookingId, petId) => {
                          handleNavigate('BookingDetail', { bookingId, petId });
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="WalkerServiceScreen">
                    {(props) => (
                      <WalkerServiceScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                        onViewBooking={(bookingId, petId) => {
                          handleNavigate('BookingDetail', { bookingId, petId });
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AdoptionServiceRouter">
                    {(props) => (
                      <AdoptionServiceRouter
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="InsuranceServicesScreen">
                    {(props) => (
                      <InsuranceServicesScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PetCafeServicesScreen">
                    {(props) => (
                      <PetCafeServicesScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PharmacyStoreScreen">
                    {(props) => (
                      <PharmacyStoreScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="NutritionistServiceScreen">
                    {(props) => (
                      <NutritionistServiceScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ShopDashboardScreen">
                    {(props) => (
                      <ShopDashboardScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ResortServicesScreen">
                    {(props) => (
                      <ResortServicesScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
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
                        onNavigate={handleNavigate}
                        onSelectBooking={(bookingId) => handleNavigate('BookingDetail', { bookingId })}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingDetail">
                    {(props) => (
                      <BookingDetailScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        onBack={() => handleNavigate('BookingList')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingConfirmation">
                    {(props) => (
                      <BookingConfirmationScreen
                        {...props}
                        bookingData={props.route?.params?.bookingData || {}}
                        onViewBooking={(bookingId, petId) =>
                          handleNavigate('BookingDetail', { bookingId })
                        }
                        onBackToHome={() =>
                          setSession({ ...session, navigationTarget: null })
                        }
                        onBack={() =>
                          setSession({ ...session, navigationTarget: null })
                        }
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="RescheduleBooking">
                    {(props) => (
                      <RescheduleBookingScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        currentDate={props.route?.params?.currentDate}
                        currentTime={props.route?.params?.currentTime}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onSuccess={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="CancelBooking">
                    {(props) => (
                      <CancelBookingScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        bookingData={props.route?.params?.bookingData}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onSuccess={() => handleNavigate('BookingList')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="CustomerPetsPage">
                    {(props) => (
                      <CustomerPetsPageScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => setSession({ ...session, navigationTarget: null })}
                        onNavigate={handleNavigate}
                        onAddPet={() => handleNavigate('AddPet')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AddPet">
                    {(props) => (
                      <CustomerPetProfileScreen
                        {...props}
                        phone={session.phone}
                        onComplete={(pets) => {
                          handleNavigate('CustomerPetsPage');
                        }}
                        onBack={() => handleNavigate('CustomerPetsPage')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PetProfileDashboard">
                    {(props) => (
                      <PetProfileDashboardScreen
                        {...props}
                        petId={props.route?.params?.petId || ''}
                        pet={props.route?.params?.pet}
                        phone={session.phone}
                        onBack={() => handleNavigate('CustomerPetsPage')}
                        onNavigate={handleNavigate}
                        onViewBooking={(bookingId, petId) =>
                          handleNavigate('BookingDetail', { bookingId })
                        }
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="MedicalRecords">
                    {(props) => (
                      <MedicalRecordsScreen
                        {...props}
                        petId={props.route?.params?.petId || ''}
                        phone={session.phone}
                        onBack={() => handleNavigate('PetProfileDashboard', { petId: props.route?.params?.petId })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="CustomerProfile">
                    {(props) => (
                      <CustomerProfileScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => {
                          if (props.navigation.canGoBack()) {
                            props.navigation.goBack();
                          } else {
                            handleNavigate('MainTabs', { screen: 'Home' });
                          }
                        }}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Settings">
                    {(props) => (
                      <SettingsScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                        onLogout={() => {
                          setSession({ phone: '', isAuthenticated: false, navigationTarget: null });
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PaymentMethods">
                    {(props) => (
                      <PaymentMethodsScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Addresses">
                    {(props) => (
                      <AddressesScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="HelpSupport">
                    {(props) => (
                      <HelpSupportScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderHistory">
                    {(props) => (
                      <OrderHistoryScreen
                        {...props}
                        phone={session.phone}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderDetail">
                    {(props) => (
                      <OrderDetailScreen
                        {...props}
                        orderId={props.route?.params?.orderId || ''}
                        order={props.route?.params?.order}
                        phone={session.phone}
                        onBack={() => handleNavigate('OrderHistory')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderTracking">
                    {(props) => (
                      <OrderTrackingScreen
                        {...props}
                        orderId={props.route?.params?.orderId || ''}
                        order={props.route?.params?.order}
                        phone={session.phone}
                        onBack={() => handleNavigate('OrderDetail', { orderId: props.route?.params?.orderId, order: props.route?.params?.order })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Wallet">
                    {(props) => (
                      <WalletScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="RewardsLoyalty">
                    {(props) => (
                      <RewardsLoyaltyScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ReferralSystem">
                    {(props) => (
                      <ReferralSystemScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Notifications">
                    {(props) => (
                      <NotificationsScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  {/* Batch 1: New Screens */}
                  <Stack.Screen name="EmergencyBooking">
                    {(props) => (
                      <EmergencyBookingScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                        onSuccess={(bookingId) => handleNavigate('BookingDetail', { bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ShoppingCart">
                    {(props) => (
                      <ShoppingCartScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('ShopDashboard')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Checkout">
                    {(props) => (
                      <CheckoutScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        cart={props.route?.params?.cart}
                        onBack={() => handleNavigate('ShoppingCart')}
                        onNavigate={handleNavigate}
                        onSuccess={(orderId) => handleNavigate('OrderDetail', { orderId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ProductDetail">
                    {(props) => (
                      <ProductDetailScreen
                        {...props}
                        productId={props.route?.params?.productId || ''}
                        phone={session.phone}
                        onBack={() => handleNavigate('ShopDashboard')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderReturn">
                    {(props) => (
                      <OrderReturnScreen
                        {...props}
                        orderId={props.route?.params?.orderId || ''}
                        order={props.route?.params?.order}
                        phone={session.phone}
                        onBack={() => handleNavigate('OrderDetail', { orderId: props.route?.params?.orderId })}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('OrderDetail', { orderId: props.route?.params?.orderId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PaymentFailureRecovery">
                    {(props) => (
                      <PaymentFailureRecoveryScreen
                        {...props}
                        paymentId={props.route?.params?.paymentId || ''}
                        orderId={props.route?.params?.orderId}
                        bookingId={props.route?.params?.bookingId}
                        amount={props.route?.params?.amount || 0}
                        phone={session.phone}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                        onSuccess={() => {
                          if (props.route?.params?.bookingId) {
                            handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId });
                          } else if (props.route?.params?.orderId) {
                            handleNavigate('OrderDetail', { orderId: props.route?.params?.orderId });
                          }
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Chat">
                    {(props) => (
                      <ChatScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        matchId={props.route?.params?.matchId}
                        senderId={session.customerId || session.phone}
                        recipientName={props.route?.params?.recipientName}
                        recipientAvatar={props.route?.params?.recipientAvatar}
                        phone={session.phone}
                        onBack={() => {
                          if (navigationRef.canGoBack()) {
                            navigationRef.goBack();
                          } else if (props.route?.params?.bookingId) {
                            handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId });
                          } else {
                            handleNavigate('MainTabs');
                          }
                        }}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Subscriptions">
                    {(props) => (
                      <SubscriptionsScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingTimeline">
                    {(props) => (
                      <BookingTimelineScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ProblemDiscovery">
                    {(props) => (
                      <ProblemDiscoveryScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  {/* Batch 2: New Screens */}
                  <Stack.Screen name="GPSTracking">
                    {(props) => (
                      <GPSTrackingScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="VideoConsultation">
                    {(props) => (
                      <VideoConsultationScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        callId={props.route?.params?.callId}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                        onCallEnd={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="MapsRoute">
                    {(props) => (
                      <MapsRouteScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId}
                        origin={props.route?.params?.origin}
                        destination={props.route?.params?.destination}
                        route={props.route?.params?.route}
                        phone={session.phone}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderSuccess">
                    {(props) => (
                      <OrderSuccessScreen
                        {...props}
                        orderId={props.route?.params?.orderId || ''}
                        order={props.route?.params?.order}
                        phone={session.phone}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AppointmentList">
                    {(props) => (
                      <AppointmentListScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AppointmentDetail">
                    {(props) => (
                      <AppointmentDetailScreen
                        {...props}
                        appointmentId={props.route?.params?.appointmentId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('AppointmentList')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AppointmentReschedule">
                    {(props) => (
                      <AppointmentRescheduleScreen
                        {...props}
                        appointmentId={props.route?.params?.appointmentId || ''}
                        currentDate={props.route?.params?.currentDate}
                        currentTime={props.route?.params?.currentTime}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('AppointmentDetail', { appointmentId: props.route?.params?.appointmentId })}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('AppointmentDetail', { appointmentId: props.route?.params?.appointmentId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AddressBook">
                    {(props) => (
                      <AddressBookScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PackageBooking">
                    {(props) => (
                      <PackageBookingScreen
                        {...props}
                        serviceType={props.route?.params?.serviceType || ''}
                        vendorId={props.route?.params?.vendorId}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                        onSuccess={(bookingId) => handleNavigate('BookingDetail', { bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PrescriptionView">
                    {(props) => (
                      <PrescriptionViewScreen
                        {...props}
                        prescriptionId={props.route?.params?.prescriptionId}
                        appointmentId={props.route?.params?.appointmentId}
                        prescription={props.route?.params?.prescription}
                        phone={session.phone}
                        onBack={() => {
                          if (props.route?.params?.appointmentId) {
                            handleNavigate('AppointmentDetail', { appointmentId: props.route?.params?.appointmentId });
                          } else {
                            handleNavigate('MedicalRecords', { petId: props.route?.params?.petId });
                          }
                        }}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  {/* Batch 3: New Screens */}
                  <Stack.Screen name="LiveTrackingDashboard">
                    {(props) => (
                      <LiveTrackingDashboardScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderTracking">
                    {(props) => (
                      <OrderTrackingScreen
                        {...props}
                        orderId={props.route?.params?.orderId || ''}
                        phone={session.phone}
                        onBack={() => handleNavigate('OrderDetail', { orderId: props.route?.params?.orderId })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="WalletTopUp">
                    {(props) => (
                      <WalletTopUpScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        currentBalance={props.route?.params?.currentBalance}
                        onBack={() => handleNavigate('Wallet')}
                        onNavigate={handleNavigate}
                        onSuccess={(amount) => handleNavigate('Wallet')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="TransactionHistory">
                    {(props) => (
                      <TransactionHistoryScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Wallet')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="CouponApply">
                    {(props) => (
                      <CouponApplyScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId}
                        orderId={props.route?.params?.orderId}
                        totalAmount={props.route?.params?.totalAmount || 0}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => {
                          if (props.route?.params?.bookingId) {
                            handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId });
                          } else if (props.route?.params?.orderId) {
                            handleNavigate('Checkout', { orderId: props.route?.params?.orderId });
                          } else {
                            handleNavigate('Home');
                          }
                        }}
                        onNavigate={handleNavigate}
                        onApply={(coupon, discount) => {
                          if (props.route?.params?.bookingId) {
                            handleNavigate('BookingDetail', { 
                              bookingId: props.route?.params?.bookingId,
                              appliedCoupon: coupon,
                              discount 
                            });
                          } else if (props.route?.params?.orderId) {
                            handleNavigate('Checkout', { 
                              orderId: props.route?.params?.orderId,
                              appliedCoupon: coupon,
                              discount 
                            });
                          }
                        }}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="NotificationCenter">
                    {(props) => (
                      <NotificationCenterScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  {/* Batch 4: New Screens */}
                  <Stack.Screen name="ServiceSearch">
                    {(props) => (
                      <ServiceSearchScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        initialQuery={props.route?.params?.query}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="VendorProfile">
                    {(props) => (
                      <VendorProfileScreen
                        {...props}
                        vendorId={props.route?.params?.vendorId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('ServiceDiscovery')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ServiceBookingFlow">
                    {(props) => (
                      <ServiceBookingFlowScreen
                        {...props}
                        serviceId={props.route?.params?.serviceId || ''}
                        vendorId={props.route?.params?.vendorId || ''}
                        serviceName={props.route?.params?.serviceName || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('ServiceDetail', { 
                          serviceId: props.route?.params?.serviceId,
                          vendorId: props.route?.params?.vendorId 
                        })}
                        onNavigate={handleNavigate}
                        onSuccess={(bookingId) => handleNavigate('BookingConfirmation', { bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingConfirmation">
                    {(props) => (
                      <BookingConfirmationScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PaymentMethods">
                    {(props) => (
                      <PaymentMethodsScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="HelpSupport">
                    {(props) => (
                      <HelpSupportScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AIChatbot">
                    {(props) => (
                      <AIChatbotScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('HelpSupport')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Settings">
                    {(props) => (
                      <SettingsScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="PetProfileDashboard">
                    {(props) => (
                      <PetProfileDashboardScreen
                        {...props}
                        petId={props.route?.params?.petId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('CustomerPetsPage')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="MedicalRecords">
                    {(props) => (
                      <MedicalRecordsScreen
                        {...props}
                        petId={props.route?.params?.petId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => {
                          if (props.route?.params?.petId) {
                            handleNavigate('PetProfileDashboard', { petId: props.route?.params?.petId });
                          } else {
                            handleNavigate('CustomerPetsPage');
                          }
                        }}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderHistory">
                    {(props) => (
                      <OrderHistoryScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Home')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="MealPlanOrders">
                    {(props) => (
                      <MealPlanOrdersScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('NutritionistServiceScreen')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  {/* Batch 5: New Screens */}
                  <Stack.Screen name="BookingOTP">
                    {(props) => (
                      <BookingOTPScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingCheckIn">
                    {(props) => (
                      <BookingCheckInScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingFeedback">
                    {(props) => (
                      <BookingFeedbackScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="BookingReceipt">
                    {(props) => (
                      <BookingReceiptScreen
                        {...props}
                        bookingId={props.route?.params?.bookingId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('BookingDetail', { bookingId: props.route?.params?.bookingId })}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="EditAddress">
                    {(props) => (
                      <EditAddressScreen
                        {...props}
                        addressId={props.route?.params?.addressId || ''}
                        address={props.route?.params?.address}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('AddressBook')}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('AddressBook')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AddAddress">
                    {(props) => (
                      <AddAddressScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('AddressBook')}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('AddressBook')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="ChangePassword">
                    {(props) => (
                      <ChangePasswordScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('Settings')}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('Settings')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="EditProfile">
                    {(props) => (
                      <EditProfileScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        profile={props.route?.params?.profile}
                        onBack={() => handleNavigate('CustomerProfile')}
                        onNavigate={handleNavigate}
                        onSuccess={() => handleNavigate('CustomerProfile')}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="Wishlist">
                    {(props) => (
                      <WishlistScreen
                        {...props}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('ShopDashboard')}
                        onNavigate={handleNavigate}
                      />
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="OrderInvoice">
                    {(props) => (
                      <OrderInvoiceScreen
                        {...props}
                        orderId={props.route?.params?.orderId || ''}
                        phone={session.phone}
                        customerId={session.customerId}
                        onBack={() => handleNavigate('OrderDetail', { orderId: props.route?.params?.orderId })}
                        onNavigate={handleNavigate}
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

