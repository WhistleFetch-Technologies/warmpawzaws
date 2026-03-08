/**
 * ============================================================================
 * PHARMACY INVENTORY MANAGEMENT
 * ============================================================================
 * 
 * Inventory management system for pharmacy vendors
 * - Add/update/delete medicines
 * - Stock tracking
 * - Low stock alerts
 * - Auto-deduct on order acceptance
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { sendEventNotification } from '../aws/aws-sns-notification-service';

export function registerPharmacyInventoryEndpoints(app: Hono) {

  /**
   * GET /pharmacy/:vendorId/inventory
   * Get inventory for a pharmacy
   */
  app.get("/pharmacy/:vendorId/inventory", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const search = c.req.query('search');
      const lowStock = c.req.query('lowStock') === 'true';

      let inventoryQuery = `
        SELECT 
          i.*,
          m.name as medicine_name,
          m.manufacturer,
          m.category,
          m.unit_type
        FROM pharmacy_inventory i
        LEFT JOIN medicines m ON i.medicine_id = m.id
        WHERE i.vendor_id = $1 AND i.is_active = true
      `;

      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (search) {
        inventoryQuery += ` AND (m.name ILIKE $${paramIndex} OR i.medicine_name ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (lowStock) {
        inventoryQuery += ` AND i.current_stock <= i.low_stock_threshold`;
      }

      inventoryQuery += ` ORDER BY m.name ASC, i.created_at DESC`;

      const result = await query(inventoryQuery, params);

      return c.json({
        success: true,
        inventory: (result as any).rows,
        total: (result as any).rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/:vendorId/inventory
   * Add medicine to inventory
   */
  app.post("/pharmacy/:vendorId/inventory", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const {
        medicineName,
        medicineId,
        manufacturer,
        category,
        unitType,
        currentStock,
        lowStockThreshold,
        unitPrice,
        expiryDate,
        batchNumber,
      } = body;

      if (!medicineName || currentStock === undefined) {
        return c.json({ error: 'medicineName and currentStock are required' }, 400);
      }

      // Check if medicine already exists in inventory
      const existing = await query(
        `SELECT id FROM pharmacy_inventory 
         WHERE vendor_id = $1 
         AND (medicine_id = $2 OR (medicine_id IS NULL AND medicine_name = $3))
         AND is_active = true`,
        [vendorId, medicineId || null, medicineName]
      );

      if ((existing as any).rows.length > 0) {
        return c.json({ error: 'Medicine already exists in inventory' }, 400);
      }

      // Create inventory entry
      const result = await insert('pharmacy_inventory', {
        vendor_id: vendorId,
        medicine_id: medicineId || null,
        medicine_name: medicineName,
        manufacturer: manufacturer || null,
        category: category || null,
        unit_type: unitType || 'tablet',
        current_stock: parseInt(currentStock),
        low_stock_threshold: parseInt(lowStockThreshold || '10'),
        unit_price: parseFloat(unitPrice || '0'),
        expiry_date: expiryDate || null,
        batch_number: batchNumber || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        inventory: result[0],
        message: 'Medicine added to inventory',
      });
    } catch (error: any) {
      console.error('Error adding to inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /pharmacy/:vendorId/inventory/:inventoryId
   * Update inventory item
   */
  app.put("/pharmacy/:vendorId/inventory/:inventoryId", async (c) => {
    try {
      const { vendorId, inventoryId } = c.req.param();
      const body = await c.req.json();

      const updateFields: any = {
        updated_at: new Date().toISOString(),
      };

      if (body.currentStock !== undefined) {
        updateFields.current_stock = parseInt(body.currentStock);
      }
      if (body.lowStockThreshold !== undefined) {
        updateFields.low_stock_threshold = parseInt(body.lowStockThreshold);
      }
      if (body.unitPrice !== undefined) {
        updateFields.unit_price = parseFloat(body.unitPrice);
      }
      if (body.expiryDate !== undefined) {
        updateFields.expiry_date = body.expiryDate;
      }
      if (body.isActive !== undefined) {
        updateFields.is_active = body.isActive;
      }

      await update(
        'pharmacy_inventory',
        { id: inventoryId, vendor_id: vendorId },
        updateFields
      );

      // Check for low stock alert
      if (body.currentStock !== undefined && body.lowStockThreshold !== undefined) {
        if (body.currentStock <= body.lowStockThreshold) {
          await sendEventNotification({
            eventType: 'pharmacy_order_preparing', // Reuse event type
            recipientId: vendorId,
            recipientType: 'vendor',
            data: {
              message: `Low stock alert: ${body.medicineName || 'Medicine'} is running low (${body.currentStock} remaining)`,
            },
          });
        }
      }

      return c.json({
        success: true,
        message: 'Inventory updated',
      });
    } catch (error: any) {
      console.error('Error updating inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /pharmacy/:vendorId/inventory/deduct
   * Deduct stock when order is accepted
   */
  app.post("/pharmacy/:vendorId/inventory/deduct", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { items } = body; // [{medicineName, quantity}]

      if (!items || !Array.isArray(items)) {
        return c.json({ error: 'items array is required' }, 400);
      }

      const results = [];

      for (const item of items) {
        const { medicineName, quantity } = item;

        // Find inventory item
        const inventory = await query(
          `SELECT * FROM pharmacy_inventory 
           WHERE vendor_id = $1 
           AND (medicine_name = $2 OR medicine_id IN (SELECT id FROM medicines WHERE name = $2))
           AND is_active = true
           ORDER BY current_stock DESC
           LIMIT 1`,
          [vendorId, medicineName]
        );

        if ((inventory as any).rows.length === 0) {
          results.push({
            medicineName,
            success: false,
            error: 'Medicine not found in inventory',
          });
          continue;
        }

        const inventoryItem = (inventory as any).rows[0];

        if (inventoryItem.current_stock < quantity) {
          results.push({
            medicineName,
            success: false,
            error: `Insufficient stock. Available: ${inventoryItem.current_stock}, Required: ${quantity}`,
          });
          continue;
        }

        // Deduct stock
        const newStock = inventoryItem.current_stock - quantity;
        await update(
          'pharmacy_inventory',
          { id: inventoryItem.id },
          {
            current_stock: newStock,
            updated_at: new Date().toISOString(),
          }
        );

        // Check for low stock
        if (newStock <= inventoryItem.low_stock_threshold) {
          await sendEventNotification({
            eventType: 'pharmacy_order_preparing',
            recipientId: vendorId,
            recipientType: 'vendor',
            data: {
              message: `Low stock alert: ${medicineName} is running low (${newStock} remaining)`,
            },
          });
        }

        results.push({
          medicineName,
          success: true,
          previousStock: inventoryItem.current_stock,
          newStock,
        });
      }

      return c.json({
        success: true,
        results,
      });
    } catch (error: any) {
      console.error('Error deducting inventory:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /pharmacy/:vendorId/inventory/low-stock
   * Get low stock items
   */
  app.get("/pharmacy/:vendorId/inventory/low-stock", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const result = await query(
        `SELECT 
          i.*,
          m.name as medicine_name,
          m.manufacturer
         FROM pharmacy_inventory i
         LEFT JOIN medicines m ON i.medicine_id = m.id
         WHERE i.vendor_id = $1 
         AND i.is_active = true
         AND i.current_stock <= i.low_stock_threshold
         ORDER BY i.current_stock ASC`,
        [vendorId]
      );

      return c.json({
        success: true,
        lowStockItems: (result as any).rows,
        count: (result as any).rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching low stock items:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /pharmacy/:vendorId/inventory/:inventoryId
   * Remove item from inventory (soft delete)
   */
  app.delete("/pharmacy/:vendorId/inventory/:inventoryId", async (c) => {
    try {
      const { vendorId, inventoryId } = c.req.param();

      await update(
        'pharmacy_inventory',
        { id: inventoryId, vendor_id: vendorId },
        {
          is_active: false,
          updated_at: new Date().toISOString(),
        }
      );

      return c.json({
        success: true,
        message: 'Item removed from inventory',
      });
    } catch (error: any) {
      console.error('Error removing inventory item:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
