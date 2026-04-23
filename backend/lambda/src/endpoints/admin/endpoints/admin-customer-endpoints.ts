/**
 * Customer administration API — mirrors non-document vendor admin surfaces.
 */
import type { Hono } from 'hono';
import { query, select, update } from '../../../database/rds-connection';
import { requireAdminAuth } from './admin.controller';
import { createCustomerPortalCode } from '../../../lib/services/admin/customer-portal-session-service';

const COLORS = ['#FF8C42', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

function normalizeIsActive(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value === true || value === 1 || value === '1' || value === 't' || value === 'true') return true;
  return false;
}

async function gate(c: any) {
  const auth = await requireAdminAuth(c);
  if (!auth.authorized) return { ok: false as const, res: c.json({ error: auth.error }, 401) };
  if (auth.userId && typeof c.set === 'function') {
    c.set('userId', auth.userId);
  }
  return { ok: true as const, userId: auth.userId as string | undefined };
}

export function registerAdminCustomerEndpoints(app: Hono) {
  // ── Stats (same card shape as vendor stats consumer) ─────────────────────
  app.get('/admin/customers/stats', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const allRes = await query(`
        SELECT id, is_active, created_at
        FROM customers
        ORDER BY created_at DESC
      `).catch(() => ({ rows: [] }));
      const rows = allRes.rows || [];
      const activeCustomers = rows.filter((r: any) => normalizeIsActive(r.is_active));
      const deactivated = rows.filter((r: any) => !normalizeIsActive(r.is_active));

      let newToday = 0;
      try {
        const nt = await query(`
          SELECT COUNT(*)::text AS c FROM customers
          WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + INTERVAL '1 day'
        `);
        newToday = parseInt(nt.rows?.[0]?.c || '0', 10);
      } catch {
        /* empty */
      }

      let complianceCount = 0;
      let complianceHigh = 0;
      try {
        const ci = await query(`
          SELECT COUNT(*)::text AS cnt,
            COUNT(*) FILTER (WHERE LOWER(COALESCE(severity::text, '')) IN ('high', 'critical'))::text AS high_cnt
          FROM customer_compliance_issues
          WHERE status <> 'resolved'
        `);
        if (ci.rows?.[0]) {
          complianceCount = parseInt(ci.rows[0].cnt || '0', 10);
          complianceHigh = parseInt(ci.rows[0].high_cnt || '0', 10);
        }
      } catch {
        /* table may not exist yet */
      }

      let supportTicketsTotal = 0;
      let supportTicketsOpen = 0;
      try {
        const st = await query(`
          SELECT COUNT(*)::text AS total_tickets,
            COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::text AS open_tickets
          FROM support_tickets
        `);
        if (st.rows?.[0]) {
          supportTicketsTotal = parseInt(st.rows[0].total_tickets || '0', 10);
          supportTicketsOpen = parseInt(st.rows[0].open_tickets || '0', 10);
        }
      } catch {
        /* empty */
      }

      let pendingDeactivation = 0;
      try {
        const pd = await query(
          `SELECT COUNT(*)::text AS c FROM customer_deactivation_requests WHERE status = 'pending'`
        );
        pendingDeactivation = parseInt(pd.rows?.[0]?.c || '0', 10);
      } catch {
        /* empty */
      }

      const stats = {
        activeCustomers: {
          count: activeCustomers.length,
          percentage:
            rows.length > 0 ? Math.round((activeCustomers.length / rows.length) * 100) : 0,
        },
        pendingApplications: {
          count: pendingDeactivation,
          todayCount: newToday,
        },
        complianceIssues: {
          count: complianceCount,
          highPriority: complianceHigh,
        },
        supportTickets: {
          total: supportTicketsTotal,
          open: supportTicketsOpen,
        },
        distribution: {
          active: activeCustomers.length,
          deactivated: deactivated.length,
          pending: pendingDeactivation,
        },
      };

      return c.json({ stats });
    } catch (error: any) {
      console.error('[admin/customers/stats]', error);
      return c.json({ error: error.message || 'Failed to load stats' }, 500);
    }
  });

  /** Legacy list + filters */
  app.get('/admin/customers', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const search = (c.req.query('search') || '').trim().toLowerCase();
      const limit = Math.min(parseInt(c.req.query('limit') || '500', 10), 1000);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const customers = await select('customers', {});
      let list = customers || [];
      if (search) {
        list = list.filter((cust: any) => {
          const fn = String(cust.full_name || '').toLowerCase();
          const em = String(cust.email || '').toLowerCase();
          const ph = String(cust.phone || '');
          return fn.includes(search) || em.includes(search) || ph.includes(search);
        });
      }
      const total = list.length;
      const page = list.slice(offset, offset + limit);

      return c.json({
        success: true,
        count: total,
        customers: page.map((customer: any) => ({
          id: customer.id,
          name: customer.full_name || customer.name,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          created_at: customer.created_at,
          is_active: customer.is_active,
          status: customer.status || 'active',
        })),
      });
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/customers/active', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const search = (c.req.query('search') || '').trim().toLowerCase();
      const city = (c.req.query('city') || '').trim().toLowerCase();
      const limit = Math.min(parseInt(c.req.query('limit') || '500', 10), 1000);

      const customers = await select('customers', {});
      let list = (customers || []).filter((cust: any) => normalizeIsActive(cust.is_active));
      if (search) {
        list = list.filter((cust: any) => {
          const fn = String(cust.full_name || '').toLowerCase();
          const em = String(cust.email || '').toLowerCase();
          const ph = String(cust.phone || '');
          const ct = String(cust.city || '').toLowerCase();
          return fn.includes(search) || em.includes(search) || ph.includes(search) || ct.includes(search);
        });
      }
      if (city && city !== 'all') {
        list = list.filter((cust: any) => String(cust.city || '').toLowerCase() === city);
      }

      list = list.slice(0, limit);

      const mapped = list.map((cust: any) => ({
        id: cust.id,
        businessName: cust.full_name || 'Customer',
        ownerName: cust.full_name || '',
        tier: 'Standard',
        city: cust.city || '',
        location: cust.city || cust.address || '',
        category: 'customer',
        rating: 0,
        vendorType: 'solo',
        roleName: 'customer',
        roleDisplayName: 'Customer',
        phone: cust.phone,
        email: cust.email,
        isActive: true,
        completedBookingsCount: 0,
        activeServicesCount: 0,
        reviewCount: 0,
      }));

      return c.json({ vendors: mapped, customers: mapped, total: mapped.length });
    } catch (error: any) {
      console.error('[admin/customers/active]', error);
      return c.json({ success: false, error: error.message, vendors: [], customers: [], total: 0 }, 500);
    }
  });

  app.get('/admin/customers/deactivated', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const search = (c.req.query('search') || '').trim().toLowerCase();
      const limit = Math.min(parseInt(c.req.query('limit') || '500', 10), 1000);

      const customers = await select('customers', {});
      let list = (customers || []).filter((cust: any) => !normalizeIsActive(cust.is_active));
      if (search) {
        list = list.filter((cust: any) => {
          const fn = String(cust.full_name || '').toLowerCase();
          const ph = String(cust.phone || '');
          const em = String(cust.email || '').toLowerCase();
          return fn.includes(search) || ph.includes(search) || em.includes(search);
        });
      }
      list = list.slice(0, limit);

      const mapped = list.map((cust: any) => ({
        id: cust.id,
        businessName: cust.full_name || 'Customer',
        ownerName: cust.full_name || '',
        phone: cust.phone,
        email: cust.email,
        roleName: 'customer',
        roleDisplayName: 'Customer',
        category: 'customer',
        status: 'inactive',
        tier: 'Standard',
        isActive: false,
        vendorType: 'solo',
        location: cust.city || null,
        city: cust.city || '',
        completedBookingsCount: 0,
        totalRevenue: 0,
        createdAt: cust.created_at,
        updatedAt: cust.updated_at,
        deactivatedAt: cust.updated_at,
        deactivatedBy: null,
        deactivationReason: null,
      }));

      return c.json({ success: true, vendors: mapped, customers: mapped, total: mapped.length });
    } catch (error: any) {
      console.error('[admin/customers/deactivated]', error);
      return c.json({ success: false, error: error.message, vendors: [], customers: [] }, 500);
    }
  });

  app.get('/admin/customers/insights', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const range = c.req.query('range') || '30d';
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

      const salesData = await query(`
        SELECT 
          COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as total_sales,
          COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.created_at >= NOW() - INTERVAL '${days} days' THEN b.total_amount ELSE 0 END), 0) as period_sales,
          COALESCE(SUM(CASE WHEN b.status = 'completed' AND b.created_at >= NOW() - INTERVAL '${days * 2} days' AND b.created_at < NOW() - INTERVAL '${days} days' THEN b.total_amount ELSE 0 END), 0) as previous_period_sales
        FROM bookings b
        WHERE b.created_at >= NOW() - INTERVAL '${days * 2} days'
      `).catch(() => ({ rows: [{ total_sales: 0, period_sales: 0, previous_period_sales: 0 }] }));

      const sales = salesData.rows[0] || { total_sales: 0, period_sales: 0, previous_period_sales: 0 };
      const growth =
        Number(sales.previous_period_sales) > 0
          ? ((Number(sales.period_sales) - Number(sales.previous_period_sales)) /
              Number(sales.previous_period_sales)) *
            100
          : 0;

      const bookingStats = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
          COUNT(*) as total_bookings,
          AVG(rating) FILTER (WHERE rating IS NOT NULL) as avg_rating
        FROM bookings
        WHERE created_at >= NOW() - INTERVAL '${days} days'
      `).catch(() => ({
        rows: [{ completed_bookings: 0, cancelled_bookings: 0, total_bookings: 0, avg_rating: 0 }],
      }));

      const stats = bookingStats.rows[0] || {
        completed_bookings: 0,
        cancelled_bookings: 0,
        total_bookings: 0,
        avg_rating: 0,
      };
      const cancellationRate =
        Number(stats.total_bookings) > 0
          ? (Number(stats.cancelled_bookings) / Number(stats.total_bookings)) * 100
          : 0;

      const cityDist = await query(`
        SELECT COALESCE(NULLIF(TRIM(city), ''), 'Unknown') as city_name, COUNT(*)::int as count
        FROM customers
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 8
      `).catch(() => ({ rows: [] }));

      const byCategory = (cityDist.rows || []).map((r: any, idx: number) => ({
        name: String(r.city_name),
        value: parseInt(r.count, 10),
        color: COLORS[idx % COLORS.length],
      }));

      const statusDist = await query(`
        SELECT 
          CASE WHEN COALESCE(is_active, true) THEN 'Active' ELSE 'Inactive' END as status,
          COUNT(*)::int as count
        FROM customers
        GROUP BY 1
      `).catch(() => ({ rows: [] }));

      const byStatus = (statusDist.rows || []).map((r: any, idx: number) => ({
        name: r.status,
        value: parseInt(r.count, 10),
        color: COLORS[(idx + 2) % COLORS.length],
      }));

      const trends = await query(`
        SELECT 
          DATE(b.created_at) as date,
          COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0) as sales,
          COUNT(*) FILTER (WHERE b.status = 'completed') as bookings,
          COUNT(DISTINCT b.customer_id) as customers_n
        FROM bookings b
        WHERE b.created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY DATE(b.created_at)
        ORDER BY DATE(b.created_at) ASC
      `).catch(() => ({ rows: [] }));

      const trendsData = (trends.rows || []).map((r: any) => ({
        date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: parseFloat(r.sales) || 0,
        bookings: parseInt(r.bookings, 10) || 0,
        vendors: parseInt(r.customers_n, 10) || 0,
      }));

      return c.json({
        sales: {
          total: parseFloat(String(sales.total_sales)) || 0,
          growth: Math.round(growth * 10) / 10,
          thisMonth: parseFloat(String(sales.period_sales)) || 0,
          lastMonth: parseFloat(String(sales.previous_period_sales)) || 0,
          trend: growth >= 0 ? 'up' : 'down',
        },
        activities: {
          totalBookings: parseInt(String(stats.total_bookings), 10) || 0,
          completedBookings: parseInt(String(stats.completed_bookings), 10) || 0,
          cancelledBookings: parseInt(String(stats.cancelled_bookings), 10) || 0,
          cancellationRate: Math.round(cancellationRate * 10) / 10,
          avgRating: parseFloat(String(stats.avg_rating)) || 0,
        },
        distribution: {
          byCategory,
          byStatus,
        },
        trends: trendsData,
      });
    } catch (error: any) {
      console.error('[admin/customers/insights]', error);
      return c.json({ error: error.message || 'Failed to fetch insights' }, 500);
    }
  });

  app.get('/admin/customers/activities', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const filter = c.req.query('filter') || 'all';
      const limit = parseInt(c.req.query('limit') || '50', 10);

      let activitiesQuery = `
        SELECT 
          'booking' as activity_type,
          b.id as activity_id,
          c.id as vendor_id,
          COALESCE(c.full_name, 'Customer') as vendor_name,
          CONCAT('Booking ', b.status) as description,
          b.created_at as timestamp,
          jsonb_build_object(
            'bookingId', b.id,
            'amount', b.total_amount,
            'status', b.status
          ) as metadata,
          CASE 
            WHEN b.status = 'completed' THEN 'success'
            WHEN b.status = 'cancelled' THEN 'error'
            ELSE 'info'
          END as severity
        FROM bookings b
        INNER JOIN customers c ON c.id = b.customer_id
        WHERE b.created_at >= NOW() - INTERVAL '7 days'
      `;

      if (filter === 'payment') {
        activitiesQuery = `
          SELECT 
            'payment' as activity_type,
            t.id as activity_id,
            c.id as vendor_id,
            COALESCE(c.full_name, 'Customer') as vendor_name,
            'Payment' as description,
            t.created_at as timestamp,
            jsonb_build_object('amount', t.amount, 'type', t.transaction_type) as metadata,
            'success' as severity
          FROM transactions t
          INNER JOIN customers c ON c.id = t.customer_id
          WHERE t.created_at >= NOW() - INTERVAL '7 days'
            AND t.transaction_type = 'payment'
        `;
      }

      activitiesQuery += ` ORDER BY timestamp DESC LIMIT $1`;

      const activities = await query(activitiesQuery, [limit]).catch(() => ({ rows: [] }));

      const formatted = (activities.rows || []).map((r: any) => ({
        id: r.activity_id,
        vendorId: r.vendor_id,
        vendorName: r.vendor_name,
        activityType: r.activity_type,
        description: r.description,
        timestamp: r.timestamp,
        metadata: r.metadata || {},
        severity: r.severity || 'info',
      }));

      return c.json({ activities: formatted });
    } catch (error: any) {
      console.error('[admin/customers/activities]', error);
      return c.json({ activities: [] });
    }
  });

  app.get('/admin/customers/fraud-alerts', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const suspicious = await query(`
        SELECT 
          c.id as customer_id,
          COALESCE(c.full_name, c.phone) as customer_name,
          COUNT(DISTINCT t.id) as transaction_count,
          COUNT(DISTINCT CASE WHEN t.transaction_type = 'refund' THEN t.id END) as refund_count,
          COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
          ROUND(COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(DISTINCT b.id), 0) * 100, 1) as cancellation_rate
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id AND t.created_at >= NOW() - INTERVAL '30 days'
        LEFT JOIN bookings b ON b.customer_id = c.id AND b.created_at >= NOW() - INTERVAL '30 days'
        WHERE COALESCE(c.is_active, true) = true
        GROUP BY c.id, c.full_name, c.phone
        HAVING 
          COUNT(DISTINCT CASE WHEN t.transaction_type = 'refund' THEN t.id END) > 3
          OR COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled') > 5
          OR (COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(DISTINCT b.id), 0)) > 0.35
        ORDER BY refund_count DESC, cancellation_rate DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      const alerts = (suspicious.rows || []).map((r: any, idx: number) => {
        const refundCount = parseInt(r.refund_count, 10) || 0;
        const cancellationRate = parseFloat(r.cancellation_rate) || 0;
        let riskLevel = 'low';
        if (refundCount > 8 || cancellationRate > 40) riskLevel = 'high';
        else if (refundCount > 4 || cancellationRate > 25) riskLevel = 'medium';

        return {
          id: `${r.customer_id}:${idx}`,
          vendorId: r.customer_id,
          vendorName: r.customer_name,
          riskLevel,
          alertType: cancellationRate > 30 ? 'cancellation_pattern' : 'suspicious_payment',
          description:
            refundCount > 4
              ? `Multiple refunds (${refundCount})`
              : `High cancellation rate (${cancellationRate}%)`,
          detectedAt: new Date().toISOString(),
          evidence: {
            transactionCount: parseInt(r.transaction_count, 10) || 0,
            cancellationRate,
          },
          status: 'new',
        };
      });

      return c.json({ alerts });
    } catch (error: any) {
      console.error('[admin/customers/fraud-alerts]', error);
      return c.json({ alerts: [] });
    }
  });

  app.post('/admin/customers/fraud-alerts/:alertId/:action', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const alertId = c.req.param('alertId');
      const action = c.req.param('action');
      const customerId = String(alertId || '').split(':')[0];

      if ((action === 'investigate' || action === 'resolve' || action === 'dismiss') && customerId?.length > 10) {
        await query(`UPDATE customers SET updated_at = NOW() WHERE id = $1::uuid`, [customerId]).catch(() => undefined);
      }

      return c.json({ success: true, message: `Alert ${action}`, alertId });
    } catch (error: any) {
      return c.json({ error: error.message || 'Failed' }, 500);
    }
  });

  app.get('/admin/customers/abnormal-behavior', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const behaviors = await query(`
        SELECT 
          c.id as customer_id,
          COALESCE(c.full_name, c.phone) as customer_name,
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_count,
          COUNT(b.id) as total_bookings,
          ROUND(COUNT(b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(b.id), 0) * 100, 1) as cancellation_rate,
          ROUND(AVG(b.rating) FILTER (WHERE b.rating IS NOT NULL), 1) as avg_rating
        FROM customers c
        LEFT JOIN bookings b ON b.customer_id = c.id AND b.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.full_name, c.phone
        HAVING COUNT(b.id) > 3 AND (
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled')::numeric / NULLIF(COUNT(b.id), 0) > 0.25
          OR AVG(b.rating) FILTER (WHERE b.rating IS NOT NULL) < 3
        )
        LIMIT 30
      `).catch(() => ({ rows: [] }));

      const formatted = (behaviors.rows || []).map((r: any) => ({
        vendorId: r.customer_id,
        vendorName: r.customer_name,
        behaviorType: parseFloat(r.avg_rating) < 3 ? 'low_rating' : 'high_cancellation',
        severity: parseFloat(r.cancellation_rate) > 35 ? 'alert' : 'warning',
        description: `Cancellation rate ${r.cancellation_rate}%`,
        metrics: {
          value: parseFloat(r.cancellation_rate) || 0,
          threshold: 25,
          trend: 'up' as const,
        },
      }));

      return c.json({ behaviors: formatted });
    } catch (error: any) {
      return c.json({ behaviors: [] });
    }
  });

  app.get('/admin/customers/deactivation-requests', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const requests = await query(`
        SELECT r.id, r.reason, r.requested_at, r.status,
          c.id as customer_id,
          COALESCE(c.full_name, c.phone) as customer_name,
          COALESCE(c.full_name, c.phone) as business_name
        FROM customer_deactivation_requests r
        INNER JOIN customers c ON c.id = r.customer_id
        WHERE r.status = 'pending'
        ORDER BY r.requested_at DESC
      `).catch(() => ({ rows: [] }));

      const mapped = (requests.rows || []).map((r: any) => ({
        id: r.id,
        vendorName: r.customer_name,
        businessName: r.business_name,
        reason: r.reason || '',
        requestedAt: r.requested_at,
        status: r.status || 'pending',
      }));

      return c.json({ requests: mapped });
    } catch (error: any) {
      return c.json({ requests: [] });
    }
  });

  app.post('/admin/customers/deactivation-requests/:requestId/approve', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const requestId = c.req.param('requestId');
      const row = await query(
        `SELECT customer_id FROM customer_deactivation_requests WHERE id = $1::uuid`,
        [requestId]
      );
      const customerId = row.rows?.[0]?.customer_id;
      if (!customerId) return c.json({ error: 'Request not found' }, 404);

      await update('customers', { id: customerId }, { is_active: false, updated_at: new Date().toISOString() });
      await query(
        `UPDATE customer_deactivation_requests SET status = 'approved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
        [requestId]
      );
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/customers/deactivation-requests/:requestId/reject', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const requestId = c.req.param('requestId');
      await query(
        `UPDATE customer_deactivation_requests SET status = 'rejected', resolved_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
        [requestId]
      );
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/customers/compliance-issues', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const issues = await query(`
        SELECT ci.id,
          COALESCE(c.full_name, c.phone) as vendor_name,
          ci.issue_type,
          ci.severity,
          COALESCE(ci.description, ci.title, '') as description,
          ci.created_at as reported_at,
          ci.status
        FROM customer_compliance_issues ci
        INNER JOIN customers c ON c.id = ci.customer_id
        WHERE ci.status <> 'resolved'
        ORDER BY ci.created_at DESC
        LIMIT 50
      `).catch(() => ({ rows: [] }));

      const formatted = (issues.rows || []).map((r: any) => ({
        id: r.id,
        vendorName: r.vendor_name,
        issueType: r.issue_type,
        severity: r.severity || 'medium',
        description: r.description,
        reportedAt: r.reported_at,
        status: r.status === 'investigating' ? 'investigating' : r.status === 'resolved' ? 'resolved' : 'open',
      }));

      return c.json({ issues: formatted });
    } catch (error: any) {
      return c.json({ issues: [] });
    }
  });

  app.post('/admin/customers/compliance-issues/:issueId/investigate', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const issueId = c.req.param('issueId');
      await query(
        `UPDATE customer_compliance_issues SET status = 'investigating', investigated_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
        [issueId]
      );
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/customers/compliance-issues/:issueId/resolve', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const issueId = c.req.param('issueId');
      await query(
        `UPDATE customer_compliance_issues SET status = 'resolved', resolved_at = NOW(), updated_at = NOW() WHERE id = $1::uuid`,
        [issueId]
      );
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/customers/:customerId/deactivate', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json().catch(() => ({}));
      const reason = String(body.reason || '').trim();
      await update('customers', { id: customerId }, { is_active: false, updated_at: new Date().toISOString() });
      if (reason) {
        await query(
          `INSERT INTO customer_deactivation_requests (customer_id, reason, status, requested_at, resolved_at, admin_notes)
           VALUES ($1::uuid, $2, 'approved', NOW(), NOW(), 'admin')`,
          [customerId, reason]
        ).catch(() => undefined);
      }
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/customers/:customerId/reactivate', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const customerId = c.req.param('customerId');
      await update('customers', { id: customerId }, { is_active: true, updated_at: new Date().toISOString() });
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/customers/:customerId/delete', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json().catch(() => ({}));
      const reason = String(body.reason || 'admin_delete').trim();
      await update('customers', { id: customerId }, { is_active: false, updated_at: new Date().toISOString() });
      console.log('[admin/customers/delete]', customerId, reason);
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.get('/admin/customers/:customerId/details', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const customerId = c.req.param('customerId');
      const rows = await select('customers', { id: customerId });
      const cust = rows[0];
      if (!cust) return c.json({ error: 'Not found' }, 404);
      return c.json({
        success: true,
        vendor: {
          id: cust.id,
          businessName: cust.full_name,
          ownerName: cust.full_name,
          email: cust.email,
          phone: cust.phone,
          city: cust.city,
          status: cust.is_active === false ? 'inactive' : 'active',
        },
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/customers/:customerId/customer-portal-code', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const customerId = c.req.param('customerId');
      const adminId = (c.get('userId') as string | undefined) || g.userId;
      const result = await createCustomerPortalCode({ adminId, customerId });
      if (!result.ok) {
        return c.json(
          { success: false, error: result.error, code: result.errorCode },
          result.status as 400 | 403 | 404 | 500
        );
      }
      return c.json({ success: true, code: result.code, expiresAt: result.expiresAt });
    } catch (error: any) {
      return c.json({ success: false, error: error?.message || 'Failed' }, 500);
    }
  });

  /** Quality alerts — customer-centric (same thresholds idea as /quality/alerts for vendors) */
  app.get('/quality/customer-alerts', async (c) => {
    const g = await gate(c);
    if (!g.ok) return g.res;
    try {
      const alerts = await query(`
        SELECT 
          c.id as customer_id,
          COALESCE(c.full_name, c.phone) as customer_name,
          COUNT(b.id) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,
          COUNT(b.id) FILTER (WHERE b.status = 'completed' AND b.rating IS NOT NULL AND b.rating < 3) as low_rated_bookings
        FROM customers c
        LEFT JOIN bookings b ON b.customer_id = c.id
        WHERE COALESCE(c.is_active, true) = true
        GROUP BY c.id, c.full_name, c.phone
        HAVING COUNT(b.id) FILTER (WHERE b.status = 'cancelled') > 5
           OR COUNT(b.id) FILTER (WHERE b.status = 'completed' AND b.rating IS NOT NULL AND b.rating < 3) > 3
        ORDER BY cancelled_bookings DESC, low_rated_bookings DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        alerts: (alerts.rows || []).map((r: any) => ({
          vendor_id: r.customer_id,
          vendor_name: r.customer_name,
          cancelled_bookings: parseInt(r.cancelled_bookings, 10) || 0,
          low_rated_bookings: parseInt(r.low_rated_bookings, 10) || 0,
        })),
      });
    } catch (error: any) {
      return c.json({ success: true, alerts: [] });
    }
  });
}
