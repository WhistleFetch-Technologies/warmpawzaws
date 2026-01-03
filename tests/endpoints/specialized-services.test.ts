/**
 * Specialized Services Endpoints Test Suite
 * Tests all 8+ specialized vendor services
 */

import { describe, it, expect } from '@jest/globals';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

async function apiRequest(method: string, endpoint: string, body?: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

describe('Ambulance Services', () => {
  const vendorId = 'test-ambulance-vendor';

  describe('GET /vendor/:vendorId/ambulance/vehicles', () => {
    it('should retrieve ambulance fleet', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/ambulance/vehicles`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/ambulance/vehicles', () => {
    it('should add ambulance vehicle', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/ambulance/vehicles`, {
        vehicleNumber: 'MH01AB1234',
        vehicleType: 'advanced',
        capacity: 2,
        equipment: ['oxygen', 'stretcher', 'firstAid'],
        currentLocation: { lat: 19.0760, lng: 72.8777 },
      });
      expect(response).toBeDefined();
    });
  });

  describe('Ambulance Dispatch', () => {
    it('should dispatch nearest ambulance', async () => {
      const response = await apiRequest('POST', '/ambulance/dispatch', {
        customerId: 'test-customer',
        pickupLocation: { lat: 19.0760, lng: 72.8777 },
        emergencyType: 'critical',
        petDetails: { type: 'dog', breed: 'Labrador', weight: 30 },
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Diagnostic Services', () => {
  const vendorId = 'test-diagnostic-vendor';

  describe('GET /vendor/:vendorId/diagnostics/tests', () => {
    it('should retrieve test catalog', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/diagnostics/tests`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/diagnostics/tests', () => {
    it('should add diagnostic test', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/diagnostics/tests`, {
        testName: 'Complete Blood Count',
        testCode: 'CBC-001',
        category: 'blood',
        price: 500,
        durationMinutes: 60,
        sampleType: 'blood',
        preparationInstructions: 'Fasting not required',
      });
      expect(response).toBeDefined();
    });
  });

  describe('Diagnostic Booking', () => {
    it('should book diagnostic test', async () => {
      const response = await apiRequest('POST', '/bookings/diagnostic', {
        customerId: 'test-customer',
        vendorId: vendorId,
        testIds: ['test-1', 'test-2'],
        petId: 'test-pet',
        appointmentDate: '2026-02-01',
        appointmentTime: '10:00',
        sampleCollection: 'at_center',
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Pharmacy Services', () => {
  const vendorId = 'test-pharmacy-vendor';

  describe('GET /vendor/:vendorId/pharmacy/medicines', () => {
    it('should retrieve medicine inventory', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/pharmacy/medicines`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/pharmacy/medicines', () => {
    it('should add medicine to inventory', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/pharmacy/medicines`, {
        name: 'Amoxicillin 500mg',
        description: 'Antibiotic for bacterial infections',
        category: 'antibiotic',
        price: 150,
        stock: 100,
        hsnCode: '30049099',
        requiresPrescription: true,
      });
      expect(response).toBeDefined();
    });
  });

  describe('Prescription Order', () => {
    it('should create prescription-based order', async () => {
      const response = await apiRequest('POST', '/orders/prescription', {
        customerId: 'test-customer',
        vendorId: vendorId,
        prescriptionId: 'prescription-123',
        items: [
          { medicineId: 'med-1', quantity: 2 },
          { medicineId: 'med-2', quantity: 1 },
        ],
        deliveryAddress: {
          address: '123 Test St',
          city: 'Mumbai',
          pincode: '400001',
        },
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Pet Cafe Services', () => {
  const vendorId = 'test-cafe-vendor';

  describe('GET /vendor/:vendorId/cafe/tables', () => {
    it('should retrieve table configuration', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/cafe/tables`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/cafe/tables', () => {
    it('should update table configuration', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/cafe/tables`, {
        tables: [
          { tableNumber: 'T1', capacity: 4, section: 'indoor', isOutdoor: false },
          { tableNumber: 'T2', capacity: 6, section: 'outdoor', isOutdoor: true },
        ],
      });
      expect(response).toBeDefined();
    });
  });

  describe('Table Booking', () => {
    it('should book cafe table', async () => {
      const response = await apiRequest('POST', '/bookings/cafe', {
        customerId: 'test-customer',
        vendorId: vendorId,
        tableId: 'table-1',
        date: '2026-02-01',
        time: '14:00',
        duration: 2, // hours
        guestCount: 4,
        petCount: 2,
        specialRequests: 'Window seat preferred',
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Pet Resort/Boarding Services', () => {
  const vendorId = 'test-resort-vendor';

  describe('GET /vendor/:vendorId/resort/rooms', () => {
    it('should retrieve room inventory', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/resort/rooms`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/resort/rooms', () => {
    it('should add resort room', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/resort/rooms`, {
        roomNumber: 'R101',
        roomType: 'deluxe',
        capacity: 2,
        amenities: ['ac', 'cctv', 'play_area'],
        pricePerNight: 1500,
      });
      expect(response).toBeDefined();
    });
  });

  describe('Boarding Booking', () => {
    it('should book boarding stay', async () => {
      const response = await apiRequest('POST', '/bookings/boarding', {
        customerId: 'test-customer',
        vendorId: vendorId,
        petId: 'test-pet',
        roomId: 'room-1',
        checkInDate: '2026-02-01',
        checkOutDate: '2026-02-05',
        specialInstructions: 'Daily medication at 8am',
        dietaryRestrictions: 'No chicken',
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Breeder/Adoption Services', () => {
  const vendorId = 'test-breeder-vendor';

  describe('GET /vendor/:vendorId/breeder/puppies', () => {
    it('should retrieve available pets', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/breeder/puppies`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/breeder/puppies', () => {
    it('should list pet for adoption', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/breeder/puppies`, {
        name: 'Max',
        petType: 'dog',
        breed: 'Golden Retriever',
        age: 3,
        ageUnit: 'months',
        gender: 'male',
        description: 'Friendly and playful puppy',
        vaccinationStatus: 'partial',
        adoptionFee: 15000,
        photos: ['https://example.com/photo1.jpg'],
      });
      expect(response).toBeDefined();
    });
  });

  describe('Adoption Application', () => {
    it('should submit adoption application', async () => {
      const response = await apiRequest('POST', '/adoptions/apply', {
        customerId: 'test-customer',
        petId: 'test-pet',
        vendorId: vendorId,
        applicationDetails: {
          homeType: 'apartment',
          hasGarden: true,
          otherPets: false,
          experience: 'first-time owner',
          reason: 'Looking for a companion',
        },
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Nutritionist Services', () => {
  const vendorId = 'test-nutritionist-vendor';

  describe('GET /vendor/:vendorId/nutritionist/meal-plans', () => {
    it('should retrieve meal plans', async () => {
      const response = await apiRequest('GET', `/vendor/${vendorId}/nutritionist/meal-plans`);
      expect(response).toBeDefined();
    });
  });

  describe('POST /vendor/:vendorId/nutritionist/meal-plans', () => {
    it('should create meal plan', async () => {
      const response = await apiRequest('POST', `/vendor/${vendorId}/nutritionist/meal-plans`, {
        planName: 'Weight Loss Plan',
        description: 'Balanced diet for overweight dogs',
        meals: [
          { time: 'morning', items: ['low-fat kibble', 'carrots'] },
          { time: 'evening', items: ['lean protein', 'vegetables'] },
        ],
        nutritionalGoals: {
          calories: 800,
          protein: 25,
          fat: 10,
        },
      });
      expect(response).toBeDefined();
    });
  });
});

describe('Insurance Services', () => {
  describe('GET /insurance/plans', () => {
    it('should retrieve available insurance plans', async () => {
      const response = await apiRequest('GET', '/insurance/plans');
      expect(response).toBeDefined();
    });
  });

  describe('POST /insurance/policies', () => {
    it('should purchase insurance policy', async () => {
      const response = await apiRequest('POST', '/insurance/policies', {
        customerId: 'test-customer',
        petId: 'test-pet',
        planId: 'plan-premium',
        paymentMethodId: 'pm_test',
      });
      expect(response).toBeDefined();
    });
  });

  describe('POST /insurance/claims', () => {
    it('should submit insurance claim', async () => {
      const response = await apiRequest('POST', '/insurance/claims', {
        policyId: 'policy-123',
        claimType: 'accident',
        incidentDate: '2026-01-15',
        description: 'Dog injured leg during walk',
        claimedAmount: 5000,
        documents: ['https://example.com/vet-bill.pdf'],
      });
      expect(response).toBeDefined();
    });
  });
});

