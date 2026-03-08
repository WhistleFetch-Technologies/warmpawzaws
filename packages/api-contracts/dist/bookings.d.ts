/**
 * ============================================================================
 * BOOKING API CONTRACTS
 * ============================================================================
 */
import { z } from 'zod';
export declare const SelectedServiceSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    serviceId: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    duration: z.ZodOptional<z.ZodNumber>;
    quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    id?: string | undefined;
    name?: string | undefined;
    serviceId?: string | undefined;
    price?: number | undefined;
    duration?: number | undefined;
}, {
    id?: string | undefined;
    name?: string | undefined;
    serviceId?: string | undefined;
    price?: number | undefined;
    duration?: number | undefined;
    quantity?: number | undefined;
}>;
export declare const CreateBookingRequestSchema: z.ZodObject<{
    customerId: z.ZodString;
    vendorId: z.ZodString;
    serviceId: z.ZodUnion<[z.ZodString, z.ZodEffects<z.ZodString, string, string>]>;
    staffId: z.ZodOptional<z.ZodString>;
    bookingDate: z.ZodString;
    bookingTime: z.ZodString;
    serviceType: z.ZodEnum<["at_vendor", "at_home", "online", "at_center", "tele", "hybrid", "product"]>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    pincode: z.ZodOptional<z.ZodString>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    petId: z.ZodOptional<z.ZodString>;
    amount: z.ZodOptional<z.ZodNumber>;
    totalAmount: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    couponCode: z.ZodOptional<z.ZodString>;
    promotionId: z.ZodOptional<z.ZodString>;
    selectedServices: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodNumber>;
        duration: z.ZodOptional<z.ZodNumber>;
        quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
    }, {
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
        quantity?: number | undefined;
    }>, "many">>;
    serviceName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    customerName: z.ZodOptional<z.ZodString>;
    petName: z.ZodOptional<z.ZodString>;
    packagePurchaseId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    serviceId: string;
    customerId: string;
    vendorId: string;
    bookingDate: string;
    bookingTime: string;
    serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
    staffId?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    petId?: string | undefined;
    amount?: number | undefined;
    totalAmount?: number | undefined;
    notes?: string | undefined;
    idempotencyKey?: string | undefined;
    couponCode?: string | undefined;
    promotionId?: string | undefined;
    selectedServices?: {
        quantity: number;
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
    }[] | undefined;
    serviceName?: string | undefined;
    customerPhone?: string | undefined;
    customerName?: string | undefined;
    petName?: string | undefined;
    packagePurchaseId?: string | undefined;
}, {
    serviceId: string;
    customerId: string;
    vendorId: string;
    bookingDate: string;
    bookingTime: string;
    serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
    staffId?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    petId?: string | undefined;
    amount?: number | undefined;
    totalAmount?: number | undefined;
    notes?: string | undefined;
    idempotencyKey?: string | undefined;
    couponCode?: string | undefined;
    promotionId?: string | undefined;
    selectedServices?: {
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
        quantity?: number | undefined;
    }[] | undefined;
    serviceName?: string | undefined;
    customerPhone?: string | undefined;
    customerName?: string | undefined;
    petName?: string | undefined;
    packagePurchaseId?: string | undefined;
}>;
export declare const UpdateBookingStatusRequestSchema: z.ZodObject<{
    status: z.ZodEnum<["pending", "confirmed", "scheduled", "in_progress", "completed", "cancelled", "no_show", "rescheduled", "sample_collected", "sample_received_at_lab", "processing", "reports_ready"]>;
    reason: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "confirmed" | "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled" | "sample_collected" | "sample_received_at_lab" | "processing" | "reports_ready";
    notes?: string | undefined;
    reason?: string | undefined;
}, {
    status: "pending" | "confirmed" | "scheduled" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled" | "sample_collected" | "sample_received_at_lab" | "processing" | "reports_ready";
    notes?: string | undefined;
    reason?: string | undefined;
}>;
export declare const RescheduleBookingRequestSchema: z.ZodObject<{
    bookingDate: z.ZodString;
    bookingTime: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    bookingDate: string;
    bookingTime: string;
    reason?: string | undefined;
}, {
    bookingDate: string;
    bookingTime: string;
    reason?: string | undefined;
}>;
export declare const CancelBookingRequestSchema: z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
    refundRequested: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reason?: string | undefined;
    refundRequested?: boolean | undefined;
}, {
    reason?: string | undefined;
    refundRequested?: boolean | undefined;
}>;
export declare const BookingSchema: z.ZodObject<{
    id: z.ZodString;
    customerId: z.ZodString;
    vendorId: z.ZodNullable<z.ZodString>;
    staffId: z.ZodNullable<z.ZodString>;
    serviceId: z.ZodString;
    bookingDate: z.ZodString;
    bookingTime: z.ZodString;
    status: z.ZodEnum<["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"]>;
    serviceType: z.ZodEnum<["at_vendor", "at_home", "online", "at_center", "tele", "hybrid", "product"]>;
    address: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    state: z.ZodNullable<z.ZodString>;
    pincode: z.ZodNullable<z.ZodString>;
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
    basePrice: z.ZodNumber;
    discountAmount: z.ZodNumber;
    taxAmount: z.ZodNumber;
    totalAmount: z.ZodNumber;
    paymentStatus: z.ZodEnum<["pending", "partial", "paid", "refunded", "failed"]>;
    paymentId: z.ZodNullable<z.ZodString>;
    petId: z.ZodNullable<z.ZodString>;
    notes: z.ZodNullable<z.ZodString>;
    cancellationReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    completedAt: z.ZodNullable<z.ZodString>;
    cancelledAt: z.ZodNullable<z.ZodString>;
    selectedServices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        serviceId: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
        price: z.ZodOptional<z.ZodNumber>;
        duration: z.ZodOptional<z.ZodNumber>;
        quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
    }, {
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
        quantity?: number | undefined;
    }>, "many">>>;
    totalDurationMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
    id: string;
    serviceId: string;
    customerId: string;
    vendorId: string | null;
    staffId: string | null;
    bookingDate: string;
    bookingTime: string;
    serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    latitude: number | null;
    longitude: number | null;
    petId: string | null;
    totalAmount: number;
    notes: string | null;
    basePrice: number;
    discountAmount: number;
    taxAmount: number;
    paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
    paymentId: string | null;
    cancellationReason: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    selectedServices?: {
        quantity: number;
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
    }[] | null | undefined;
    totalDurationMinutes?: number | null | undefined;
}, {
    status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
    id: string;
    serviceId: string;
    customerId: string;
    vendorId: string | null;
    staffId: string | null;
    bookingDate: string;
    bookingTime: string;
    serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    latitude: number | null;
    longitude: number | null;
    petId: string | null;
    totalAmount: number;
    notes: string | null;
    basePrice: number;
    discountAmount: number;
    taxAmount: number;
    paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
    paymentId: string | null;
    cancellationReason: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    cancelledAt: string | null;
    selectedServices?: {
        id?: string | undefined;
        name?: string | undefined;
        serviceId?: string | undefined;
        price?: number | undefined;
        duration?: number | undefined;
        quantity?: number | undefined;
    }[] | null | undefined;
    totalDurationMinutes?: number | null | undefined;
}>;
export declare const BookingStatusHistorySchema: z.ZodObject<{
    id: z.ZodString;
    bookingId: z.ZodString;
    previousStatus: z.ZodNullable<z.ZodString>;
    newStatus: z.ZodString;
    changedBy: z.ZodNullable<z.ZodString>;
    changedByType: z.ZodEnum<["customer", "vendor", "staff", "admin", "system"]>;
    changeReason: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    bookingId: string;
    previousStatus: string | null;
    newStatus: string;
    changedBy: string | null;
    changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
    changeReason: string | null;
}, {
    id: string;
    createdAt: string;
    bookingId: string;
    previousStatus: string | null;
    newStatus: string;
    changedBy: string | null;
    changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
    changeReason: string | null;
}>;
export declare const CreateBookingResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        bookingId: z.ZodString;
        status: z.ZodString;
        message: z.ZodString;
        isNew: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        message: string;
        status: string;
        bookingId: string;
        isNew: boolean;
    }, {
        message: string;
        status: string;
        bookingId: string;
        isNew: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        message: string;
        status: string;
        bookingId: string;
        isNew: boolean;
    };
}, {
    success: true;
    data: {
        message: string;
        status: string;
        bookingId: string;
        isNew: boolean;
    };
}>;
export declare const GetBookingResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        booking: z.ZodObject<{
            id: z.ZodString;
            customerId: z.ZodString;
            vendorId: z.ZodNullable<z.ZodString>;
            staffId: z.ZodNullable<z.ZodString>;
            serviceId: z.ZodString;
            bookingDate: z.ZodString;
            bookingTime: z.ZodString;
            status: z.ZodEnum<["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"]>;
            serviceType: z.ZodEnum<["at_vendor", "at_home", "online", "at_center", "tele", "hybrid", "product"]>;
            address: z.ZodNullable<z.ZodString>;
            city: z.ZodNullable<z.ZodString>;
            state: z.ZodNullable<z.ZodString>;
            pincode: z.ZodNullable<z.ZodString>;
            latitude: z.ZodNullable<z.ZodNumber>;
            longitude: z.ZodNullable<z.ZodNumber>;
            basePrice: z.ZodNumber;
            discountAmount: z.ZodNumber;
            taxAmount: z.ZodNumber;
            totalAmount: z.ZodNumber;
            paymentStatus: z.ZodEnum<["pending", "partial", "paid", "refunded", "failed"]>;
            paymentId: z.ZodNullable<z.ZodString>;
            petId: z.ZodNullable<z.ZodString>;
            notes: z.ZodNullable<z.ZodString>;
            cancellationReason: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            completedAt: z.ZodNullable<z.ZodString>;
            cancelledAt: z.ZodNullable<z.ZodString>;
            selectedServices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                serviceId: z.ZodOptional<z.ZodString>;
                name: z.ZodOptional<z.ZodString>;
                price: z.ZodOptional<z.ZodNumber>;
                duration: z.ZodOptional<z.ZodNumber>;
                quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, "strip", z.ZodTypeAny, {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }, {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }>, "many">>>;
            totalDurationMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }, {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        booking: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        };
    }, {
        booking: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        booking: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        };
    };
}, {
    success: true;
    data: {
        booking: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        };
    };
}>;
export declare const BookingListResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        bookings: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            customerId: z.ZodString;
            vendorId: z.ZodNullable<z.ZodString>;
            staffId: z.ZodNullable<z.ZodString>;
            serviceId: z.ZodString;
            bookingDate: z.ZodString;
            bookingTime: z.ZodString;
            status: z.ZodEnum<["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show", "rescheduled"]>;
            serviceType: z.ZodEnum<["at_vendor", "at_home", "online", "at_center", "tele", "hybrid", "product"]>;
            address: z.ZodNullable<z.ZodString>;
            city: z.ZodNullable<z.ZodString>;
            state: z.ZodNullable<z.ZodString>;
            pincode: z.ZodNullable<z.ZodString>;
            latitude: z.ZodNullable<z.ZodNumber>;
            longitude: z.ZodNullable<z.ZodNumber>;
            basePrice: z.ZodNumber;
            discountAmount: z.ZodNumber;
            taxAmount: z.ZodNumber;
            totalAmount: z.ZodNumber;
            paymentStatus: z.ZodEnum<["pending", "partial", "paid", "refunded", "failed"]>;
            paymentId: z.ZodNullable<z.ZodString>;
            petId: z.ZodNullable<z.ZodString>;
            notes: z.ZodNullable<z.ZodString>;
            cancellationReason: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
            completedAt: z.ZodNullable<z.ZodString>;
            cancelledAt: z.ZodNullable<z.ZodString>;
            selectedServices: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodObject<{
                id: z.ZodOptional<z.ZodString>;
                serviceId: z.ZodOptional<z.ZodString>;
                name: z.ZodOptional<z.ZodString>;
                price: z.ZodOptional<z.ZodNumber>;
                duration: z.ZodOptional<z.ZodNumber>;
                quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
            }, "strip", z.ZodTypeAny, {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }, {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }>, "many">>>;
            totalDurationMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }, {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }>, "many">;
        total: z.ZodNumber;
        page: z.ZodOptional<z.ZodNumber>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        bookings: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }[];
        total: number;
        page?: number | undefined;
        limit?: number | undefined;
    }, {
        bookings: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }[];
        total: number;
        page?: number | undefined;
        limit?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        bookings: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                quantity: number;
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }[];
        total: number;
        page?: number | undefined;
        limit?: number | undefined;
    };
}, {
    success: true;
    data: {
        bookings: {
            status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | "no_show" | "rescheduled";
            id: string;
            serviceId: string;
            customerId: string;
            vendorId: string | null;
            staffId: string | null;
            bookingDate: string;
            bookingTime: string;
            serviceType: "at_vendor" | "at_home" | "online" | "at_center" | "tele" | "hybrid" | "product";
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            petId: string | null;
            totalAmount: number;
            notes: string | null;
            basePrice: number;
            discountAmount: number;
            taxAmount: number;
            paymentStatus: "pending" | "partial" | "paid" | "refunded" | "failed";
            paymentId: string | null;
            cancellationReason: string | null;
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            cancelledAt: string | null;
            selectedServices?: {
                id?: string | undefined;
                name?: string | undefined;
                serviceId?: string | undefined;
                price?: number | undefined;
                duration?: number | undefined;
                quantity?: number | undefined;
            }[] | null | undefined;
            totalDurationMinutes?: number | null | undefined;
        }[];
        total: number;
        page?: number | undefined;
        limit?: number | undefined;
    };
}>;
export declare const BookingStatusHistoryResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        history: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            bookingId: z.ZodString;
            previousStatus: z.ZodNullable<z.ZodString>;
            newStatus: z.ZodString;
            changedBy: z.ZodNullable<z.ZodString>;
            changedByType: z.ZodEnum<["customer", "vendor", "staff", "admin", "system"]>;
            changeReason: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            createdAt: string;
            bookingId: string;
            previousStatus: string | null;
            newStatus: string;
            changedBy: string | null;
            changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
            changeReason: string | null;
        }, {
            id: string;
            createdAt: string;
            bookingId: string;
            previousStatus: string | null;
            newStatus: string;
            changedBy: string | null;
            changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
            changeReason: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        history: {
            id: string;
            createdAt: string;
            bookingId: string;
            previousStatus: string | null;
            newStatus: string;
            changedBy: string | null;
            changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
            changeReason: string | null;
        }[];
    }, {
        history: {
            id: string;
            createdAt: string;
            bookingId: string;
            previousStatus: string | null;
            newStatus: string;
            changedBy: string | null;
            changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
            changeReason: string | null;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        history: {
            id: string;
            createdAt: string;
            bookingId: string;
            previousStatus: string | null;
            newStatus: string;
            changedBy: string | null;
            changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
            changeReason: string | null;
        }[];
    };
}, {
    success: true;
    data: {
        history: {
            id: string;
            createdAt: string;
            bookingId: string;
            previousStatus: string | null;
            newStatus: string;
            changedBy: string | null;
            changedByType: "customer" | "vendor" | "admin" | "staff" | "system";
            changeReason: string | null;
        }[];
    };
}>;
export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type UpdateBookingStatusRequest = z.infer<typeof UpdateBookingStatusRequestSchema>;
export type RescheduleBookingRequest = z.infer<typeof RescheduleBookingRequestSchema>;
export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;
export type Booking = z.infer<typeof BookingSchema>;
export type BookingStatusHistory = z.infer<typeof BookingStatusHistorySchema>;
export type CreateBookingResponse = z.infer<typeof CreateBookingResponseSchema>;
export type GetBookingResponse = z.infer<typeof GetBookingResponseSchema>;
export type BookingListResponse = z.infer<typeof BookingListResponseSchema>;
export type BookingStatusHistoryResponse = z.infer<typeof BookingStatusHistoryResponseSchema>;
//# sourceMappingURL=bookings.d.ts.map