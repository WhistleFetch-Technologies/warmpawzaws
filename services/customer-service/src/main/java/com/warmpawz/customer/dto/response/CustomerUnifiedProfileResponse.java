package com.warmpawz.customer.dto.response;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CustomerUnifiedProfileResponse {

    private boolean success;
    private Profile profile;

    @Data
    public static class Profile {

        private UUID id;
        private String name;
        private String email;
        private String phone;

        private String status;
        private String onboardingStatus;
        private Boolean profileCompleted;
        private Boolean onboardingComplete;

        private Wallet wallet;

        private List<AddressResponse> addresses;

        private List<Object> bookings; // from booking-service later

        private Stats stats;

        @Data
        public static class Wallet {
            private Integer balance;
            private String currency;
            private String status;
        }

        @Data
        public static class Stats {
            private Integer totalBookings;
            private Integer activeBookings;
            private Integer totalEcommerceOrders;
            private Integer walletBalance;
        }
    }
}
