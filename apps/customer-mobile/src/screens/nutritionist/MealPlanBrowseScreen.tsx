/**
 * Meal Plan Browse Screen - Customer Mobile App
 * Browse available nutritionist meal plans
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface MealPlan {
  id: string;
  name: string;
  description: string;
  duration: number; // days
  price: number;
  imageUrl?: string;
  nutritionistId: string;
  nutritionistName: string;
  mealsPerDay: number;
  totalMeals: number;
}

export default function MealPlanBrowseScreen() {
  const navigation = useNavigation();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMealPlans();
  }, []);

  const loadMealPlans = async () => {
    try {
      setLoading(true);
      // Note: This endpoint needs to be created in backend
      // For now, using a placeholder endpoint
      const response = await fetch(`${API_BASE_URL}/nutritionist/meal-plans`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMealPlans(data.mealPlans || []);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMealPlans();
    setRefreshing(false);
  };

  const handleMealPlanPress = (mealPlan: MealPlan) => {
    navigation.navigate('MealPlanDetail' as never, { mealPlanId: mealPlan.id } as never);
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        </View>
      ) : mealPlans.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="restaurant-menu" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No meal plans available</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {mealPlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.mealPlanCard}
              onPress={() => handleMealPlanPress(plan)}
            >
              {plan.imageUrl ? (
                <Image source={{ uri: plan.imageUrl }} style={styles.mealPlanImage} />
              ) : (
                <View style={styles.mealPlanImagePlaceholder}>
                  <Icon name="restaurant-menu" size={32} color={BrandColors.text.secondary} />
                </View>
              )}
              <View style={styles.mealPlanInfo}>
                <Text style={styles.mealPlanName}>{plan.name}</Text>
                <Text style={styles.mealPlanDescription} numberOfLines={2}>
                  {plan.description}
                </Text>
                <View style={styles.mealPlanDetails}>
                  <View style={styles.detailItem}>
                    <Icon name="schedule" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{plan.duration} days</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon name="restaurant" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{plan.mealsPerDay} meals/day</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Icon name="person" size={16} color={BrandColors.text.secondary} />
                    <Text style={styles.detailText}>{plan.nutritionistName}</Text>
                  </View>
                </View>
                <View style={styles.mealPlanFooter}>
                  <Text style={styles.mealPlanPrice}>₹{plan.price}</Text>
                  <Text style={styles.mealPlanTotalMeals}>{plan.totalMeals} meals total</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
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
  emptyText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  listContainer: {
    flex: 1,
  },
  mealPlanCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mealPlanImage: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  mealPlanImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealPlanInfo: {
    flex: 1,
  },
  mealPlanName: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  mealPlanDescription: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.sm,
  },
  mealPlanDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
    marginBottom: Spacing.xs,
  },
  detailText: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
    marginLeft: 4,
  },
  mealPlanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealPlanPrice: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  mealPlanTotalMeals: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
});

