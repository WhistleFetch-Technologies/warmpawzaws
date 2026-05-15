/**
 * ============================================================================
 * FEE CONFIGURATION ENDPOINTS
 * ============================================================================
 * 
 * Endpoints for fetching platform and convenience fee configurations.
 * GET /config/fees uses admin_settings (Admin → Finance) via utils/feeCalculator.
 * POST /admin/config/fees still updates platform_settings (legacy admin JSON).
 * 
 * Endpoints:
 * - GET /config/fees - Calculated fees for checkout (public)
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select } from '../database/rds-connection';
import { calculateFinalFees } from '../utils/feeCalculator';

// Default fee configuration
const DEFAULT_FEE_CONFIG = {
  // Platform fee: percentage of transaction amount
  platformFeePercentage: 2, // 2%
  platformFeeMaxCap: 200, // Max ₹200 platform fee
  
  // Convenience fee: flat fee for bookings
  convenienceFee: 10, // ₹10 flat
  
  // Delivery fee (for at_home services and orders)
  deliveryFee: 0, // Usually calculated by logistics
  
  // Packaging fee (for orders)
  packagingFee: 0,
  
  // Service style specific overrides
  serviceStyleFees: {
    at_home: {
      convenienceFee: 10,
    },
    at_center: {
      convenienceFee: 10,
    },
    tele: {
      convenienceFee: 5,
    },
    ecom: {
      convenienceFee: 0,
      packagingFee: 15,
    },
    product: {
      convenienceFee: 0,
      packagingFee: 15,
    },
  } as Record<string, { convenienceFee?: number; packagingFee?: number }>,
};

/**
 * Calculate fees based on configuration and parameters
 */
export function calculateFees(params: {
  amount: number;
  serviceStyle?: string;
  type?: 'booking' | 'order';
  config?: typeof DEFAULT_FEE_CONFIG;
}): {
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  packagingFee: number;
  total: number;
  breakdown: {
    platformFeePercentage: number;
    platformFeeMaxCap: number;
    platformFeeCalculated: number;
    convenienceFeeBase: number;
  };
} {
  const { amount, serviceStyle, type = 'booking', config = DEFAULT_FEE_CONFIG } = params;
  
  // Calculate platform fee (percentage with max cap)
  const platformFeePercentage = config.platformFeePercentage || 2;
  const platformFeeMaxCap = config.platformFeeMaxCap || 200;
  let platformFeeCalculated = Math.round((amount * platformFeePercentage) / 100);
  const platformFee = Math.min(platformFeeCalculated, platformFeeMaxCap);
  
  // Get service style specific fees
  const styleConfig = serviceStyle && config.serviceStyleFees?.[serviceStyle];
  
  // Calculate convenience fee
  let convenienceFee = config.convenienceFee || 10;
  if (styleConfig?.convenienceFee !== undefined) {
    convenienceFee = styleConfig.convenienceFee;
  }
  
  // For orders, convenience fee is typically 0
  if (type === 'order') {
    convenienceFee = styleConfig?.convenienceFee ?? 0;
  }
  
  // Delivery fee (usually 0, calculated by logistics separately)
  const deliveryFee = config.deliveryFee || 0;
  
  // Packaging fee (for orders and ecom)
  let packagingFee = 0;
  if (type === 'order' || serviceStyle === 'ecom' || serviceStyle === 'product') {
    packagingFee = styleConfig?.packagingFee ?? config.packagingFee ?? 0;
  }
  
  const total = platformFee + convenienceFee + deliveryFee + packagingFee;
  
  return {
    platformFee,
    convenienceFee,
    deliveryFee,
    packagingFee,
    total,
    breakdown: {
      platformFeePercentage,
      platformFeeMaxCap,
      platformFeeCalculated,
      convenienceFeeBase: config.convenienceFee || 10,
    },
  };
}

/**
 * Register fee configuration endpoints
 */
export function registerFeeConfigEndpoints(app: Hono) {
  /**
   * GET /config/fees
   * Query: amount, type (booking|order), serviceStyle, category (business service type)
   */
  app.get('/config/fees', async (c) => {
    try {
      const amount = parseFloat(c.req.query('amount') || '0');
      const serviceStyle = c.req.query('serviceStyle') || '';
      const type = (c.req.query('type') || 'booking') as 'booking' | 'order';
      const category =
        c.req.query('category') || c.req.query('businessServiceType') || '';

      const fees = await calculateFinalFees({
        amount,
        type,
        serviceStyle,
        businessServiceType: category,
      });

      return c.json({
        success: true,
        platformFee: fees.platformFee,
        convenienceFee: fees.convenienceFee,
        deliveryFee: fees.deliveryFee,
        packagingFee: fees.packagingFee,
        total: fees.total,
      });
    } catch (error: any) {
      console.error('[FEE-CONFIG] Error getting fee configuration:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to get fee configuration',
      }, 500);
    }
  });

  /**
   * POST /admin/config/fees
   * Update fee configuration (admin only)
   */
  app.post('/admin/config/fees', async (c) => {
    try {
      const body = await c.req.json();
      
      const {
        platformFeePercentage,
        platformFeeMaxCap,
        convenienceFee,
        deliveryFee,
        packagingFee,
        serviceStyleFees,
      } = body;
      
      // Build config object with only provided values
      const newConfig: any = {};
      
      if (platformFeePercentage !== undefined) {
        if (platformFeePercentage < 0 || platformFeePercentage > 10) {
          return c.json({
            success: false,
            error: 'Platform fee percentage must be between 0 and 10',
          }, 400);
        }
        newConfig.platformFeePercentage = platformFeePercentage;
      }
      
      if (platformFeeMaxCap !== undefined) {
        if (platformFeeMaxCap < 0 || platformFeeMaxCap > 1000) {
          return c.json({
            success: false,
            error: 'Platform fee max cap must be between 0 and 1000',
          }, 400);
        }
        newConfig.platformFeeMaxCap = platformFeeMaxCap;
      }
      
      if (convenienceFee !== undefined) {
        if (convenienceFee < 0 || convenienceFee > 100) {
          return c.json({
            success: false,
            error: 'Convenience fee must be between 0 and 100',
          }, 400);
        }
        newConfig.convenienceFee = convenienceFee;
      }
      
      if (deliveryFee !== undefined) {
        newConfig.deliveryFee = deliveryFee;
      }
      
      if (packagingFee !== undefined) {
        newConfig.packagingFee = packagingFee;
      }
      
      if (serviceStyleFees !== undefined) {
        newConfig.serviceStyleFees = serviceStyleFees;
      }
      
      // Fetch existing config
      const existingSettings = await select('platform_settings', { setting_key: 'platform:fees:config' });
      
      if (existingSettings.length > 0) {
        // Merge with existing config
        const existingConfig = existingSettings[0].setting_value as any || {};
        const mergedConfig = {
          ...DEFAULT_FEE_CONFIG,
          ...existingConfig,
          ...newConfig,
          serviceStyleFees: {
            ...DEFAULT_FEE_CONFIG.serviceStyleFees,
            ...(existingConfig.serviceStyleFees || {}),
            ...(newConfig.serviceStyleFees || {}),
          },
        };
        
        await query(
          `UPDATE platform_settings 
           SET setting_value = $1, updated_at = NOW() 
           WHERE setting_key = 'platform:fees:config'`,
          [JSON.stringify(mergedConfig)]
        );
        
        return c.json({
          success: true,
          message: 'Fee configuration updated successfully',
          config: mergedConfig,
        });
      } else {
        // Create new config
        const fullConfig = {
          ...DEFAULT_FEE_CONFIG,
          ...newConfig,
          serviceStyleFees: {
            ...DEFAULT_FEE_CONFIG.serviceStyleFees,
            ...(newConfig.serviceStyleFees || {}),
          },
        };
        
        await query(
          `INSERT INTO platform_settings (setting_key, setting_value, description, created_at, updated_at)
           VALUES ('platform:fees:config', $1, 'Platform and convenience fee configuration', NOW(), NOW())`,
          [JSON.stringify(fullConfig)]
        );
        
        return c.json({
          success: true,
          message: 'Fee configuration created successfully',
          config: fullConfig,
        });
      }
    } catch (error: any) {
      console.error('[FEE-CONFIG] Error updating fee configuration:', error);
      return c.json({
        success: false,
        error: error.message || 'Failed to update fee configuration',
      }, 500);
    }
  });
}
