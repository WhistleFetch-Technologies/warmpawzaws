/**
 * Search Screen - Customer Mobile App
 * Elastic search for services, vendors, and providers
 * Supports problem grid discovery and location-based filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import SearchService, { SearchResult, SearchFilters } from '../../services/SearchService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SearchScreenProps {
  navigation?: any;
  route?: {
    params?: {
      roleId?: string;
      problemId?: string;
      initialQuery?: string;
    };
  };
}

export default function SearchScreen({ navigation, route }: SearchScreenProps) {
  const { user } = useAuth();
  const roleId = route?.params?.roleId;
  const problemId = route?.params?.problemId;
  const initialQuery = route?.params?.initialQuery || '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    roleId,
    problemId,
    sortBy: 'relevance',
    entityType: 'all',
  });
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load initial results if problemId is provided
  useEffect(() => {
    if (problemId && roleId) {
      loadProblemDiscovery();
    }
  }, [problemId, roleId]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (searchQuery.length >= 2) {
      const timeout = setTimeout(() => {
        performSearch();
      }, 500); // 500ms debounce
      setSearchTimeout(timeout);
    } else if (searchQuery.length === 0 && !problemId) {
      setResults([]);
    }

    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchQuery]);

  const loadProblemDiscovery = async () => {
    if (!problemId || !roleId) return;

    try {
      setLoading(true);
      const response = await SearchService.discoverByProblemV2(problemId, roleId, filters);
      setResults(response.results);
    } catch (error) {
      console.error('Error loading problem discovery:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    if (searchQuery.length < 2) return;

    try {
      setLoading(true);
      const response = await SearchService.searchWithLocation(searchQuery, filters);
      setResults(response.results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (problemId && roleId) {
      await loadProblemDiscovery();
    } else if (searchQuery.length >= 2) {
      await performSearch();
    }
    setRefreshing(false);
  }, [problemId, roleId, searchQuery]);

  const handleResultPress = (result: SearchResult) => {
    if (result.type === 'vendor' || result.entityType === 'center') {
      navigation?.navigate('ServiceSelection', {
        vendorId: result.vendorId || result.id,
        vendorName: result.businessName || result.name,
        roleId: filters.roleId,
        problemId: filters.problemId,
      });
    } else if (result.type === 'staff' || result.entityType === 'staff') {
      navigation?.navigate('ServiceSelection', {
        vendorId: result.vendorId || result.id,
        vendorName: result.fullName || result.name,
        staffId: result.staffId,
        roleId: filters.roleId,
        problemId: filters.problemId,
      });
    }
  };

  const toggleFilter = (filterType: 'all' | 'staff' | 'center') => {
    setFilters({ ...filters, entityType: filterType });
  };

  const filteredResults = results.filter((result) => {
    if (filters.entityType === 'all') return true;
    if (filters.entityType === 'center') return result.entityType === 'center';
    if (filters.entityType === 'staff') return result.entityType === 'staff';
    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={BrandColors.neutral.gray400} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services, providers..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={!problemId}
            returnKeyType="search"
            onSubmitEditing={performSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setResults([]);
              }}
              style={styles.clearButton}
            >
              <Icon name="close" size={20} color={BrandColors.neutral.gray400} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.cancelButton}>
          <Text style={[Typography.body, { color: BrandColors.primary.orange }]}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {results.length > 0 && (
        <View style={styles.filters}>
          {(['all', 'staff', 'center'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                filters.entityType === filter && styles.filterButtonActive,
              ]}
              onPress={() => toggleFilter(filter)}
            >
              <Text
                style={[
                  Typography.bodySmall,
                  filters.entityType === filter && styles.filterButtonTextActive,
                ]}
              >
                {filter === 'all' ? 'All' : filter === 'staff' ? 'Individual' : 'Centers'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BrandColors.primary.orange} />
        }
      >
        {loading && results.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={BrandColors.primary.orange} />
            <Text style={[Typography.body, styles.loadingText]}>Searching...</Text>
          </View>
        ) : filteredResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="search-off" size={48} color={BrandColors.neutral.gray300} />
            <Text style={[Typography.body, styles.emptyText]}>
              {searchQuery ? 'No results found' : 'Start typing to search'}
            </Text>
            {searchQuery && (
              <Text style={[Typography.bodySmall, styles.emptySubtext]}>
                Try different keywords or adjust filters
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.resultsList}>
            {filteredResults.map((result) => (
              <TouchableOpacity
                key={result.id}
                style={styles.resultCard}
                onPress={() => handleResultPress(result)}
                activeOpacity={0.7}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.resultInfo}>
                    <Text style={[Typography.h4, styles.resultName]} numberOfLines={1}>
                      {result.businessName || result.fullName || result.name}
                    </Text>
                    {result.rating && (
                      <View style={styles.ratingRow}>
                        <Icon name="star" size={16} color={BrandColors.semantic.warning} />
                        <Text style={[Typography.bodySmall, styles.rating]}>
                          {result.rating.toFixed(1)}
                        </Text>
                        {result.reviews && (
                          <Text style={[Typography.bodyTiny, styles.reviews]}>
                            ({result.reviews})
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  <Icon name="chevron-right" size={24} color={BrandColors.neutral.gray400} />
                </View>

                {result.description && (
                  <Text style={[Typography.bodyTiny, styles.description]} numberOfLines={2}>
                    {result.description}
                  </Text>
                )}

                {result.location?.address && (
                  <View style={styles.locationRow}>
                    <Icon name="location-on" size={16} color={BrandColors.neutral.gray500} />
                    <Text style={[Typography.bodyTiny, styles.location]} numberOfLines={1}>
                      {result.location.address}
                    </Text>
                  </View>
                )}

                {result.distance && (
                  <View style={styles.distanceRow}>
                    <Icon name="directions-walk" size={16} color={BrandColors.primary.orange} />
                    <Text style={[Typography.bodyTiny, styles.distance]}>
                      {result.distance.toFixed(1)} km away
                    </Text>
                  </View>
                )}

                {result.consultationFee && (
                  <Text style={[Typography.bodySmall, styles.fee]}>
                    ₹{result.consultationFee} consultation fee
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base,
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
  clearButton: {
    padding: Spacing.xs,
  },
  cancelButton: {
    padding: Spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.base,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  filterButton: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray100,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  filterButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  loadingText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    minHeight: 400,
  },
  emptyText: {
    color: BrandColors.neutral.gray600,
    marginTop: Spacing.base,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: BrandColors.neutral.gray500,
  },
  resultsList: {
    padding: Spacing.lg,
    gap: Spacing.base,
  },
  resultCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rating: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
  },
  reviews: {
    color: BrandColors.neutral.gray500,
  },
  description: {
    color: BrandColors.neutral.gray600,
    marginBottom: Spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  location: {
    color: BrandColors.neutral.gray600,
    flex: 1,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  distance: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  fee: {
    color: BrandColors.neutral.gray700,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
});

