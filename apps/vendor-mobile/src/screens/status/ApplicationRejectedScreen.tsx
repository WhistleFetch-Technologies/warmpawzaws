/**
 * Application Rejected Screen - Vendor Mobile App
 * Matches web app VendorApplicationRejected component
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

interface ApplicationRejectedScreenProps {
  route?: {
    params?: {
      applicationId?: string;
      reason?: string;
    };
  };
  navigation?: any;
}

export default function ApplicationRejectedScreen({
  route,
  navigation,
}: ApplicationRejectedScreenProps) {
  const applicationId = route?.params?.applicationId || 'N/A';
  const reason = route?.params?.reason || 'Your application did not meet our requirements.';

  const handleResubmit = () => {
    if (navigation) {
      navigation.navigate('Onboarding', {
        applicationId,
        mode: 'resubmit',
      });
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
              <Icon name="cancel" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={[Typography.h1, styles.title]}>
            Application{'\n'}Rejected
          </Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={[Typography.body, styles.message]}>
              Unfortunately, your application has been rejected at this time.
            </Text>

            {/* Reason Section */}
            {reason && (
              <View style={styles.reasonContainer}>
                <Text style={[Typography.h4, styles.reasonTitle]}>
                  Reason
                </Text>
                <View style={styles.reasonBox}>
                  <Text style={[Typography.bodySmall, styles.reasonText]}>
                    {reason}
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <BrandedButton
                title="Resubmit Application"
                onPress={handleResubmit}
                fullWidth
                variant="primary"
              />
              <BrandedButton
                title="Contact Support"
                onPress={() => {
                  // Navigate to support/help
                }}
                fullWidth
                variant="outline"
              />
            </View>

            <View style={styles.applicationIdContainer}>
              <Text style={[Typography.bodyTiny, styles.applicationIdLabel]}>
                Application ID #{applicationId}
              </Text>
            </View>
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
    backgroundColor: BrandColors.semantic.error,
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
  message: {
    color: BrandColors.neutral.gray700,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  reasonContainer: {
    marginBottom: Spacing.xl,
  },
  reasonTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  reasonBox: {
    backgroundColor: BrandColors.semantic.error + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.semantic.error,
  },
  reasonText: {
    color: BrandColors.neutral.gray700,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: Spacing.base,
    marginBottom: Spacing.base,
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
  },
});

