/**
 * Medicine Catalog Endpoints
 * Browse medicines, search, and order
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { getElasticsearchClient } from './elasticsearch-client.tsx';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  manufacturer: string;
  category: 'antibiotic' | 'vitamin' | 'supplement' | 'pain_relief' | 'skin_care' | 'other';
  description: string;
  dosage: string;
  price: number;
  stock: number;
  requiresPrescription: boolean;
  imageUrl?: string;
  vendorId: string;
  vendorName: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * Register medicine catalog endpoints
 */
export function registerMedicineCatalogEndpoints(app: Hono) {
  const esClient = getElasticsearchClient();

  /**
   * Search medicines
   * GET /make-server-3dd53475/medicine/catalog/search
   */
  app.get('/make-server-3dd53475/medicine/catalog/search', async (c) => {
    try {
      const query = c.req.query('q') || '';
      const category = c.req.query('category');
      const requiresPrescription = c.req.query('requiresPrescription');
      const priceMin = parseFloat(c.req.query('priceMin') || '0');
      const priceMax = parseFloat(c.req.query('priceMax') || '999999');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      // Get all medicines from KV store
      const allMedicines = await kv.getByPrefix('medicine:catalog:');

      let filtered = allMedicines.filter((m: any) => {
        if (!m.isActive) return false;

        if (query) {
          const searchLower = query.toLowerCase();
          const nameMatch = (m.name || '').toLowerCase().includes(searchLower);
          const genericMatch = (m.genericName || '').toLowerCase().includes(searchLower);
          const descMatch = (m.description || '').toLowerCase().includes(searchLower);
          if (!nameMatch && !genericMatch && !descMatch) return false;
        }

        if (category && m.category !== category) return false;
        if (requiresPrescription !== undefined) {
          const reqPresc = requiresPrescription === 'true';
          if (m.requiresPrescription !== reqPresc) return false;
        }

        const price = m.price || 0;
        if (price < priceMin || price > priceMax) return false;

        return true;
      });

      // Sort by relevance/name
      filtered.sort((a: any, b: any) => {
        if (query) {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const queryLower = query.toLowerCase();
          if (aName.startsWith(queryLower) && !bName.startsWith(queryLower)) return -1;
          if (!aName.startsWith(queryLower) && bName.startsWith(queryLower)) return 1;
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      return c.json({
        success: true,
        medicines: filtered.slice(offset, offset + limit),
        total: filtered.length,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get medicine by ID
   * GET /make-server-3dd53475/medicine/catalog/:medicineId
   */
  app.get('/make-server-3dd53475/medicine/catalog/:medicineId', async (c) => {
    try {
      const { medicineId } = c.req.param();
      const medicine = await kv.get(`medicine:catalog:${medicineId}`);

      if (!medicine) {
        return c.json({ error: 'Medicine not found' }, 404);
      }

      return c.json({
        success: true,
        medicine,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get medicines by prescription
   * POST /make-server-3dd53475/medicine/catalog/by-prescription
   */
  app.post('/make-server-3dd53475/medicine/catalog/by-prescription', async (c) => {
    try {
      const { prescriptionId } = await c.req.json();

      if (!prescriptionId) {
        return c.json({ error: 'prescriptionId is required' }, 400);
      }

      // Get prescription
      const prescription = await kv.get(`prescription:${prescriptionId}`);
      if (!prescription) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      const medications = prescription.medications || [];
      const allMedicines = await kv.getByPrefix('medicine:catalog:');

      // Match prescription medications with catalog
      const matchedMedicines = medications.map((prescMed: any) => {
        const medicine = allMedicines.find((m: any) => {
          const medName = (m.name || '').toLowerCase();
          const prescName = (prescMed.name || '').toLowerCase();
          return medName.includes(prescName) || prescName.includes(medName);
        });

        return {
          prescriptionMedication: prescMed,
          catalogMedicine: medicine || null,
          available: !!medicine && medicine.isActive && (medicine.stock || 0) > 0,
        };
      });

      return c.json({
        success: true,
        prescription,
        matchedMedicines,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Create medicine order from catalog
   * POST /make-server-3dd53475/medicine/catalog/order
   */
  app.post('/make-server-3dd53475/medicine/catalog/order', async (c) => {
    try {
      const {
        customerId,
        customerPhone,
        petId,
        items, // [{ medicineId, quantity }]
        deliveryAddress,
        prescriptionId,
        paymentMethod,
      } = await c.req.json();

      if (!customerPhone || !items || items.length === 0) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Validate and calculate total
      let totalAmount = 0;
      const orderItems = [];

      for (const item of items) {
        const medicine = await kv.get(`medicine:catalog:${item.medicineId}`);
        if (!medicine || !medicine.isActive) {
          return c.json({ error: `Medicine ${item.medicineId} not found or inactive` }, 400);
        }

        if ((medicine.stock || 0) < item.quantity) {
          return c.json({ error: `Insufficient stock for ${medicine.name}` }, 400);
        }

        if (medicine.requiresPrescription && !prescriptionId) {
          return c.json({ error: `Prescription required for ${medicine.name}` }, 400);
        }

        const itemTotal = (medicine.price || 0) * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          medicineId: medicine.id,
          medicineName: medicine.name,
          quantity: item.quantity,
          price: medicine.price,
          total: itemTotal,
        });
      }

      // Create order
      const orderId = `medicine_order_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const order = {
        id: orderId,
        customerId: customerId || null,
        customerPhone,
        petId: petId || null,
        prescriptionId: prescriptionId || null,
        items: orderItems,
        totalAmount,
        deliveryAddress,
        paymentMethod: paymentMethod || 'cod',
        status: 'pending',
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`medicine:order:${orderId}`, order);

      // Update stock
      for (const item of items) {
        const medicine = await kv.get(`medicine:catalog:${item.medicineId}`);
        if (medicine) {
          medicine.stock = (medicine.stock || 0) - item.quantity;
          await kv.set(`medicine:catalog:${item.medicineId}`, medicine);
        }
      }

      // Add to customer orders
      const customerOrdersKey = `customer:${customerPhone}:medicine_orders`;
      const customerOrders = await kv.get(customerOrdersKey) || [];
      customerOrders.unshift(orderId);
      await kv.set(customerOrdersKey, customerOrders);

      return c.json({
        success: true,
        order,
        message: 'Medicine order created successfully',
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get medicine categories
   * GET /make-server-3dd53475/medicine/catalog/categories
   */
  app.get('/make-server-3dd53475/medicine/catalog/categories', async (c) => {
    try {
      const allMedicines = await kv.getByPrefix('medicine:catalog:');
      const categories = new Set<string>();

      allMedicines.forEach((m: any) => {
        if (m.category && m.isActive) {
          categories.add(m.category);
        }
      });

      return c.json({
        success: true,
        categories: Array.from(categories).sort(),
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}

