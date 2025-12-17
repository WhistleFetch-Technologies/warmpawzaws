/**
 * Onboarding Screen - Customer Mobile App
 * Matches web app CustomerOnboarding component exactly
 * Stage selection: Planning, Have Pet, End of Life
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface OnboardingScreenProps {
  onComplete: (stage: string) => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedStage) {
      onComplete(selectedStage);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BrandColors.primary.orange} />
      
      {/* Orange Top Section */}
      <View style={styles.topSection}>
        {/* Paw Logo with Heart */}
        <View style={styles.logoContainer}>
          <View style={styles.pawLogo}>
            {/* Main paw pad */}
            <View style={styles.pawPad} />
            {/* Heart in center */}
            <View style={styles.heart} />
            {/* Toes */}
            <View style={[styles.toe, styles.toeTopLeft]} />
            <View style={[styles.toe, styles.toeTopCenterLeft]} />
            <View style={[styles.toe, styles.toeTopCenterRight]} />
            <View style={[styles.toe, styles.toeTopRight]} />
          </View>
        </View>
        
        <Text style={[Typography.h1, styles.title]}>
          Choose Your{'\n'}Stage
        </Text>
      </View>

      {/* White Bottom Section */}
      <View style={styles.bottomSection}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            Choose your journey to get{'\n'}
            personalized support 💖🐕🐈
          </Text>

          {/* Journey Stage Cards */}
          <View style={styles.cardsContainer}>
            {/* Planning to Get a Pet */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedStage === 'planning' && styles.cardSelectedBlue,
              ]}
              onPress={() => setSelectedStage('planning')}
              activeOpacity={0.8}
            >
              <View style={styles.cardContent}>
                {/* Blue Icon */}
                <View style={[styles.iconContainer, styles.iconBlue]}>
                  <Icon name="star" size={24} color="#FFFFFF" />
                </View>

                {/* Content */}
                <View style={styles.cardTextContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={[Typography.h4, styles.cardTitle]}>
                      Planning to Get a Pet
                    </Text>
                    <Icon name="chevron-right" size={20} color={BrandColors.neutral.gray400} />
                  </View>
                  <Text style={[Typography.bodyTiny, styles.cardDescription]}>
                    Find your perfect match! Get expert guidance on breeds, adoption, preparation, and bringing home your new best friend 🐾💙
                  </Text>
                  
                  {/* Badge */}
                  <View style={styles.badgeContainer}>
                    <View style={[styles.badge, styles.badgeBlue]}>
                      <Text style={[Typography.bodyTiny, styles.badgeText, styles.badgeTextBlue]}>
                        Start Your Journey
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* Already Have a Pet */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedStage === 'have-pet' && styles.cardSelectedGreen,
              ]}
              onPress={() => setSelectedStage('have-pet')}
              activeOpacity={0.8}
            >
              <View style={styles.cardContent}>
                {/* Green Icon */}
                <View style={[styles.iconContainer, styles.iconGreen]}>
                  <Icon name="pets" size={24} color="#FFFFFF" />
                </View>

                {/* Content */}
                <View style={styles.cardTextContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={[Typography.h4, styles.cardTitle]}>
                      Already Have a Pet
                    </Text>
                    <Icon name="chevron-right" size={20} color={BrandColors.neutral.gray400} />
                  </View>
                  <Text style={[Typography.bodyTiny, styles.cardDescription]}>
                    Complete pet care hub! Track health records, schedule vet visits, manage medications, log activities, and celebrate your bond 💚🐾
                  </Text>
                  
                  {/* Progress Bar */}
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                      <View style={[styles.progressBarFill, styles.progressBarGreen]} />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            {/* End of Life Care */}
            <TouchableOpacity
              style={[
                styles.card,
                selectedStage === 'end-of-life' && styles.cardSelectedPurple,
              ]}
              onPress={() => setSelectedStage('end-of-life')}
              activeOpacity={0.8}
            >
              <View style={styles.cardContent}>
                {/* Purple Icon */}
                <View style={[styles.iconContainer, styles.iconPurple]}>
                  <Icon name="favorite" size={24} color="#FFFFFF" />
                </View>

                {/* Content */}
                <View style={styles.cardTextContainer}>
                  <View style={styles.cardHeader}>
                    <Text style={[Typography.h4, styles.cardTitle]}>
                      End of Life Care
                    </Text>
                    <Icon name="chevron-right" size={20} color={BrandColors.neutral.gray400} />
                  </View>
                  <Text style={[Typography.bodyTiny, styles.cardDescription]}>
                    Compassionate support with quality of life guidance, hospice care, sunset services, memorial options, and grief counseling 🌈💜
                  </Text>
                  
                  {/* Badge */}
                  <View style={styles.badgeContainer}>
                    <View style={[styles.badge, styles.badgePurple]}>
                      <Text style={[Typography.bodyTiny, styles.badgeText, styles.badgeTextPurple]}>
                        Manage care
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer Message */}
          <View style={styles.footerMessage}>
            <Text style={[Typography.bodySmall, styles.footerText]}>
              🐾💕🐾{'\n'}
              Every pet deserves love and the best care
            </Text>
          </View>

          {/* Continue Button */}
          <BrandedButton
            title="Continue"
            onPress={handleContinue}
            disabled={!selectedStage}
            fullWidth
          />

          {/* Footer Text */}
          <Text style={[Typography.bodyTiny, styles.copyrightText]}>
            Trusted by 15,000+ pet professionals worldwide{'\n'}
            © 2025 WARMPAWZ Inc. All rights reserved
          </Text>
        </ScrollView>
      </View>

      {/* Home Indicator (iOS) */}
      <View style={styles.homeIndicator}>
        <View style={styles.homeIndicatorBar} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.primary.orange,
  },
  topSection: {
    paddingTop: Spacing.xl + 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  logoContainer: {
    width: 128,
    height: 128,
    marginBottom: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawLogo: {
    width: 120,
    height: 120,
    position: 'relative',
  },
  pawPad: {
    position: 'absolute',
    width: 66,
    height: 78,
    borderRadius: 33,
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -33,
  },
  heart: {
    position: 'absolute',
    width: 24,
    height: 24,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 12,
    bottom: 30,
    left: '50%',
    marginLeft: -12,
    transform: [{ rotate: '45deg' }],
  },
  toe: {
    position: 'absolute',
    width: 30,
    height: 42,
    borderRadius: 15,
    backgroundColor: BrandColors.neutral.black,
  },
  toeTopLeft: {
    top: 15,
    left: 15,
    transform: [{ rotate: '-15deg' }],
  },
  toeTopCenterLeft: {
    top: 0,
    left: 30,
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterRight: {
    top: 0,
    right: 30,
    transform: [{ rotate: '5deg' }],
  },
  toeTopRight: {
    top: 15,
    right: 15,
    transform: [{ rotate: '15deg' }],
  },
  title: {
    color: BrandColors.neutral.black,
    textAlign: 'center',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: Spacing.xl,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  subtitle: {
    color: BrandColors.neutral.gray700,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  cardsContainer: {
    gap: Spacing.base,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
  },
  cardSelectedBlue: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  cardSelectedGreen: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  cardSelectedPurple: {
    borderColor: '#9B59B6',
    backgroundColor: '#F5F3FF',
  },
  cardContent: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBlue: {
    backgroundColor: '#3B82F6',
  },
  iconGreen: {
    backgroundColor: '#10B981',
  },
  iconPurple: {
    backgroundColor: '#9B59B6',
  },
  cardTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    color: BrandColors.neutral.black,
    flex: 1,
  },
  cardDescription: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  badgeContainer: {
    marginTop: Spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.base,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  badgeBlue: {
    backgroundColor: '#DBEAFE',
    borderColor: '#93C5FD',
  },
  badgePurple: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  badgeText: {
    fontWeight: '600',
  },
  badgeTextBlue: {
    color: '#1E40AF',
  },
  badgeTextPurple: {
    color: '#6B21A8',
  },
  progressBarContainer: {
    marginTop: Spacing.sm,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: BrandColors.neutral.gray200,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    width: '70%',
    borderRadius: BorderRadius.full,
  },
  progressBarGreen: {
    backgroundColor: '#10B981',
  },
  footerMessage: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  footerText: {
    color: BrandColors.neutral.gray700,
    textAlign: 'center',
    lineHeight: 20,
  },
  copyrightText: {
    color: BrandColors.neutral.gray500,
    textAlign: 'center',
    marginTop: Spacing.lg,
    lineHeight: 16,
  },
  homeIndicator: {
    alignItems: 'center',
    paddingVertical: Spacing.base,
    backgroundColor: '#FFFFFF',
  },
  homeIndicatorBar: {
    width: 128,
    height: 4,
    backgroundColor: BrandColors.neutral.black,
    borderRadius: 2,
  },
});

