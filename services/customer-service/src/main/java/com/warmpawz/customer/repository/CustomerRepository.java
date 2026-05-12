package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    Optional<Customer> findByPhone(String phone);

    boolean existsByPhone(String phone);

    /**
     * Match stored {@code customers.phone} when the client sends a different formatting
     * (spaces, leading {@code +}, country trunk) but the digit sequences align.
     * Uses PostgreSQL digit stripping and compares full digit strings or a bounded suffix
     * of the shorter normalized value (same idea as {@code findCustomerByPhone} in Lambda).
     */
    @Query(
            value = """
                    select * from customers c
                    where trim(coalesce(c.phone, '')) = trim(coalesce(:rawPhone, ''))
                       or regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')
                            = regexp_replace(coalesce(:digitsPhone, ''), '[^0-9]', '', 'g')
                       or (
                            least(
                              length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')),
                              length(regexp_replace(coalesce(:digitsPhone, ''), '[^0-9]', '', 'g'))
                            ) >= 8
                            and right(
                                  regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g'),
                                  least(
                                    length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')),
                                    length(regexp_replace(coalesce(:digitsPhone, ''), '[^0-9]', '', 'g')),
                                    15
                                  )
                                )
                                = right(
                                  regexp_replace(coalesce(:digitsPhone, ''), '[^0-9]', '', 'g'),
                                  least(
                                    length(regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g')),
                                    length(regexp_replace(coalesce(:digitsPhone, ''), '[^0-9]', '', 'g')),
                                    15
                                  )
                                )
                          )
                    order by c.updated_at desc nulls last, c.created_at desc nulls last
                    limit 1
                    """,
            nativeQuery = true)
    Optional<Customer> findFirstMatchingPhoneInput(
            @Param("rawPhone") String rawPhone,
            @Param("digitsPhone") String digitsPhone);
}