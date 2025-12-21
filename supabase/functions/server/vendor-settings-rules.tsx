import { Hono } from "npm:hono";

/**
 * Vendor Settings Multi-Rule Management Endpoints
 * Supports multiple rules per service type with service location filtering
 */
export function vendorSettingsRulesEndpoints(app: Hono, kv: any) {
  
  // ============================================
  // HELPER: Get All Services from Catalog
  // ============================================
  
  async function getAllServicesFromCatalog() {
    const categories = await kv.get('catalog:categories') || [];
    const services: any[] = [];
    
    categories.forEach((category: any) => {
      if (category.subCategories && Array.isArray(category.subCategories)) {
        category.subCategories.forEach((subCategory: any) => {
          if (subCategory.services && Array.isArray(subCategory.services)) {
            subCategory.services.forEach((service: any) => {
              services.push({
                id: service.id,
                name: service.name,
                categoryId: category.id,
                categoryName: category.name,
                subCategoryId: subCategory.id,
                subCategoryName: subCategory.name,
                serviceStyle: service.serviceStyle || category.serviceStyle || 'both',
                vendorType: category.vendorType
              });
            });
          }
        });
      }
    });
    
    return services;
  }
  
  // ============================================
  // GET ALL VENDOR SETTINGS (Multi-Rule Based)
  // ============================================
  
  app.get("/make-server-3dd53475/admin/vendor-settings-rules", async (c) => {
    try {
      // Get multi-rule based settings
      const bookingRules = await kv.get('admin:booking_rules') || [];
      const paymentRules = await kv.get('admin:payment_rules') || [];
      const refundTiers = await kv.get('admin:refund_tiers') || [];
      
      // Get additional refund policy settings
      const refundPolicies = await kv.get('admin:refund_policies') || {
        providerCancellation: {
          refundToCustomer: 100,
          additionalCompensation: 10,
          cancellationFee: 50
        },
        refundProcessing: {
          mode: 'auto',
          processingTimeBusinessDays: 7,
          actionRefundType: 'immediate',
          disputeResolutionTimeDays: 7,
          refundPreference: 'wallet'
        }
      };
      
      // Get service types from catalog
      const serviceTypes = await getAllServicesFromCatalog();
      
      return c.json({ 
        bookingRules, 
        paymentRules, 
        refundTiers,
        refundPolicies,
        serviceTypes 
      });
    } catch (error) {
      console.error('Error fetching vendor settings rules:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // BOOKING RULES MANAGEMENT (Multi-Rule)
  // ============================================

  // Get all booking rules
  app.get("/make-server-3dd53475/admin/vendor-settings/booking-rules", async (c) => {
    try {
      const rules = await kv.get('admin:booking_rules') || [];
      return c.json({ rules });
    } catch (error) {
      console.error('Error fetching booking rules:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Create new booking rule
  app.post("/make-server-3dd53475/admin/vendor-settings/booking-rules", async (c) => {
    try {
      const newRule = await c.req.json();
      const rules = await kv.get('admin:booking_rules') || [];
      
      // Generate ID if not provided
      if (!newRule.id) {
        newRule.id = `booking_rule_${Date.now()}`;
      }
      
      // Add creation timestamp
      newRule.createdAt = new Date().toISOString();
      newRule.isActive = newRule.isActive ?? true;
      
      rules.push(newRule);
      await kv.set('admin:booking_rules', rules);
      
      console.log('Booking rule created:', newRule);
      return c.json({ success: true, rule: newRule });
    } catch (error) {
      console.error('Error creating booking rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Update existing booking rule
  app.put("/make-server-3dd53475/admin/vendor-settings/booking-rules/:ruleId", async (c) => {
    try {
      const { ruleId } = c.req.param();
      const updatedRule = await c.req.json();
      const rules = await kv.get('admin:booking_rules') || [];
      
      const index = rules.findIndex((r: any) => r.id === ruleId);
      if (index === -1) {
        return c.json({ error: 'Rule not found' }, 404);
      }
      
      rules[index] = { ...rules[index], ...updatedRule, id: ruleId };
      await kv.set('admin:booking_rules', rules);
      
      console.log('Booking rule updated:', rules[index]);
      return c.json({ success: true, rule: rules[index] });
    } catch (error) {
      console.error('Error updating booking rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Delete booking rule
  app.delete("/make-server-3dd53475/admin/vendor-settings/booking-rules/:ruleId", async (c) => {
    try {
      const { ruleId } = c.req.param();
      const rules = await kv.get('admin:booking_rules') || [];
      
      const filteredRules = rules.filter((r: any) => r.id !== ruleId);
      await kv.set('admin:booking_rules', filteredRules);
      
      console.log('Booking rule deleted:', ruleId);
      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting booking rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // PAYMENT RULES MANAGEMENT (Multi-Rule)
  // ============================================

  // Get all payment rules
  app.get("/make-server-3dd53475/admin/vendor-settings/payment-rules", async (c) => {
    try {
      const rules = await kv.get('admin:payment_rules') || [];
      return c.json({ rules });
    } catch (error) {
      console.error('Error fetching payment rules:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Create new payment rule
  app.post("/make-server-3dd53475/admin/vendor-settings/payment-rules", async (c) => {
    try {
      const newRule = await c.req.json();
      const rules = await kv.get('admin:payment_rules') || [];
      
      // Generate ID if not provided
      if (!newRule.id) {
        newRule.id = `payment_rule_${Date.now()}`;
      }
      
      // Add creation timestamp
      newRule.createdAt = new Date().toISOString();
      newRule.isActive = newRule.isActive ?? true;
      
      rules.push(newRule);
      await kv.set('admin:payment_rules', rules);
      
      console.log('Payment rule created:', newRule);
      return c.json({ success: true, rule: newRule });
    } catch (error) {
      console.error('Error creating payment rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Update existing payment rule
  app.put("/make-server-3dd53475/admin/vendor-settings/payment-rules/:ruleId", async (c) => {
    try {
      const { ruleId } = c.req.param();
      const updatedRule = await c.req.json();
      const rules = await kv.get('admin:payment_rules') || [];
      
      const index = rules.findIndex((r: any) => r.id === ruleId);
      if (index === -1) {
        return c.json({ error: 'Rule not found' }, 404);
      }
      
      rules[index] = { ...rules[index], ...updatedRule, id: ruleId };
      await kv.set('admin:payment_rules', rules);
      
      console.log('Payment rule updated:', rules[index]);
      return c.json({ success: true, rule: rules[index] });
    } catch (error) {
      console.error('Error updating payment rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Delete payment rule
  app.delete("/make-server-3dd53475/admin/vendor-settings/payment-rules/:ruleId", async (c) => {
    try {
      const { ruleId } = c.req.param();
      const rules = await kv.get('admin:payment_rules') || [];
      
      const filteredRules = rules.filter((r: any) => r.id !== ruleId);
      await kv.set('admin:payment_rules', filteredRules);
      
      console.log('Payment rule deleted:', ruleId);
      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting payment rule:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // REFUND POLICY TIERS MANAGEMENT (Multi-Rule)
  // ============================================

  // Get all refund policy tiers
  app.get("/make-server-3dd53475/admin/vendor-settings/refund-tiers", async (c) => {
    try {
      const tiers = await kv.get('admin:refund_tiers') || [];
      return c.json({ tiers });
    } catch (error) {
      console.error('Error fetching refund tiers:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Create new refund tier
  app.post("/make-server-3dd53475/admin/vendor-settings/refund-tiers", async (c) => {
    try {
      const newTier = await c.req.json();
      const tiers = await kv.get('admin:refund_tiers') || [];
      
      // Generate ID if not provided
      if (!newTier.id) {
        newTier.id = `refund_tier_${Date.now()}`;
      }
      
      // Add creation timestamp
      newTier.createdAt = new Date().toISOString();
      newTier.isActive = newTier.isActive ?? true;
      
      tiers.push(newTier);
      await kv.set('admin:refund_tiers', tiers);
      
      console.log('Refund tier created:', newTier);
      return c.json({ success: true, tier: newTier });
    } catch (error) {
      console.error('Error creating refund tier:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Update existing refund tier
  app.put("/make-server-3dd53475/admin/vendor-settings/refund-tiers/:tierId", async (c) => {
    try {
      const { tierId } = c.req.param();
      const updatedTier = await c.req.json();
      const tiers = await kv.get('admin:refund_tiers') || [];
      
      const index = tiers.findIndex((t: any) => t.id === tierId);
      if (index === -1) {
        return c.json({ error: 'Tier not found' }, 404);
      }
      
      tiers[index] = { ...tiers[index], ...updatedTier, id: tierId };
      await kv.set('admin:refund_tiers', tiers);
      
      console.log('Refund tier updated:', tiers[index]);
      return c.json({ success: true, tier: tiers[index] });
    } catch (error) {
      console.error('Error updating refund tier:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Delete refund tier
  app.delete("/make-server-3dd53475/admin/vendor-settings/refund-tiers/:tierId", async (c) => {
    try {
      const { tierId } = c.req.param();
      const tiers = await kv.get('admin:refund_tiers') || [];
      
      const filteredTiers = tiers.filter((t: any) => t.id !== tierId);
      await kv.set('admin:refund_tiers', filteredTiers);
      
      console.log('Refund tier deleted:', tierId);
      return c.json({ success: true });
    } catch (error) {
      console.error('Error deleting refund tier:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ============================================
  // CUSTOMER APP QUERY ENDPOINTS
  // ============================================

  // Get applicable rules for a service booking
  app.get("/make-server-3dd53475/customer/booking-rules/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const serviceLocation = c.req.query('location') || 'both'; // 'at_home' | 'at_center' | 'both'
      
      // Get service details from catalog to find vendor type
      const categories = await kv.get('catalog:categories') || [];
      let serviceVendorType = null;
      
      // Find the service in catalog to get its vendor type
      for (const category of categories) {
        if (category.subCategories && Array.isArray(category.subCategories)) {
          for (const subCategory of category.subCategories) {
            if (subCategory.services && Array.isArray(subCategory.services)) {
              const service = subCategory.services.find((s: any) => s.id === serviceId);
              if (service) {
                serviceVendorType = category.vendorType;
                break;
              }
            }
          }
        }
        if (serviceVendorType) break;
      }
      
      if (!serviceVendorType) {
        return c.json({ error: 'Service not found in catalog' }, 404);
      }
      
      // Get all rules
      const paymentRules = await kv.get('admin:payment_rules') || [];
      const refundTiers = await kv.get('admin:refund_tiers') || [];
      
      // Find applicable payment rule (by vendor type)
      const applicablePaymentRule = paymentRules.find((rule: any) => 
        rule.isActive && 
        rule.vendorTypes && 
        rule.vendorTypes.includes(serviceVendorType) &&
        (rule.serviceLocation === 'both' || rule.serviceLocation === serviceLocation)
      );
      
      // Find applicable refund tier (by vendor type)
      const applicableRefundTier = refundTiers.find((tier: any) => 
        tier.isActive && 
        tier.vendorTypes && 
        tier.vendorTypes.includes(serviceVendorType) &&
        (tier.serviceLocation === 'both' || tier.serviceLocation === serviceLocation)
      );
      
      console.log(`Found rules for service ${serviceId} (vendor type: ${serviceVendorType}) at ${serviceLocation}:`, {
        hasPaymentRule: !!applicablePaymentRule,
        hasRefundTier: !!applicableRefundTier,
        serviceVendorType
      });
      
      return c.json({
        serviceId,
        serviceLocation,
        serviceVendorType,
        paymentRule: applicablePaymentRule || null,
        refundTier: applicableRefundTier || null,
        hasRules: !!(applicablePaymentRule || applicableRefundTier)
      });
    } catch (error) {
      console.error('Error fetching booking rules for customer:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Calculate payment amount for a booking
  app.post("/make-server-3dd53475/customer/calculate-payment", async (c) => {
    try {
      const { serviceId, serviceLocation, totalAmount } = await c.req.json();
      
      // Get service details from catalog to find vendor type
      const categories = await kv.get('catalog:categories') || [];
      let serviceVendorType = null;
      
      // Find the service in catalog to get its vendor type
      for (const category of categories) {
        if (category.subCategories && Array.isArray(category.subCategories)) {
          for (const subCategory of category.subCategories) {
            if (subCategory.services && Array.isArray(subCategory.services)) {
              const service = subCategory.services.find((s: any) => s.id === serviceId);
              if (service) {
                serviceVendorType = category.vendorType;
                break;
              }
            }
          }
        }
        if (serviceVendorType) break;
      }
      
      if (!serviceVendorType) {
        return c.json({ error: 'Service not found in catalog' }, 404);
      }
      
      // Get payment rules
      const paymentRules = await kv.get('admin:payment_rules') || [];
      
      // Find applicable payment rule (by vendor type)
      const applicableRule = paymentRules.find((rule: any) => 
        rule.isActive && 
        rule.vendorTypes && 
        rule.vendorTypes.includes(serviceVendorType) &&
        (rule.serviceLocation === 'both' || rule.serviceLocation === serviceLocation)
      );
      
      if (!applicableRule) {
        return c.json({
          error: 'No payment rule found for this service',
          totalAmount,
          advancePayment: 0,
          remainingPayment: totalAmount
        }, 404);
      }
      
      let advancePayment = 0;
      let remainingPayment = totalAmount;
      
      if (applicableRule.reservationType === 'full') {
        advancePayment = totalAmount;
        remainingPayment = 0;
      } else if (applicableRule.reservationType === 'percentage') {
        advancePayment = Math.max(
          (totalAmount * applicableRule.reservationPercentage) / 100,
          applicableRule.minimumAdvancePayment
        );
        remainingPayment = totalAmount - advancePayment;
      } else if (applicableRule.reservationType === 'flat') {
        advancePayment = applicableRule.flatAmount;
        remainingPayment = totalAmount - advancePayment;
      }
      
      return c.json({
        serviceId,
        serviceLocation,
        serviceVendorType,
        totalAmount,
        advancePayment: Math.round(advancePayment * 100) / 100,
        remainingPayment: Math.round(remainingPayment * 100) / 100,
        paymentRule: {
          name: applicableRule.name,
          type: applicableRule.reservationType,
          partialPaymentAllowed: applicableRule.partialPaymentAllowed
        }
      });
    } catch (error) {
      console.error('Error calculating payment:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Calculate refund amount for a cancellation
  app.post("/make-server-3dd53475/customer/calculate-refund", async (c) => {
    try {
      const { serviceId, serviceLocation, paidAmount, hoursBeforeService } = await c.req.json();
      
      // Get service details from catalog to find vendor type
      const categories = await kv.get('catalog:categories') || [];
      let serviceVendorType = null;
      
      // Find the service in catalog to get its vendor type
      for (const category of categories) {
        if (category.subCategories && Array.isArray(category.subCategories)) {
          for (const subCategory of category.subCategories) {
            if (subCategory.services && Array.isArray(subCategory.services)) {
              const service = subCategory.services.find((s: any) => s.id === serviceId);
              if (service) {
                serviceVendorType = category.vendorType;
                break;
              }
            }
          }
        }
        if (serviceVendorType) break;
      }
      
      if (!serviceVendorType) {
        return c.json({ error: 'Service not found in catalog' }, 404);
      }
      
      // Get refund tiers
      const refundTiers = await kv.get('admin:refund_tiers') || [];
      
      // Find applicable refund tier (by vendor type)
      const applicableTier = refundTiers.find((tier: any) => 
        tier.isActive && 
        tier.vendorTypes && 
        tier.vendorTypes.includes(serviceVendorType) &&
        (tier.serviceLocation === 'both' || tier.serviceLocation === serviceLocation) &&
        hoursBeforeService >= tier.hoursBeforeService
      );
      
      if (!applicableTier) {
        return c.json({
          error: 'No refund policy found for this cancellation window',
          paidAmount,
          refundAmount: 0,
          cancellationFee: paidAmount
        }, 404);
      }
      
      const refundPercentage = applicableTier.refundPercentage;
      const cancellationFee = applicableTier.cancellationFee || 0;
      const refundAmount = Math.max(0, (paidAmount * refundPercentage / 100) - cancellationFee);
      
      return c.json({
        serviceId,
        serviceLocation,
        serviceVendorType,
        paidAmount,
        hoursBeforeService,
        refundPercentage,
        cancellationFee,
        refundAmount: Math.round(refundAmount * 100) / 100,
        refundPolicy: {
          name: applicableTier.name,
          windowHours: applicableTier.hoursBeforeService
        }
      });
    } catch (error) {
      console.error('Error calculating refund:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}