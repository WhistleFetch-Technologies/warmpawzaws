package com.warmpawz.customer.config;

public final class CacheNames {

    private CacheNames() {
    }

    public static final String CUSTOMER_BY_ID = "customerById";
    public static final String CUSTOMER_BY_PHONE = "customerByPhone";
    public static final String PETS_BY_CUSTOMER_ID = "petsByCustomerId";
    public static final String PETS_BY_PHONE = "petsByPhone";
    public static final String ADDRESSES_BY_CUSTOMER_ID = "addressesByCustomerId";
    public static final String ADDRESSES_BY_PHONE = "addressesByPhone";
    public static final String IDEMPOTENCY_RESPONSE = "idempotencyResponse";
}
