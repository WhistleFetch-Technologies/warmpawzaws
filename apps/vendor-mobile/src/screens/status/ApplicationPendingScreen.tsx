/**
 * Application Pending Screen - Vendor Mobile App
 * Matches web app VendorApplicationUnderReview component
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
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function ApplicationPendingScreen() {
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
              <Icon name="hourglass-empty" size={48} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={[Typography.h1, styles.title]}>
            Under Review
          </Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={[Typography.body, styles.message]}>
              Your application is currently being reviewed by our team.
            </Text>

            <View style={styles.infoContainer}>
              <Text style={[Typography.h4, styles.infoTitle]}>
                Review Process
              </Text>
              
              <View style={styles.infoList}>
                <View style={styles.infoItem}>
                  <Icon name="check-circle" size={20} color={BrandColors.semantic.success} />
                  <Text style={styles.infoText}>
                    Application received and logged
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Icon name="schedule" size={20} color={BrandColors.primary.orange} />
                  <Text style={styles.infoText}>
                    Review in progress
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Icon name="notifications" size={20} color={BrandColors.semantic.info} />
                  <Text style={styles.infoText}>
                    You'll be notified when complete
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineContainer}>
              <Text style={[Typography.bodySmall, styles.timelineText]}>
                Expected review time: 24-48 hours
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
    backgroundColor: BrandColors.semantic.warning,
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
  infoContainer: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base + 4,
    marginBottom: Spacing.base,
  },
  infoTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  infoList: {
    gap: Spacing.base,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.bodySmall,
    color: BrandColors.neutral.gray700,
    flex: 1,
  },
  timelineContainer: {
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
  },
  timelineText: {
    color: BrandColors.neutral.gray600,
    textAlign: 'center',
  },
});

