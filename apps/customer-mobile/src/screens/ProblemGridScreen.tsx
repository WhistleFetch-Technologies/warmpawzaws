/**
 * Problem Grid Screen - Customer Mobile App
 * Displays problem categories for service discovery
 * Matches web app ProblemGridSelector
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, publicAnonKey } from '../../config/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Problem {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  keywords?: string[];
  icon?: string;
}

interface ProblemGridScreenProps {
  route?: {
    params?: {
      roleId?: string;
      roleName?: string;
    };
  };
  navigation?: any;
}

export default function ProblemGridScreen({
  route,
  navigation,
}: ProblemGridScreenProps) {
  const { user } = useAuth();
  const roleId = route?.params?.roleId || 'veterinarian';
  const roleName = route?.params?.roleName || 'Service Provider';

  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  useEffect(() => {
    loadProblemGrid();
  }, [roleId]);

  const loadProblemGrid = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/problem-grid/${roleId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setProblems(data.problems || []);
      } else {
        Alert.alert('Error', 'Failed to load problem categories');
      }
    } catch (error) {
      console.error('Error loading problem grid:', error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const filteredProblems = problems.filter((problem) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      problem.name.toLowerCase().includes(query) ||
      (problem.displayName && problem.displayName.toLowerCase().includes(query)) ||
      (problem.description && problem.description.toLowerCase().includes(query)) ||
      (problem.keywords && problem.keywords.some((keyword) => keyword.toLowerCase().includes(query)))
    );
  });

  const handleProblemSelect = (problem: Problem) => {
    setSelectedProblem(problem);
    // Navigate to vendor discovery
    navigation?.navigate('VendorDiscovery', {
      roleId,
      roleName,
      problemId: problem.id,
      problem: problem,
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        <Text style={[Typography.body, { marginTop: Spacing.base }]}>
          Loading categories...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BrandColors.primary.orange} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation?.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[Typography.h2, styles.headerTitle]}>Find {roleName}</Text>
          <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
            Select your pet's concern
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={BrandColors.neutral.gray400} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search symptoms (e.g. itching, fever)..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Problem Grid */}
        {filteredProblems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={48} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>
              No matching problems found
            </Text>
            <Text style={[Typography.bodySmall, styles.emptySubtext]}>
              Try searching with different keywords
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredProblems.map((problem) => (
              <TouchableOpacity
                key={problem.id}
                style={[
                  styles.problemCard,
                  selectedProblem?.id === problem.id && styles.problemCardSelected,
                ]}
                onPress={() => handleProblemSelect(problem)}
                activeOpacity={0.7}
              >
                <Text style={[Typography.body, styles.problemName]} numberOfLines={2}>
                  {problem.displayName || problem.name}
                </Text>
                {problem.description && (
                  <Text style={[Typography.bodyTiny, styles.problemDescription]} numberOfLines={2}>
                    {problem.description}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: BrandColors.primary.orange,
    paddingTop: Spacing.xl + 20,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  headerContent: {
    marginTop: Spacing.sm,
  },
  headerTitle: {
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: '#FFFFFF',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.base,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.base,
  },
  problemCard: {
    width: '47%',
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: BrandColors.neutral.gray200,
    minHeight: 100,
    justifyContent: 'center',
  },
  problemCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: BrandColors.primary.orange + '10',
  },
  problemName: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  problemDescription: {
    color: BrandColors.neutral.gray600,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: BrandColors.neutral.gray500,
  },
});

