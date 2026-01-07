/**
 * Vendor Landing Screen
 * Handles all vendor lifecycle states
 * Simplified version for mobile - identical functionality
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { GradientBackground, BrandedCard, StatusIcon } from '../../components/branded';
import { VendorApi } from '../../services/api';

interface VendorLandingScreenProps {
  vendorId: string;
  phone: string;
  initialVendorData?: any;
  onNavigateToDashboard?: () => void;
  onNavigateToOnboarding?: (roleId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

type VendorStatus =
  | 'new'
  | 'submitted'
  | 'pending'
  | 'approved_services'
  | 'approved_availability'
  | 'setup_completed'
  | 'rejected'
  | 'clarification'
  | 'active';

export function VendorLandingScreen({
  vendorId,
  phone,
  initialVendorData,
  onNavigateToDashboard,
  onNavigateToOnboarding,
  onNavigate,
}: VendorLandingScreenProps) {
  const [status, setStatus] = useState<VendorStatus>('new');
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);

  // Cleanup
  useEffect(() => {
    if (initialVendorData) {
      processVendorData(initialVendorData);
      setLoading(false);
    } else if (vendorId) {
      checkVendorStatus();
    } else {
      setStatus('new');
      setLoading(false);
    }

    return () => {
      // Cleanup
    };
  }, [vendorId, phone, initialVendorData]);

  const processVendorData = (vendor: any) => {
    setVendorData(vendor);

    if (vendor.status === 'submitted' || vendor.status === 'pending') {
      setStatus('pending');
    } else if (vendor.status === 'approved') {
      if (vendor.isActive) {
        setStatus('active');
      } else if (vendor.setupCompleted) {
        setStatus('setup_completed');
      } else if (vendor.servicesConfigured) {
        setStatus('approved_availability');
      } else {
        setStatus('approved_services');
      }
    } else if (vendor.status === 'rejected') {
      setStatus('rejected');
    } else if (vendor.status === 'clarification_requested') {
      setStatus('clarification');
    } else {
      setStatus('new');
    }
  };

  const checkVendorStatus = async () => {
    try {
      setLoading(true);
      const statusData = await VendorApi.getStatus(phone);
      
      if (statusData.hasApplication && statusData.vendorId) {
        const vendor = await VendorApi.getProfile(statusData.vendorId);
        processVendorData(vendor.vendor || vendor);
      } else {
        setStatus('new');
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
      setStatus('new');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Render based on status
  return (
    <GradientBackground variant="orange">
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {status === 'new' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="info" size={100} />
              <Text style={styles.statusTitle}>Welcome to Warmpawz!</Text>
              <Text style={styles.statusDescription}>
                You're new here. Let's get you started by selecting your vendor role.
              </Text>
            </View>
          )}

          {status === 'submitted' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="checkmark" size={100} />
              <Text style={styles.statusTitle}>Application Submitted!</Text>
              <Text style={styles.statusDescription}>
                Your vendor application has been submitted successfully. Our team will review it and get back to you within 24-48 hours.
              </Text>
            </View>
          )}

          {status === 'pending' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="clock" size={100} />
              <Text style={styles.statusTitle}>Application Under Review</Text>
              <Text style={styles.statusDescription}>
                Your application is being reviewed by our admin team. This usually takes 24-48 hours.
              </Text>
            </View>
          )}

          {status === 'approved_services' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="checkmark" size={100} backgroundColor={colors.success} />
              <Text style={styles.statusTitle}>Application Approved!</Text>
              <Text style={styles.statusDescription}>
                Great news! Your application has been approved. Now let's set up your services.
              </Text>
            </View>
          )}

          {status === 'approved_availability' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="checkmark" size={100} backgroundColor={colors.success} />
              <Text style={styles.statusTitle}>Services Configured!</Text>
              <Text style={styles.statusDescription}>
                Your services are set up. Now configure your availability schedule.
              </Text>
            </View>
          )}

          {status === 'setup_completed' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="checkmark" size={100} backgroundColor={colors.success} />
              <Text style={styles.statusTitle}>Setup Complete!</Text>
              <Text style={styles.statusDescription}>
                Congratulations! Your vendor profile is complete. You're now ready to start receiving bookings.
              </Text>
            </View>
          )}

          {status === 'active' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="checkmark" size={100} backgroundColor={colors.success} />
              <Text style={styles.statusTitle}>Welcome Back!</Text>
              <Text style={styles.statusDescription}>
                Your vendor account is active. Manage your services, bookings, and more from the dashboard.
              </Text>
            </View>
          )}

          {status === 'rejected' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="error" size={100} backgroundColor={colors.error} />
              <Text style={styles.statusTitle}>Application Rejected</Text>
              <Text style={styles.statusDescription}>
                Unfortunately, your application has been rejected. Please contact support for more information.
              </Text>
            </View>
          )}

          {status === 'clarification' && (
            <View style={styles.statusTopSection}>
              <StatusIcon icon="warning" size={100} />
              <Text style={styles.statusTitle}>More Information Needed</Text>
              <Text style={styles.statusDescription}>
                We need some additional information to process your application. Please review and update your profile.
              </Text>
            </View>
          )}

          {/* Action Buttons in Branded Card */}
          {(status === 'new' || status === 'approved_services' || status === 'approved_availability' || 
            status === 'setup_completed' || status === 'active' || status === 'rejected' || status === 'clarification') && (
            <BrandedCard>
              {status === 'new' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => onNavigateToOnboarding?.('')}
                >
                  <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>
              )}

              {status === 'submitted' && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    You'll receive a notification once your application is reviewed.
                  </Text>
                </View>
              )}

              {status === 'pending' && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>
                    We'll notify you once a decision has been made.
                  </Text>
                </View>
              )}

              {status === 'approved_services' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    Alert.alert('Service Setup', 'Service management screen will open here');
                  }}
                >
                  <Text style={styles.buttonText}>Set Up Services</Text>
                </TouchableOpacity>
              )}

              {status === 'approved_availability' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    Alert.alert('Availability Setup', 'Availability screen will open here');
                  }}
                >
                  <Text style={styles.buttonText}>Set Up Availability</Text>
                </TouchableOpacity>
              )}

              {(status === 'setup_completed' || status === 'active') && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => onNavigateToDashboard?.()}
                >
                  <Text style={styles.buttonText}>Go to Dashboard</Text>
                </TouchableOpacity>
              )}

              {status === 'rejected' && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    if (onNavigate) {
                      onNavigate('Help', { vendorId });
                    } else {
                      Alert.alert('Contact Support', 'Please use the Help section in Settings to contact support.');
                    }
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Contact Support</Text>
                </TouchableOpacity>
              )}

              {status === 'clarification' && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => {
                    if (onNavigate) {
                      onNavigate('Profile', { vendorId });
                    } else {
                      Alert.alert('Update Profile', 'Please go to Settings > Profile to update your information.');
                    }
                  }}
                >
                  <Text style={styles.buttonText}>Update Profile</Text>
                </TouchableOpacity>
              )}
            </BrandedCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  statusTopSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
  statusTitle: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  statusDescription: {
    fontSize: typography.fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  infoBox: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    width: '100%',
  },
  infoText: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: {
    color: '#fff',
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
  },
});

