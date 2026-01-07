/**
 * Address Book Screen - Mobile
 * Manage delivery addresses
 * Identical functionality to web app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { CustomerApi } from '../../services/api';

interface AddressBookScreenProps {
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Address {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export function AddressBookScreen({
  phone,
  customerId,
  onBack,
  onNavigate,
}: AddressBookScreenProps) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      if (customerId) {
        const response = await CustomerApi.getAddresses(customerId);
        const addressesData = Array.isArray(response) ? response : (response as any).addresses || [];
        
        const formattedAddresses: Address[] = addressesData.map((addr: any) => ({
          id: addr.id,
          name: addr.label || addr.name || 'Address',
          phone: addr.phone || phone,
          address: addr.addressLine1 || addr.address || '',
          city: addr.city || '',
          state: addr.state || '',
          pincode: addr.pincode || '',
          landmark: addr.landmark || '',
          isDefault: addr.isDefault || false,
          location: addr.latitude && addr.longitude ? {
            latitude: addr.latitude,
            longitude: addr.longitude,
          } : undefined,
        }));
        
        setAddresses(formattedAddresses);
      }
    } catch (error) {
      console.error('Error loading addresses:', error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      if (customerId) {
        await CustomerApi.setDefaultAddress(customerId, addressId);
        setAddresses(addresses.map(addr => ({
          ...addr,
          isDefault: addr.id === addressId,
        })));
      }
    } catch (error: any) {
      console.error('Error setting default address:', error);
      Alert.alert('Error', error.message || 'Failed to set default address');
    }
  };

  const handleDelete = (addressId: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CustomerApi.deleteAddress(addressId);
              setAddresses(addresses.filter(addr => addr.id !== addressId));
            } catch (error: any) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', error.message || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (address: Address) => {
    if (onNavigate) {
      onNavigate('Addresses', { editAddress: address });
    }
  };

  const renderAddressItem = ({ item }: { item: Address }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressInfo}>
          <Text style={styles.addressName}>{item.name}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          )}
        </View>
      </View>
      <Text style={styles.addressText}>{item.address}</Text>
      <Text style={styles.addressText}>
        {item.city}, {item.state} - {item.pincode}
      </Text>
      {item.landmark && (
        <Text style={styles.landmarkText}>Landmark: {item.landmark}</Text>
      )}
      <Text style={styles.phoneText}>{item.phone}</Text>
      <View style={styles.addressActions}>
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(item.id)}
          >
            <Text style={styles.actionButtonText}>Set as Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEdit(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item.id)}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address Book</Text>
        <View style={styles.placeholder} />
      </View>

      {addresses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>No Addresses</Text>
          <Text style={styles.emptySubtitle}>
            Add an address to get started
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onNavigate && onNavigate('Addresses')}
          >
            <Text style={styles.addButtonText}>+ Add Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={addresses}
            renderItem={renderAddressItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
          />
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => onNavigate && onNavigate('Addresses')}
            >
              <Text style={styles.addButtonText}>+ Add New Address</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.md,
  },
  addressCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  addressInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  defaultBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
  },
  defaultBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  addressText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  landmarkText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  phoneText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  addressActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray.100,
  },
  actionButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: colors.error + 20% opacity,
  },
  deleteButtonText: {
    color: colors.error,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  footer: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

