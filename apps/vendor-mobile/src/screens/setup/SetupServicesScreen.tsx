/**
 * Setup Services Screen - Vendor Mobile App
 * Matches web app VendorApprovedSetup component
 * Stage 1: Service configuration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SetupServicesScreenProps {
  route?: {
    params?: {
      vendorId?: string;
      roleId?: string;
    };
  };
  navigation?: any;
}

export default function SetupServicesScreen({
  route,
  navigation,
}: SetupServicesScreenProps) {
  const vendorId = route?.params?.vendorId || '';
  const roleId = route?.params?.roleId;
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/setup/complete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vendorId,
            setupStage: 'availability_pending',
          }),
        }
      );

      if (response.ok) {
        if (navigation) {
          navigation.navigate('SetupAvailability', { vendorId });
        }
      } else {
        throw new Error('Failed to complete service setup');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon name="check-circle" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={[Typography.h1, styles.title]}>
            You're{'\n'}Approved!
          </Text>
          <Text style={[Typography.body, styles.subtitle]}>
            Welcome to WARMPAWZ!
          </Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={[Typography.h3, styles.cardTitle]}>
              What happens next?
            </Text>

            <View style={styles.stepsContainer}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[Typography.h4, styles.stepTitle]}>
                    Configure Services
                  </Text>
                  <Text style={[Typography.bodySmall, styles.stepDescription]}>
                    Set up your service offerings and pricing
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[Typography.h4, styles.stepTitle]}>
                    Set Availability
                  </Text>
                  <Text style={[Typography.bodySmall, styles.stepDescription]}>
                    Define your working hours and schedule
                  </Text>
                </View>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={[Typography.h4, styles.stepTitle]}>
                    Start Accepting Bookings
                  </Text>
                  <Text style={[Typography.bodySmall, styles.stepDescription]}>
                    You're all set to serve customers!
                  </Text>
                </View>
              </View>
            </View>

            <BrandedButton
              title={loading ? 'Setting up...' : 'Get Started'}
              onPress={handleComplete}
              disabled={loading}
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: BrandColors.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    color: BrandColors.neutral.gray900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: BrandColors.neutral.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 430,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    color: BrandColors.neutral.gray900,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  stepsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  stepItem: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.orange + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  stepDescription: {
    color: BrandColors.neutral.gray600,
    lineHeight: 20,
  },
});

