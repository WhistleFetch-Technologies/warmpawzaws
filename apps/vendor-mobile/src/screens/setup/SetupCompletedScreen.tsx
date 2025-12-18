/**
 * Setup Completed Screen - Vendor Mobile App
 * Matches web app VendorSetupCompleted component
 * Final setup stage
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

interface SetupCompletedScreenProps {
  navigation?: any;
}

export default function SetupCompletedScreen({ navigation }: SetupCompletedScreenProps) {
  const handleContinue = () => {
    if (navigation) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
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
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon name="check-circle" size={64} color="#FFFFFF" />
            </View>
          </View>

          {/* Title */}
          <Text style={[Typography.h1, styles.title]}>
            Setup{'\n'}Complete!
          </Text>
          <Text style={[Typography.body, styles.subtitle]}>
            You're all set to start accepting bookings
          </Text>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.successSteps}>
              <View style={styles.successStep}>
                <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
                <Text style={[Typography.body, styles.successStepText]}>
                  Services configured
                </Text>
              </View>
              <View style={styles.successStep}>
                <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
                <Text style={[Typography.body, styles.successStepText]}>
                  Availability set
                </Text>
              </View>
              <View style={styles.successStep}>
                <Icon name="check-circle" size={24} color={BrandColors.semantic.success} />
                <Text style={[Typography.body, styles.successStepText]}>
                  Ready to serve customers
                </Text>
              </View>
            </View>

            <BrandedButton
              title="Go to Dashboard"
              onPress={handleContinue}
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
    width: 128,
    height: 128,
    borderRadius: 64,
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
  successSteps: {
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  successStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  successStepText: {
    color: BrandColors.neutral.gray700,
  },
});

