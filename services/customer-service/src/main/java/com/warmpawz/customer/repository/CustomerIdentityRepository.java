package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.CustomerIdentity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CustomerIdentityRepository extends JpaRepository<CustomerIdentity, UUID> {

    Optional<CustomerIdentity> findByPhone(String phone);
}