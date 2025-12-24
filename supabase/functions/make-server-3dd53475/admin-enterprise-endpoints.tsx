import { Hono } from "npm:hono";
import { getDbClient } from "../../lib/db.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * ADMIN ENTERPRISE & REVENUE ENDPOINTS (✅ SQL-ONLY)
 * 
 * Endpoints for enterprise revenue analytics and customer management
 */

export function adminEnterpriseEndpoints(app: Hono) {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  const payoutsRepo = getPayoutsRepository();
  const customersRepo = getCustomersRepository();

  /**
   * GET /admin/enterprise/revenue/stats
   * Get revenue statistics for enterprise dashboard
   */
  app.get("/make-server-3dd53475/admin/enterprise/revenue/stats", async (c) => {
    try {
      const range = c.req.query('range') || '30d';
      
      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      if (range === '7d') startDate.setDate(now.getDate() - 7);
      else if (range === '30d') startDate.setDate(now.getDate() - 30);
      else if (range === '90d') startDate.setDate(now.getDate() - 90);
      else if (range === '1y') startDate.setFullYear(now.getFullYear() - 1);
      
      // ✅ SQL: Get completed bookings in range
      const allBookings = await bookingsRepo.findAll({ limit: 10000 });
      const recentBookings = allBookings.filter((b: any) => 
        b.status === 'completed' && 
        new Date(b.completed_at || b.created_at) >= startDate
      );
      
      // Calculate revenue metrics
      const totalRevenue = recentBookings.reduce((sum: number, b: any) => 
        sum + Number(b.total_amount || 0), 0
      );
      
      // ✅ SQL: Get commission from payout rules
      const { data: payoutRule } = await client
        .from('payout_rules')
        .select('commission_percentage')
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1)
        .single();
      
      const commissionRate = payoutRule?.commission_percentage ? parseFloat(payoutRule.commission_percentage) : 15;
      const commissionEarned = totalRevenue * (commissionRate / 100);
      const vendorPayouts = totalRevenue - commissionEarned;
      
      // Calculate growth (simplified - compare with previous period)
      const previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365));
      
      const previousBookings = allBookings.filter((b: any) => 
        b.status === 'completed' && 
        new Date(b.completed_at || b.created_at) >= previousStartDate &&
        new Date(b.completed_at || b.created_at) < startDate
      );
      
      const previousRevenue = previousBookings.reduce((sum: number, b: any) => 
        sum + Number(b.total_amount || 0), 0
      );
      
      const growthRate = previousRevenue > 0 
        ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;
      
      // ✅ SQL: Count enterprise customers (customers with high spending)
      const allCustomers = await customersRepo.findAll({ limit: 10000 });
      const enterpriseCustomers = allCustomers.filter((c: any) => 
        Number(c.total_spent || 0) > 10000 // Threshold for enterprise
      ).length;
      
      // Calculate average order value
      const avgOrderValue = recentBookings.length > 0 
        ? totalRevenue / recentBookings.length 
        : 0;
      
      // Monthly recurring (subscriptions)
      const monthlyRecurring = 0; // TODO: Calculate from subscriptions table
      
      return sendSuccess(c, {
        totalRevenue,
        commissionEarned,
        vendorPayouts,
        growthRate,
        enterpriseCustomers,
        avgOrderValue,
        monthlyRecurring
      });
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/enterprise/customers
   * Get enterprise customers list
   */
  app.get("/make-server-3dd53475/admin/enterprise/customers", async (c) => {
    try {
      // ✅ SQL: Get customers with high spending
      const allCustomers = await customersRepo.findAll({ limit: 10000 });
      
      // Get bookings for each customer
      const allBookings = await bookingsRepo.findAll({ limit: 10000 });
      
      const enterpriseCustomers = allCustomers
        .filter((c: any) => Number(c.total_spent || 0) > 10000)
        .map((customer: any) => {
          const customerBookings = allBookings.filter((b: any) => b.customer_id === customer.id);
          
          return {
            id: customer.id,
            name: customer.preferences?.name || customer.address?.name || 'Customer',
            email: customer.preferences?.email || '',
            totalSpent: Number(customer.total_spent || 0),
            bookings: customerBookings.length,
            status: customer.total_bookings > 0 ? 'active' : 'inactive',
            joinedAt: customer.created_at
          };
        })
        .sort((a: any, b: any) => b.totalSpent - a.totalSpent);
      
      return sendSuccess(c, {
        customers: enterpriseCustomers,
        total: enterpriseCustomers.length
      });
    } catch (error) {
      console.error('Error fetching enterprise customers:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Admin enterprise endpoints registered (SQL-only)');
}

