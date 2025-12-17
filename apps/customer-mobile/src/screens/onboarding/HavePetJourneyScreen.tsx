/**
 * Have Pet Journey Screen - Customer Mobile App
 * Matches web app CustomerHavePetJourney component exactly
 * Multi-step onboarding for existing pet owners
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface OnboardingData {
  petName: string;
  petType: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  livingSpace: {
    homeType: string;
    outdoorSpace: string;
  };
  lifestyle: {
    workSchedule: string;
    activityLevel: string;
    travelFrequency: string;
  };
  budget: string;
  healthInfo: {
    spayedNeutered: string;
    allergies: string;
    medications: string;
  };
  preferences: string[];
}

interface HavePetJourneyScreenProps {
  session: any;
  onComplete: () => void;
  navigation?: any;
}

export default function HavePetJourneyScreen({
  session,
  onComplete,
  navigation,
}: HavePetJourneyScreenProps) {
  const [currentStep, setCurrentStep] = useState(3);
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState<OnboardingData>({
    petName: '',
    petType: '',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    livingSpace: {
      homeType: '',
      outdoorSpace: '',
    },
    lifestyle: {
      workSchedule: '',
      activityLevel: '',
      travelFrequency: '',
    },
    budget: '',
    healthInfo: {
      spayedNeutered: '',
      allergies: '',
      medications: '',
    },
    preferences: [],
  });

  const [tempSelections, setTempSelections] = useState<any>({});
  const totalSteps = 12;

  const handleNext = async () => {
    const isValid = validateStep(currentStep);
    if (!isValid) return;

    // Save temp selections to main data
    if (currentStep === 3) {
      setData({
        ...data,
        livingSpace: {
          homeType: tempSelections.homeType || '',
          outdoorSpace: tempSelections.outdoorSpace || '',
        },
      });
    } else if (currentStep === 4) {
      setData({
        ...data,
        lifestyle: {
          workSchedule: tempSelections.workSchedule || '',
          activityLevel: tempSelections.activityLevel || '',
          travelFrequency: tempSelections.travelFrequency || '',
        },
      });
    } else if (currentStep === 5) {
      setData({
        ...data,
        budget: tempSelections.budget || '',
      });
    }

    if (currentStep === totalSteps) {
      await saveOnboarding(data);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
      setTempSelections({});
    }
  };

  const handleBack = () => {
    if (currentStep > 3) {
      setCurrentStep(currentStep - 1);
      setTempSelections({});
    } else if (navigation) {
      navigation.goBack();
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 3:
        return !!(tempSelections.homeType && tempSelections.outdoorSpace);
      case 4:
        return !!(tempSelections.workSchedule && tempSelections.activityLevel && tempSelections.travelFrequency);
      case 5:
        return !!tempSelections.budget;
      default:
        return Object.keys(tempSelections).length > 0;
    }
  };

  const saveOnboarding = async (onboardingData: OnboardingData) => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            phone: session.phone,
            type: 'have-pet',
            data: onboardingData,
          }),
        }
      );

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(`Failed to save onboarding data: ${responseData.error || response.statusText}`);
      }

      console.log('Onboarding data saved successfully');
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 3:
        return (
          <>
            {/* Orange Top Section */}
            <View style={styles.topSection}>
              <View style={styles.iconCircle}>
                <Icon name="home" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.topTitle]}>
                Your Living{'\n'}Space 🏡
              </Text>
            </View>

            {/* White Bottom Section */}
            <View style={styles.bottomSection}>
              <Text style={[Typography.body, styles.sectionText]}>
                Tell us about where you live
              </Text>

              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  What type of home do you have?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'apartment', emoji: '🏢', label: 'Apartment' },
                    { value: 'small-house', emoji: '🏠', label: 'Small House' },
                    { value: 'large-house', emoji: '🌳', label: 'Large House' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        tempSelections.homeType === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setTempSelections({ ...tempSelections, homeType: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <Text style={[Typography.body, styles.optionLabel]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  Do you have a yard or outdoor space?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'large-yard', emoji: '🌳', label: 'Yes, large fenced yard' },
                    { value: 'small-patio', emoji: '🪴', label: 'Yes, small yard/patio' },
                    { value: 'no-outdoor', emoji: '🏙️', label: 'No outdoor space' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        tempSelections.outdoorSpace === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setTempSelections({ ...tempSelections, outdoorSpace: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <Text style={[Typography.body, styles.optionLabel]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        );

      case 4:
        return (
          <>
            <View style={styles.topSection}>
              <View style={styles.iconCircle}>
                <Icon name="schedule" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.topTitle]}>
                Your{'\n'}Lifestyle ⭐
              </Text>
            </View>

            <View style={styles.bottomSection}>
              <Text style={[Typography.body, styles.sectionText]}>
                Help us understand your daily routine
              </Text>

              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  What's your typical work schedule?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'work-from-home', emoji: '🏠', label: 'Work from home' },
                    { value: 'away-4-6', emoji: '⏰', label: 'Away 4-6 hours/day' },
                    { value: 'away-8-plus', emoji: '💼', label: 'Away 8+ hours/day' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        tempSelections.workSchedule === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setTempSelections({ ...tempSelections, workSchedule: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <Text style={[Typography.body, styles.optionLabel]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  How would you describe your activity level?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'very-active', emoji: '🏃', label: 'Very Active (daily exercise/outdoors)' },
                    { value: 'moderate', emoji: '🚶', label: 'Moderate (regular walks/activities)' },
                    { value: 'relaxed', emoji: '🛋️', label: 'Relaxed (prefer indoor activities)' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        tempSelections.activityLevel === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setTempSelections({ ...tempSelections, activityLevel: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <Text style={[Typography.body, styles.optionLabel]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  How often do you travel?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'rarely', emoji: '🏡', label: 'Rarely or never' },
                    { value: 'few-times', emoji: '✈️', label: 'A few times a year' },
                    { value: 'monthly', emoji: '🌍', label: 'Monthly or more' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        tempSelections.travelFrequency === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setTempSelections({ ...tempSelections, travelFrequency: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <Text style={[Typography.body, styles.optionLabel]}>
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        );

      case 5:
        return (
          <>
            <View style={styles.topSection}>
              <View style={styles.iconCircle}>
                <Icon name="account-balance-wallet" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.topTitle]}>
                Budget{'\n'}Planning 💳
              </Text>
            </View>

            <View style={styles.bottomSection}>
              <Text style={[Typography.body, styles.sectionText]}>
                Let's understand the investment involved ❤️
              </Text>

              {/* Typical Costs Overview */}
              <View style={styles.infoCard}>
                <Text style={styles.infoEmoji}>💡</Text>
                <View style={styles.infoContent}>
                  <Text style={[Typography.bodySmall, styles.infoTitle]}>
                    Typical Costs Overview:
                  </Text>
                  <View style={styles.costGrid}>
                    <View style={styles.costItem}>
                      <Text style={[Typography.bodyTiny, styles.costLabel]}>Initial Setup</Text>
                      <Text style={[Typography.bodySmall, styles.costValue]}>₹20,000 - ₹50,000</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={[Typography.bodyTiny, styles.costLabel]}>Monthly Care</Text>
                      <Text style={[Typography.bodySmall, styles.costValue]}>₹3,000 - ₹12,000+</Text>
                    </View>
                  </View>
                  <Text style={[Typography.bodyTiny, styles.costNote]}>
                    Includes food, vet care, supplies & grooming
                  </Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  What's your comfortable monthly budget?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: '3000-6000', emoji: '💚', label: '₹3,000 - ₹6,000/month', desc: 'Essential care & basic needs' },
                    { value: '6000-12000', emoji: '⭐', label: '₹6,000 - ₹12,000/month', desc: 'Good care with extra comfort' },
                    { value: '12000-plus', emoji: '👑', label: '₹12,000+/month', desc: 'Comprehensive & premium services' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        tempSelections.budget === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setTempSelections({ ...tempSelections, budget: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <View style={styles.optionTextContainer}>
                          <Text style={[Typography.body, styles.optionLabel]}>
                            {option.label}
                          </Text>
                          <Text style={[Typography.bodyTiny, styles.optionDesc]}>
                            {option.desc}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Pro Tip */}
              <View style={styles.proTipCard}>
                <Text style={styles.infoEmoji}>💡</Text>
                <View style={styles.infoContent}>
                  <Text style={[Typography.bodySmall, styles.infoTitle]}>
                    Pro Tip: Keep an emergency fund
                  </Text>
                  <Text style={[Typography.bodyTiny, styles.infoList]}>
                    Save ₹15,000 - ₹50,000 for unexpected vet emergencies
                  </Text>
                </View>
              </View>
            </View>
          </>
        );

      default:
        return (
          <>
            <View style={styles.topSection}>
              <View style={styles.iconCircle}>
                <Icon name="pets" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.topTitle]}>
                Step {currentStep}
              </Text>
            </View>
            <View style={styles.bottomSection}>
              <Text style={[Typography.body, styles.sectionText]}>
                Coming soon...
              </Text>
            </View>
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BrandColors.primary.orange} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {/* Progress and Navigation - Fixed at bottom */}
      <View style={styles.navigationContainer}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <TouchableOpacity
            onPress={handleBack}
            disabled={currentStep === 3}
            style={[styles.backButtonNav, currentStep === 3 && styles.backButtonDisabled]}
          >
            <Icon name="chevron-left" size={20} color={currentStep === 3 ? BrandColors.neutral.gray400 : BrandColors.neutral.black} />
          </TouchableOpacity>
          
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]}
            />
          </View>
          
          <Text style={[Typography.bodySmall, styles.progressText]}>
            Step {currentStep}/{totalSteps}
          </Text>
        </View>

        {/* Continue Button */}
        <BrandedButton
          title={loading ? 'Saving...' : 'Continue'}
          onPress={handleNext}
          disabled={loading || !validateStep(currentStep)}
          fullWidth
        />

        {/* Home Indicator */}
        <View style={styles.homeIndicator}>
          <View style={styles.homeIndicatorBar} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.primary.orange,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 200, // Space for fixed navigation
  },
  topSection: {
    alignItems: 'center',
    paddingTop: Spacing.xl + 20,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: BrandColors.primary.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  topTitle: {
    color: BrandColors.neutral.black,
    textAlign: 'center',
  },
  bottomSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  sectionText: {
    color: BrandColors.neutral.black,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: BrandColors.neutral.black,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
  },
  optionButtonSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: '#FED7AA',
  },
  optionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 24,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    color: BrandColors.neutral.black,
    fontWeight: '600',
  },
  optionDesc: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.xs,
  },
  infoCard: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  infoEmoji: {
    fontSize: 20,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    color: '#1E3A8A',
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  infoList: {
    color: '#1E40AF',
    lineHeight: 18,
  },
  costGrid: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginTop: Spacing.sm,
  },
  costItem: {
    flex: 1,
  },
  costLabel: {
    color: '#1E40AF',
  },
  costValue: {
    color: '#1E3A8A',
    fontWeight: '600',
  },
  costNote: {
    color: '#1E40AF',
    marginTop: Spacing.xs,
  },
  proTipCard: {
    backgroundColor: '#FED7AA',
    borderWidth: 2,
    borderColor: '#FDBA74',
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl + 20 : Spacing.xl,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  backButtonNav: {
    padding: Spacing.sm,
  },
  backButtonDisabled: {
    opacity: 0.3,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: BrandColors.neutral.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 4,
  },
  progressText: {
    color: BrandColors.neutral.gray600,
    minWidth: 80,
    textAlign: 'right',
  },
  homeIndicator: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  homeIndicatorBar: {
    width: 128,
    height: 4,
    backgroundColor: BrandColors.neutral.black,
    borderRadius: 2,
  },
});

