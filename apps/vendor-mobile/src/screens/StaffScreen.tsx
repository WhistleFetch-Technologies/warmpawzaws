/**
 * Staff Screen - Vendor Mobile App
 * Manage staff members
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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import vendorService from '../services/api';
import { handleApiError, getErrorMessage } from '../utils/errorHandler';
import Icon from 'react-native-vector-icons/MaterialIcons';

type StaffScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function StaffScreen() {
  const navigation = useNavigation<StaffScreenNavigationProp>();
  const { vendor, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && vendor) {
      loadStaff();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, vendor]);

  const loadStaff = async () => {
    if (!vendor?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      // TODO: Uncomment when API is ready
      // const response = await vendorService.getStaff(vendor.id);
      // setStaff(response.staff || []);
      
      // Placeholder for now
      setStaff([]);
      setLoading(false);
    } catch (err) {
      const apiError = handleApiError(err);
      const errorMessage = getErrorMessage(apiError);
      setError(errorMessage);
      setLoading(false);
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddStaff')}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF8C42" style={styles.loader} />
      ) : staff.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="people" size={64} color="#ccc" />
          <Text style={styles.emptyStateText}>No staff members yet</Text>
          <TouchableOpacity
            style={styles.addStaffButton}
            onPress={() => navigation.navigate('AddStaff')}
          >
            <Text style={styles.addStaffButtonText}>Add Staff</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {staff.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={styles.staffCard}
              onPress={() => navigation.navigate('StaffDetail', { staffId: member.id })}
            >
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{member.name}</Text>
                <Text style={styles.staffRole}>{member.role}</Text>
                <Text style={styles.staffStatus}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color="#ccc" />
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF8C42',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  loader: {
    marginTop: 50,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  staffRole: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  staffStatus: {
    fontSize: 12,
    color: '#4CAF50',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  addStaffButton: {
    backgroundColor: '#FF8C42',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  addStaffButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

