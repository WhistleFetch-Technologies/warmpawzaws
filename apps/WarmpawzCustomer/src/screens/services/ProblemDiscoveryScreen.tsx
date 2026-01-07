/**
 * Problem Discovery Screen - Mobile
 * Category mapper for problem-based service discovery
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
} from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface ProblemDiscoveryScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Problem {
  id: string;
  name: string;
  displayName: string;
  icon?: string;
  category: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  problems: Problem[];
}

const CATEGORIES = [
  { id: 'health', name: 'Health Issues', icon: '🏥' },
  { id: 'behavior', name: 'Behavior', icon: '🐕' },
  { id: 'grooming', name: 'Grooming', icon: '✂️' },
  { id: 'nutrition', name: 'Nutrition', icon: '🍖' },
  { id: 'training', name: 'Training', icon: '🎓' },
  { id: 'emergency', name: 'Emergency', icon: '🚨' },
];

export function ProblemDiscoveryScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: ProblemDiscoveryScreenProps) {
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (selectedCategory) {
      loadProblems(selectedCategory);
    }
  }, [selectedCategory]);

  const loadProblems = async (categoryId: string) => {
    try {
      setLoading(true);
      // ✅ FIX: Use actual API call instead of mock data
      const response = await CustomerApi.getProblemGrid(categoryId);
      const problemsData = (response as any).problems || (response as any).grid || [];
      setProblems(Array.isArray(problemsData) ? problemsData : []);
    } catch (error) {
      console.error('Error loading problems:', error);
      // Set empty array on error instead of mock data
      setProblems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProblemSelect = async (problem: Problem) => {
    setSelectedProblem(problem);
    try {
      // Discover services based on problem
      const response = await EnhancedProblemDiscoveryApi.discoverByProblem(
        'vet', // roleId - default to vet
        problem.id
      );

      if (onNavigate) {
        onNavigate('ServiceDiscovery', {
          problemId: problem.id,
          problemName: problem.displayName,
          services: response.services || [],
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to discover services');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Problem Discovery</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Tell us what problem your pet is facing, and we'll find the right services for you.
        </Text>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Category</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  selectedCategory === category.id && styles.categoryCardSelected,
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text
                  style={[
                    styles.categoryName,
                    selectedCategory === category.id && styles.categoryNameSelected,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Problems */}
        {selectedCategory && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Problem</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.problemsList}>
                {problems.map((problem) => (
                  <TouchableOpacity
                    key={problem.id}
                    style={[
                      styles.problemCard,
                      selectedProblem?.id === problem.id && styles.problemCardSelected,
                    ]}
                    onPress={() => handleProblemSelect(problem)}
                  >
                    {problem.icon && <Text style={styles.problemIcon}>{problem.icon}</Text>}
                    <Text
                      style={[
                        styles.problemName,
                        selectedProblem?.id === problem.id && styles.problemNameSelected,
                      ]}
                    >
                      {problem.displayName}
                    </Text>
                    {selectedProblem?.id === problem.id && (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedCheck}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  backButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  categoryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary.50,
  },
  categoryIcon: {
    fontSize: 32,
    marginBottom: spacing.xs,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: colors.primary,
  },
  loadingContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  problemsList: {
    gap: spacing.sm,
  },
  problemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  problemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary.50,
  },
  problemIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  problemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  problemNameSelected: {
    color: colors.primary,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheck: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

