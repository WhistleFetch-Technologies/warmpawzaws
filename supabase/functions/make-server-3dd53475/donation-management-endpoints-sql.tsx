/**
 * DONATION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Handles donations for animal shelters (monetary and in-kind)
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (19 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getDbClient, withTransaction } from '../../lib/db.ts';
import { sendSuccess, sendError } from './response-utils.ts';

export function donationManagementEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();

  // ============================================
  // DONATION ENDPOINTS
  // ============================================

  /**
   * GET /vendor/donations/:vendorId/list
   * Get all donations for a shelter
   */
  app.get(`${BASE_PATH}/vendor/donations/:vendorId/list`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const { status, type, startDate, endDate } = c.req.query();

      // ✅ SQL: Get all donations for vendor
      let query = db
        .from('donations')
        .select('*')
        .eq('vendor_id', vendorId);

      if (status) {
        query = query.eq('status', status);
      }
      if (type) {
        query = query.eq('type', type);
      }
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: donations, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate stats
      const now = new Date();
      const thisMonth = donations?.filter((d: any) => {
        const date = new Date(d.created_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }) || [];

      const stats = {
        total: donations?.length || 0,
        totalValue: donations?.reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0) || 0,
        pending: donations?.filter((d: any) => d.status === 'pending').length || 0,
        received: donations?.filter((d: any) => d.status === 'received').length || 0,
        monetary: donations?.filter((d: any) => d.type === 'monetary').length || 0,
        inkind: donations?.filter((d: any) => d.type !== 'monetary').length || 0,
        thisMonth: thisMonth.length
      };

      return sendSuccess(c, { donations: donations || [], stats });
    } catch (error) {
      console.error('Error fetching donations:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/donations/:vendorId/create
   * Create a new donation
   */
  app.post(`${BASE_PATH}/vendor/donations/:vendorId/create`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const body = await c.req.json();

      const now = new Date().toISOString();
      const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      return await withTransaction(async (txClient) => {
        // ✅ SQL: Create donation
        const { data: donation, error: donationError } = await txClient
          .from('donations')
          .insert({
            vendor_id: vendorId,
            donor_id: body.donorId || null,
            donor_name: body.donorName,
            donor_email: body.donorEmail,
            donor_phone: body.donorPhone,
            donor_address: body.donorAddress || null,
            type: body.type,
            amount: body.amount || null,
            items: body.items || null,
            total_value: body.totalValue || body.amount || 0,
            payment_method: body.paymentMethod || null,
            transaction_id: body.transactionId || null,
            status: 'pending',
            receipt_number: receiptNumber,
            receipt_issued: false,
            tax_benefit: body.taxBenefit || false,
            purpose: body.purpose || null,
            notes: body.notes || null,
            thankyou_sent: false,
            created_at: now,
            updated_at: now
          })
          .select()
          .single();

        if (donationError) throw donationError;

        // ✅ SQL: Update or create donor profile
        if (body.donorEmail || body.donorPhone) {
          const donorIdentifier = body.donorEmail || body.donorPhone;
          const { data: existingDonor } = await txClient
            .from('donors')
            .select('*')
            .eq('vendor_id', vendorId)
            .or(`donor_email.eq.${body.donorEmail || ''},donor_phone.eq.${body.donorPhone || ''}`)
            .maybeSingle();

          if (existingDonor) {
            // Update existing donor
            await txClient
              .from('donors')
              .update({
                total_donations: (parseFloat(existingDonor.total_donations || 0) + parseFloat(donation.total_value || 0)).toString(),
                total_amount: (parseFloat(existingDonor.total_amount || 0) + parseFloat(donation.total_value || 0)).toString(),
                donation_count: (existingDonor.donation_count || 0) + 1,
                last_donation_date: now,
                updated_at: now
              })
              .eq('id', existingDonor.id);
          } else {
            // Create new donor
            await txClient
              .from('donors')
              .insert({
                vendor_id: vendorId,
                name: body.donorName,
                email: body.donorEmail || null,
                phone: body.donorPhone || null,
                address: body.donorAddress || null,
                total_donations: donation.total_value || 0,
                total_amount: donation.total_value || 0,
                donation_count: 1,
                first_donation_date: now,
                last_donation_date: now,
                tags: [],
                created_at: now,
                updated_at: now
              });
          }
        }

        return sendSuccess(c, { donation, message: 'Donation recorded successfully' });
      });
    } catch (error) {
      console.error('Error creating donation:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/donations/:vendorId/:donationId/status
   * Update donation status
   */
  app.put(`${BASE_PATH}/vendor/donations/:vendorId/:donationId/status`, async (c) => {
    try {
      const { vendorId, donationId } = c.req.param();
      const { status } = await c.req.json();

      const now = new Date().toISOString();

      // ✅ SQL: Get donation
      const { data: donation, error: getError } = await db
        .from('donations')
        .select('*')
        .eq('id', donationId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (getError) throw getError;
      if (!donation) {
        return sendError(c, 'Donation not found', 404);
      }

      // ✅ SQL: Update donation status
      const updateData: any = {
        status,
        updated_at: now
      };

      if (status === 'received' && !donation.received_date) {
        updateData.received_date = now;
      }
      if (status === 'acknowledged' && !donation.acknowledged_date) {
        updateData.acknowledged_date = now;
      }

      const { data: updated, error: updateError } = await db
        .from('donations')
        .update(updateData)
        .eq('id', donationId)
        .select()
        .single();

      if (updateError) throw updateError;

      return sendSuccess(c, { donation: updated, message: 'Donation status updated' });
    } catch (error) {
      console.error('Error updating donation status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/donations/:vendorId/donors
   * Get all donors
   */
  app.get(`${BASE_PATH}/vendor/donations/:vendorId/donors`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Get all donors for vendor
      const { data: donors, error } = await db
        .from('donors')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('total_amount', { ascending: false });

      if (error) throw error;

      const stats = {
        total: donors?.length || 0,
        majorDonors: donors?.filter((d: any) => parseFloat(d.total_amount || 0) >= 10000).length || 0,
        recurring: donors?.filter((d: any) => (d.donation_count || 0) >= 3).length || 0,
        totalValue: donors?.reduce((sum: number, d: any) => sum + parseFloat(d.total_amount || 0), 0) || 0
      };

      return sendSuccess(c, { donors: donors || [], stats });
    } catch (error) {
      console.error('Error fetching donors:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/donations/:vendorId/campaigns
   * Get all donation campaigns
   */
  app.get(`${BASE_PATH}/vendor/donations/:vendorId/campaigns`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const { status } = c.req.query();

      // ✅ SQL: Get campaigns
      let query = db
        .from('donation_campaigns')
        .select('*')
        .eq('vendor_id', vendorId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: campaigns, error } = await query.order('start_date', { ascending: false });

      if (error) throw error;

      return sendSuccess(c, { campaigns: campaigns || [], total: campaigns?.length || 0 });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/donations/:vendorId/campaigns
   * Create a new donation campaign
   */
  app.post(`${BASE_PATH}/vendor/donations/:vendorId/campaigns`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const body = await c.req.json();

      const now = new Date().toISOString();

      // ✅ SQL: Create campaign
      const { data: campaign, error } = await db
        .from('donation_campaigns')
        .insert({
          vendor_id: vendorId,
          name: body.name,
          description: body.description,
          goal_amount: body.goalAmount,
          raised_amount: 0,
          start_date: body.startDate,
          end_date: body.endDate,
          status: 'draft',
          image_url: body.imageUrl || null,
          donation_count: 0,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) throw error;

      return sendSuccess(c, { campaign, message: 'Campaign created successfully' });
    } catch (error) {
      console.error('Error creating campaign:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/donations/:vendorId/dashboard
   * Get comprehensive donation dashboard data
   */
  app.get(`${BASE_PATH}/vendor/donations/:vendorId/dashboard`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');

      // ✅ SQL: Fetch all data in parallel
      const [donationsResult, donorsResult, campaignsResult] = await Promise.all([
        db.from('donations').select('*').eq('vendor_id', vendorId),
        db.from('donors').select('*').eq('vendor_id', vendorId),
        db.from('donation_campaigns').select('*').eq('vendor_id', vendorId)
      ]);

      const donations = donationsResult.data || [];
      const donors = donorsResult.data || [];
      const campaigns = campaignsResult.data || [];

      // Calculate comprehensive stats
      const now = new Date();
      const thisMonth = donations.filter((d: any) => {
        const date = new Date(d.created_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });

      const thisYear = donations.filter((d: any) => {
        const date = new Date(d.created_at);
        return date.getFullYear() === now.getFullYear();
      });

      const stats = {
        donations: {
          total: donations.length,
          totalValue: donations.reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0),
          thisMonth: thisMonth.length,
          thisMonthValue: thisMonth.reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0),
          thisYear: thisYear.length,
          thisYearValue: thisYear.reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0),
          pending: donations.filter((d: any) => d.status === 'pending').length,
          byType: {
            monetary: donations.filter((d: any) => d.type === 'monetary').reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0),
            food: donations.filter((d: any) => d.type === 'food').reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0),
            medicine: donations.filter((d: any) => d.type === 'medicine').reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0),
            supplies: donations.filter((d: any) => d.type === 'supplies').reduce((sum: number, d: any) => sum + parseFloat(d.total_value || 0), 0)
          }
        },
        donors: {
          total: donors.length,
          majorDonors: donors.filter((d: any) => parseFloat(d.total_amount || 0) >= 10000).length,
          recurring: donors.filter((d: any) => (d.donation_count || 0) >= 3).length,
          new: donors.filter((d: any) => {
            const date = new Date(d.first_donation_date);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          }).length
        },
        campaigns: {
          active: campaigns.filter((c: any) => c.status === 'active').length,
          total: campaigns.length,
          totalGoal: campaigns.filter((c: any) => c.status === 'active').reduce((sum: number, c: any) => sum + parseFloat(c.goal_amount || 0), 0),
          totalRaised: campaigns.filter((c: any) => c.status === 'active').reduce((sum: number, c: any) => sum + parseFloat(c.raised_amount || 0), 0)
        }
      };

      // Get recent donations
      const recentDonations = donations
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      // Get top donors
      const topDonors = donors
        .sort((a: any, b: any) => parseFloat(b.total_amount || 0) - parseFloat(a.total_amount || 0))
        .slice(0, 5);

      return sendSuccess(c, { stats, recentDonations, topDonors });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/donations/:vendorId/donations/:donationId/generate-receipt
   * Generate and issue receipt for a donation
   */
  app.post(`${BASE_PATH}/vendor/donations/:vendorId/donations/:donationId/generate-receipt`, async (c) => {
    try {
      const { vendorId, donationId } = c.req.param();

      // ✅ SQL: Get donation
      const { data: donation, error: getError } = await db
        .from('donations')
        .select('*')
        .eq('id', donationId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (getError) throw getError;
      if (!donation) {
        return sendError(c, 'Donation not found', 404);
      }

      // Generate receipt URL (in production, this would generate a PDF)
      const receiptUrl = `https://warmpawz.com/receipts/${donationId}`;
      const certificateUrl = donation.tax_benefit
        ? `https://warmpawz.com/certificates/80G/${donationId}`
        : undefined;

      // ✅ SQL: Update donation
      const { data: updated, error: updateError } = await db
        .from('donations')
        .update({
          receipt_issued: true,
          receipt_url: receiptUrl,
          certificate_url: certificateUrl,
          status: 'acknowledged',
          acknowledged_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', donationId)
        .select()
        .single();

      if (updateError) throw updateError;

      return sendSuccess(c, {
        donation: updated,
        receiptUrl,
        certificateUrl,
        message: 'Receipt generated successfully'
      });
    } catch (error) {
      console.error('Error generating receipt:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/donations/:vendorId/donations/:donationId/receipt
   * Get receipt details for a donation
   */
  app.get(`${BASE_PATH}/vendor/donations/:vendorId/donations/:donationId/receipt`, async (c) => {
    try {
      const { vendorId, donationId } = c.req.param();

      // ✅ SQL: Get donation
      const { data: donation, error } = await db
        .from('donations')
        .select('*')
        .eq('id', donationId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (error) throw error;
      if (!donation) {
        return sendError(c, 'Donation not found', 404);
      }

      if (!donation.receipt_issued) {
        return sendError(c, 'Receipt not yet generated', 404);
      }

      return sendSuccess(c, {
        receipt: {
          receiptNumber: donation.receipt_number,
          receiptUrl: donation.receipt_url,
          certificateUrl: donation.certificate_url,
          donorName: donation.donor_name,
          amount: donation.amount,
          type: donation.type,
          date: donation.created_at,
          taxBenefit: donation.tax_benefit
        }
      });
    } catch (error) {
      console.error('Error fetching receipt:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /vendor/donations/:vendorId/:donationId
   * Delete a donation
   */
  app.delete(`${BASE_PATH}/vendor/donations/:vendorId/:donationId`, async (c) => {
    try {
      const { vendorId, donationId } = c.req.param();

      return await withTransaction(async (txClient) => {
        // ✅ SQL: Get donation
        const { data: donation, error: getError } = await txClient
          .from('donations')
          .select('*')
          .eq('id', donationId)
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (getError) throw getError;
        if (!donation) {
          return sendError(c, 'Donation not found', 404);
        }

        // ✅ SQL: Delete donation
        const { error: deleteError } = await txClient
          .from('donations')
          .delete()
          .eq('id', donationId);

        if (deleteError) throw deleteError;

        // ✅ SQL: Update donor stats if needed
        if (donation.donor_email || donation.donor_phone) {
          const { data: donor } = await txClient
            .from('donors')
            .select('*')
            .eq('vendor_id', vendorId)
            .or(`donor_email.eq.${donation.donor_email || ''},donor_phone.eq.${donation.donor_phone || ''}`)
            .maybeSingle();

          if (donor) {
            await txClient
              .from('donors')
              .update({
                total_donations: Math.max(0, parseFloat(donor.total_donations || 0) - parseFloat(donation.total_value || 0)).toString(),
                total_amount: Math.max(0, parseFloat(donor.total_amount || 0) - parseFloat(donation.total_value || 0)).toString(),
                donation_count: Math.max(0, (donor.donation_count || 0) - 1),
                updated_at: new Date().toISOString()
              })
              .eq('id', donor.id);
          }
        }

        console.log(`✅ Donation deleted successfully: ${donationId}`);

        return sendSuccess(c, {}, 'Donation deleted successfully');
      });
    } catch (error) {
      console.error('Error deleting donation:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Donation management endpoints registered (SQL-only)');
}

