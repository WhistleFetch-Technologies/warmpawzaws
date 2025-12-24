/**
 * ============================================================================
 * ADVERTISING ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * Pay-Per-Click and Impression Advertising System
 * 
 * Features:
 * - Campaign management (PPC, Impression, Banner, Sponsored)
 * - Impression tracking
 * - Click tracking
 * - Budget management
 * - Performance analytics
 * - Conversion tracking
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 2, Task 2.2 - Advertising Module
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getAdvertisingRepository } from "../../lib/repositories/advertising.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getDbClient } from "../../lib/db.ts";

export function advertisingEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const adRepo = getAdvertisingRepository();
  const vendorsRepo = getVendorsRepository();
  const db = getDbClient();

  // Helper: Resolve vendor ID
  async function resolveVendorId(identifier: string): Promise<string | null> {
    return await vendorsRepo.resolveVendorId(identifier);
  }

  // ============================================
  // CAMPAIGN MANAGEMENT
  // ============================================

  /**
   * GET /vendor/:vendorId/advertising/campaigns
   * List all campaigns for a vendor
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/advertising/campaigns`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const campaigns = await adRepo.findByVendor(resolvedVendorId, { status: status || undefined, limit, offset });

      return sendSuccess(c, { campaigns });
    } catch (error) {
      console.error('❌ [ADVERTISING] Error fetching campaigns:', error);
      return sendError(c, `Failed to fetch campaigns: ${String(error)}`, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/advertising/campaigns
   * Create a new advertising campaign
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/advertising/campaigns`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const campaignData = await c.req.json();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Validate required fields
      if (!campaignData.campaign_name || !campaignData.campaign_type || !campaignData.budget_amount || !campaignData.ad_creative || !campaignData.landing_url || !campaignData.start_date) {
        return sendError(c, 'Missing required fields: campaign_name, campaign_type, budget_amount, ad_creative, landing_url, start_date', 400);
      }

      // Validate campaign type
      if (!['ppc', 'impression', 'banner', 'sponsored'].includes(campaignData.campaign_type)) {
        return sendError(c, 'Invalid campaign_type. Must be: ppc, impression, banner, or sponsored', 400);
      }

      // Validate cost settings based on type
      if (campaignData.campaign_type === 'ppc' && !campaignData.cost_per_click) {
        return sendError(c, 'cost_per_click is required for PPC campaigns', 400);
      }
      if (campaignData.campaign_type === 'impression' && !campaignData.cost_per_impression) {
        return sendError(c, 'cost_per_impression is required for impression campaigns', 400);
      }

      const campaign = await adRepo.create({
        vendor_id: resolvedVendorId,
        campaign_name: campaignData.campaign_name,
        campaign_type: campaignData.campaign_type,
        budget_amount: parseFloat(campaignData.budget_amount),
        daily_budget: campaignData.daily_budget ? parseFloat(campaignData.daily_budget) : null,
        cost_per_click: campaignData.cost_per_click ? parseFloat(campaignData.cost_per_click) : null,
        cost_per_impression: campaignData.cost_per_impression ? parseFloat(campaignData.cost_per_impression) : null,
        target_audience: campaignData.target_audience || {},
        target_keywords: campaignData.target_keywords || [],
        target_categories: campaignData.target_categories || [],
        ad_creative: campaignData.ad_creative,
        landing_url: campaignData.landing_url,
        start_date: campaignData.start_date,
        end_date: campaignData.end_date || null,
        status: campaignData.status || 'draft',
      });

      console.log(`✅ [ADVERTISING] Created campaign ${campaign.id} for vendor ${paramVendorId}`);

      return sendSuccess(c, { campaign }, 'Campaign created successfully');
    } catch (error) {
      console.error('❌ [ADVERTISING] Error creating campaign:', error);
      return sendError(c, `Failed to create campaign: ${String(error)}`, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/advertising/campaigns/:campaignId
   * Update a campaign
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/advertising/campaigns/:campaignId`, async (c) => {
    try {
      const { vendorId: paramVendorId, campaignId } = c.req.param();
      const updates = await c.req.json();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Verify campaign belongs to vendor
      const campaign = await adRepo.findById(campaignId);
      if (!campaign) {
        return sendError(c, 'Campaign not found', 404);
      }
      if (campaign.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Campaign does not belong to this vendor', 403);
      }

      const updated = await adRepo.update(campaignId, updates);

      return sendSuccess(c, { campaign: updated }, 'Campaign updated successfully');
    } catch (error) {
      console.error('❌ [ADVERTISING] Error updating campaign:', error);
      return sendError(c, `Failed to update campaign: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/advertising/campaigns/:campaignId
   * Delete a campaign
   */
  app.delete(`${BASE_PATH}/vendor/:vendorId/advertising/campaigns/:campaignId`, async (c) => {
    try {
      const { vendorId: paramVendorId, campaignId } = c.req.param();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      // Verify campaign belongs to vendor
      const campaign = await adRepo.findById(campaignId);
      if (!campaign) {
        return sendError(c, 'Campaign not found', 404);
      }
      if (campaign.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Campaign does not belong to this vendor', 403);
      }

      await adRepo.delete(campaignId);

      return sendSuccess(c, {}, 'Campaign deleted successfully');
    } catch (error) {
      console.error('❌ [ADVERTISING] Error deleting campaign:', error);
      return sendError(c, `Failed to delete campaign: ${String(error)}`, 500);
    }
  });

  // ============================================
  // IMPRESSION TRACKING
  // ============================================

  /**
   * POST /advertising/track-impression
   * Track an ad impression
   */
  app.post(`${BASE_PATH}/advertising/track-impression`, async (c) => {
    try {
      const impressionData = await c.req.json();

      if (!impressionData.campaign_id || !impressionData.vendor_id || !impressionData.impression_type) {
        return sendError(c, 'Missing required fields: campaign_id, vendor_id, impression_type', 400);
      }

      // Verify campaign exists and is active
      const campaign = await adRepo.findById(impressionData.campaign_id);
      if (!campaign) {
        return sendError(c, 'Campaign not found', 404);
      }
      if (campaign.status !== 'active') {
        return sendError(c, 'Campaign is not active', 400);
      }

      // Check budget
      if (campaign.spent_amount >= campaign.budget_amount) {
        return sendError(c, 'Campaign budget exhausted', 400);
      }

      // Record impression
      const impression = await adRepo.recordImpression({
        campaign_id: impressionData.campaign_id,
        vendor_id: impressionData.vendor_id,
        impression_type: impressionData.impression_type,
        target_id: impressionData.target_id || null,
        target_type: impressionData.target_type || null,
        customer_id: impressionData.customer_id || null,
        session_id: impressionData.session_id || null,
        ip_address: impressionData.ip_address || null,
        user_agent: impressionData.user_agent || null,
        location: impressionData.location || null,
      });

      // Update campaign metrics
      const newImpressionCount = campaign.total_impressions + 1;
      let newSpentAmount = campaign.spent_amount;

      // Charge for impression if cost_per_impression is set
      if (campaign.cost_per_impression) {
        const impressionCost = campaign.cost_per_impression;
        newSpentAmount = campaign.spent_amount + impressionCost;

        // Record budget transaction
        await adRepo.recordBudgetTransaction({
          campaign_id: campaign.id,
          vendor_id: campaign.vendor_id,
          transaction_type: 'impression',
          amount: impressionCost,
          impression_id: impression.id,
          description: `Impression charge for ${impressionData.impression_type}`,
        });
      }

      // Update campaign
      await adRepo.update(campaign.id, {
        total_impressions: newImpressionCount,
        spent_amount: newSpentAmount,
        click_through_rate: campaign.total_clicks > 0 ? (campaign.total_clicks / newImpressionCount) * 100 : 0,
      });

      return sendSuccess(c, { impression }, 'Impression recorded');
    } catch (error) {
      console.error('❌ [ADVERTISING] Error tracking impression:', error);
      return sendError(c, `Failed to track impression: ${String(error)}`, 500);
    }
  });

  // ============================================
  // CLICK TRACKING
  // ============================================

  /**
   * POST /advertising/track-click
   * Track an ad click
   */
  app.post(`${BASE_PATH}/advertising/track-click`, async (c) => {
    try {
      const clickData = await c.req.json();

      if (!clickData.campaign_id || !clickData.vendor_id || !clickData.click_type) {
        return sendError(c, 'Missing required fields: campaign_id, vendor_id, click_type', 400);
      }

      // Verify campaign exists and is active
      const campaign = await adRepo.findById(clickData.campaign_id);
      if (!campaign) {
        return sendError(c, 'Campaign not found', 404);
      }
      if (campaign.status !== 'active') {
        return sendError(c, 'Campaign is not active', 400);
      }

      // Check budget
      if (campaign.spent_amount >= campaign.budget_amount) {
        return sendError(c, 'Campaign budget exhausted', 400);
      }

      // Record click
      const click = await adRepo.recordClick({
        campaign_id: clickData.campaign_id,
        impression_id: clickData.impression_id || null,
        vendor_id: clickData.vendor_id,
        click_type: clickData.click_type,
        target_id: clickData.target_id || null,
        target_type: clickData.target_type || null,
        customer_id: clickData.customer_id || null,
        session_id: clickData.session_id || null,
        ip_address: clickData.ip_address || null,
        user_agent: clickData.user_agent || null,
        referrer: clickData.referrer || null,
        location: clickData.location || null,
      });

      // Update campaign metrics
      const newClickCount = campaign.total_clicks + 1;
      let newSpentAmount = campaign.spent_amount;

      // Charge for click if cost_per_click is set
      if (campaign.cost_per_click) {
        const clickCost = campaign.cost_per_click;
        newSpentAmount = campaign.spent_amount + clickCost;

        // Record budget transaction
        await adRepo.recordBudgetTransaction({
          campaign_id: campaign.id,
          vendor_id: campaign.vendor_id,
          transaction_type: 'click',
          amount: clickCost,
          click_id: click.id,
          description: `Click charge for ${clickData.click_type}`,
        });
      }

      // Calculate CTR
      const ctr = campaign.total_impressions > 0 ? (newClickCount / campaign.total_impressions) * 100 : 0;

      // Update campaign
      await adRepo.update(campaign.id, {
        total_clicks: newClickCount,
        spent_amount: newSpentAmount,
        click_through_rate: ctr,
      });

      return sendSuccess(c, { click }, 'Click recorded');
    } catch (error) {
      console.error('❌ [ADVERTISING] Error tracking click:', error);
      return sendError(c, `Failed to track click: ${String(error)}`, 500);
    }
  });

  /**
   * POST /advertising/track-conversion
   * Mark a click as converted (e.g., purchase, booking)
   */
  app.post(`${BASE_PATH}/advertising/track-conversion`, async (c) => {
    try {
      const { click_id, conversion_type, conversion_value } = await c.req.json();

      if (!click_id || !conversion_type || conversion_value === undefined) {
        return sendError(c, 'Missing required fields: click_id, conversion_type, conversion_value', 400);
      }

      // Get click
      const clicks = await adRepo.getClicks('', { limit: 1000 }); // TODO: Add findById method
      const click = clicks.find(c => c.id === click_id);
      if (!click) {
        return sendError(c, 'Click not found', 404);
      }

      // Mark as converted
      const updatedClick = await adRepo.markClickAsConverted(click_id, conversion_type, parseFloat(conversion_value));

      // Update campaign conversion metrics
      const campaign = await adRepo.findById(click.campaign_id);
      if (campaign) {
        const newConversionCount = campaign.total_conversions + 1;
        const conversionRate = campaign.total_clicks > 0 ? (newConversionCount / campaign.total_clicks) * 100 : 0;

        await adRepo.update(campaign.id, {
          total_conversions: newConversionCount,
          conversion_rate: conversionRate,
        });
      }

      return sendSuccess(c, { click: updatedClick }, 'Conversion recorded');
    } catch (error) {
      console.error('❌ [ADVERTISING] Error tracking conversion:', error);
      return sendError(c, `Failed to track conversion: ${String(error)}`, 500);
    }
  });

  // ============================================
  // ANALYTICS
  // ============================================

  /**
   * GET /vendor/:vendorId/advertising/analytics
   * Get advertising analytics for a vendor
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/advertising/analytics`, async (c) => {
    try {
      const { vendorId: paramVendorId } = c.req.param();
      const period = c.req.query('period') || 'month'; // day, week, month, year

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const campaigns = await adRepo.findByVendor(resolvedVendorId);

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Aggregate metrics
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      let totalSpend = 0;
      let totalRevenue = 0;

      for (const campaign of campaigns) {
        if (new Date(campaign.created_at) >= startDate) {
          totalImpressions += campaign.total_impressions;
          totalClicks += campaign.total_clicks;
          totalConversions += campaign.total_conversions;
          totalSpend += campaign.spent_amount;
        }
      }

      const analytics = {
        period,
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter(c => c.status === 'active').length,
        total_impressions,
        total_clicks,
        total_conversions,
        total_spend: totalSpend,
        total_revenue: totalRevenue,
        average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        average_conversion_rate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
        roas: totalSpend > 0 ? (totalRevenue / totalSpend) : 0, // Return on ad spend
        campaigns: campaigns.map(c => ({
          id: c.id,
          name: c.campaign_name,
          type: c.campaign_type,
          status: c.status,
          impressions: c.total_impressions,
          clicks: c.total_clicks,
          conversions: c.total_conversions,
          spend: c.spent_amount,
          budget: c.budget_amount,
          ctr: c.click_through_rate,
          conversion_rate: c.conversion_rate,
        })),
      };

      return sendSuccess(c, { analytics });
    } catch (error) {
      console.error('❌ [ADVERTISING] Error fetching analytics:', error);
      return sendError(c, `Failed to fetch analytics: ${String(error)}`, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/advertising/campaigns/:campaignId/performance
   * Get detailed performance for a specific campaign
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/advertising/campaigns/:campaignId/performance`, async (c) => {
    try {
      const { vendorId: paramVendorId, campaignId } = c.req.param();

      const resolvedVendorId = await resolveVendorId(paramVendorId);
      if (!resolvedVendorId) {
        return sendError(c, 'Vendor not found or invalid ID format', 404);
      }

      const campaign = await adRepo.findById(campaignId);
      if (!campaign) {
        return sendError(c, 'Campaign not found', 404);
      }
      if (campaign.vendor_id !== resolvedVendorId) {
        return sendError(c, 'Campaign does not belong to this vendor', 403);
      }

      // Get impressions and clicks
      const impressions = await adRepo.getImpressions(campaignId);
      const clicks = await adRepo.getClicks(campaignId);
      const budgetTransactions = await adRepo.getBudgetTransactions(campaignId);

      const performance = {
        campaign,
        metrics: {
          impressions: campaign.total_impressions,
          clicks: campaign.total_clicks,
          conversions: campaign.total_conversions,
          spend: campaign.spent_amount,
          budget_remaining: campaign.budget_amount - campaign.spent_amount,
          ctr: campaign.click_through_rate,
          conversion_rate: campaign.conversion_rate,
          cpc: campaign.total_clicks > 0 ? campaign.spent_amount / campaign.total_clicks : 0,
          cpm: campaign.total_impressions > 0 ? (campaign.spent_amount / campaign.total_impressions) * 1000 : 0,
        },
        recent_impressions: impressions.slice(0, 50),
        recent_clicks: clicks.slice(0, 50),
        budget_transactions: budgetTransactions.slice(0, 50),
      };

      return sendSuccess(c, { performance });
    } catch (error) {
      console.error('❌ [ADVERTISING] Error fetching campaign performance:', error);
      return sendError(c, `Failed to fetch campaign performance: ${String(error)}`, 500);
    }
  });

  console.log('✅ [ADVERTISING-SQL] Advertising endpoints registered (SQL-only)');
}

