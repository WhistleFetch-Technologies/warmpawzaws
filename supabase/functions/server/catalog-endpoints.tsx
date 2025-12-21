// This file contains catalog endpoint handlers
// Import into main index.tsx

export const catalogEndpoints = (app: any, kv: any) => {
  
  // Get all products/services
  app.get("/make-server-3dd53475/admin/catalog/products", async (c: any) => {
    try {
      let products = await kv.get('catalog:products');
      if (!products) {
        products = [
          {
            id: 'prod_001',
            name: 'Basic Veterinary Consultation',
            sku: 'VET-BASIC-001',
            category: 'Healthcare Service Providers',
            price: 1500,
            stock: '∞',
            status: 'active',
            rating: 4.8
          },
          {
            id: 'prod_002',
            name: 'Premium Pet Grooming Package',
            sku: 'GRM-PREM-002',
            category: 'Grooming & Day-care Services',
            price: 2500,
            stock: '∞',
            status: 'active',
            rating: 4.7
          },
          {
            id: 'prod_003',
            name: 'Emergency Vet Visit',
            sku: 'EMR-VET-003',
            category: 'Healthcare Service Providers',
            price: 2500,
            stock: '∞',
            status: 'active',
            rating: 4.7
          },
          {
            id: 'prod_004',
            name: 'Daily Dog Walk (30 mins)',
            sku: 'WALK-DAILY-004',
            category: 'Walking & Sitters',
            price: 2500,
            stock: '∞',
            status: 'active',
            rating: 4.7
          },
          {
            id: 'prod_005',
            name: 'Premium Dog Food - 10kg',
            sku: 'FOOD-PREM-005',
            category: 'Product',
            price: 3500,
            stock: 0,
            status: 'out-of-stock',
            rating: 4.7
          }
        ];
        await kv.set('catalog:products', products);
      }
      return c.json({ success: true, products });
    } catch (error) {
      console.log('Error getting products:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Create product
  app.post("/make-server-3dd53475/admin/catalog/products/create", async (c: any) => {
    try {
      const data = await c.req.json();
      const productId = `prod_${Date.now()}`;
      const newProduct = {
        id: productId,
        ...data,
        createdAt: new Date().toISOString()
      };
      const products = await kv.get('catalog:products') || [];
      products.unshift(newProduct);
      await kv.set('catalog:products', products);
      
      const stats = await kv.get('admin:catalog_stats') || {};
      stats.activeProducts = { count: products.length, change: 1 };
      await kv.set('admin:catalog_stats', stats);
      
      return c.json({ success: true, product: newProduct });
    } catch (error) {
      console.log('Error creating product:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Update product
  app.put("/make-server-3dd53475/admin/catalog/products/:productId", async (c: any) => {
    try {
      const productId = c.req.param('productId');
      const data = await c.req.json();
      const products = await kv.get('catalog:products') || [];
      const updated = products.map((p: any) => 
        p.id === productId ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
      );
      await kv.set('catalog:products', updated);
      return c.json({ success: true });
    } catch (error) {
      console.log('Error updating product:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Delete product
  app.delete("/make-server-3dd53475/admin/catalog/products/:productId", async (c: any) => {
    try {
      const productId = c.req.param('productId');
      const products = await kv.get('catalog:products') || [];
      const updated = products.filter((p: any) => p.id !== productId);
      await kv.set('catalog:products', updated);
      return c.json({ success: true });
    } catch (error) {
      console.log('Error deleting product:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get pricing data
  app.get("/make-server-3dd53475/admin/catalog/pricing", async (c: any) => {
    try {
      let items = await kv.get('catalog:pricing');
      if (!items) {
        items = [
          {
            id: 'price_001',
            name: 'Basic Veterinary Consultation',
            category: 'Veterinary Services',
            currentPrice: 1500,
            originalPrice: 2000,
            margin: '25% off',
            stockLevel: '∞',
            lastUpdated: '2025-08-22'
          },
          {
            id: 'price_002',
            name: 'Premium Pet Grooming Package',
            category: 'Basic Grooming',
            currentPrice: 2500,
            originalPrice: null,
            margin: '',
            stockLevel: '∞',
            lastUpdated: '2025-08-22'
          },
          {
            id: 'price_003',
            name: 'Emergency Vet Services',
            category: 'Veterinary Services',
            currentPrice: 3500,
            originalPrice: 4500,
            margin: '15% off',
            stockLevel: '∞',
            lastUpdated: '2025-08-22'
          },
          {
            id: 'price_004',
            name: 'Royal canin Dog Food',
            category: 'Pet Food',
            currentPrice: 3500,
            originalPrice: 4000,
            margin: '13% off',
            stockLevel: 0,
            lastUpdated: '2025-08-22'
          }
        ];
        await kv.set('catalog:pricing', items);
      }
      
      const stats = {
        avgPrice: 2450,
        lowStock: 0,
        outOfStock: 1,
        totalValue: 6703000
      };
      
      return c.json({ success: true, items, stats });
    } catch (error) {
      console.log('Error getting pricing data:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get bulk operations
  app.get("/make-server-3dd53475/admin/catalog/bulk-operations", async (c: any) => {
    try {
      let operations = await kv.get('catalog:bulk_operations');
      if (!operations) {
        operations = [
          {
            id: 'bulk_001',
            name: 'Updated prices for Grooming services',
            operationId: 'BULK-872',
            type: 'Price Update',
            items: 25,
            progress: 100,
            status: 'completed',
            created: '2025-08-22'
          },
          {
            id: 'bulk_002',
            name: 'Activating new veterinary services',
            operationId: 'BULK-342',
            type: 'Status Change',
            items: 12,
            progress: 67,
            status: 'in-progress',
            created: '2025-08-22'
          },
          {
            id: 'bulk_003',
            name: 'Export all active products to CSV',
            operationId: 'BULK-549',
            type: 'Export',
            items: 150,
            progress: 0,
            status: 'pending',
            created: '2025-08-22'
          }
        ];
        await kv.set('catalog:bulk_operations', operations);
      }
      return c.json({ success: true, operations });
    } catch (error) {
      console.log('Error getting bulk operations:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Create bulk operation
  app.post("/make-server-3dd53475/admin/catalog/bulk-operations/create", async (c: any) => {
    try {
      const data = await c.req.json();
      const operationId = `BULK-${Math.floor(Math.random() * 1000)}`;
      const newOperation = {
        id: `bulk_${Date.now()}`,
        ...data,
        operationId,
        progress: 0,
        status: 'pending',
        created: new Date().toISOString().split('T')[0]
      };
      const operations = await kv.get('catalog:bulk_operations') || [];
      operations.unshift(newOperation);
      await kv.set('catalog:bulk_operations', operations);
      return c.json({ success: true, operation: newOperation });
    } catch (error) {
      console.log('Error creating bulk operation:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Export categories
  app.post("/make-server-3dd53475/admin/catalog/export/categories", async (c: any) => {
    try {
      const data = await c.req.json();
      
      // Create export record
      const exportRecord = {
        id: `export_${Date.now()}`,
        type: 'categories',
        format: data.format,
        dataRange: data.dataRange,
        totalItems: data.totalItems,
        exportedAt: data.exportedAt,
        status: 'completed'
      };
      
      // Store export record
      const exports = await kv.get('catalog:exports') || [];
      exports.unshift(exportRecord);
      await kv.set('catalog:exports', exports);
      
      return c.json({ success: true, export: exportRecord });
    } catch (error) {
      console.log('Error exporting categories:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Create subcategory
  app.post("/make-server-3dd53475/admin/catalog/subcategories/create", async (c: any) => {
    try {
      const data = await c.req.json();
      const subCategoryId = `sub_${Date.now()}`;
      
      const newSubCategory = {
        id: subCategoryId,
        name: data.name,
        description: data.description,
        status: data.status,
        services: []
      };
      
      const categories = await kv.get('catalog:categories') || [];
      const updated = categories.map((cat: any) => {
        if (cat.id === data.parentCategory) {
          return {
            ...cat,
            subCategories: [...cat.subCategories, newSubCategory],
            itemCount: cat.itemCount + 1
          };
        }
        return cat;
      });
      
      await kv.set('catalog:categories', updated);
      return c.json({ success: true, subcategory: newSubCategory });
    } catch (error) {
      console.log('Error creating subcategory:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
};