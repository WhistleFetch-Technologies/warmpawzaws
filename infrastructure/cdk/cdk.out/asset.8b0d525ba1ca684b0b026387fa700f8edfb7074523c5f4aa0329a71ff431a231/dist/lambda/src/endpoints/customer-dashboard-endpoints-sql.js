"use strict";
/**
 * ============================================================================
 * CUSTOMER DASHBOARD ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Complete API endpoints for customer dashboard with:
 * - Customer bookings overview
 * - Pet management
 * - Wallet balance
 * - Order history
 * - Upcoming appointments
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.customerDashboardEndpoints = customerDashboardEndpoints;
const response_utils_1 = require("./response-utils");
const repositories_1 = require("../lib/repositories");
/**
 * Register customer dashboard endpoints
 */
function customerDashboardEndpoints(app) {
    /**
     * Get comprehensive customer dashboard data
     * GET /customer/dashboard/:customerId
     */
    app.get('/customer/dashboard/:customerId', async (c) => {
        try {
            const { customerId } = c.req.param();
            // Get repositories
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const petsRepo = (0, repositories_1.getPetsRepository)();
            const walletsRepo = (0, repositories_1.getWalletsRepository)();
            const ordersRepo = (0, repositories_1.getOrdersRepository)();
            // Get customer
            const customer = await customersRepo.findById(customerId);
            if (!customer) {
                return (0, response_utils_1.sendError)(c, new Error('Customer not found'), 404);
            }
            // Get customer data
            const bookings = await bookingsRepo.findByCustomer(customerId);
            const pets = await petsRepo.findByCustomer(customerId);
            const wallet = await walletsRepo.findByCustomer(customerId);
            const orders = await ordersRepo.findByCustomer(customerId);
            // Calculate statistics
            const stats = {
                totalBookings: bookings.length,
                upcomingBookings: bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending').length,
                completedBookings: bookings.filter((b) => b.status === 'completed').length,
                cancelledBookings: bookings.filter((b) => b.status === 'cancelled').length,
                totalPets: pets.length,
                walletBalance: wallet?.balance || 0,
                totalOrders: orders.length,
                pendingOrders: orders.filter((o) => o.order_status === 'pending').length,
            };
            // Get upcoming appointments (next 7 days)
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const upcomingAppointments = bookings
                .filter((b) => {
                const bookingDate = b.booking_date || b.scheduled_date;
                if (!bookingDate)
                    return false;
                const date = new Date(bookingDate);
                return date >= now && date <= nextWeek &&
                    (b.status === 'confirmed' || b.status === 'pending');
            })
                .sort((a, b) => {
                const dateA = new Date(a.booking_date || a.scheduled_date || 0).getTime();
                const dateB = new Date(b.booking_date || b.scheduled_date || 0).getTime();
                return dateA - dateB;
            })
                .slice(0, 10);
            // Get recent bookings
            const recentBookings = bookings
                .sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            })
                .slice(0, 5);
            // Get recent orders
            const recentOrders = orders
                .sort((a, b) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA;
            })
                .slice(0, 5);
            return (0, response_utils_1.sendSuccess)(c, {
                customer: {
                    id: customer.id,
                    phone: customer.phone,
                    email: customer.email,
                    fullName: customer.full_name,
                    profilePhoto: customer.profile_photo_url,
                },
                stats,
                pets: pets.map((p) => ({
                    id: p.id,
                    name: p.name,
                    species: p.species,
                    breed: p.breed,
                    profilePhoto: p.profile_photo_url,
                })),
                wallet: wallet ? {
                    balance: wallet.balance,
                    currency: wallet.currency,
                } : null,
                upcomingAppointments,
                recentBookings,
                recentOrders,
                generatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Error fetching customer dashboard:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get customer quick stats
     * GET /customer/dashboard/:customerId/stats
     */
    app.get('/customer/dashboard/:customerId/stats', async (c) => {
        try {
            const { customerId } = c.req.param();
            const timeframe = c.req.query('timeframe') || 'all'; // today, week, month, all
            const bookingsRepo = (0, repositories_1.getBookingsRepository)();
            const ordersRepo = (0, repositories_1.getOrdersRepository)();
            const allBookings = await bookingsRepo.findByCustomer(customerId);
            const allOrders = await ordersRepo.findByCustomer(customerId);
            // Filter by timeframe
            let filteredBookings = allBookings;
            let filteredOrders = allOrders;
            if (timeframe !== 'all') {
                const now = new Date();
                let dateFrom;
                if (timeframe === 'today') {
                    dateFrom = now.toISOString().split('T')[0];
                }
                else if (timeframe === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    dateFrom = weekAgo.toISOString().split('T')[0];
                }
                else if (timeframe === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    dateFrom = monthAgo.toISOString().split('T')[0];
                }
                else {
                    dateFrom = '';
                }
                if (dateFrom) {
                    filteredBookings = allBookings.filter((b) => {
                        const bookingDate = b.booking_date || b.scheduled_date || b.created_at || '';
                        return bookingDate >= dateFrom;
                    });
                    filteredOrders = allOrders.filter((o) => {
                        const orderDate = o.created_at || '';
                        return orderDate >= dateFrom;
                    });
                }
            }
            const stats = {
                bookings: {
                    total: filteredBookings.length,
                    completed: filteredBookings.filter((b) => b.status === 'completed').length,
                    pending: filteredBookings.filter((b) => b.status === 'pending' || b.status === 'confirmed').length,
                    cancelled: filteredBookings.filter((b) => b.status === 'cancelled').length,
                },
                orders: {
                    total: filteredOrders.length,
                    completed: filteredOrders.filter((o) => o.order_status === 'completed').length,
                    pending: filteredOrders.filter((o) => o.order_status === 'pending').length,
                },
                timeframe,
            };
            return (0, response_utils_1.sendSuccess)(c, stats);
        }
        catch (error) {
            console.error('Error fetching customer stats:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * Get customer home page data (banners, quick services, featured content)
     * GET /customer/home/:customerId
     */
    app.get('/customer/home/:customerId', async (c) => {
        try {
            const { customerId } = c.req.param();
            // Get customer
            const customersRepo = (0, repositories_1.getCustomersRepository)();
            const customer = await customersRepo.findById(customerId);
            if (!customer) {
                return (0, response_utils_1.sendError)(c, new Error('Customer not found'), 404);
            }
            // Get pets
            const petsRepo = (0, repositories_1.getPetsRepository)();
            const pets = await petsRepo.findByCustomer(customerId);
            // Default banners (can be enhanced with database later)
            const banners = [
                {
                    title: "Get 50% OFF",
                    subtitle: "First Grooming Session",
                    bg: "linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)",
                    emoji: "✂️",
                    ctaLink: "grooming"
                },
                {
                    title: "Free Health Checkup",
                    subtitle: "Book Vet Appointment Today",
                    bg: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
                    emoji: "🏥",
                    ctaLink: "vet"
                },
                {
                    title: "Premium Pet Food",
                    subtitle: "20% OFF on First Order",
                    bg: "linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)",
                    emoji: "🍖",
                    ctaLink: "shop"
                }
            ];
            // Quick services (static for now, can be made dynamic)
            const quickServices = [
                { screen: 'vet', label: 'Vet', icon: 'Stethoscope', color: 'bg-blue-100' },
                { screen: 'grooming', label: 'Grooming', icon: 'Scissors', color: 'bg-pink-100' },
                { screen: 'boarding', label: 'Boarding', icon: 'HomeIcon', color: 'bg-cyan-100' },
                { screen: 'training', label: 'Training', icon: 'GraduationCap', color: 'bg-indigo-100' },
                { screen: 'walker', label: 'Walker', icon: 'Bike', color: 'bg-green-100' },
                { screen: 'shop', label: 'Shop', icon: 'ShoppingBag', color: 'bg-orange-100' },
                { screen: 'insurance', label: 'Insurance', icon: 'Shield', color: 'bg-purple-100' },
                { screen: 'cafes', label: 'Cafes', icon: 'Coffee', color: 'bg-amber-100' },
            ];
            return (0, response_utils_1.sendSuccess)(c, {
                customer: {
                    id: customer.id,
                    phone: customer.phone,
                    email: customer.email,
                    fullName: customer.full_name,
                    profilePhoto: customer.profile_photo_url,
                },
                pets: pets.map((p) => ({
                    id: p.id,
                    name: p.name,
                    species: p.species,
                    breed: p.breed,
                    age: p.age,
                    weight: p.weight,
                    photo: p.profile_photo_url,
                    image: p.profile_photo_url,
                })),
                banners,
                quickServices,
                generatedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Error fetching customer home data:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    console.log('✅ Customer dashboard endpoints registered');
}
//# sourceMappingURL=customer-dashboard-endpoints-sql.js.map