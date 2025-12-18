/**
 * Prescription Builder Screen - Vendor Mobile App
 * Create and manage prescriptions for veterinary bookings
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandedButton } from '../../components/BrandedButton';
import { BrandColors, Typography, BorderRadius, Spacing } from '../../theme';
import PrescriptionService, {
  Medication,
  TestRecommended,
  ProductUsed,
  Vitals,
} from '../../services/PrescriptionService';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface PrescriptionBuilderScreenProps {
  route?: {
    params?: {
      bookingId: string;
      booking?: any;
    };
  };
  navigation?: any;
}

export default function PrescriptionBuilderScreen({
  route,
  navigation,
}: PrescriptionBuilderScreenProps) {
  const { vendor } = useAuth();
  const bookingId = route?.params?.bookingId || '';
  const booking = route?.params?.booking || {};

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Medical Details
  const [diagnosis, setDiagnosis] = useState('');
  const [observations, setObservations] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [productsUsed, setProductsUsed] = useState<ProductUsed[]>([]);
  const [testsRecommended, setTestsRecommended] = useState<TestRecommended[]>([]);

  // Vitals
  const [weight, setWeight] = useState('');
  const [temperature, setTemperature] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');

  // General Notes
  const [generalNotes, setGeneralNotes] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');

  const isVet = vendor?.roleId === 'veterinarian' || booking?.vendorType === 'vet';

  const addMedication = () => {
    setMedications([
      ...medications,
      {
        name: '',
        dosage: '',
        frequency: '',
        duration: '',
        instructions: '',
      },
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const addTest = () => {
    setTestsRecommended([
      ...testsRecommended,
      {
        testName: '',
        priority: 'recommended',
      },
    ]);
  };

  const removeTest = (index: number) => {
    setTestsRecommended(testsRecommended.filter((_, i) => i !== index));
  };

  const updateTest = (
    index: number,
    field: keyof TestRecommended,
    value: string | 'urgent' | 'recommended' | 'optional'
  ) => {
    const updated = [...testsRecommended];
    updated[index] = { ...updated[index], [field]: value };
    setTestsRecommended(updated);
  };

  const addProduct = () => {
    setProductsUsed([
      ...productsUsed,
      {
        name: '',
        quantity: '',
        notes: '',
      },
    ]);
  };

  const removeProduct = (index: number) => {
    setProductsUsed(productsUsed.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof ProductUsed, value: string) => {
    const updated = [...productsUsed];
    updated[index] = { ...updated[index], [field]: value };
    setProductsUsed(updated);
  };

  const handleSubmit = async () => {
    if (isVet && !diagnosis) {
      Alert.alert('Required Field', 'Please enter a diagnosis');
      return;
    }

    if (!isVet && !observations) {
      Alert.alert('Required Field', 'Please enter observations');
      return;
    }

    try {
      setSaving(true);

      const prescriptionData: any = {
        bookingId,
        vendorId: vendor?.id || '',
        generalNotes,
        recommendations,
        nextFollowUpDate: nextFollowUpDate || undefined,
        followUpReason: followUpReason || undefined,
        medications: medications.filter((m) => m.name),
        testsRecommended: testsRecommended.filter((t) => t.testName),
      };

      if (isVet) {
        prescriptionData.diagnosis = diagnosis;
        prescriptionData.vitals = {
          weight: weight ? parseFloat(weight) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          heartRate: heartRate ? parseInt(heartRate) : undefined,
          respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
          bloodPressure: bloodPressure || undefined,
        };
      } else {
        prescriptionData.observations = observations;
        prescriptionData.productsUsed = productsUsed.filter((p) => p.name);
      }

      const prescription = await PrescriptionService.createPrescription(prescriptionData);

      if (prescription) {
        Alert.alert(
          'Success',
          `${isVet ? 'Prescription' : 'Service notes'} saved successfully!`,
          [
            {
              text: 'OK',
              onPress: () => navigation?.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to save prescription');
      }
    } catch (error) {
      console.error('Error saving prescription:', error);
      Alert.alert('Error', 'Failed to save prescription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-back" size={24} color={BrandColors.primary.orange} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[Typography.h2, styles.headerTitle]}>
              {isVet ? 'Prescription' : 'Service Notes'}
            </Text>
            <Text style={[Typography.bodySmall, styles.headerSubtitle]}>
              Booking: {bookingId.substring(0, 12)}...
            </Text>
          </View>
        </View>

        {/* Medical Details */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>
            {isVet ? 'Diagnosis' : 'Observations'}
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder={isVet ? 'Enter diagnosis...' : 'Enter observations...'}
            placeholderTextColor={BrandColors.neutral.gray400}
            value={isVet ? diagnosis : observations}
            onChangeText={isVet ? setDiagnosis : setObservations}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Vitals (Vets only) */}
        {isVet && (
          <View style={styles.section}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Vitals</Text>
            <View style={styles.vitalsGrid}>
              <View style={styles.vitalInput}>
                <Text style={[Typography.bodySmall, styles.vitalLabel]}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.0"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.vitalInput}>
                <Text style={[Typography.bodySmall, styles.vitalLabel]}>Temperature (°F)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.0"
                  value={temperature}
                  onChangeText={setTemperature}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.vitalInput}>
                <Text style={[Typography.bodySmall, styles.vitalLabel]}>Heart Rate (bpm)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={heartRate}
                  onChangeText={setHeartRate}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.vitalInput}>
                <Text style={[Typography.bodySmall, styles.vitalLabel]}>Respiratory Rate</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  value={respiratoryRate}
                  onChangeText={setRespiratoryRate}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.vitalInput, styles.vitalInputFull]}>
                <Text style={[Typography.bodySmall, styles.vitalLabel]}>Blood Pressure</Text>
                <TextInput
                  style={styles.input}
                  placeholder="120/80"
                  value={bloodPressure}
                  onChangeText={setBloodPressure}
                />
              </View>
            </View>
          </View>
        )}

        {/* Medications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.h3, styles.sectionTitle]}>Medications</Text>
            <TouchableOpacity style={styles.addButton} onPress={addMedication}>
              <Icon name="add" size={20} color={BrandColors.primary.orange} />
              <Text style={[Typography.bodySmall, styles.addButtonText]}>Add</Text>
            </TouchableOpacity>
          </View>
          {medications.map((med, index) => (
            <View key={index} style={styles.medicationCard}>
              <View style={styles.medicationHeader}>
                <Text style={[Typography.body, styles.medicationNumber]}>
                  Medication {index + 1}
                </Text>
                <TouchableOpacity onPress={() => removeMedication(index)}>
                  <Icon name="delete" size={20} color={BrandColors.semantic.error} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Medication name"
                value={med.name}
                onChangeText={(text) => updateMedication(index, 'name', text)}
              />
              <View style={styles.medicationRow}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Dosage"
                  value={med.dosage}
                  onChangeText={(text) => updateMedication(index, 'dosage', text)}
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Frequency"
                  value={med.frequency}
                  onChangeText={(text) => updateMedication(index, 'frequency', text)}
                />
              </View>
              <View style={styles.medicationRow}>
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Duration"
                  value={med.duration}
                  onChangeText={(text) => updateMedication(index, 'duration', text)}
                />
                <TextInput
                  style={[styles.input, styles.inputHalf]}
                  placeholder="Instructions"
                  value={med.instructions}
                  onChangeText={(text) => updateMedication(index, 'instructions', text)}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Tests Recommended (Vets only) */}
        {isVet && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Tests Recommended</Text>
              <TouchableOpacity style={styles.addButton} onPress={addTest}>
                <Icon name="add" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.bodySmall, styles.addButtonText]}>Add</Text>
              </TouchableOpacity>
            </View>
            {testsRecommended.map((test, index) => (
              <View key={index} style={styles.testCard}>
                <View style={styles.testHeader}>
                  <TextInput
                    style={[styles.input, styles.testInput]}
                    placeholder="Test name"
                    value={test.testName}
                    onChangeText={(text) => updateTest(index, 'testName', text)}
                  />
                  <View style={styles.priorityButtons}>
                    {(['urgent', 'recommended', 'optional'] as const).map((priority) => (
                      <TouchableOpacity
                        key={priority}
                        style={[
                          styles.priorityButton,
                          test.priority === priority && styles.priorityButtonActive,
                        ]}
                        onPress={() => updateTest(index, 'priority', priority)}
                      >
                        <Text
                          style={[
                            Typography.bodyTiny,
                            test.priority === priority && styles.priorityButtonTextActive,
                          ]}
                        >
                          {priority}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => removeTest(index)}>
                    <Icon name="delete" size={20} color={BrandColors.semantic.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Products Used (Non-vets) */}
        {!isVet && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[Typography.h3, styles.sectionTitle]}>Products Used</Text>
              <TouchableOpacity style={styles.addButton} onPress={addProduct}>
                <Icon name="add" size={20} color={BrandColors.primary.orange} />
                <Text style={[Typography.bodySmall, styles.addButtonText]}>Add</Text>
              </TouchableOpacity>
            </View>
            {productsUsed.map((product, index) => (
              <View key={index} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <Text style={[Typography.body, styles.productNumber]}>
                    Product {index + 1}
                  </Text>
                  <TouchableOpacity onPress={() => removeProduct(index)}>
                    <Icon name="delete" size={20} color={BrandColors.semantic.error} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Product name"
                  value={product.name}
                  onChangeText={(text) => updateProduct(index, 'name', text)}
                />
                <View style={styles.productRow}>
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    placeholder="Quantity"
                    value={product.quantity}
                    onChangeText={(text) => updateProduct(index, 'quantity', text)}
                  />
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    placeholder="Notes"
                    value={product.notes}
                    onChangeText={(text) => updateProduct(index, 'notes', text)}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* General Notes */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>General Notes</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Enter general notes..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={generalNotes}
            onChangeText={setGeneralNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Recommendations</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Enter recommendations..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={recommendations}
            onChangeText={setRecommendations}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Follow-up */}
        <View style={styles.section}>
          <Text style={[Typography.h3, styles.sectionTitle]}>Follow-up</Text>
          <TextInput
            style={styles.input}
            placeholder="Next follow-up date (YYYY-MM-DD)"
            value={nextFollowUpDate}
            onChangeText={setNextFollowUpDate}
          />
          <TextInput
            style={[styles.textArea, { marginTop: Spacing.sm }]}
            placeholder="Follow-up reason..."
            placeholderTextColor={BrandColors.neutral.gray400}
            value={followUpReason}
            onChangeText={setFollowUpReason}
            multiline
            numberOfLines={3}
          />
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <BrandedButton
          title={saving ? 'Saving...' : 'Save Prescription'}
          onPress={handleSubmit}
          disabled={saving}
          variant="primary"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl + 80,
  },
  header: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: BrandColors.neutral.gray600,
  },
  section: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.neutral.gray200,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.base,
  },
  textArea: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  input: {
    padding: Spacing.base,
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
    ...Typography.body,
    color: BrandColors.neutral.gray900,
    marginBottom: Spacing.sm,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  vitalInput: {
    width: '48%',
  },
  vitalInputFull: {
    width: '100%',
  },
  vitalLabel: {
    color: BrandColors.neutral.gray700,
    marginBottom: Spacing.xs,
  },
  medicationCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  medicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  medicationNumber: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  medicationRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  inputHalf: {
    flex: 1,
  },
  testCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  testInput: {
    flex: 1,
    marginBottom: 0,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  priorityButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: BrandColors.neutral.gray200,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray300,
  },
  priorityButtonActive: {
    backgroundColor: BrandColors.primary.orange,
    borderColor: BrandColors.primary.orange,
  },
  priorityButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productCard: {
    backgroundColor: BrandColors.neutral.gray50,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: BrandColors.neutral.gray200,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  productNumber: {
    color: BrandColors.neutral.gray900,
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  addButtonText: {
    color: BrandColors.primary.orange,
    fontWeight: '600',
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: BrandColors.neutral.gray200,
    backgroundColor: '#FFFFFF',
  },
});

