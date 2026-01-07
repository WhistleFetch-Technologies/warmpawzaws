/**
 * Prescription View Screen - Mobile
 * View prescriptions in detail with medicine list
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
import { MedicalHistoryApi } from '../../services/api';

interface PrescriptionViewScreenProps {
  prescriptionId?: string;
  appointmentId?: string;
  prescription?: any;
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  quantity?: number;
}

export function PrescriptionViewScreen({
  prescriptionId,
  appointmentId,
  prescription: initialPrescription,
  phone,
  onBack,
  onNavigate,
}: PrescriptionViewScreenProps) {
  const [prescription, setPrescription] = useState<any>(initialPrescription || null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(!initialPrescription);

  useEffect(() => {
    if (!initialPrescription && (prescriptionId || appointmentId)) {
      loadPrescription();
    } else if (initialPrescription) {
      setMedicines(initialPrescription.medicines || []);
    }
  }, []);

  const loadPrescription = async () => {
    try {
      setLoading(true);
      if (appointmentId) {
        const response = await MedicalHistoryApi.getPrescriptions(appointmentId);
        const prescriptions = response.prescriptions || [];
        if (prescriptionId) {
          const found = prescriptions.find((p: any) => p.id === prescriptionId);
          if (found) {
            setPrescription(found);
            setMedicines(found.medicines || []);
          }
        } else if (prescriptions.length > 0) {
          setPrescription(prescriptions[0]);
          setMedicines(prescriptions[0].medicines || []);
        }
      }
    } catch (error) {
      console.error('Error loading prescription:', error);
      Alert.alert('Error', 'Failed to load prescription');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderMedicines = () => {
    if (onNavigate) {
      onNavigate('PharmacyStore', { 
        medicines: medicines.map(m => ({ name: m.name, quantity: m.quantity || 1 }))
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!prescription) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Prescription not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Prescription</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Prescription Header */}
        <View style={styles.prescriptionHeader}>
          <View style={styles.headerInfo}>
            <Text style={styles.prescriptionDate}>
              {new Date(prescription.createdAt || Date.now()).toLocaleDateString()}
            </Text>
            <Text style={styles.doctorName}>
              Dr. {prescription.doctorName || 'Doctor'}
            </Text>
            {prescription.clinicName && (
              <Text style={styles.clinicName}>{prescription.clinicName}</Text>
            )}
          </View>
        </View>

        {/* Medicines List */}
        <View style={styles.medicinesSection}>
          <Text style={styles.sectionTitle}>Medicines</Text>
          {medicines.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No medicines prescribed</Text>
            </View>
          ) : (
            medicines.map((medicine, index) => (
              <View key={index} style={styles.medicineCard}>
                <View style={styles.medicineHeader}>
                  <Text style={styles.medicineName}>{medicine.name}</Text>
                  {medicine.quantity && (
                    <Text style={styles.medicineQuantity}>Qty: {medicine.quantity}</Text>
                  )}
                </View>
                <View style={styles.medicineDetails}>
                  <View style={styles.medicineDetailRow}>
                    <Text style={styles.medicineDetailLabel}>Dosage</Text>
                    <Text style={styles.medicineDetailValue}>{medicine.dosage}</Text>
                  </View>
                  <View style={styles.medicineDetailRow}>
                    <Text style={styles.medicineDetailLabel}>Frequency</Text>
                    <Text style={styles.medicineDetailValue}>{medicine.frequency}</Text>
                  </View>
                  <View style={styles.medicineDetailRow}>
                    <Text style={styles.medicineDetailLabel}>Duration</Text>
                    <Text style={styles.medicineDetailValue}>{medicine.duration}</Text>
                  </View>
                  {medicine.instructions && (
                    <View style={styles.instructionsContainer}>
                      <Text style={styles.instructionsLabel}>Instructions</Text>
                      <Text style={styles.instructionsText}>{medicine.instructions}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Additional Notes */}
        {prescription.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Doctor's Notes</Text>
            <Text style={styles.notesText}>{prescription.notes}</Text>
          </View>
        )}

        {/* Action Button */}
        {medicines.length > 0 && (
          <TouchableOpacity
            style={styles.orderButton}
            onPress={handleOrderMedicines}
          >
            <Text style={styles.orderButtonText}>Order Medicines</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  prescriptionHeader: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerInfo: {
    alignItems: 'center',
  },
  prescriptionDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  clinicName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  medicinesSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  medicineCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  medicineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  medicineName: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  medicineQuantity: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  medicineDetails: {
    gap: spacing.sm,
  },
  medicineDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  medicineDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  medicineDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  instructionsContainer: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.gray['100'],
    borderRadius: borderRadius.sm,
  },
  instructionsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  instructionsText: {
    fontSize: 14,
    color: colors.text,
  },
  notesSection: {
    marginBottom: spacing.lg,
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  orderButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

