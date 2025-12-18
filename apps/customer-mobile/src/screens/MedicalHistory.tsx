/**
 * Medical History Screen - Customer Mobile App
 * Complete medical record management UI
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import { projectId, getPublicAnonKey } from '../../config/api';

interface MedicalRecord {
  id: string;
  type: 'prescription' | 'vaccination' | 'checkup' | 'surgery' | 'lab_report';
  date: string;
  veterinarian?: string;
  clinicName?: string;
  diagnosis?: string;
  medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  notes?: string;
  prescriptionUrl?: string;
  reportUrl?: string;
  vaccinationType?: string;
  nextDueDate?: string;
}

export default function MedicalHistoryScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { petId, petName } = route.params as { petId: string; petName?: string };

  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    loadMedicalHistory();
  }, [petId]);

  const loadMedicalHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/prescription/pet/${petId}`,
        {
          headers: {
            'Authorization': `Bearer ${getPublicAnonKey()}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const prescriptions = data.prescriptions || [];

        // Also load medical history from pet record
        const petResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/pets/${petId}`,
          {
            headers: {
              'Authorization': `Bearer ${getPublicAnonKey()}`,
            },
          }
        );

        let medicalHistory: any[] = [];
        if (petResponse.ok) {
          const petData = await petResponse.json();
          medicalHistory = petData.pet?.medicalHistory || [];
        }

        // Combine and format records
        const allRecords: MedicalRecord[] = [
          ...prescriptions.map((p: any) => ({
            id: p.id,
            type: 'prescription' as const,
            date: p.createdAt || p.uploaded_at,
            veterinarian: p.vendorName || p.doctorName,
            clinicName: p.clinicName,
            diagnosis: p.diagnosis,
            medications: p.medications || [],
            notes: p.notes || p.instructions,
            prescriptionUrl: p.prescriptionUrl,
          })),
          ...medicalHistory.map((m: any) => ({
            id: m.id,
            type: m.type || 'checkup',
            date: m.date || m.addedAt,
            veterinarian: m.veterinarian,
            diagnosis: m.description,
            notes: m.notes,
          })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setRecords(allRecords);
      }
    } catch (error) {
      console.error('Error loading medical history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredRecords = selectedType === 'all'
    ? records
    : records.filter(r => r.type === selectedType);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return 'medication';
      case 'vaccination':
        return 'vaccines';
      case 'checkup':
        return 'medical-services';
      case 'surgery':
        return 'healing';
      case 'lab_report':
        return 'description';
      default:
        return 'medical-information';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'prescription':
        return BrandColors.primary;
      case 'vaccination':
        return '#4CAF50';
      case 'checkup':
        return '#2196F3';
      case 'surgery':
        return '#F44336';
      case 'lab_report':
        return '#FF9800';
      default:
        return BrandColors.secondary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading && records.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color={BrandColors.text} />
          </TouchableOpacity>
          <Text style={[Typography.h2, styles.headerTitle]}>
            Medical History
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BrandColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={BrandColors.text} />
        </TouchableOpacity>
        <Text style={[Typography.h2, styles.headerTitle]}>
          {petName ? `${petName}'s Medical History` : 'Medical History'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {['all', 'prescription', 'vaccination', 'checkup', 'lab_report'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              selectedType === type && styles.filterTabActive,
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Text
              style={[
                Typography.body,
                selectedType === type && styles.filterTabTextActive,
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadMedicalHistory}
            colors={[BrandColors.primary]}
          />
        }
      >
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="medical-services" size={64} color={BrandColors.border} />
            <Text style={[Typography.h3, styles.emptyText]}>
              No Medical Records
            </Text>
            <Text style={[Typography.body, styles.emptySubtext]}>
              Medical records will appear here after consultations
            </Text>
          </View>
        ) : (
          filteredRecords.map((record) => (
            <TouchableOpacity
              key={record.id}
              style={styles.recordCard}
              onPress={() => {
                // Navigate to record detail
                navigation.navigate('PrescriptionView' as never, {
                  prescriptionId: record.id,
                  record,
                } as never);
              }}
            >
              <View style={styles.recordHeader}>
                <View
                  style={[
                    styles.typeIcon,
                    { backgroundColor: getTypeColor(record.type) + '20' },
                  ]}
                >
                  <Icon
                    name={getTypeIcon(record.type)}
                    size={24}
                    color={getTypeColor(record.type)}
                  />
                </View>
                <View style={styles.recordHeaderText}>
                  <Text style={[Typography.h3, styles.recordTitle]}>
                    {record.type.charAt(0).toUpperCase() + record.type.slice(1).replace('_', ' ')}
                  </Text>
                  <Text style={[Typography.bodySmall, styles.recordDate]}>
                    {formatDate(record.date)}
                  </Text>
                </View>
                {record.prescriptionUrl && (
                  <Icon name="download" size={20} color={BrandColors.primary} />
                )}
              </View>

              {record.veterinarian && (
                <Text style={[Typography.body, styles.recordVet]}>
                  Dr. {record.veterinarian}
                  {record.clinicName && ` • ${record.clinicName}`}
                </Text>
              )}

              {record.diagnosis && (
                <View style={styles.recordSection}>
                  <Text style={[Typography.bodySmall, styles.sectionLabel]}>
                    Diagnosis
                  </Text>
                  <Text style={[Typography.body, styles.sectionValue]}>
                    {record.diagnosis}
                  </Text>
                </View>
              )}

              {record.medications && record.medications.length > 0 && (
                <View style={styles.recordSection}>
                  <Text style={[Typography.bodySmall, styles.sectionLabel]}>
                    Medications
                  </Text>
                  {record.medications.map((med, idx) => (
                    <Text key={idx} style={[Typography.body, styles.sectionValue]}>
                      • {med.name} - {med.dosage} ({med.frequency})
                    </Text>
                  ))}
                </View>
              )}

              {record.notes && (
                <View style={styles.recordSection}>
                  <Text style={[Typography.bodySmall, styles.sectionLabel]}>
                    Notes
                  </Text>
                  <Text style={[Typography.body, styles.sectionValue]}>
                    {record.notes}
                  </Text>
                </View>
              )}

              {record.nextDueDate && (
                <View style={styles.nextDueContainer}>
                  <Icon name="event" size={16} color="#4CAF50" />
                  <Text style={[Typography.bodySmall, styles.nextDueText]}>
                    Next due: {formatDate(record.nextDueDate)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: BrandColors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    backgroundColor: BrandColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.border,
  },
  filterContent: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.background,
  },
  filterTabActive: {
    backgroundColor: BrandColors.primary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    marginTop: Spacing.md,
    color: BrandColors.text,
  },
  emptySubtext: {
    marginTop: Spacing.sm,
    color: BrandColors.textSecondary,
    textAlign: 'center',
  },
  recordCard: {
    backgroundColor: BrandColors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  recordHeaderText: {
    flex: 1,
  },
  recordTitle: {
    color: BrandColors.text,
    marginBottom: 2,
  },
  recordDate: {
    color: BrandColors.textSecondary,
  },
  recordVet: {
    color: BrandColors.textSecondary,
    marginBottom: Spacing.sm,
  },
  recordSection: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    color: BrandColors.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  sectionValue: {
    color: BrandColors.text,
  },
  nextDueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#4CAF5020',
    borderRadius: BorderRadius.sm,
  },
  nextDueText: {
    marginLeft: Spacing.sm,
    color: '#4CAF50',
    fontWeight: '600',
  },
});

