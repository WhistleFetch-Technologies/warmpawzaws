/**
 * Appointment Detail Screen - Mobile
 * Detailed appointment view with prescriptions and medical records
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
import { AppointmentApi, MedicalHistoryApi } from '../../services/api';

interface AppointmentDetailScreenProps {
  appointmentId: string;
  phone: string;
  customerId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function AppointmentDetailScreen({
  appointmentId,
  phone,
  customerId,
  onNavigate,
  onBack,
}: AppointmentDetailScreenProps) {
  const [appointment, setAppointment] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'prescriptions' | 'records'>('details');

  useEffect(() => {
    loadAppointment();
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const response = await AppointmentApi.getAppointment(appointmentId);
      setAppointment(response.appointment || response);

      // Load prescriptions
      const prescResponse = await MedicalHistoryApi.getPrescriptions(appointmentId);
      setPrescriptions(prescResponse.prescriptions || []);
    } catch (error) {
      console.error('Error loading appointment:', error);
      Alert.alert('Error', 'Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await AppointmentApi.cancelAppointment(appointmentId);
              Alert.alert('Success', 'Appointment cancelled');
              if (onNavigate) {
                onNavigate('AppointmentList');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel appointment');
            }
          },
        },
      ]
    );
  };

  const handleReschedule = () => {
    if (onNavigate) {
      onNavigate('AppointmentReschedule', {
        appointmentId,
        currentDate: appointment?.appointmentDate,
        currentTime: appointment?.appointmentTime,
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

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Appointment not found</Text>
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
        <Text style={styles.headerTitle}>Appointment Details</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'details' && styles.tabActive]}
          onPress={() => setActiveTab('details')}
        >
          <Text style={[styles.tabText, activeTab === 'details' && styles.tabTextActive]}>
            Details
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'prescriptions' && styles.tabActive]}
          onPress={() => setActiveTab('prescriptions')}
        >
          <Text style={[styles.tabText, activeTab === 'prescriptions' && styles.tabTextActive]}>
            Prescriptions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'records' && styles.tabActive]}
          onPress={() => setActiveTab('records')}
        >
          <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>
            Records
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'details' && (
          <View style={styles.detailsSection}>
            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Appointment Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Service</Text>
                <Text style={styles.infoValue}>{appointment.serviceName || 'Service'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pet</Text>
                <Text style={styles.infoValue}>{appointment.petName || 'Pet'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date</Text>
                <Text style={styles.infoValue}>
                  {new Date(appointment.appointmentDate || Date.now()).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Time</Text>
                <Text style={styles.infoValue}>{appointment.appointmentTime || 'N/A'}</Text>
              </View>
              {appointment.doctorName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Doctor</Text>
                  <Text style={styles.infoValue}>Dr. {appointment.doctorName}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vendor</Text>
                <Text style={styles.infoValue}>{appointment.vendorName || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.statusText, { color: colors.primary }]}>
                    {appointment.status?.toUpperCase() || 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.rescheduleButton}
                  onPress={handleReschedule}
                >
                  <Text style={styles.rescheduleButtonText}>Reschedule</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {activeTab === 'prescriptions' && (
          <View style={styles.prescriptionsSection}>
            {prescriptions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>💊</Text>
                <Text style={styles.emptyTitle}>No Prescriptions</Text>
                <Text style={styles.emptySubtitle}>
                  Prescriptions will appear here after the appointment
                </Text>
              </View>
            ) : (
              prescriptions.map((prescription, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.prescriptionCard}
                  onPress={() => onNavigate && onNavigate('PrescriptionView', { prescription })}
                >
                  <Text style={styles.prescriptionDate}>
                    {new Date(prescription.createdAt || Date.now()).toLocaleDateString()}
                  </Text>
                  <Text style={styles.prescriptionDoctor}>
                    Dr. {prescription.doctorName || 'Doctor'}
                  </Text>
                  <Text style={styles.prescriptionMedicines}>
                    {prescription.medicines?.length || 0} medicines
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {activeTab === 'records' && (
          <View style={styles.recordsSection}>
            <TouchableOpacity
              style={styles.recordCard}
              onPress={() => onNavigate && onNavigate('MedicalRecords', { 
                petId: appointment.petId,
                appointmentId: appointment.id 
              })}
            >
              <Text style={styles.recordCardTitle}>View Medical Records</Text>
              <Text style={styles.recordCardSubtitle}>
                View all medical records for {appointment.petName}
              </Text>
            </TouchableOpacity>
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
    backgroundColor: '#fff',
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  detailsSection: {
    gap: spacing.md,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rescheduleButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  rescheduleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#fee2e2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  prescriptionsSection: {
    gap: spacing.md,
  },
  emptyContainer: {
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
    textAlign: 'center',
  },
  prescriptionCard: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prescriptionDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  prescriptionDoctor: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  prescriptionMedicines: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  recordsSection: {
    gap: spacing.md,
  },
  recordCard: {
    backgroundColor: '#fff',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recordCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  recordCardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

