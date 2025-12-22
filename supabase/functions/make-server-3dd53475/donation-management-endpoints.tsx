/**
 * Donation Management Endpoints
 * Handles donations for animal shelters (monetary and in-kind)
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Donation structure
interface Donation {
  id: string;
  vendorId: string; // Shelter ID
  donorId?: string;
  donorName: string;
  donorEmail: string;
  donorPhone: string;
  donorAddress?: string;
  type: 'monetary' | 'food' | 'medicine' | 'supplies' | 'equipment' | 'other';
  amount?: number; // For monetary donations
  items?: {
    name: string;
    quantity: number;
    unit: string;
    value: number;
  }[]; // For in-kind donations
  totalValue: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque';
  transactionId?: string;
  status: 'pending' | 'received' | 'acknowledged' | 'utilized';
  receiptNumber: string;
  receiptIssued: boolean;
  receiptUrl?: string;
  taxBenefit: boolean; // 80G certificate eligible
  certificateUrl?: string;
  purpose?: string; // What the donation will be used for
  notes?: string;
  receivedDate?: string;
  acknowledgedDate?: string;
  thankyouSent: boolean;
  createdAt: string;
  updatedAt: string;
}

// Donor structure
interface Donor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  totalDonations: number;
  totalAmount: number;
  donationCount: number;
  firstDonationDate: string;
  lastDonationDate: string;
  tags: string[]; // 'recurring', 'major_donor', 'volunteer', etc.
  createdAt: string;
  updatedAt: string;
}

// Campaign structure
interface DonationCampaign {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  imageUrl?: string;
  donationCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /vendor/donations/:vendorId/list
 * Get all donations for a shelter
 */
app.get('/:vendorId/list', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status, type, startDate, endDate } = c.req.query();
    
    let donations = await kv.getByPrefix<Donation>(`donation:${vendorId}:`);
    
    // Filter by status
    if (status) {
      donations = donations.filter(d => d.status === status);
    }
    
    // Filter by type
    if (type) {
      donations = donations.filter(d => d.type === type);
    }
    
    // Filter by date range
    if (startDate) {
      donations = donations.filter(d => d.createdAt >= startDate);
    }
    if (endDate) {
      donations = donations.filter(d => d.createdAt <= endDate);
    }
    
    // Sort by date (most recent first)
    donations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Calculate stats
    const stats = {
      total: donations.length,
      totalValue: donations.reduce((sum, d) => sum + d.totalValue, 0),
      pending: donations.filter(d => d.status === 'pending').length,
      received: donations.filter(d => d.status === 'received').length,
      monetary: donations.filter(d => d.type === 'monetary').length,
      inkind: donations.filter(d => d.type !== 'monetary').length,
      thisMonth: donations.filter(d => {
        const date = new Date(d.createdAt);
        const now = new Date();
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length
    };
    
    return c.json({
      success: true,
      donations,
      stats
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch donations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/donations/:vendorId/create
 * Create a new donation
 */
app.post('/:vendorId/create', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const donationId = `donation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    // Generate receipt number
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    
    const donation: Donation = {
      id: donationId,
      vendorId,
      donorId: body.donorId,
      donorName: body.donorName,
      donorEmail: body.donorEmail,
      donorPhone: body.donorPhone,
      donorAddress: body.donorAddress,
      type: body.type,
      amount: body.amount,
      items: body.items,
      totalValue: body.totalValue || body.amount || 0,
      paymentMethod: body.paymentMethod,
      transactionId: body.transactionId,
      status: 'pending',
      receiptNumber,
      receiptIssued: false,
      taxBenefit: body.taxBenefit || false,
      purpose: body.purpose,
      notes: body.notes,
      thankyouSent: false,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`donation:${vendorId}:${donationId}`, donation);
    
    // Update or create donor profile
    if (body.donorEmail || body.donorPhone) {
      const donorKey = `donor:${vendorId}:${body.donorEmail || body.donorPhone}`;
      const existingDonor = await kv.get<Donor>(donorKey);
      
      if (existingDonor) {
        const updatedDonor: Donor = {
          ...existingDonor,
          totalDonations: existingDonor.totalDonations + donation.totalValue,
          totalAmount: existingDonor.totalAmount + donation.totalValue,
          donationCount: existingDonor.donationCount + 1,
          lastDonationDate: now,
          updatedAt: now
        };
        await kv.set(donorKey, updatedDonor);
      } else {
        const newDonor: Donor = {
          id: `donor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: body.donorName,
          email: body.donorEmail,
          phone: body.donorPhone,
          address: body.donorAddress,
          totalDonations: donation.totalValue,
          totalAmount: donation.totalValue,
          donationCount: 1,
          firstDonationDate: now,
          lastDonationDate: now,
          tags: [],
          createdAt: now,
          updatedAt: now
        };
        await kv.set(donorKey, newDonor);
      }
    }
    
    return c.json({
      success: true,
      donation,
      message: 'Donation recorded successfully'
    });
  } catch (error) {
    console.error('Error creating donation:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create donation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /vendor/donations/:vendorId/:donationId/status
 * Update donation status
 */
app.put('/:vendorId/:donationId/status', async (c) => {
  try {
    const { vendorId, donationId } = c.req.param();
    const { status } = await c.req.json();
    
    const donation = await kv.get<Donation>(`donation:${vendorId}:${donationId}`);
    
    if (!donation) {
      return c.json({ 
        success: false, 
        error: 'Donation not found' 
      }, 404);
    }
    
    const now = new Date().toISOString();
    const updated: Donation = {
      ...donation,
      status,
      receivedDate: status === 'received' ? now : donation.receivedDate,
      acknowledgedDate: status === 'acknowledged' ? now : donation.acknowledgedDate,
      updatedAt: now
    };
    
    await kv.set(`donation:${vendorId}:${donationId}`, updated);
    
    return c.json({
      success: true,
      donation: updated,
      message: 'Donation status updated'
    });
  } catch (error) {
    console.error('Error updating donation status:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to update donation status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/donations/:vendorId/donors
 * Get all donors
 */
app.get('/:vendorId/donors', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    let donors = await kv.getByPrefix<Donor>(`donor:${vendorId}:`);
    
    // Sort by total donations (highest first)
    donors.sort((a, b) => b.totalAmount - a.totalAmount);
    
    const stats = {
      total: donors.length,
      majorDonors: donors.filter(d => d.totalAmount >= 10000).length,
      recurring: donors.filter(d => d.donationCount >= 3).length,
      totalValue: donors.reduce((sum, d) => sum + d.totalAmount, 0)
    };
    
    return c.json({
      success: true,
      donors,
      stats
    });
  } catch (error) {
    console.error('Error fetching donors:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch donors',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/donations/:vendorId/campaigns
 * Get all donation campaigns
 */
app.get('/:vendorId/campaigns', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { status } = c.req.query();
    
    let campaigns = await kv.getByPrefix<DonationCampaign>(`campaign:${vendorId}:`);
    
    if (status) {
      campaigns = campaigns.filter(c => c.status === status);
    }
    
    // Sort by start date (most recent first)
    campaigns.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    
    return c.json({
      success: true,
      campaigns,
      total: campaigns.length
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch campaigns',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/donations/:vendorId/campaigns
 * Create a new donation campaign
 */
app.post('/:vendorId/campaigns', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();
    
    const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const campaign: DonationCampaign = {
      id: campaignId,
      vendorId,
      name: body.name,
      description: body.description,
      goalAmount: body.goalAmount,
      raisedAmount: 0,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'draft',
      imageUrl: body.imageUrl,
      donationCount: 0,
      createdAt: now,
      updatedAt: now
    };
    
    await kv.set(`campaign:${vendorId}:${campaignId}`, campaign);
    
    return c.json({
      success: true,
      campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to create campaign',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/donations/:vendorId/dashboard
 * Get comprehensive donation dashboard data
 */
app.get('/:vendorId/dashboard', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    // Fetch all data in parallel
    const [donations, donors, campaigns] = await Promise.all([
      kv.getByPrefix<Donation>(`donation:${vendorId}:`),
      kv.getByPrefix<Donor>(`donor:${vendorId}:`),
      kv.getByPrefix<DonationCampaign>(`campaign:${vendorId}:`)
    ]);
    
    // Calculate comprehensive stats
    const now = new Date();
    const thisMonth = donations.filter(d => {
      const date = new Date(d.createdAt);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    
    const thisYear = donations.filter(d => {
      const date = new Date(d.createdAt);
      return date.getFullYear() === now.getFullYear();
    });
    
    const stats = {
      donations: {
        total: donations.length,
        totalValue: donations.reduce((sum, d) => sum + d.totalValue, 0),
        thisMonth: thisMonth.length,
        thisMonthValue: thisMonth.reduce((sum, d) => sum + d.totalValue, 0),
        thisYear: thisYear.length,
        thisYearValue: thisYear.reduce((sum, d) => sum + d.totalValue, 0),
        pending: donations.filter(d => d.status === 'pending').length,
        byType: {
          monetary: donations.filter(d => d.type === 'monetary').reduce((sum, d) => sum + d.totalValue, 0),
          food: donations.filter(d => d.type === 'food').reduce((sum, d) => sum + d.totalValue, 0),
          medicine: donations.filter(d => d.type === 'medicine').reduce((sum, d) => sum + d.totalValue, 0),
          supplies: donations.filter(d => d.type === 'supplies').reduce((sum, d) => sum + d.totalValue, 0)
        }
      },
      donors: {
        total: donors.length,
        majorDonors: donors.filter(d => d.totalAmount >= 10000).length,
        recurring: donors.filter(d => d.donationCount >= 3).length,
        new: donors.filter(d => {
          const date = new Date(d.firstDonationDate);
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }).length
      },
      campaigns: {
        active: campaigns.filter(c => c.status === 'active').length,
        total: campaigns.length,
        totalGoal: campaigns.filter(c => c.status === 'active').reduce((sum, c) => sum + c.goalAmount, 0),
        totalRaised: campaigns.filter(c => c.status === 'active').reduce((sum, c) => sum + c.raisedAmount, 0)
      }
    };
    
    // Get recent donations
    const recentDonations = donations
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    
    // Get top donors
    const topDonors = donors
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);
    
    return c.json({
      success: true,
      stats,
      recentDonations,
      topDonors
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /vendor/donation-management/:vendorId/donations/:donationId/generate-receipt
 * Generate and issue receipt for a donation
 */
app.post('/:vendorId/donations/:donationId/generate-receipt', async (c) => {
  try {
    const { vendorId, donationId } = c.req.param();
    
    const donation = await kv.get<Donation>(`donation:${vendorId}:${donationId}`);
    
    if (!donation) {
      return c.json({
        success: false,
        error: 'Donation not found'
      }, 404);
    }
    
    // Generate receipt URL (in production, this would generate a PDF)
    const receiptUrl = `https://warmpawz.com/receipts/${donationId}`;
    const certificateUrl = donation.taxBenefit 
      ? `https://warmpawz.com/certificates/80G/${donationId}`
      : undefined;
    
    const updatedDonation: Donation = {
      ...donation,
      receiptIssued: true,
      receiptUrl,
      certificateUrl,
      status: 'acknowledged',
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`donation:${vendorId}:${donationId}`, updatedDonation);
    
    return c.json({
      success: true,
      donation: updatedDonation,
      receiptUrl,
      certificateUrl,
      message: 'Receipt generated successfully'
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    return c.json({
      success: false,
      error: 'Failed to generate receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /vendor/donation-management/:vendorId/donations/:donationId/receipt
 * Get receipt details for a donation
 */
app.get('/:vendorId/donations/:donationId/receipt', async (c) => {
  try {
    const { vendorId, donationId } = c.req.param();
    
    const donation = await kv.get<Donation>(`donation:${vendorId}:${donationId}`);
    
    if (!donation) {
      return c.json({
        success: false,
        error: 'Donation not found'
      }, 404);
    }
    
    if (!donation.receiptIssued) {
      return c.json({
        success: false,
        error: 'Receipt not yet generated'
      }, 404);
    }
    
    return c.json({
      success: true,
      receipt: {
        receiptNumber: donation.receiptNumber,
        receiptUrl: donation.receiptUrl,
        certificateUrl: donation.certificateUrl,
        donorName: donation.donorName,
        amount: donation.amount,
        type: donation.type,
        date: donation.createdAt,
        taxBenefit: donation.taxBenefit
      }
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch receipt',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /vendor/donations/:vendorId/:donationId
 * Delete a donation
 * ✅ FIX: Priority 1 Gap #2 - Add DELETE endpoint
 */
app.delete('/:vendorId/:donationId', async (c) => {
  try {
    const { vendorId, donationId } = c.req.param();
    
    const donation = await kv.get<Donation>(`donation:${vendorId}:${donationId}`);
    
    if (!donation) {
      return c.json({ 
        success: false, 
        error: 'Donation not found' 
      }, 404);
    }
    
    // Delete the donation
    await kv.del(`donation:${vendorId}:${donationId}`);
    
    // Update donor stats if needed
    if (donation.donorEmail || donation.donorPhone) {
      const donorKey = `donor:${vendorId}:${donation.donorEmail || donation.donorPhone}`;
      const donor = await kv.get<Donor>(donorKey);
      if (donor) {
        donor.totalDonations = Math.max(0, donor.totalDonations - donation.totalValue);
        donor.totalAmount = Math.max(0, donor.totalAmount - donation.totalValue);
        donor.donationCount = Math.max(0, donor.donationCount - 1);
        donor.updatedAt = new Date().toISOString();
        await kv.set(donorKey, donor);
      }
    }
    
    console.log(`✅ Donation deleted successfully: ${donationId}`);
    
    return c.json({
      success: true,
      message: 'Donation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting donation:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to delete donation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;