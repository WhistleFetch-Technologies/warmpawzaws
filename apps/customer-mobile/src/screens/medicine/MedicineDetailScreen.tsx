/**
 * Medicine Detail Screen - Customer Mobile App
 * View medicine details and add to cart
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
// import { BrandedButton } from '../../components/BrandedButton'; // TODO: Add if component exists
import ErrorHandler from '../../utils/errorHandler';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer: string;
  category: string;
  description: string;
  dosage: string;
  price: number;
  stock: number;
  requiresPrescription: boolean;
  imageUrl?: string;
  vendorId: string;
  vendorName: string;
}

export default function MedicineDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { medicineId } = route.params as { medicineId: string };

  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadMedicineDetails();
  }, [medicineId]);

  const loadMedicineDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/medicine/catalog/${medicineId}`, {
        headers: {
          Authorization: `Bearer ${getPublicAnonKey()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMedicine(data.medicine);
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

  const handleAddToCart = () => {
    if (!medicine) return;

    if (medicine.stock === 0) {
      Alert.alert('Out of Stock', 'This medicine is currently out of stock.');
      return;
    }

    if (medicine.requiresPrescription) {
      Alert.alert(
        'Prescription Required',
        'This medicine requires a prescription. Please upload a prescription to order.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload Prescription',
            onPress: () => {
              // Navigate to prescription upload screen
              navigation.navigate('PrescriptionUpload' as never, { medicineId: medicine.id } as never);
            },
          },
        ]
      );
      return;
    }

    // Add to cart logic here
    Alert.alert('Added to Cart', `${medicine.name} added to cart`);
  };

  const handleBuyNow = () => {
    if (!medicine) return;

    if (medicine.stock === 0) {
      Alert.alert('Out of Stock', 'This medicine is currently out of stock.');
      return;
    }

    if (medicine.requiresPrescription) {
      Alert.alert(
        'Prescription Required',
        'This medicine requires a prescription. Please upload a prescription to order.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload Prescription',
            onPress: () => {
              navigation.navigate('PrescriptionUpload' as never, { medicineId: medicine.id } as never);
            },
          },
        ]
      );
      return;
    }

    // Navigate to order screen
    navigation.navigate('MedicineOrder' as never, {
      medicines: [{ medicineId: medicine.id, quantity }],
    } as never);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.orange} />
      </View>
    );
  }

  if (!medicine) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={64} color={BrandColors.text.secondary} />
        <Text style={styles.errorText}>Medicine not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {medicine.imageUrl ? (
        <Image source={{ uri: medicine.imageUrl }} style={styles.medicineImage} />
      ) : (
        <View style={styles.medicineImagePlaceholder}>
          <Icon name="medication" size={64} color={BrandColors.text.secondary} />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.medicineName}>{medicine.name}</Text>
        {medicine.genericName && (
          <Text style={styles.medicineGeneric}>Generic: {medicine.genericName}</Text>
        )}

        <View style={styles.priceContainer}>
          <Text style={styles.price}>₹{medicine.price}</Text>
          {medicine.requiresPrescription && (
            <View style={styles.prescriptionBadge}>
              <Icon name="verified" size={16} color={BrandColors.primary.orange} />
              <Text style={styles.prescriptionText}>Prescription Required</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Manufacturer</Text>
          <Text style={styles.sectionContent}>{medicine.manufacturer}</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Category</Text>
          <Text style={styles.sectionContent}>{medicine.category.replace('_', ' ').toUpperCase()}</Text>
        </View>

        {medicine.description && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.sectionContent}>{medicine.description}</Text>
          </View>
        )}

        {medicine.dosage && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Dosage</Text>
            <Text style={styles.sectionContent}>{medicine.dosage}</Text>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Stock</Text>
          <Text style={[styles.sectionContent, medicine.stock === 0 && styles.outOfStock]}>
            {medicine.stock === 0 ? 'Out of Stock' : `${medicine.stock} units available`}
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Vendor</Text>
          <Text style={styles.sectionContent}>{medicine.vendorName}</Text>
        </View>

        {/* Quantity Selector */}
        <View style={styles.quantityContainer}>
          <Text style={styles.quantityLabel}>Quantity:</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity === 1}
            >
              <Icon name="remove" size={20} color={BrandColors.primary.orange} />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.min(medicine.stock, quantity + 1))}
              disabled={quantity >= medicine.stock}
            >
              <Icon name="add" size={20} color={BrandColors.primary.orange} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.addToCartButton]}
            onPress={handleAddToCart}
            disabled={medicine.stock === 0}
          >
            <Icon name="shopping-cart" size={20} color="#FFFFFF" />
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.buyNowButton]}
            onPress={handleBuyNow}
            disabled={medicine.stock === 0}
          >
            <Text style={styles.buyNowText}>Buy Now</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>₹{medicine.price * quantity}</Text>
        </View>
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
  medicineImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  medicineImagePlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.md,
  },
  medicineName: {
    ...Typography.headingLarge,
    color: BrandColors.text.primary,
    marginBottom: Spacing.xs,
  },
  medicineGeneric: {
    ...Typography.bodyMedium,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.md,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  price: {
    ...Typography.headingLarge,
    color: BrandColors.primary.orange,
    fontWeight: '600',
    marginRight: Spacing.md,
  },
  prescriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  prescriptionText: {
    ...Typography.bodySmall,
    color: BrandColors.primary.orange,
    marginLeft: 4,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.bodySmall,
    color: BrandColors.text.secondary,
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  sectionContent: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
  },
  outOfStock: {
    color: '#F44336',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#F5F5F5',
    borderRadius: BorderRadius.md,
  },
  quantityLabel: {
    ...Typography.bodyMedium,
    color: BrandColors.text.primary,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.primary.orange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
    marginHorizontal: Spacing.md,
    minWidth: 30,
    textAlign: 'center',
  },
  actionContainer: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToCartButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: BrandColors.primary.orange,
  },
  addToCartText: {
    ...Typography.bodyMedium,
    color: BrandColors.primary.orange,
    marginLeft: Spacing.xs,
    fontWeight: '600',
  },
  buyNowButton: {
    backgroundColor: BrandColors.primary.orange,
  },
  buyNowText: {
    ...Typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    ...Typography.headingSmall,
    color: BrandColors.text.primary,
  },
  totalAmount: {
    ...Typography.headingLarge,
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
});

