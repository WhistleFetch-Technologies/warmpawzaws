/**
 * Customer Planning Journey Screen
 * Multi-step questionnaire for users planning to get a pet
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { CustomerApi } from '../../services/api';
import { API_BASE_URL } from '../../config/aws';

interface CustomerPlanningJourneyScreenProps {
  phone: string;
  onComplete: () => void;
  onBack?: () => void;
}

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

export function CustomerPlanningJourneyScreen({
  phone,
  onComplete,
  onBack,
}: CustomerPlanningJourneyScreenProps) {
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

  // Cleanup
  useEffect(() => {
    return () => {
      setData({
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
    };
  }, []);

  const handleNext = async () => {
    if (!isStepValid()) {
      Alert.alert('Required', 'Please make a selection to continue');
      return;
    }

    if (currentStep === 11) {
      // Last step, save and complete
      await saveQuestionnaire(data);
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 6) {
      setCurrentStep(currentStep - 1);
    } else if (onBack) {
      onBack();
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 6:
        return !!data.timeCommitment;
      case 7:
        return !!(data.children && data.otherPets && data.allergies);
      case 8:
        return !!(data.dogSize && data.energyLevel);
      case 9:
        return true; // Skippable step
      case 10:
        return data.selectedBreeds.length > 0;
      case 11:
        return true; // Final comparison step
      default:
        return true;
    }
  };

  const saveQuestionnaire = async (questionnaireData: QuestionnaireData) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/customer/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone,
            type: 'planning',
            data: questionnaireData,
          }),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save questionnaire');
      }

      console.log('Questionnaire saved successfully');
    } catch (error: any) {
      console.error('Error saving questionnaire:', error);
      Alert.alert('Error', error.message || 'Failed to save questionnaire. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTrait = (trait: string) => {
    const index = data.importantTraits.indexOf(trait);
    if (index > -1) {
      setData({
        ...data,
        importantTraits: data.importantTraits.filter((t) => t !== trait),
      });
    } else {
      setData({
        ...data,
        importantTraits: [...data.importantTraits, trait],
      });
    }
  };

  const toggleBreed = (breed: string) => {
    const index = data.selectedBreeds.indexOf(breed);
    if (index > -1) {
      setData({
        ...data,
        selectedBreeds: data.selectedBreeds.filter((b) => b !== breed),
      });
    } else {
      setData({
        ...data,
        selectedBreeds: [...data.selectedBreeds, breed],
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 6:
        return (
          <>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⏱️</Text>
              </View>
              <Text style={styles.title}>Time{'\n'}Commitment ⏱️</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.description}>
                Pets need daily attention and care 💕
              </Text>

              {/* Info Card */}
              <View style={styles.infoCard}>
                <View style={styles.infoCardContent}>
                  <Text style={styles.infoEmoji}>⏰</Text>
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoTitle}>
                      Daily time needs (average):
                    </Text>
                    <Text style={styles.infoText}>• Feeding & water: 15-30 min</Text>
                    <Text style={styles.infoText}>• Exercise/play: 30-120 min</Text>
                    <Text style={styles.infoText}>• Grooming: 10-30 min</Text>
                    <Text style={styles.infoText}>• Training/bonding: 15-45 min</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.question}>How much time can you dedicate daily?</Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.timeCommitment === '1-2-hours' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, timeCommitment: '1-2-hours' })}
                >
                  <Text style={styles.optionTitle}>1-2 hours per day</Text>
                  <Text style={styles.optionSubtitle}>Basic care & short activities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.timeCommitment === '2-4-hours' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, timeCommitment: '2-4-hours' })}
                >
                  <Text style={styles.optionTitle}>2-4 hours per day</Text>
                  <Text style={styles.optionSubtitle}>Good care & regular activities</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.timeCommitment === '4-plus-hours' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, timeCommitment: '4-plus-hours' })}
                >
                  <Text style={styles.optionTitle}>4+ hours per day</Text>
                  <Text style={styles.optionSubtitle}>Lots of time for bonding & training</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        );

      case 7:
        return (
          <>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>👨‍👩‍👧</Text>
              </View>
              <Text style={styles.title}>Your{'\n'}Household 👨‍👩‍👧</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.description}>
                Important factors for choosing the right pet
              </Text>

              {/* Children */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Do you have children at home?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.children === 'no-children' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, children: 'no-children' })}
                  >
                    <Text style={styles.optionText}>No children</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.children === 'young-children' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, children: 'young-children' })}
                  >
                    <Text style={styles.optionText}>Yes, young children (under 6)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.children === 'older-children' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, children: 'older-children' })}
                  >
                    <Text style={styles.optionText}>Yes, older children (6+)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Other Pets */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Do you have other pets?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.otherPets === 'no-pets' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, otherPets: 'no-pets' })}
                  >
                    <Text style={styles.optionText}>No other pets</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.otherPets === 'has-dogs' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, otherPets: 'has-dogs' })}
                  >
                    <Text style={styles.optionText}>Yes, I have dogs</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.otherPets === 'has-cats' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, otherPets: 'has-cats' })}
                  >
                    <Text style={styles.optionText}>Yes, I have cats</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.otherPets === 'has-other' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, otherPets: 'has-other' })}
                  >
                    <Text style={styles.optionText}>Yes, other pets</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Allergies */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Any allergies in household?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.allergies === 'no-allergies' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, allergies: 'no-allergies' })}
                  >
                    <Text style={styles.optionText}>No allergies</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.allergies === 'pet-allergies' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, allergies: 'pet-allergies' })}
                  >
                    <Text style={styles.optionText}>Yes, pet allergies</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.allergies === 'other-allergies' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, allergies: 'other-allergies' })}
                  >
                    <Text style={styles.optionText}>Other allergies</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );

      case 8:
        return (
          <>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⚡</Text>
              </View>
              <Text style={styles.title}>Dog Size &{'\n'}Energy ⚡</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.description}>
                What size and energy level fits your lifestyle?
              </Text>

              {/* Dog Size */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferred dog size</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.dogSize === 'small' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, dogSize: 'small' })}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🐕</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>Small (under 25 lbs)</Text>
                        <Text style={styles.optionSubtitle}>
                          Easier to handle, good for apartments
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.dogSize === 'medium' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, dogSize: 'medium' })}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🐕</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>Medium (25-60 lbs)</Text>
                        <Text style={styles.optionSubtitle}>
                          Versatile, great family dogs
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.dogSize === 'large' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, dogSize: 'large' })}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🐕🐕</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>Large (60+ lbs)</Text>
                        <Text style={styles.optionSubtitle}>
                          Need more space, great protectors
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Energy Level */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Preferred energy level</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.energyLevel === 'low' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, energyLevel: 'low' })}
                  >
                    <Text style={styles.optionTitle}>Low energy</Text>
                    <Text style={styles.optionSubtitle}>
                      Calm, relaxed, minimal exercise needs
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.energyLevel === 'moderate' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, energyLevel: 'moderate' })}
                  >
                    <Text style={styles.optionTitle}>Moderate energy</Text>
                    <Text style={styles.optionSubtitle}>
                      Balanced, regular exercise, adaptable
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      data.energyLevel === 'high' && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, energyLevel: 'high' })}
                  >
                    <Text style={styles.optionTitle}>High energy</Text>
                    <Text style={styles.optionSubtitle}>
                      Active, needs lots of exercise & play
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );

      case 9:
        return (
          <>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⭐</Text>
              </View>
              <Text style={styles.title}>Important{'\n'}Traits ⭐</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.description}>
                What traits are most important to you? (Select all that apply)
              </Text>

              <View style={styles.traitsContainer}>
                {[
                  'Good with kids',
                  'Easy to train',
                  'Low maintenance',
                  'Friendly',
                  'Protective',
                  'Apartment-friendly',
                  'Good with other pets',
                  'Minimal shedding',
                ].map((trait) => (
                  <TouchableOpacity
                    key={trait}
                    style={[
                      styles.traitButton,
                      data.importantTraits.includes(trait) && styles.traitButtonSelected,
                    ]}
                    onPress={() => toggleTrait(trait)}
                  >
                    <Text
                      style={[
                        styles.traitText,
                        data.importantTraits.includes(trait) && styles.traitTextSelected,
                      ]}
                    >
                      {trait}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.skipHint}>You can skip this step</Text>
            </View>
          </>
        );

      case 10:
        return (
          <>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>🐕</Text>
              </View>
              <Text style={styles.title}>Select{'\n'}Breeds 🐕</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.description}>
                Select breeds you're interested in (at least one)
              </Text>

              <View style={styles.breedsContainer}>
                {['Shih Tzu', 'French Bulldog', 'Cavalier King Charles', 'Golden Retriever', 'Labrador', 'German Shepherd'].map((breed) => (
                  <TouchableOpacity
                    key={breed}
                    style={[
                      styles.breedButton,
                      data.selectedBreeds.includes(breed) && styles.breedButtonSelected,
                    ]}
                    onPress={() => toggleBreed(breed)}
                  >
                    <View style={styles.breedContent}>
                      <Text style={styles.breedEmoji}>🐕</Text>
                      <Text
                        style={[
                          styles.breedText,
                          data.selectedBreeds.includes(breed) && styles.breedTextSelected,
                        ]}
                      >
                        {breed}
                      </Text>
                      {data.selectedBreeds.includes(breed) && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.hint}>
                Select at least one breed to continue
              </Text>
            </View>
          </>
        );

      case 11:
        return (
          <>
            {/* Orange Circle Icon */}
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>📊</Text>
              </View>
              <Text style={styles.title}>Compare{'\n'}Breeds</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.description}>
                Detailed pros & cons for your selections
              </Text>

              <ScrollView style={styles.comparisonContainer} showsVerticalScrollIndicator={false}>
                {data.selectedBreeds.map((breed) => {
                  const breedData: Record<string, any> = {
                    'Shih Tzu': {
                      emoji: '🐕',
                      description: 'Affectionate, playful, and outgoing',
                      pros: ['Good with kids', 'Friendly personality', 'Adaptable'],
                      cons: ['Requires regular grooming', 'Can be stubborn', 'Health issues to watch'],
                      bestFor: ['Apartments', 'Families', 'Seniors', 'First-time owners'],
                    },
                    'French Bulldog': {
                      emoji: '🐕',
                      description: 'Adaptable, playful, and smart',
                      pros: ['Low exercise needs', 'Great apartment dog', 'Minimal barking'],
                      cons: ['Heat sensitivity', 'Breathing issues', 'Health complications'],
                      bestFor: ['Apartments', 'Low active owners', 'Seniors'],
                    },
                    'Cavalier King Charles': {
                      emoji: '🐕',
                      description: 'Gentle, affectionate, and graceful',
                      pros: ['Excellent companions', 'Good with children', 'Adaptable to lifestyle'],
                      cons: ['Health issues common', 'Needs companionship', 'Regular grooming needed'],
                      bestFor: ['Families', 'Seniors', 'First-time owners'],
                    },
                  };

                  const info = breedData[breed] || {
                    emoji: '🐕',
                    description: 'Great companion',
                    pros: ['Loyal', 'Friendly'],
                    cons: ['Needs exercise'],
                    bestFor: ['Families'],
                  };

                  return (
                    <View key={breed} style={styles.breedComparisonCard}>
                      <View style={styles.breedHeader}>
                        <Text style={styles.breedComparisonEmoji}>{info.emoji}</Text>
                        <View style={styles.breedHeaderText}>
                          <Text style={styles.breedComparisonTitle}>{breed}</Text>
                          <Text style={styles.breedComparisonDescription}>
                            {info.description}
                          </Text>
                        </View>
                      </View>

                      {/* Pros */}
                      <View style={styles.prosContainer}>
                        <View style={styles.prosCard}>
                          <Text style={styles.prosTitle}>Pros:</Text>
                          {info.pros.map((pro: string, idx: number) => (
                            <Text key={idx} style={styles.prosText}>
                              ✓ {pro}
                            </Text>
                          ))}
                        </View>
                      </View>

                      {/* Cons */}
                      <View style={styles.consContainer}>
                        <View style={styles.consCard}>
                          <Text style={styles.consTitle}>Cons:</Text>
                          {info.cons.map((con: string, idx: number) => (
                            <Text key={idx} style={styles.consText}>
                              ✗ {con}
                            </Text>
                          ))}
                        </View>
                      </View>

                      {/* Best For */}
                      <View style={styles.bestForContainer}>
                        <Text style={styles.bestForTitle}>Best for:</Text>
                        <View style={styles.bestForTags}>
                          {info.bestFor.map((tag: string, idx: number) => (
                            <View key={idx} style={styles.bestForTag}>
                              <Text style={styles.bestForTagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentStep - 5) / 6) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Step {currentStep - 5} of 6
          </Text>
        </View>

        {/* Step Content */}
        {renderStep()}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {currentStep > 6 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              (!isStepValid() || loading) && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!isStepValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === 11 ? 'Complete' : 'Next →'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  progressContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  orangeCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontSize: typography.fontSizes['3xl'],
    fontWeight: typography.fontWeights.bold,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 36,
  },
  content: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  description: {
    fontSize: typography.fontSizes.md,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  question: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.md,
    fontWeight: typography.fontWeights.medium,
  },
  infoCard: {
    backgroundColor: colors.gradientOrange50,
    borderWidth: 2,
    borderColor: '#FFE0B2',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoCardContent: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  infoEmoji: {
    fontSize: typography.fontSizes.xl,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: '#B8621B',
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSizes.xs,
    color: '#B8621B',
    marginBottom: spacing.xs / 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    width: '100%',
    borderWidth: 2,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  optionButtonSmall: {
    width: '100%',
    borderWidth: 2,
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionEmoji: {
    fontSize: typography.fontSizes['2xl'],
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  optionSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  optionText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  traitButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  traitButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  traitText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  traitTextSelected: {
    color: colors.primary,
    fontWeight: typography.fontWeights.medium,
  },
  skipHint: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  breedsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  breedButton: {
    borderWidth: 2,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  breedButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.gradientOrange50,
  },
  breedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breedEmoji: {
    fontSize: typography.fontSizes['2xl'],
  },
  breedText: {
    flex: 1,
    fontSize: typography.fontSizes.md,
    color: colors.text,
  },
  breedTextSelected: {
    fontWeight: typography.fontWeights.medium,
    color: colors.primary,
  },
  checkmark: {
    fontSize: typography.fontSizes.lg,
    color: colors.primary,
    fontWeight: typography.fontWeights.bold,
  },
  hint: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  comparisonContainer: {
    maxHeight: 500,
  },
  breedComparisonCard: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  breedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  breedComparisonEmoji: {
    fontSize: typography.fontSizes['3xl'],
  },
  breedHeaderText: {
    flex: 1,
  },
  breedComparisonTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs / 2,
  },
  breedComparisonDescription: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  prosContainer: {
    marginBottom: spacing.sm,
  },
  prosCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
  },
  prosTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: '#065F46',
    marginBottom: spacing.xs / 2,
  },
  prosText: {
    fontSize: typography.fontSizes.xs,
    color: '#047857',
    marginBottom: spacing.xs / 2,
  },
  consContainer: {
    marginBottom: spacing.sm,
  },
  consCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
  },
  consTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: '#991B1B',
    marginBottom: spacing.xs / 2,
  },
  consText: {
    fontSize: typography.fontSizes.xs,
    color: colors.error,
    marginBottom: spacing.xs / 2,
  },
  bestForContainer: {
    marginTop: spacing.sm,
  },
  bestForTitle: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  bestForTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  bestForTag: {
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.full,
  },
  bestForTagText: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.text,
  },
  nextButton: {
    flex: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: colors.textMuted,
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
});

