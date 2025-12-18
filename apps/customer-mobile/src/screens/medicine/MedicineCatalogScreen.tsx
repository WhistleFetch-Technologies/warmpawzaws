/**
 * Medicine Catalog Screen - Customer Mobile App
 * Browse and search medicines
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
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

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer: string;
  category: string;
  price: number;
  stock: number;
  requiresPrescription: boolean;
  imageUrl?: string;
  vendorName: string;
}

export default function MedicineCatalogScreen() {
  const navigation = useNavigation();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    loadMedicines();
    loadCategories();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeout = setTimeout(() => {
        searchMedicines();
      }, 500);
      return () => clearTimeout(timeout);
    } else if (searchQuery.length === 0) {
      loadMedicines();
    }
  }, [searchQuery, selectedCategory]);

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/medicine/catalog/categories`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
      });

      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }

      const response = await fetch(`${API_BASE_URL}/medicine/catalog/search?${params}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMedicines(data.medicines || []);
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

  const searchMedicines = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '50',
        offset: '0',
      });

      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory);
      }

      const response = await fetch(`${API_BASE_URL}/medicine/catalog/search?${params}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMedicines(data.medicines || []);
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
    await loadMedicines();
    setRefreshing(false);
  };

  const handleMedicinePress = (medicine: Medicine) => {
    navigation.navigate('MedicineDetail' as never, { medicineId: medicine.id } as never);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={24} color={BrandColors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={BrandColors.text.secondary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close" size={24} color={BrandColors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
        <TouchableOpacity
          style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[styles.categoryText, selectedCategory === 'all' && styles.categoryTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
              {category.replace('_', ' ').toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Medicines List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        </View>
      ) : medicines.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="medication" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No medicines found</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {medicines.map((medicine) => (
            <TouchableOpacity
              key={medicine.id}
              style={styles.medicineCard}
              onPress={() => handleMedicinePress(medicine)}
            >
              {medicine.imageUrl ? (
                <Image source={{ uri: medicine.imageUrl }} style={styles.medicineImage} />
              ) : (
                <View style={styles.medicineImagePlaceholder}>
                  <Icon name="medication" size={32} color={BrandColors.text.secondary} />
                </View>
              )}
              <View style={styles.medicineInfo}>
                <Text style={styles.medicineName}>{medicine.name}</Text>
                {medicine.genericName && (
                  <Text style={styles.medicineGeneric}>{medicine.genericName}</Text>
                )}
                <Text style={styles.medicineManufacturer}>{medicine.manufacturer}</Text>
                <View style={styles.medicineFooter}>
                  <Text style={styles.medicinePrice}>₹{medicine.price}</Text>
                  {medicine.requiresPrescription && (
                    <View style={styles.prescriptionBadge}>
                      <Icon name="verified" size={14} color={BrandColors.primary.orange} />
                      <Text style={styles.prescriptionText}>Rx</Text>
                    </View>
                  )}
                </View>
                {medicine.stock === 0 && (
                  <Text style={styles.outOfStock}>Out of Stock</Text>
                )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    color: BrandColors.text.primary,
  },
  categoriesContainer: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F5F5F5',
    marginRight: Spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: BrandColors.primary.orange,
  },
  categoryText: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
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
  medicineCard: {
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
  medicineImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
  },
  medicineImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.md,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  medicineGeneric: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.xs,
  },
  medicineManufacturer: {
    ...Typography.bodyTiny,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.sm,
  },
  medicineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medicinePrice: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  prescriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  prescriptionText: {
    ...Typography.bodyTiny,
    color: BrandColors.primary.orange,
    marginLeft: 4,
    fontWeight: '600',
  },
  outOfStock: {
    ...Typography.bodySmall,
    color: '#F44336',
    marginTop: Spacing.xs,
  },
});

