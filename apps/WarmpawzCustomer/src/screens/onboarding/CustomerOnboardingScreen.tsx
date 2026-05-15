/**
 * Customer Onboarding Screen
 * Choose journey stage - Identical to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { ScreenShell } from '../../components/layout/ScreenShell';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface CustomerOnboardingScreenProps {
  onComplete: (stage: 'planning' | 'have-pet' | 'end-of-life') => void;
}

export function CustomerOnboardingScreen({ phone, customerId, onComplete }: CustomerOnboardingScreenProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      setSelectedStage(null);
    };
  }, []);

  const handleSelect = async (stage: string) => {
    setSelectedStage(stage);
    
    // ✅ API Integration: Save onboarding status
    if (customerId || phone) {
      try {
        await CustomerApi.updateOnboardingStatus(customerId || phone!, stage, {
          selectedStage: stage,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error saving onboarding status:', error);
        // Continue even if API call fails
      }
    }
    
    // Auto-proceed after selection
    setTimeout(() => {
      onComplete(stage as 'planning' | 'have-pet' | 'end-of-life');
    }, 300);
  };

  return (
    <ScreenShell style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Orange Top Section */}
        <View style={styles.topSection}>
          {/* Paw Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          
          <Text style={styles.title}>Choose Your{'\n'}Stage</Text>
        </View>

        {/* White Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.subtitle}>
            Choose your journey to get{'\n'}
            personalized support 💖🐕🐈
          </Text>

          {/* Journey Stage Cards */}
          <View style={styles.cardsContainer}>
            {/* Planning to Get a Pet */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedStage === 'planning' && styles.cardSelected
              ]}
              onPress={() => handleSelect('planning')}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <View style={[styles.iconContainer, styles.blueIcon]}>
                  <Text style={styles.iconEmoji}>⭐</Text>
                </View>
                <View style={styles.cardText}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Planning to Get a Pet</Text>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                  <Text style={styles.cardDescription}>
                    Find your perfect match! Get expert guidance on breeds, adoption, preparation, and bringing home your new best friend 🐾💙
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Start Your Journey</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Already Have a Pet */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedStage === 'have-pet' && styles.cardSelectedGreen
              ]}
              onPress={() => handleSelect('have-pet')}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <View style={[styles.iconContainer, styles.greenIcon]}>
                  <Text style={styles.iconEmoji}>🐕</Text>
                </View>
                <View style={styles.cardText}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Already Have a Pet</Text>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                  <Text style={styles.cardDescription}>
                    Complete pet care hub! Track health records, schedule vet visits, manage medications, log activities, and celebrate your bond 💚🐾
                  </Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: '70%' }]} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* End of Life Care */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedStage === 'end-of-life' && styles.cardSelectedPurple
              ]}
              onPress={() => handleSelect('end-of-life')}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <View style={[styles.iconContainer, styles.purpleIcon]}>
                  <Text style={styles.iconEmoji}>💜</Text>
                </View>
                <View style={styles.cardText}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>End of Life Care</Text>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                  <Text style={styles.cardDescription}>
                    Compassionate support during difficult times. Access palliative care, memorial services, grief counseling, and honor your pet's memory 💜🕯️
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Get Support</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: typography.fontSizes['4xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  subtitle: {
    fontSize: typography.fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  cardsContainer: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  cardSelectedGreen: {
    borderColor: colors.success,
    backgroundColor: '#f0fdf4',
  },
  cardSelectedPurple: {
    borderColor: '#8b5cf6',
    backgroundColor: '#faf5ff',
  },
  cardContent: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueIcon: {
    backgroundColor: '#3b82f6',
  },
  greenIcon: {
    backgroundColor: colors.success,
  },
  purpleIcon: {
    backgroundColor: '#8b5cf6',
  },
  iconEmoji: {
    fontSize: 24,
  },
  cardText: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.text,
  },
  arrow: {
    fontSize: typography.fontSizes.lg,
    color: colors.textMuted,
  },
  cardDescription: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: '#93c5fd',
    backgroundColor: '#dbeafe',
  },
  badgeText: {
    fontSize: typography.fontSizes.xs,
    color: '#1e40af',
    fontWeight: typography.fontWeights.medium,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: borderRadius.full,
  },
});

