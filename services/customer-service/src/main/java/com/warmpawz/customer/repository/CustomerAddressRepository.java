package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.CustomerAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CustomerAddressRepository extends JpaRepository<CustomerAddress, UUID> {

    List<CustomerAddress> findByCustomer_Id(UUID customerId);

    List<CustomerAddress> findByCustomer_IdAndIsDefaultTrue(UUID customerId);

    @Query("""
            select count(a) > 0 from CustomerAddress a
            where a.customer.id = :customerId
              and lower(trim(coalesce(a.addressLine1, ''))) = lower(trim(coalesce(:addressLine1, '')))
              and lower(trim(coalesce(a.addressLine2, ''))) = lower(trim(coalesce(:addressLine2, '')))
              and lower(trim(coalesce(a.city, ''))) = lower(trim(coalesce(:city, '')))
              and lower(trim(coalesce(a.state, ''))) = lower(trim(coalesce(:state, '')))
              and trim(coalesce(a.pincode, '')) = trim(coalesce(:pincode, ''))
              and lower(trim(coalesce(a.addressType, ''))) = lower(trim(coalesce(:label, '')))
            """)
    boolean existsNormalizedDuplicate(
            @Param("customerId") UUID customerId,
            @Param("addressLine1") String addressLine1,
            @Param("addressLine2") String addressLine2,
            @Param("city") String city,
            @Param("state") String state,
            @Param("pincode") String pincode,
            @Param("label") String label
    );
}