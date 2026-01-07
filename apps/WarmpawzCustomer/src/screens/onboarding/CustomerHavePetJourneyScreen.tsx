/**
 * Customer Have Pet Journey Screen
 * Multi-step onboarding for users who already have a pet
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
  TextInput,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme/colors';
import { API_BASE_URL } from '../../config/aws';

interface CustomerHavePetJourneyScreenProps {
  phone: string;
  onComplete: () => void;
  onBack?: () => void;
}

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

export function CustomerHavePetJourneyScreen({
  phone,
  onComplete,
  onBack,
}: CustomerHavePetJourneyScreenProps) {
  const [currentStep, setCurrentStep] = useState(1);
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

  // Cleanup
  useEffect(() => {
    return () => {
      setData({
        petName: '',
        petType: '',
        breed: '',
        age: '',
        gender: '',
        weight: '',
        livingSpace: { homeType: '', outdoorSpace: '' },
        lifestyle: { workSchedule: '', activityLevel: '', travelFrequency: '' },
        budget: '',
        healthInfo: { spayedNeutered: '', allergies: '', medications: '' },
        preferences: [],
      });
      setTempSelections({});
    };
  }, []);

  const handleNext = async () => {
    // Save temp selections to main data before proceeding
    if (currentStep === 3) {
      setData({
        ...data,
        livingSpace: {
          homeType: tempSelections.homeType || data.livingSpace.homeType,
          outdoorSpace: tempSelections.outdoorSpace || data.livingSpace.outdoorSpace,
        },
      });
    } else if (currentStep === 4) {
      setData({
        ...data,
        lifestyle: {
          workSchedule: tempSelections.workSchedule || data.lifestyle.workSchedule,
          activityLevel: tempSelections.activityLevel || data.lifestyle.activityLevel,
          travelFrequency: tempSelections.travelFrequency || data.lifestyle.travelFrequency,
        },
      });
    } else if (currentStep === 5) {
      setData({
        ...data,
        budget: tempSelections.budget || data.budget,
      });
    }

    const isValid = validateStep(currentStep);
    if (!isValid) {
      Alert.alert('Required', 'Please complete all required fields to continue');
      return;
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
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setTempSelections({});
    } else if (onBack) {
      onBack();
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!data.petName.trim();
      case 2:
        return !!data.petType;
      case 3:
        return !!(
          (tempSelections.homeType || data.livingSpace.homeType) &&
          (tempSelections.outdoorSpace || data.livingSpace.outdoorSpace)
        );
      case 4:
        return !!(
          (tempSelections.workSchedule || data.lifestyle.workSchedule) &&
          (tempSelections.activityLevel || data.lifestyle.activityLevel) &&
          (tempSelections.travelFrequency || data.lifestyle.travelFrequency)
        );
      case 5:
        return !!(tempSelections.budget || data.budget);
      case 6:
        return !!data.breed.trim();
      case 7:
        return !!data.age;
      case 8:
        return !!data.gender;
      case 9:
        return !!data.weight.trim();
      case 10:
        return !!(
          data.healthInfo.spayedNeutered &&
          data.healthInfo.allergies &&
          data.healthInfo.medications
        );
      case 11:
        return true; // Preferences are optional
      case 12:
        return true; // Final step
      default:
        return true;
    }
  };

  const saveOnboarding = async (onboardingData: OnboardingData) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/customer/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          type: 'have-pet',
          data: onboardingData,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save onboarding data');
      }

      console.log('Onboarding data saved successfully');
    } catch (error: any) {
      console.error('Error saving onboarding data:', error);
      Alert.alert('Error', error.message || 'Failed to save onboarding data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePreference = (preference: string) => {
    const index = data.preferences.indexOf(preference);
    if (index > -1) {
      setData({
        ...data,
        preferences: data.preferences.filter((p) => p !== preference),
      });
    } else {
      setData({
        ...data,
        preferences: [...data.preferences, preference],
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>🐕</Text>
              </View>
              <Text style={styles.title}>What's Your{'\n'}Pet's Name? 🐕</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>
                Let's start by getting to know your furry friend!
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter your pet's name"
                placeholderTextColor={colors.textMuted}
                value={data.petName}
                onChangeText={(text) => setData({ ...data, petName: text })}
                autoCapitalize="words"
                autoFocus
              />
            </View>
          </>
        );

      case 2:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>🐾</Text>
              </View>
              <Text style={styles.title}>Pet Type 🐾</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>What type of pet do you have?</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.petType === 'dog' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, petType: 'dog' })}
                >
                  <Text style={styles.optionEmoji}>🐕</Text>
                  <Text style={styles.optionTitle}>Dog</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.petType === 'cat' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, petType: 'cat' })}
                >
                  <Text style={styles.optionEmoji}>🐈</Text>
                  <Text style={styles.optionTitle}>Cat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        );

      case 3:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>🏡</Text>
              </View>
              <Text style={styles.title}>Your Living{'\n'}Space 🏡</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>Tell us about where you live</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>What type of home do you have?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.homeType || data.livingSpace.homeType) === 'apartment' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, homeType: 'apartment' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🏢</Text>
                      <Text style={styles.optionTitle}>Apartment</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.homeType || data.livingSpace.homeType) === 'small-house' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, homeType: 'small-house' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🏠</Text>
                      <Text style={styles.optionTitle}>Small House</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.homeType || data.livingSpace.homeType) === 'large-house' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, homeType: 'large-house' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🌳</Text>
                      <Text style={styles.optionTitle}>Large House</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Do you have a yard or outdoor space?
                </Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.outdoorSpace || data.livingSpace.outdoorSpace) ===
                        'large-yard' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, outdoorSpace: 'large-yard' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🌳</Text>
                      <Text style={styles.optionTitle}>Yes, large fenced yard</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.outdoorSpace || data.livingSpace.outdoorSpace) ===
                        'small-patio' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, outdoorSpace: 'small-patio' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🪴</Text>
                      <Text style={styles.optionTitle}>Yes, small yard/patio</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.outdoorSpace || data.livingSpace.outdoorSpace) ===
                        'no-outdoor' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, outdoorSpace: 'no-outdoor' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🏙️</Text>
                      <Text style={styles.optionTitle}>No outdoor space</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );

      case 4:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⭐</Text>
              </View>
              <Text style={styles.title}>Your{'\n'}Lifestyle ⭐</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>Help us understand your daily routine</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  What's your typical work schedule?
                </Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.workSchedule || data.lifestyle.workSchedule) ===
                        'work-from-home' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, workSchedule: 'work-from-home' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🏠</Text>
                      <Text style={styles.optionTitle}>Work from home</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.workSchedule || data.lifestyle.workSchedule) ===
                        'away-4-6' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, workSchedule: 'away-4-6' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>⏰</Text>
                      <Text style={styles.optionTitle}>Away 4-6 hours/day</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.workSchedule || data.lifestyle.workSchedule) ===
                        'away-8-plus' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, workSchedule: 'away-8-plus' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>💼</Text>
                      <Text style={styles.optionTitle}>Away 8+ hours/day</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  How would you describe your activity level?
                </Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.activityLevel || data.lifestyle.activityLevel) ===
                        'very-active' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, activityLevel: 'very-active' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🏃</Text>
                      <Text style={styles.optionTitle}>
                        Very Active (daily exercise/outdoors)
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.activityLevel || data.lifestyle.activityLevel) ===
                        'moderate' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, activityLevel: 'moderate' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🚶</Text>
                      <Text style={styles.optionTitle}>
                        Moderate (regular walks/activities)
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.activityLevel || data.lifestyle.activityLevel) ===
                        'relaxed' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, activityLevel: 'relaxed' })
                    }
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>🛋️</Text>
                      <Text style={styles.optionTitle}>
                        Relaxed (prefer indoor activities)
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  How often do you travel?
                </Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.travelFrequency || data.lifestyle.travelFrequency) ===
                        'frequent' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, travelFrequency: 'frequent' })
                    }
                  >
                    <Text style={styles.optionTitle}>Frequently (monthly or more)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.travelFrequency || data.lifestyle.travelFrequency) ===
                        'occasional' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, travelFrequency: 'occasional' })
                    }
                  >
                    <Text style={styles.optionTitle}>Occasionally (few times a year)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.travelFrequency || data.lifestyle.travelFrequency) ===
                        'rarely' && styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setTempSelections({ ...tempSelections, travelFrequency: 'rarely' })
                    }
                  >
                    <Text style={styles.optionTitle}>Rarely or never</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );

      case 5:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>💳</Text>
              </View>
              <Text style={styles.title}>Budget{'\n'}Planning 💳</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>
                Let's understand the investment involved ❤️
              </Text>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>💡 Typical Costs Overview:</Text>
                <View style={styles.costGrid}>
                  <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Initial Setup</Text>
                    <Text style={styles.costValue}>₹20,000 - ₹50,000</Text>
                  </View>
                  <View style={styles.costItem}>
                    <Text style={styles.costLabel}>Monthly Care</Text>
                    <Text style={styles.costValue}>₹3,000 - ₹12,000+</Text>
                  </View>
                </View>
                <Text style={styles.infoText}>
                  Includes food, vet care, supplies & grooming
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  What's your comfortable monthly budget?
                </Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.budget || data.budget) === '3000-6000' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setTempSelections({ ...tempSelections, budget: '3000-6000' })}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>💚</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>₹3,000 - ₹6,000/month</Text>
                        <Text style={styles.optionSubtitle}>Essential care & basic needs</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.budget || data.budget) === '6000-12000' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setTempSelections({ ...tempSelections, budget: '6000-12000' })}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>⭐</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>₹6,000 - ₹12,000/month</Text>
                        <Text style={styles.optionSubtitle}>Good care with extra comfort</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.optionButton,
                      (tempSelections.budget || data.budget) === '12000-plus' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() => setTempSelections({ ...tempSelections, budget: '12000-plus' })}
                  >
                    <View style={styles.optionRow}>
                      <Text style={styles.optionEmoji}>👑</Text>
                      <View style={styles.optionTextContainer}>
                        <Text style={styles.optionTitle}>₹12,000+/month</Text>
                        <Text style={styles.optionSubtitle}>
                          Comprehensive & premium services
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.proTipCard}>
                <Text style={styles.proTipEmoji}>💡</Text>
                <View style={styles.proTipContent}>
                  <Text style={styles.proTipTitle}>Pro Tip: Keep an emergency fund</Text>
                  <Text style={styles.proTipText}>
                    Save ₹15,000 - ₹50,000 for unexpected vet emergencies
                  </Text>
                </View>
              </View>
            </View>
          </>
        );

      case 6:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>🐕</Text>
              </View>
              <Text style={styles.title}>Breed 🐕</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>What breed is your pet?</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter breed (e.g., Golden Retriever, Persian)"
                placeholderTextColor={colors.textMuted}
                value={data.breed}
                onChangeText={(text) => setData({ ...data, breed: text })}
                autoCapitalize="words"
              />
            </View>
          </>
        );

      case 7:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>📅</Text>
              </View>
              <Text style={styles.title}>Age 📅</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>How old is your pet?</Text>
              <View style={styles.optionsContainer}>
                {['Puppy/Kitten (0-1 year)', 'Young (1-3 years)', 'Adult (3-7 years)', 'Senior (7+ years)'].map((age) => (
                  <TouchableOpacity
                    key={age}
                    style={[
                      styles.optionButton,
                      data.age === age && styles.optionButtonSelected,
                    ]}
                    onPress={() => setData({ ...data, age })}
                  >
                    <Text style={styles.optionTitle}>{age}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        );

      case 8:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⚧️</Text>
              </View>
              <Text style={styles.title}>Gender ⚧️</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>What's your pet's gender?</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.gender === 'male' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, gender: 'male' })}
                >
                  <Text style={styles.optionTitle}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    data.gender === 'female' && styles.optionButtonSelected,
                  ]}
                  onPress={() => setData({ ...data, gender: 'female' })}
                >
                  <Text style={styles.optionTitle}>Female</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        );

      case 9:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⚖️</Text>
              </View>
              <Text style={styles.title}>Weight ⚖️</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>What's your pet's weight?</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter weight in kg (e.g., 15)"
                placeholderTextColor={colors.textMuted}
                value={data.weight}
                onChangeText={(text) => setData({ ...data, weight: text })}
                keyboardType="numeric"
              />
            </View>
          </>
        );

      case 10:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>🏥</Text>
              </View>
              <Text style={styles.title}>Health Info 🏥</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>Tell us about your pet's health</Text>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Is your pet spayed/neutered?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.healthInfo.spayedNeutered === 'yes' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setData({
                        ...data,
                        healthInfo: { ...data.healthInfo, spayedNeutered: 'yes' },
                      })
                    }
                  >
                    <Text style={styles.optionText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.healthInfo.spayedNeutered === 'no' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setData({
                        ...data,
                        healthInfo: { ...data.healthInfo, spayedNeutered: 'no' },
                      })
                    }
                  >
                    <Text style={styles.optionText}>No</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Any known allergies?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.healthInfo.allergies === 'none' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setData({
                        ...data,
                        healthInfo: { ...data.healthInfo, allergies: 'none' },
                      })
                    }
                  >
                    <Text style={styles.optionText}>None</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.healthInfo.allergies === 'yes' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setData({
                        ...data,
                        healthInfo: { ...data.healthInfo, allergies: 'yes' },
                      })
                    }
                  >
                    <Text style={styles.optionText}>Yes, has allergies</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Any current medications?</Text>
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.healthInfo.medications === 'none' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setData({
                        ...data,
                        healthInfo: { ...data.healthInfo, medications: 'none' },
                      })
                    }
                  >
                    <Text style={styles.optionText}>None</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.optionButtonSmall,
                      data.healthInfo.medications === 'yes' &&
                        styles.optionButtonSelected,
                    ]}
                    onPress={() =>
                      setData({
                        ...data,
                        healthInfo: { ...data.healthInfo, medications: 'yes' },
                      })
                    }
                  >
                    <Text style={styles.optionText}>Yes, on medications</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </>
        );

      case 11:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>⭐</Text>
              </View>
              <Text style={styles.title}>Preferences ⭐</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>
                What services are you interested in? (Select all that apply)
              </Text>
              <View style={styles.traitsContainer}>
                {[
                  'Veterinary care',
                  'Grooming',
                  'Training',
                  'Boarding',
                  'Pet sitting',
                  'Dog walking',
                  'Pet supplies',
                  'Pet insurance',
                ].map((pref) => (
                  <TouchableOpacity
                    key={pref}
                    style={[
                      styles.traitButton,
                      data.preferences.includes(pref) && styles.traitButtonSelected,
                    ]}
                    onPress={() => togglePreference(pref)}
                  >
                    <Text
                      style={[
                        styles.traitText,
                        data.preferences.includes(pref) && styles.traitTextSelected,
                      ]}
                    >
                      {pref}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.skipHint}>You can skip this step</Text>
            </View>
          </>
        );

      case 12:
        return (
          <>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🐾</Text>
            </View>
            <View style={styles.iconSection}>
              <View style={styles.orangeCircle}>
                <Text style={styles.iconText}>✅</Text>
              </View>
              <Text style={styles.title}>All Set! ✅</Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.description}>
                We've saved all your pet's information. You're ready to start using WarmPawz!
              </Text>
              <View style={styles.successCard}>
                <Text style={styles.successEmoji}>🎉</Text>
                <Text style={styles.successText}>
                  Your pet profile for {data.petName} has been created successfully!
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
                { width: `${(currentStep / totalSteps) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            Step {currentStep} of {totalSteps}
          </Text>
        </View>

        {/* Step Content */}
        {renderStep()}

        {/* Navigation Buttons */}
        <View style={styles.navigationContainer}>
          {currentStep > 1 && (
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
              (!validateStep(currentStep) || loading) && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            disabled={!validateStep(currentStep) || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === totalSteps ? 'Complete' : 'Continue →'}
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
  logoEmoji: {
    fontSize: 48,
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
  textInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    fontSize: typography.fontSizes.md,
    color: colors.text,
    backgroundColor: colors.background,
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
  },
  optionSubtitle: {
    fontSize: typography.fontSizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  optionText: {
    fontSize: typography.fontSizes.sm,
    color: colors.text,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: '#1E40AF',
    marginBottom: spacing.sm,
  },
  costGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  costItem: {
    flex: 1,
  },
  costLabel: {
    fontSize: typography.fontSizes.sm,
    color: '#1E3A8A',
    marginBottom: spacing.xs / 2,
  },
  costValue: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: '#1E40AF',
  },
  infoText: {
    fontSize: typography.fontSizes.xs,
    color: '#1E3A8A',
    marginTop: spacing.xs,
  },
  proTipCard: {
    backgroundColor: colors.gradientOrange50,
    borderWidth: 2,
    borderColor: '#FFE0B2',
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  proTipEmoji: {
    fontSize: typography.fontSizes.xl,
  },
  proTipContent: {
    flex: 1,
  },
  proTipTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: '#B8621B',
    marginBottom: spacing.xs / 2,
  },
  proTipText: {
    fontSize: typography.fontSizes.xs,
    color: '#B8621B',
    lineHeight: 18,
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
  successCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#BBF7D0',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.fontSizes.md,
    color: '#065F46',
    textAlign: 'center',
    fontWeight: typography.fontWeights.medium,
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

