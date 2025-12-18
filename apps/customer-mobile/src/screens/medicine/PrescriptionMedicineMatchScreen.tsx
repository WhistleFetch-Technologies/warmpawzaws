/**
 * Prescription Medicine Match Screen - Customer Mobile App
 * Match prescription medications with catalog medicines
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { API_BASE_URL, getPublicAnonKey } from '../../config/api';
import ErrorHandler from '../../utils/errorHandler';

interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface MatchedMedicine {
  medicineId: string;
  name: string;
  genericName?: string;
  manufacturer: string;
  price: number;
  matchScore: number;
  prescriptionMedicine: PrescriptionMedicine;
}

export default function PrescriptionMedicineMatchScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { prescriptionId } = route.params as { prescriptionId: string };

  const [matchedMedicines, setMatchedMedicines] = useState<MatchedMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);

  useEffect(() => {
    loadMatchedMedicines();
  }, [prescriptionId]);

  const loadMatchedMedicines = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/medicine/catalog/by-prescription`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getPublicAnonKey()}`,
          },
          body: JSON.stringify({
            prescriptionId,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMatchedMedicines(data.matchedMedicines || []);
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

  const toggleSelection = (medicineId: string) => {
    setSelectedMedicines((prev) =>
      prev.includes(medicineId) ? prev.filter((id) => id !== medicineId) : [...prev, medicineId]
    );
  };

  const handleAddToCart = () => {
    if (selectedMedicines.length === 0) {
      Alert.alert('Select Medicines', 'Please select at least one medicine to add to cart');
      return;
    }

    const medicines = selectedMedicines.map((id) => ({ medicineId: id, quantity: 1 }));
    navigation.navigate('MedicineOrder' as never, { medicines } as never);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matched Medicines</Text>
        <Text style={styles.headerSubtitle}>
          Based on your prescription, we found these medicines
        </Text>
      </View>

      {matchedMedicines.length === 0 ? (
        <View style={styles.centerContainer}>
          <Icon name="medication" size={64} color={BrandColors.text.secondary} />
          <Text style={styles.emptyText}>No matching medicines found</Text>
        </View>
      ) : (
        <>
          {matchedMedicines.map((match, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.medicineCard,
                selectedMedicines.includes(match.medicineId) && styles.medicineCardSelected,
              ]}
              onPress={() => toggleSelection(match.medicineId)}
            >
              <View style={styles.medicineHeader}>
                <View style={styles.medicineInfo}>
                  <Text style={styles.medicineName}>{match.name}</Text>
                  {match.genericName && (
                    <Text style={styles.medicineGeneric}>{match.genericName}</Text>
                  )}
                  <Text style={styles.medicineManufacturer}>{match.manufacturer}</Text>
                  <View style={styles.prescriptionInfo}>
                    <Text style={styles.prescriptionLabel}>Prescribed:</Text>
                    <Text style={styles.prescriptionText}>
                      {match.prescriptionMedicine.name} - {match.prescriptionMedicine.dosage}
                    </Text>
                  </View>
                </View>
                <Icon
                  name={
                    selectedMedicines.includes(match.medicineId)
                      ? 'check-circle'
                      : 'radio-button-unchecked'
                  }
                  size={24}
                  color={
                    selectedMedicines.includes(match.medicineId)
                      ? BrandColors.primary.orange
                      : '#E0E0E0'
                  }
                />
              </View>
              <View style={styles.medicineFooter}>
                <Text style={styles.medicinePrice}>₹{match.price}</Text>
                <View style={styles.matchScore}>
                  <Icon name="star" size={16} color={BrandColors.primary.orange} />
                  <Text style={styles.matchScoreText}>
                    {Math.round(match.matchScore * 100)}% match
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.addToCartButton,
                selectedMedicines.length === 0 && styles.addToCartButtonDisabled,
              ]}
              onPress={handleAddToCart}
              disabled={selectedMedicines.length === 0}
            >
              <Icon name="shopping-cart" size={20} color="#FFFFFF" />
              <Text style={styles.addToCartText}>
                Add {selectedMedicines.length} to Cart
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    minHeight: 400,
  },
  emptyText: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginTop: Spacing.md,
  },
  header: {
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    ...Typography.headingMedium,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
  },
  medicineCard: {
    margin: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  medicineCardSelected: {
    borderColor: BrandColors.primary.orange,
    backgroundColor: '#FFF3E0',
  },
  medicineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.sm,
  },
  prescriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  prescriptionLabel: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginRight: Spacing.xs,
  },
  prescriptionText: {
    ...Typography.bodySmall,
    color: BrandColors.text.primary,
    fontWeight: '600',
  },
  medicineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  medicinePrice: {
    ...Typography.headingSmall,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  matchScore: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchScoreText: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
    marginLeft: 4,
  },
  actionContainer: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.primary.orange,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  addToCartText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});

