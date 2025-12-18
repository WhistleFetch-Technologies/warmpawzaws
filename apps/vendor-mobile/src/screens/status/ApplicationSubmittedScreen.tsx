/**
 * Application Submitted Screen - Vendor Mobile App
 * Matches web app VendorApplicationSubmitted component
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface ApplicationSubmittedScreenProps {
  route?: {
    params?: {
      applicationId?: string;
    };
  };
  navigation?: any;
}

export default function ApplicationSubmittedScreen({
  route,
  navigation,
}: ApplicationSubmittedScreenProps) {
  const applicationId = route?.params?.applicationId || 'N/A';

  const handleContinue = () => {
    // Navigation will be handled by App.tsx based on vendor status
    if (navigation) {
      navigation.navigate('MainTabs');
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
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon name="check-circle" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={[Typography.h1, styles.title]}>
            Application{'\n'}Submitted!
          </Text>

          {/* Card */}
          <View style={styles.card}>
            {/* Status Message */}
            <Text style={[Typography.body, styles.statusMessage]}>
              We're reviewing{'\n'}your application
            </Text>

            {/* What's Next Section */}
            <View style={styles.nextStepsContainer}>
              <Text style={[Typography.h4, styles.nextStepsTitle]}>
                What's Next?
              </Text>
              
              <View style={styles.stepsList}>
                <View style={styles.stepItem}>
                  <Text style={styles.stepText}>
                    • Our team will review your application
                  </Text>
                </View>
                <View style={styles.stepItem}>
                  <Text style={styles.stepText}>
                    • You'll receive an update within 24-48 hours
                  </Text>
                </View>
                <View style={styles.stepItem}>
                  <Text style={styles.stepText}>
                    • We may contact you for additional information
                  </Text>
                </View>
              </View>
            </View>

            {/* Continue Button */}
            <BrandedButton
              title="Continue to Dashboard"
              onPress={handleContinue}
              fullWidth
            />

            {/* Application ID */}
            <View style={styles.applicationIdContainer}>
              <Text style={[Typography.bodyTiny, styles.applicationIdLabel]}>
                Application ID #{applicationId}
              </Text>
              <Text style={[Typography.bodyTiny, styles.applicationIdHint]}>
                Keep this ID for your records
              </Text>
            </View>

            {/* Welcome Message */}
            <Text style={[Typography.bodySmall, styles.welcomeMessage]}>
              Welcome to WARMPAWZ Family 🐾
            </Text>
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: BrandColors.neutral.gray900,
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
  statusMessage: {
    color: BrandColors.neutral.gray700,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  nextStepsContainer: {
    backgroundColor: BrandColors.primary.orange + '15',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base + 4,
    marginBottom: Spacing.xl,
  },
  nextStepsTitle: {
    color: BrandColors.primary.orange,
    marginBottom: Spacing.base,
  },
  stepsList: {
    gap: Spacing.sm,
  },
  stepItem: {
    marginBottom: Spacing.xs,
  },
  stepText: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
  },
  applicationIdContainer: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    alignItems: 'center',
  },
  applicationIdLabel: {
    color: BrandColors.neutral.gray500,
    marginBottom: Spacing.xs,
  },
  applicationIdHint: {
    color: BrandColors.neutral.gray400,
  },
  welcomeMessage: {
    color: BrandColors.neutral.gray500,
    textAlign: 'center',
    marginTop: Spacing.base,
  },
});

