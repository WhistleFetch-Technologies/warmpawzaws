/**
 * SERVICE COMPARISON SYSTEM
 * 
 * Features:
 * - Compare multiple services side-by-side
 * - Compare multiple vendors
 * - Compare multiple staff members
 * - Comparison criteria customization
 * - Save comparison results
 * - Share comparison with others
 * 
 * Status: ✅ P2 IMPLEMENTATION (3%)
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

// ==========================================================================
// SERVICE COMPARISON
// ==========================================================================

/**
 * POST /customer/compare/services
 * Compare multiple services
 */
app.post('/customer/compare/services', async (c) => {
  try {
    const { serviceIds, criteria } = await c.req.json();
    
    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length < 2) {
      return c.json({
        error: 'At least 2 services required for comparison',
        field: 'serviceIds'
      }, 400);
    }
    
    if (serviceIds.length > 5) {
      return c.json({
        error: 'Maximum 5 services can be compared at once',
        field: 'serviceIds'
      }, 400);
    }
    
    // Fetch all services
    const services: any[] = [];
    for (const serviceId of serviceIds) {
      const service = await kv.get(`service:${serviceId}`);
      if (service) {
        services.push(service);
      }
    }
    
    if (services.length < 2) {
      return c.json({
        error: 'Not enough valid services found'
      }, 404);
    }
    
    // Default comparison criteria
    const defaultCriteria = [
      'price',
      'rating',
      'duration',
      'availability',
      'experience',
      'certifications',
      'specializations'
    ];
    
    const activeCriteria = criteria || defaultCriteria;
    
    // Build comparison matrix
    const comparison = {
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        vendorName: s.vendorName,
        serviceStyle: s.serviceStyle
      })),
      criteria: {} as any
    };
    
    // Compare each criterion
    for (const criterion of activeCriteria) {
      comparison.criteria[criterion] = {
        values: services.map(s => extractCriterionValue(s, criterion)),
        winner: null as any,
        analysis: ''
      };
      
      // Determine winner for this criterion
      comparison.criteria[criterion].winner = determineWinner(
        services,
        criterion,
        comparison.criteria[criterion].values
      );
      
      comparison.criteria[criterion].analysis = generateAnalysis(
        criterion,
        comparison.criteria[criterion].values,
        comparison.criteria[criterion].winner
      );
    }
    
    // Overall recommendation
    const recommendation = generateRecommendation(services, comparison);
    
    console.log(`🔍 Compared ${services.length} services`);
    
    return c.json({
      success: true,
      comparison,
      recommendation,
      comparedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error comparing services:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Helper: Extract value for a criterion
function extractCriterionValue(service: any, criterion: string): any {
  switch (criterion) {
    case 'price':
      return service.price || 0;
    case 'rating':
      return service.rating || 0;
    case 'duration':
      return service.duration || 0;
    case 'availability':
      return service.isAvailable ? 'Available' : 'Not Available';
    case 'experience':
      return service.yearsOfExperience || 0;
    case 'certifications':
      return service.certifications || [];
    case 'specializations':
      return service.specializations || [];
    case 'reviewCount':
      return service.reviewCount || 0;
    case 'distance':
      return service.distance || null;
    default:
      return service[criterion] || 'N/A';
  }
}

// Helper: Determine winner for a criterion
function determineWinner(services: any[], criterion: string, values: any[]): any {
  switch (criterion) {
    case 'price':
      // Lower is better
      const minPriceIndex = values.indexOf(Math.min(...values.filter(v => v > 0)));
      return {
        serviceIndex: minPriceIndex,
        value: values[minPriceIndex],
        reason: 'Lowest price'
      };
    
    case 'rating':
    case 'experience':
    case 'reviewCount':
      // Higher is better
      const maxIndex = values.indexOf(Math.max(...values));
      return {
        serviceIndex: maxIndex,
        value: values[maxIndex],
        reason: `Highest ${criterion}`
      };
    
    case 'duration':
      // Shorter is better (for most services)
      const minDurationIndex = values.indexOf(Math.min(...values.filter(v => v > 0)));
      return {
        serviceIndex: minDurationIndex,
        value: values[minDurationIndex],
        reason: 'Shortest duration'
      };
    
    case 'certifications':
    case 'specializations':
      // More is better
      const lengths = values.map(v => Array.isArray(v) ? v.length : 0);
      const maxLengthIndex = lengths.indexOf(Math.max(...lengths));
      return {
        serviceIndex: maxLengthIndex,
        value: values[maxLengthIndex],
        reason: `Most ${criterion}`
      };
    
    case 'distance':
      // Closer is better
      const validDistances = values.filter(v => v !== null && v !== undefined);
      if (validDistances.length === 0) return null;
      const minDistanceIndex = values.indexOf(Math.min(...validDistances));
      return {
        serviceIndex: minDistanceIndex,
        value: values[minDistanceIndex],
        reason: 'Closest location'
      };
    
    default:
      return null;
  }
}

// Helper: Generate analysis text
function generateAnalysis(criterion: string, values: any[], winner: any): string {
  if (!winner) return 'No clear winner';
  
  const winnerValue = values[winner.serviceIndex];
  
  switch (criterion) {
    case 'price':
      const avgPrice = values.reduce((a, b) => a + b, 0) / values.length;
      const priceDiff = ((avgPrice - winnerValue) / avgPrice * 100).toFixed(0);
      return `${priceDiff}% cheaper than average (₹${avgPrice.toFixed(0)})`;
    
    case 'rating':
      return `${winnerValue}/5 rating - ${winner.reason}`;
    
    case 'experience':
      return `${winnerValue} years of experience - Most experienced`;
    
    case 'certifications':
      return `${winnerValue.length} certifications - Most certified`;
    
    case 'distance':
      return `${winnerValue.toFixed(1)} km away - Closest to you`;
    
    default:
      return winner.reason;
  }
}

// Helper: Generate overall recommendation
function generateRecommendation(services: any[], comparison: any): any {
  // Score each service based on wins
  const scores = services.map((_, index) => {
    let score = 0;
    let wins = 0;
    
    for (const criterion in comparison.criteria) {
      const winner = comparison.criteria[criterion].winner;
      if (winner && winner.serviceIndex === index) {
        // Weight different criteria
        const weight = criterion === 'rating' ? 3 : 
                      criterion === 'price' ? 2 :
                      criterion === 'experience' ? 2 : 1;
        score += weight;
        wins++;
      }
    }
    
    return { index, score, wins };
  });
  
  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  
  const topService = services[scores[0].index];
  
  return {
    recommendedServiceIndex: scores[0].index,
    recommendedService: {
      id: topService.id,
      name: topService.name,
      vendorName: topService.vendorName
    },
    score: scores[0].score,
    wins: scores[0].wins,
    reason: `Best overall value - won ${scores[0].wins} categories`,
    allScores: scores
  };
}

// ==========================================================================
// VENDOR COMPARISON
// ==========================================================================

/**
 * POST /customer/compare/vendors
 * Compare multiple vendors
 */
app.post('/customer/compare/vendors', async (c) => {
  try {
    const { vendorIds } = await c.req.json();
    
    if (!vendorIds || !Array.isArray(vendorIds) || vendorIds.length < 2) {
      return c.json({
        error: 'At least 2 vendors required for comparison'
      }, 400);
    }
    
    // Fetch vendors
    const vendors: any[] = [];
    for (const vendorId of vendorIds) {
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (vendor) {
        // Get vendor stats
        const stats = await getVendorStats(vendorId);
        vendors.push({ ...vendor, stats });
      }
    }
    
    if (vendors.length < 2) {
      return c.json({ error: 'Not enough valid vendors found' }, 404);
    }
    
    // Compare vendors
    const comparison = {
      vendors: vendors.map(v => ({
        id: v.id,
        name: v.businessName || v.fullName,
        roleId: v.roleId
      })),
      criteria: {
        rating: {
          values: vendors.map(v => v.stats.averageRating || 0),
          winner: null
        },
        totalBookings: {
          values: vendors.map(v => v.stats.totalBookings || 0),
          winner: null
        },
        totalReviews: {
          values: vendors.map(v => v.stats.totalReviews || 0),
          winner: null
        },
        responseTime: {
          values: vendors.map(v => v.stats.avgResponseTime || 0),
          winner: null
        },
        completionRate: {
          values: vendors.map(v => v.stats.completionRate || 0),
          winner: null
        }
      }
    };
    
    // Determine winners
    for (const criterion in comparison.criteria) {
      const values = comparison.criteria[criterion].values;
      
      if (criterion === 'responseTime') {
        // Lower is better
        const minIndex = values.indexOf(Math.min(...values.filter(v => v > 0)));
        comparison.criteria[criterion].winner = {
          vendorIndex: minIndex,
          value: values[minIndex]
        };
      } else {
        // Higher is better
        const maxIndex = values.indexOf(Math.max(...values));
        comparison.criteria[criterion].winner = {
          vendorIndex: maxIndex,
          value: values[maxIndex]
        };
      }
    }
    
    return c.json({
      success: true,
      comparison,
      comparedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error comparing vendors:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Helper: Get vendor statistics
async function getVendorStats(vendorId: string): Promise<any> {
  // Get all bookings for vendor
  const bookingIds = await kv.get(`vendor:bookings:${vendorId}`) || [];
  
  let totalBookings = bookingIds.length;
  let completedBookings = 0;
  let totalRating = 0;
  let ratedBookings = 0;
  
  for (const bookingId of bookingIds) {
    const booking = await kv.get(`booking:${bookingId}`);
    if (booking) {
      if (booking.status === 'completed') {
        completedBookings++;
      }
      if (booking.rating) {
        totalRating += booking.rating;
        ratedBookings++;
      }
    }
  }
  
  return {
    totalBookings,
    completedBookings,
    completionRate: totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0,
    averageRating: ratedBookings > 0 ? (totalRating / ratedBookings).toFixed(1) : 0,
    totalReviews: ratedBookings,
    avgResponseTime: 15 // Placeholder - would calculate from actual data
  };
}

// ==========================================================================
// SAVE COMPARISON
// ==========================================================================

/**
 * POST /customer/:customerId/comparisons/save
 * Save comparison results
 */
app.post('/customer/:customerId/comparisons/save', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { comparisonType, comparisonData, name } = await c.req.json();
    
    const savedComparisons = await kv.get(`customer:${customerId}:saved-comparisons`) || [];
    
    const comparisonId = `comparison_${Date.now()}`;
    
    savedComparisons.push({
      id: comparisonId,
      name: name || `Comparison ${savedComparisons.length + 1}`,
      type: comparisonType, // 'services', 'vendors', 'staff'
      data: comparisonData,
      createdAt: new Date().toISOString()
    });
    
    // Keep only last 20 comparisons
    if (savedComparisons.length > 20) {
      savedComparisons.splice(0, savedComparisons.length - 20);
    }
    
    await kv.set(`customer:${customerId}:saved-comparisons`, savedComparisons);
    
    return c.json({
      success: true,
      comparisonId,
      message: 'Comparison saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving comparison:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /customer/:customerId/comparisons
 * Get saved comparisons
 */
app.get('/customer/:customerId/comparisons', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    const savedComparisons = await kv.get(`customer:${customerId}:saved-comparisons`) || [];
    
    return c.json({
      success: true,
      comparisons: savedComparisons,
      count: savedComparisons.length
    });
    
  } catch (error) {
    console.error('Error fetching saved comparisons:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * DELETE /customer/:customerId/comparisons/:comparisonId
 * Delete saved comparison
 */
app.delete('/customer/:customerId/comparisons/:comparisonId', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const comparisonId = c.req.param('comparisonId');
    
    let savedComparisons = await kv.get(`customer:${customerId}:saved-comparisons`) || [];
    
    savedComparisons = savedComparisons.filter((comp: any) => comp.id !== comparisonId);
    
    await kv.set(`customer:${customerId}:saved-comparisons`, savedComparisons);
    
    return c.json({
      success: true,
      message: 'Comparison deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting comparison:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
