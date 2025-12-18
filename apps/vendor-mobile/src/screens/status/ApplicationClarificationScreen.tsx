/**
 * Application Clarification Screen - Vendor Mobile App
 * Matches web app VendorClarificationRequested component
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

interface ApplicationClarificationScreenProps {
  route?: {
    params?: {
      applicationId?: string;
      notes?: string;
    };
  };
  navigation?: any;
}

export default function ApplicationClarificationScreen({
  route,
  navigation,
}: ApplicationClarificationScreenProps) {
  const applicationId = route?.params?.applicationId || 'N/A';
  const notes = route?.params?.notes || 'Please update your application with the requested information.';

  const handleCorrectAndResubmit = () => {
    if (navigation) {
      navigation.navigate('Onboarding', {
        applicationId,
        mode: 'clarification',
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
              <Icon name="info" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={[Typography.h1, styles.title]}>
            Clarification{'\n'}Required
          </Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={[Typography.body, styles.message]}>
              We need some additional information to complete your application review.
            </Text>

            {/* Notes Section */}
            <View style={styles.notesContainer}>
              <Text style={[Typography.h4, styles.notesTitle]}>
                Requested Information
              </Text>
              <View style={styles.notesBox}>
                <Text style={[Typography.bodySmall, styles.notesText]}>
                  {notes}
                </Text>
              </View>
            </View>

            {/* Action Button */}
            <BrandedButton
              title="Update Application"
              onPress={handleCorrectAndResubmit}
              fullWidth
            />

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
    backgroundColor: BrandColors.semantic.info,
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
  notesContainer: {
    marginBottom: Spacing.xl,
  },
  notesTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  notesBox: {
    backgroundColor: BrandColors.semantic.info + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.semantic.info,
  },
  notesText: {
    color: BrandColors.neutral.gray700,
    lineHeight: 20,
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

