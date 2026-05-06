package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.CustomerAddress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, UUID> {

    List<CustomerAddress> findByCustomer_Id(UUID customerId);

    List<CustomerAddress> findByCustomer_IdAndIsDefaultTrue(UUID customerId);
}