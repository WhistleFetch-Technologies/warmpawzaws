/**
 * Planning Journey Screen - Customer Mobile App
 * Matches web app CustomerPlanningJourney component exactly
 * Multi-step questionnaire for planning to get a pet
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

interface QuestionnaireData {
  timeCommitment: string;
  children: string;
  otherPets: string;
  allergies: string;
  dogSize: string;
  energyLevel: string;
  importantTraits: string[];
  selectedBreeds: string[];
  comparedBreeds: string[];
}

interface PlanningJourneyScreenProps {
  session: any;
  onComplete: () => void;
  navigation?: any;
}

export default function PlanningJourneyScreen({
  session,
  onComplete,
  navigation,
}: PlanningJourneyScreenProps) {
  const [currentStep, setCurrentStep] = useState(6);
  const [loading, setLoading] = useState(false);
  
  const [data, setData] = useState<QuestionnaireData>({
    timeCommitment: '',
    children: '',
    otherPets: '',
    allergies: '',
    dogSize: '',
    energyLevel: '',
    importantTraits: [],
    selectedBreeds: [],
    comparedBreeds: [],
  });

  const totalSteps = 12;

  const handleNext = async () => {
    if (!isStepValid()) return;

    if (currentStep === 11) {
      await saveQuestionnaire(data);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 6) {
      setCurrentStep(currentStep - 1);
    } else if (navigation) {
      navigation.goBack();
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 6: return !!data.timeCommitment;
      case 7: return !!(data.children && data.otherPets && data.allergies);
      case 8: return !!(data.dogSize && data.energyLevel);
      case 9: return true; // Skippable step
      case 10: return data.selectedBreeds.length > 0;
      case 11: return true; // Final comparison step
      default: return true;
    }
  };

  const saveQuestionnaire = async (questionnaireData: QuestionnaireData) => {
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
            type: 'planning',
            data: questionnaireData,
          }),
        }
      );

      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(`Failed to save questionnaire: ${responseData.error || response.statusText}`);
      }

      console.log('Questionnaire saved successfully');
    } catch (error) {
      console.error('Error saving questionnaire:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 6:
        return (
          <>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.pawLogo}>
                <View style={styles.pawPad} />
                <View style={styles.heart} />
                <View style={[styles.toe, styles.toeTopLeft]} />
                <View style={[styles.toe, styles.toeTopCenterLeft]} />
                <View style={[styles.toe, styles.toeTopCenterRight]} />
                <View style={[styles.toe, styles.toeTopRight]} />
              </View>
            </View>

            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.iconCircle}>
                <Icon name="schedule" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.iconTitle]}>
                Time{'\n'}Commitment ⏱️
              </Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={[Typography.bodySmall, styles.contentText]}>
                Pets need daily attention and care 💕
              </Text>

              {/* Info Card */}
              <View style={styles.infoCard}>
                <Text style={styles.infoEmoji}>⏰</Text>
                <View style={styles.infoContent}>
                  <Text style={[Typography.bodySmall, styles.infoTitle]}>
                    Daily time needs (average):
                  </Text>
                  <Text style={[Typography.bodyTiny, styles.infoList]}>
                    • Feeding & water: 15-30 min{'\n'}
                    • Exercise/play: 30-120 min{'\n'}
                    • Grooming: 10-30 min{'\n'}
                    • Training/bonding: 15-45 min
                  </Text>
                </View>
              </View>

              <Text style={[Typography.bodySmall, styles.questionText]}>
                How much time can you dedicate daily?
              </Text>

              <View style={styles.optionsContainer}>
                {[
                  { value: '1-2-hours', label: '1-2 hours per day', desc: 'Basic care & short activities' },
                  { value: '2-4-hours', label: '2-4 hours per day', desc: 'Good care & regular activities' },
                  { value: '4-plus-hours', label: '4+ hours per day', desc: 'Lots of time for bonding & training' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      data.timeCommitment === option.value && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, timeCommitment: option.value })}
                  >
                    <Text style={[Typography.body, styles.optionLabel]}>
                      {option.label}
                    </Text>
                    <Text style={[Typography.bodyTiny, styles.optionDesc]}>
                      {option.desc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 7:
        return (
          <>
            <View style={styles.logoContainer}>
              <View style={styles.pawLogo}>
                <View style={styles.pawPad} />
                <View style={styles.heart} />
                <View style={[styles.toe, styles.toeTopLeft]} />
                <View style={[styles.toe, styles.toeTopCenterLeft]} />
                <View style={[styles.toe, styles.toeTopCenterRight]} />
                <View style={[styles.toe, styles.toeTopRight]} />
              </View>
            </View>

            <View style={styles.iconSection}>
              <View style={styles.iconCircle}>
                <Icon name="people" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.iconTitle]}>
                Your{'\n'}Household 👨‍👩‍👧
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={[Typography.body, styles.questionText]}>
                Important factors for choosing the right pet
              </Text>

              {/* Children */}
              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  Do you have children at home?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'no-children', label: 'No children' },
                    { value: 'young-children', label: 'Yes, young children (under 6)' },
                    { value: 'older-children', label: 'Yes, older children (6+)' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButtonSmall,
                        data.children === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setData({ ...data, children: option.value })}
                    >
                      <Text style={[Typography.bodySmall, styles.optionLabel]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Other Pets */}
              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  Do you have other pets?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'no-other-pets', label: 'No other pets' },
                    { value: 'have-dogs', label: 'Yes, I have dog(s)' },
                    { value: 'have-cats', label: 'Yes, I have cat(s)' },
                    { value: 'other-animals', label: 'Yes, other animals' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButtonSmall,
                        data.otherPets === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setData({ ...data, otherPets: option.value })}
                    >
                      <Text style={[Typography.bodySmall, styles.optionLabel]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Allergies */}
              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  Any allergies in your household?
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'no-allergies', label: 'No allergies' },
                    { value: 'mild-allergies', label: 'Mild allergies (manageable)' },
                    { value: 'severe-allergies', label: 'Severe allergies (need hypoallergenic)' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButtonSmall,
                        data.allergies === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setData({ ...data, allergies: option.value })}
                    >
                      <Text style={[Typography.bodySmall, styles.optionLabel]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </>
        );

      case 8:
        return (
          <>
            <View style={styles.logoContainer}>
              <View style={styles.pawLogo}>
                <View style={styles.pawPad} />
                <View style={styles.heart} />
                <View style={[styles.toe, styles.toeTopLeft]} />
                <View style={[styles.toe, styles.toeTopCenterLeft]} />
                <View style={[styles.toe, styles.toeTopCenterRight]} />
                <View style={[styles.toe, styles.toeTopRight]} />
              </View>
            </View>

            <View style={styles.iconSection}>
              <View style={styles.iconCircle}>
                <Icon name="bolt" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.iconTitle]}>
                Dog Size &{'\n'}Energy ⚡
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={[Typography.body, styles.questionText]}>
                What size and energy level fits your lifestyle?
              </Text>

              {/* Dog Size */}
              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  Preferred dog size
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'small', emoji: '🐕', label: 'Small (under 25 lbs)', desc: 'Easier to handle, good for apartments' },
                    { value: 'medium', emoji: '🐕', label: 'Medium (25-60 lbs)', desc: 'Versatile, great family dogs' },
                    { value: 'large', emoji: '🐕🐕', label: 'Large (60+ lbs)', desc: 'Need more space, great protectors' },
                    { value: 'no-preference', emoji: '🤷', label: 'No preference', desc: '' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        data.dogSize === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setData({ ...data, dogSize: option.value })}
                    >
                      <View style={styles.optionRow}>
                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                        <View style={styles.optionTextContainer}>
                          <Text style={[Typography.body, styles.optionLabel]}>
                            {option.label}
                          </Text>
                          {option.desc ? (
                            <Text style={[Typography.bodyTiny, styles.optionDesc]}>
                              {option.desc}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Energy Level */}
              <View style={styles.section}>
                <Text style={[Typography.bodySmall, styles.sectionTitle]}>
                  Preferred energy level
                </Text>
                <View style={styles.optionsContainer}>
                  {[
                    { value: 'low', emoji: '😴', label: 'Low energy', desc: 'Calm, prefers lounging' },
                    { value: 'moderate', emoji: '🚶', label: 'Moderate energy', desc: 'Balanced, adaptable' },
                    { value: 'high', emoji: '⚡', label: 'High energy', desc: 'Active, needs lots of exercise' },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        data.energyLevel === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setData({ ...data, energyLevel: option.value })}
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
            </View>
          </>
        );

      case 9:
        return (
          <>
            <View style={styles.iconSection}>
              <View style={styles.iconCircle}>
                <Icon name="star" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.iconTitle]}>
                Important{'\n'}Traits ⭐
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={[Typography.bodySmall, styles.contentText, { textAlign: 'center' }]}>
                Select all that are important to you
              </Text>

              <View style={styles.optionsContainer}>
                {[
                  { emoji: '😊', label: 'Friendly with kids' },
                  { emoji: '🐾', label: 'Good with other pets' },
                  { emoji: '✂️', label: 'Low maintenance grooming' },
                  { emoji: '🎓', label: 'Trainable' },
                  { emoji: '🤫', label: 'Quiet/Less barking' },
                  { emoji: '💖', label: 'Affectionate' },
                  { emoji: '😺', label: 'Independent' },
                  { emoji: '🎾', label: 'Playful' },
                  { emoji: '🛡️', label: 'Protective' },
                ].map((trait) => {
                  const isSelected = data.importantTraits.includes(trait.label);
                  return (
                    <TouchableOpacity
                      key={trait.label}
                      style={[
                        styles.traitButton,
                        isSelected && styles.traitButtonSelected,
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          setData({
                            ...data,
                            importantTraits: data.importantTraits.filter(t => t !== trait.label),
                          });
                        } else {
                          setData({
                            ...data,
                            importantTraits: [...data.importantTraits, trait.label],
                          });
                        }
                      }}
                    >
                      <Text style={styles.traitEmoji}>{trait.emoji}</Text>
                      <Text style={[Typography.bodySmall, styles.traitLabel]}>
                        {trait.label}
                      </Text>
                      {isSelected && (
                        <Icon name="check-circle" size={20} color={BrandColors.primary.orange} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        );

      case 10:
      case 11:
        // Simplified breed selection and comparison - can be expanded later
        return (
          <>
            <View style={styles.iconSection}>
              <View style={styles.iconCircle}>
                <Icon name="pets" size={48} color="#FFFFFF" />
              </View>
              <Text style={[Typography.h2, styles.iconTitle]}>
                {currentStep === 10 ? 'Breed Selection' : 'Breed Comparison'}
              </Text>
            </View>

            <View style={styles.content}>
              <Text style={[Typography.bodySmall, styles.contentText, { textAlign: 'center' }]}>
                {currentStep === 10 
                  ? 'Based on your preferences, we\'ll recommend breeds'
                  : 'Compare your selected breeds'}
              </Text>
              <View style={styles.infoCard}>
                <Text style={[Typography.bodySmall, styles.infoTitle]}>
                  💡 This feature will be enhanced with breed matching algorithm
                </Text>
              </View>
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color={BrandColors.neutral.gray700} />
        </TouchableOpacity>

        {renderStep()}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          <BrandedButton
            title={currentStep === 11 ? (loading ? 'Saving...' : 'Complete') : 'Next'}
            onPress={handleNext}
            disabled={loading || !isStepValid()}
            fullWidth
          />
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  logoContainer: {
    width: 64,
    height: 64,
    alignSelf: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pawLogo: {
    width: 60,
    height: 60,
    position: 'relative',
  },
  pawPad: {
    position: 'absolute',
    width: 33,
    height: 39,
    borderRadius: 16.5,
    backgroundColor: BrandColors.neutral.black,
    bottom: 0,
    left: '50%',
    marginLeft: -16.5,
  },
  heart: {
    position: 'absolute',
    width: 12,
    height: 12,
    backgroundColor: BrandColors.primary.orange,
    borderRadius: 6,
    bottom: 15,
    left: '50%',
    marginLeft: -6,
    transform: [{ rotate: '45deg' }],
  },
  toe: {
    position: 'absolute',
    width: 15,
    height: 21,
    borderRadius: 7.5,
    backgroundColor: BrandColors.neutral.black,
  },
  toeTopLeft: {
    top: 7.5,
    left: 7.5,
    transform: [{ rotate: '-15deg' }],
  },
  toeTopCenterLeft: {
    top: 0,
    left: 15,
    transform: [{ rotate: '-5deg' }],
  },
  toeTopCenterRight: {
    top: 0,
    right: 15,
    transform: [{ rotate: '5deg' }],
  },
  toeTopRight: {
    top: 7.5,
    right: 7.5,
    transform: [{ rotate: '15deg' }],
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
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
  iconTitle: {
    color: BrandColors.neutral.black,
    textAlign: 'center',
  },
  content: {
    width: '100%',
  },
  contentText: {
    color: BrandColors.neutral.black,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  questionText: {
    color: BrandColors.neutral.black,
    marginBottom: Spacing.base,
  },
  infoCard: {
    backgroundColor: '#FED7AA',
    borderWidth: 2,
    borderColor: '#FDBA74',
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
    color: '#9A3412',
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  infoList: {
    color: '#7C2D12',
    lineHeight: 18,
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
    borderRadius: BorderRadius.sm,
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
  },
  optionButtonSmall: {
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
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
  traitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    borderRadius: BorderRadius.sm,
    padding: Spacing.base,
    backgroundColor: '#FFFFFF',
  },
  traitButtonSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: '#FED7AA',
  },
  traitEmoji: {
    fontSize: 20,
  },
  traitLabel: {
    flex: 1,
    color: BrandColors.neutral.black,
  },
  navigationContainer: {
    marginTop: Spacing.xl,
  },
});

