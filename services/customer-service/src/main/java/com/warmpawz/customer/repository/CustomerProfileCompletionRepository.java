package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.CustomerProfileCompletion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerProfileCompletionRepository extends JpaRepository<CustomerProfileCompletion, UUID> {

    Optional<CustomerProfileCompletion> findByCustomerId(UUID customerId);
}