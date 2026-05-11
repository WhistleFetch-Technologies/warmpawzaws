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
import { StatusBar, SafeAreaView, Text, TouchableOpacity } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Import screens
import { VendorAuthScreen } from './src/screens/auth/VendorAuthScreen';
import { VendorLandingScreen } from './src/screens/landing/VendorLandingScreen';
import { VendorRoleSelectionScreen } from './src/screens/onboarding/VendorRoleSelectionScreen';
import { VendorOnboardingScreen } from './src/screens/onboarding/VendorOnboardingScreen';
import { VendorDashboardScreen } from './src/screens/dashboard/VendorDashboardScreen';
import { VendorServiceManagementScreen } from './src/screens/services/VendorServiceManagementScreen';
import { VendorBookingManagementScreen } from './src/screens/bookings/VendorBookingManagementScreen';
import { StaffManagementScreen } from './src/screens/staff/StaffManagementScreen';
import { StaffDashboardScreen } from './src/screens/staff/StaffDashboardScreen';
import { StaffEarningsScreen } from './src/screens/staff/StaffEarningsScreen';
import { VendorScheduleScreen } from './src/screens/schedule/VendorScheduleScreen';
import { isStaffUser, getStaffId, getVendorId } from './src/utils/permissions';

// Batch 1 screens
import { BookingDetailScreen } from './src/screens/bookings/BookingDetailScreen';
import { BookingCompletionScreen } from './src/screens/bookings/BookingCompletionScreen';
import { StaffAssignmentScreen } from './src/screens/bookings/StaffAssignmentScreen';
import { BookingCheckInScreen } from './src/screens/bookings/BookingCheckInScreen';
import { StartServiceScreen } from './src/screens/bookings/StartServiceScreen';
import { GPSTrackingScreen } from './src/screens/tracking/GPSTrackingScreen';
import { RouteTrackingScreen } from './src/screens/tracking/RouteTrackingScreen';
import { FileUploadScreen } from './src/screens/bookings/FileUploadScreen';
import { BookingActionsScreen } from './src/screens/bookings/BookingActionsScreen';

// Batch 2 screens
import { ChatScreen } from './src/screens/chat/ChatScreen';
import { VideoCallScreen } from './src/screens/video/VideoCallScreen';
import { NotificationCenterScreen } from './src/screens/notifications/NotificationCenterScreen';
import { EmergencyAlertScreen } from './src/screens/emergency/EmergencyAlertScreen';
import { LiveTrackingDashboard } from './src/screens/tracking/LiveTrackingDashboard';
import { LocationSharingScreen } from './src/screens/location/LocationSharingScreen';
import { RouteOptimizationScreen } from './src/screens/routing/RouteOptimizationScreen';
import { RealTimeUpdatesScreen } from './src/screens/realtime/RealTimeUpdatesScreen';
import { ConnectionStatusScreen } from './src/screens/network/ConnectionStatusScreen';
import { OfflineModeScreen } from './src/screens/offline/OfflineModeScreen';

// Batch 3 screens
import { EarningsScreen } from './src/screens/earnings/EarningsScreen';
import { PayoutsScreen } from './src/screens/payouts/PayoutsScreen';
import { CommissionBreakdownScreen } from './src/screens/earnings/CommissionBreakdownScreen';
import { ReportsScreen } from './src/screens/reports/ReportsScreen';
import { DataExportScreen } from './src/screens/export/DataExportScreen';
import { PerformanceMetricsScreen } from './src/screens/analytics/PerformanceMetricsScreen';
import { RevenueAnalyticsScreen } from './src/screens/analytics/RevenueAnalyticsScreen';
import { TransactionHistoryScreen } from './src/screens/transactions/TransactionHistoryScreen';
import { FinancialSummaryScreen } from './src/screens/financial/FinancialSummaryScreen';
import { TaxDocumentsScreen } from './src/screens/tax/TaxDocumentsScreen';

// Batch 4 screens
import { SettingsScreen } from './src/screens/settings/SettingsScreen';
import { ProfileScreen } from './src/screens/profile/ProfileScreen';
import { PreferencesScreen } from './src/screens/preferences/PreferencesScreen';
import { AccountScreen } from './src/screens/account/AccountScreen';
import { SecurityScreen } from './src/screens/security/SecurityScreen';
import { NotificationsSettingsScreen } from './src/screens/notifications/NotificationsSettingsScreen';
import { PrivacyScreen } from './src/screens/privacy/PrivacyScreen';
import { HelpScreen } from './src/screens/help/HelpScreen';
import { AboutScreen } from './src/screens/about/AboutScreen';
import { LogoutScreen } from './src/screens/logout/LogoutScreen';

// Import theme
import { colors } from './src/theme/colors';
import { setupPushNotifications } from './src/services/notifications';

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
    // Restore persisted vendor/staff session at cold start so users who logged
    // in within the last 90 days stay logged in (silent refresh happens
    // transparently on the next API call).
    const checkSession = async () => {
      try {
        const { loadStoredVendorSession } = require('./src/services/auth-session');
        const stored = await loadStoredVendorSession();

        if (stored && stored.phone) {
          const isStaff = stored.role === 'staff' || !!stored.staffId;
          const restoredSession: any = {
            phone: stored.phone,
            vendorId: stored.vendorId,
            user: stored.vendor || (isStaff ? { isStaff: true } : undefined),
            profile: !isStaff ? stored.vendor : undefined,
            staff: isStaff ? stored.vendor || { id: stored.staffId } : undefined,
            isStaffLogin: isStaff || undefined,
          };
          setSession(restoredSession);
          if (isStaff) {
            setNavigationTarget({ screen: 'StaffDashboard' });
          } else if (stored.vendor) {
            setVendorData(stored.vendor);
          }
        }
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

  // Setup push notifications when vendor is logged in
  useEffect(() => {
    if (vendorData?.id || session?.vendorId) {
      const vendorId = vendorData?.id || session?.vendorId;
      setupPushNotifications(vendorId).catch((error) => {
        console.error('Error setting up push notifications:', error);
      });
    }
  }, [vendorData, session]);

  const handleAuthSuccess = (authSession: any) => {
    setSession(authSession);
    
    // Check if staff login
    if (isStaffUser(authSession)) {
      // Staff login - route to staff dashboard
      setNavigationTarget({ screen: 'StaffDashboard' });
      return;
    }
    
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

  const handleBack = () => {
    setNavigationTarget(null);
  };

  if (isLoading) {
    return null; // TODO: Add loading screen
  }

  return (
    <ErrorBoundary>
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
              ) : navigationTarget?.screen === 'StaffDashboard' ? (
                <Stack.Screen name="StaffDashboard">
                  {(props) => {
                    const staffId = getStaffId(session) || '';
                    return (
                      <StaffDashboardScreen
                        {...props}
                        staffId={staffId}
                        staffData={session.staff || session}
                        onNavigate={handleNavigate}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Dashboard' ? (
                <Stack.Screen name="Dashboard">
                  {(props) => {
                    // Redirect staff users to staff dashboard
                    if (isStaffUser(session)) {
                      const staffId = getStaffId(session) || '';
                      return (
                        <StaffDashboardScreen
                          {...props}
                          staffId={staffId}
                          staffData={session.staff || session}
                          onNavigate={handleNavigate}
                        />
                      );
                    }
                    return (
                      <VendorDashboardScreen
                        {...props}
                        vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                        vendorData={vendorData || session.profile}
                        onNavigate={handleNavigate}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Services' ? (
                <Stack.Screen name="ServiceManagement">
                  {(props) => {
                    // Block staff users from accessing service management
                    if (isStaffUser(session)) {
                      return (
                        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16, textAlign: 'center' }}>
                            Access Denied
                          </Text>
                          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
                            Staff members cannot manage services. Please contact the vendor.
                          </Text>
                          <TouchableOpacity
                            style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 8 }}
                            onPress={() => setNavigationTarget(null)}
                          >
                            <Text style={{ color: colors.card, fontWeight: '600' }}>Go Back</Text>
                          </TouchableOpacity>
                        </SafeAreaView>
                      );
                    }
                    return (
                      <VendorServiceManagementScreen
                        {...props}
                        vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                        onBack={() => setNavigationTarget(null)}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Bookings' ? (
                <Stack.Screen name="BookingManagement">
                  {(props) => {
                    const staffId = getStaffId(session);
                    const vendorId = getVendorId(session) || vendorData?.id || session.profile?.id || session.vendorId || '';
                    return (
                      <VendorBookingManagementScreen
                        {...props}
                        vendorId={staffId ? undefined : vendorId}
                        staffId={staffId || undefined}
                        onBack={() => setNavigationTarget(null)}
                        onSelectBooking={(bookingId) => handleNavigate('BookingDetail', { bookingId })}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Staff' ? (
                <Stack.Screen name="StaffManagement">
                  {(props) => (
                    <StaffManagementScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'schedule' || navigationTarget?.screen === 'Schedule' ? (
                <Stack.Screen name="Schedule">
                  {(props) => {
                    const vendorId = getVendorId(session) || vendorData?.id || session.profile?.id || session.vendorId || '';
                    return (
                      <VendorScheduleScreen
                        {...props}
                        vendorId={vendorId}
                        onBack={handleBack}
                        onNavigate={handleNavigate}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'BookingDetail' ? (
                <Stack.Screen name="BookingDetail">
                  {(props) => {
                    const staffId = getStaffId(session);
                    const vendorId = getVendorId(session) || vendorData?.id || session.profile?.id || session.vendorId || '';
                    return (
                      <BookingDetailScreen
                        {...props}
                        bookingId={navigationTarget.bookingId || ''}
                        vendorId={staffId ? undefined : vendorId}
                        staffId={staffId || undefined}
                        session={session}
                        onBack={handleBack}
                        onNavigate={handleNavigate}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'BookingCompletion' ? (
                <Stack.Screen name="BookingCompletion">
                  {(props) => (
                    <BookingCompletionScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      bookingData={navigationTarget.bookingData}
                      onBack={handleBack}
                      onComplete={(booking) => {
                        handleBack();
                        // Refresh booking list if needed
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'StaffAssignment' ? (
                <Stack.Screen name="StaffAssignment">
                  {(props) => (
                    <StaffAssignmentScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onComplete={(assignments) => {
                        handleBack();
                        // Refresh booking if needed
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'CheckIn' ? (
                <Stack.Screen name="CheckIn">
                  {(props) => (
                    <BookingCheckInScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      bookingData={navigationTarget.bookingData}
                      onBack={handleBack}
                      onComplete={(booking) => {
                        handleBack();
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'StartService' ? (
                <Stack.Screen name="StartService">
                  {(props) => (
                    <StartServiceScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      bookingData={navigationTarget.bookingData}
                      onBack={handleBack}
                      onComplete={(booking) => {
                        handleBack();
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'GPSTracking' ? (
                <Stack.Screen name="GPSTracking">
                  {(props) => (
                    <GPSTrackingScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      customerLocation={navigationTarget.customerLocation}
                      onBack={handleBack}
                      onComplete={() => {
                        handleBack();
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'RouteTracking' ? (
                <Stack.Screen name="RouteTracking">
                  {(props) => (
                    <RouteTrackingScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      routeData={navigationTarget.routeData}
                      startLocation={navigationTarget.startLocation}
                      endLocation={navigationTarget.endLocation}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'FileUpload' ? (
                <Stack.Screen name="FileUpload">
                  {(props) => (
                    <FileUploadScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      uploadType={navigationTarget.uploadType || 'prescription'}
                      onBack={handleBack}
                      onComplete={(fileUrl) => {
                        handleBack();
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'BookingActions' ? (
                <Stack.Screen name="BookingActions">
                  {(props) => (
                    <BookingActionsScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      bookingData={navigationTarget.bookingData}
                      onBack={handleBack}
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Chat' ? (
                <Stack.Screen name="Chat">
                  {(props) => (
                    <ChatScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      customerId={navigationTarget.customerId || ''}
                      customerName={navigationTarget.customerName || 'Customer'}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'VideoCall' ? (
                <Stack.Screen name="VideoCall">
                  {(props) => (
                    <VideoCallScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      customerId={navigationTarget.customerId || ''}
                      customerName={navigationTarget.customerName || 'Customer'}
                      callId={navigationTarget.callId}
                      onBack={handleBack}
                      onCallEnd={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'NotificationCenter' ? (
                <Stack.Screen name="NotificationCenter">
                  {(props) => (
                    <NotificationCenterScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onNotificationTap={(notification) => {
                        // Handle notification tap - navigate to relevant screen
                        if (notification.data?.bookingId) {
                          handleNavigate('BookingDetail', { bookingId: notification.data.bookingId });
                        }
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'EmergencyAlert' ? (
                <Stack.Screen name="EmergencyAlert">
                  {(props) => (
                    <EmergencyAlertScreen
                      {...props}
                      bookingId={navigationTarget.bookingId}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onEmergencyReported={(alert) => {
                        // Handle emergency reported
                        handleBack();
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'LiveTrackingDashboard' ? (
                <Stack.Screen name="LiveTrackingDashboard">
                  {(props) => (
                    <LiveTrackingDashboard
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onSelectBooking={(bookingId) => {
                        handleNavigate('BookingDetail', { bookingId });
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'LocationSharing' ? (
                <Stack.Screen name="LocationSharing">
                  {(props) => (
                    <LocationSharingScreen
                      {...props}
                      bookingId={navigationTarget.bookingId || ''}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      customerId={navigationTarget.customerId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'RouteOptimization' ? (
                <Stack.Screen name="RouteOptimization">
                  {(props) => (
                    <RouteOptimizationScreen
                      {...props}
                      bookingIds={navigationTarget.bookingIds || []}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onRouteOptimized={(route) => {
                        // Handle route optimized
                        handleBack();
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'RealTimeUpdates' ? (
                <Stack.Screen name="RealTimeUpdates">
                  {(props) => (
                    <RealTimeUpdatesScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onUpdateTap={(update) => {
                        // Handle update tap - navigate to relevant screen
                        if (update.data?.bookingId) {
                          handleNavigate('BookingDetail', { bookingId: update.data.bookingId });
                        }
                      }}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'ConnectionStatus' ? (
                <Stack.Screen name="ConnectionStatus">
                  {(props) => (
                    <ConnectionStatusScreen
                      {...props}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'OfflineMode' ? (
                <Stack.Screen name="OfflineMode">
                  {(props) => (
                    <OfflineModeScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Earnings' ? (
                <Stack.Screen name="Earnings">
                  {(props) => {
                    // Route staff users to staff earnings screen
                    if (isStaffUser(session)) {
                      const staffId = getStaffId(session) || '';
                      return (
                        <StaffEarningsScreen
                          {...props}
                          staffId={staffId}
                          onBack={handleBack}
                        />
                      );
                    }
                    return (
                      <EarningsScreen
                        {...props}
                        vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                        onBack={handleBack}
                        onNavigate={handleNavigate}
                      />
                    );
                  }}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Payouts' ? (
                <Stack.Screen name="Payouts">
                  {(props) => (
                    <PayoutsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'CommissionBreakdown' ? (
                <Stack.Screen name="CommissionBreakdown">
                  {(props) => (
                    <CommissionBreakdownScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Reports' ? (
                <Stack.Screen name="Reports">
                  {(props) => (
                    <ReportsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'DataExport' ? (
                <Stack.Screen name="DataExport">
                  {(props) => (
                    <DataExportScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'PerformanceMetrics' ? (
                <Stack.Screen name="PerformanceMetrics">
                  {(props) => (
                    <PerformanceMetricsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'RevenueAnalytics' ? (
                <Stack.Screen name="RevenueAnalytics">
                  {(props) => (
                    <RevenueAnalyticsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'TransactionHistory' ? (
                <Stack.Screen name="TransactionHistory">
                  {(props) => (
                    <TransactionHistoryScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'FinancialSummary' ? (
                <Stack.Screen name="FinancialSummary">
                  {(props) => (
                    <FinancialSummaryScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'TaxDocuments' ? (
                <Stack.Screen name="TaxDocuments">
                  {(props) => (
                    <TaxDocumentsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Settings' ? (
                <Stack.Screen name="Settings">
                  {(props) => (
                    <SettingsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Profile' ? (
                <Stack.Screen name="Profile">
                  {(props) => (
                    <ProfileScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Preferences' ? (
                <Stack.Screen name="Preferences">
                  {(props) => (
                    <PreferencesScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Account' ? (
                <Stack.Screen name="Account">
                  {(props) => (
                    <AccountScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Security' ? (
                <Stack.Screen name="Security">
                  {(props) => (
                    <SecurityScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'NotificationsSettings' ? (
                <Stack.Screen name="NotificationsSettings">
                  {(props) => (
                    <NotificationsSettingsScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Privacy' ? (
                <Stack.Screen name="Privacy">
                  {(props) => (
                    <PrivacyScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Help' ? (
                <Stack.Screen name="Help">
                  {(props) => (
                    <HelpScreen
                      {...props}
                      vendorId={vendorData?.id || session.profile?.id || session.vendorId || ''}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'About' ? (
                <Stack.Screen name="About">
                  {(props) => (
                    <AboutScreen
                      {...props}
                      onBack={handleBack}
                    />
                  )}
                </Stack.Screen>
              ) : navigationTarget?.screen === 'Logout' ? (
                <Stack.Screen name="Logout">
                  {(props) => (
                    <LogoutScreen
                      {...props}
                      onBack={handleBack}
                      onLogout={async () => {
                        try {
                          const { clearVendorSession } = require('./src/services/auth-session');
                          await clearVendorSession();
                        } catch (e) {
                          console.warn('[vendor-app] logout cleanup failed:', e);
                        }
                        setSession(null);
                        setVendorData(null);
                        setShowOnboarding(false);
                        setShowRoleSelection(false);
                        setNavigationTarget(null);
                      }}
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
                      onNavigate={handleNavigate}
                    />
                  )}
                </Stack.Screen>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

