package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.CustomerPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerPreferenceRepository extends JpaRepository<CustomerPreference, UUID> {

    Optional<CustomerPreference> findByCustomerId(UUID customerId);

    boolean existsByCustomerId(UUID customerId);
}