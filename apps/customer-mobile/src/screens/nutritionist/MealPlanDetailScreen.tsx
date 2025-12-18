/**
 * Meal Plan Detail Screen - Customer Mobile App
 * View meal plan details and order meals
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface MealPlan {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  imageUrl?: string;
  nutritionistId: string;
  nutritionistName: string;
  mealsPerDay: number;
  totalMeals: number;
  meals: Array<{
    id: string;
    name: string;
    description: string;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    imageUrl?: string;
    price: number;
  }>;
}

export default function MealPlanDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { mealPlanId } = route.params as { mealPlanId: string };

  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeals, setSelectedMeals] = useState<string[]>([]);

  useEffect(() => {
    loadMealPlanDetails();
  }, [mealPlanId]);

  const loadMealPlanDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/nutritionist/meal-plan/${mealPlanId}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMealPlan(data.mealPlan);
      } else {
        const error = await response.json();
        ErrorHandler.showError(error);
      }
    } catch (error) {
      ErrorHandler.showError(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMealSelection = (mealId: string) => {
    setSelectedMeals((prev) =>
      prev.includes(mealId) ? prev.filter((id) => id !== mealId) : [...prev, mealId]
    );
  };

  const handleOrderMeals = () => {
    if (selectedMeals.length === 0) {
      Alert.alert('Select Meals', 'Please select at least one meal to order');
      return;
    }

    const selectedMealItems = mealPlan?.meals.filter((meal) => selectedMeals.includes(meal.id)) || [];
    navigation.navigate('MealOrder' as never, {
      nutritionistId: mealPlan?.nutritionistId || '',
      items: selectedMealItems,
    } as never);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  if (!mealPlan) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.text.secondary} />
        <Text style={styles.errorText}>Meal plan not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {mealPlan.imageUrl ? (
        <Image source={{ uri: mealPlan.imageUrl }} style={styles.mealPlanImage} />
      ) : (
        <View style={styles.mealPlanImagePlaceholder}>
          <Icon name="restaurant-menu" size={64} color={BrandColors.text.secondary} />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.mealPlanName}>{mealPlan.name}</Text>
        <Text style={styles.mealPlanDescription}>{mealPlan.description}</Text>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Icon name="schedule" size={20} color={BrandColors.primary.orange} />
            <Text style={styles.infoText}>{mealPlan.duration} days plan</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="restaurant" size={20} color={BrandColors.primary.orange} />
            <Text style={styles.infoText}>{mealPlan.mealsPerDay} meals per day</Text>
          </View>
          <View style={styles.infoRow}>
            <Icon name="person" size={20} color={BrandColors.primary.orange} />
            <Text style={styles.infoText}>By {mealPlan.nutritionistName}</Text>
          </View>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total Price:</Text>
          <Text style={styles.price}>₹{mealPlan.price}</Text>
        </View>

        <View style={styles.mealsSection}>
          <Text style={styles.sectionTitle}>Available Meals</Text>
          {mealPlan.meals.map((meal) => (
            <TouchableOpacity
              key={meal.id}
              style={[
                styles.mealCard,
                selectedMeals.includes(meal.id) && styles.mealCardSelected,
              ]}
              onPress={() => toggleMealSelection(meal.id)}
            >
              <View style={styles.mealHeader}>
                {meal.imageUrl ? (
                  <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
                ) : (
                  <View style={styles.mealImagePlaceholder}>
                    <Icon name="restaurant" size={24} color={BrandColors.text.secondary} />
                  </View>
                )}
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <Text style={styles.mealType}>{meal.mealType.toUpperCase()}</Text>
                </View>
                <Icon
                  name={selectedMeals.includes(meal.id) ? 'check-circle' : 'radio-button-unchecked'}
                  size={24}
                  color={selectedMeals.includes(meal.id) ? BrandColors.primary.orange : '#E0E0E0'}
                />
              </View>
              <Text style={styles.mealDescription} numberOfLines={2}>
                {meal.description}
              </Text>
              <Text style={styles.mealPrice}>₹{meal.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.orderButton, selectedMeals.length === 0 && styles.orderButtonDisabled]}
          onPress={handleOrderMeals}
          disabled={selectedMeals.length === 0}
        >
          <Text style={styles.orderButtonText}>
            Order Selected Meals ({selectedMeals.length})
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  mealPlanImage: {
    width: '100%',
    height: 250,
    resizeMode: 'cover',
  },
  mealPlanImagePlaceholder: {
    width: '100%',
    height: 250,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.md,
  },
  mealPlanName: {
    ...Typography.headingLarge,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  mealPlanDescription: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.md,
  },
  infoSection: {
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    marginLeft: Spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  priceLabel: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
  },
  price: {
    ...Typography.headingLarge,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  mealsSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.md,
  },
  mealCard: {
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  mealCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: '#FFF3E0',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  mealImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  mealImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  mealType: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
  },
  mealDescription: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.xs,
  },
  mealPrice: {
    ...Typography.bodyMedium,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  orderButton: {
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  orderButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  orderButtonText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

