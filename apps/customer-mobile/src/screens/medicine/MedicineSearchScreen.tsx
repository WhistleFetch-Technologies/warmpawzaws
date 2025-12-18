/**
 * Medicine Search Screen - Customer Mobile App
 * Advanced search for medicines with filters
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
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
  price: number;
  category: string;
}

export default function MedicineSearchScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timeout = setTimeout(() => {
        performSearch();
      }, 500);
      return () => clearTimeout(timeout);
    } else {
      setResults([]);
    }
  }, [searchQuery, selectedCategory]);

  const performSearch = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '50',
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
        setResults(data.medicines || []);
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

  const handleMedicinePress = (medicine: Medicine) => {
    navigation.navigate('MedicineDetail' as never, { medicineId: medicine.id } as never);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={24} color={BrandColors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={BrandColors.text.secondary}
          autoFocus
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close" size={24} color={BrandColors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary.orange} />
        </View>
      ) : results.length === 0 && searchQuery.length >= 2 ? (
        <View style={styles.centerContainer}>
          <Icon name="search-off" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No medicines found</Text>
        </View>
      ) : (
        <ScrollView style={styles.listContainer}>
          {results.map((medicine) => (
            <TouchableOpacity
              key={medicine.id}
              style={styles.medicineCard}
              onPress={() => handleMedicinePress(medicine)}
            >
              <View style={styles.medicineInfo}>
                <Text style={styles.medicineName}>{medicine.name}</Text>
                {medicine.genericName && (
                  <Text style={styles.medicineGeneric}>{medicine.genericName}</Text>
                )}
                <Text style={styles.medicineManufacturer}>{medicine.manufacturer}</Text>
                <Text style={styles.medicinePrice}>₹{medicine.price}</Text>
              </View>
              <Icon name="chevron-right" size={24} color={BrandColors.text.secondary} />
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
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
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
    marginBottom: Spacing.xs,
  },
  medicinePrice: {
    ...Typography.bodyMedium,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
});

