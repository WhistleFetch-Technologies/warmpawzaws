package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.Pet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PetRepository extends JpaRepository<Pet, UUID> {

    List<Pet> findByCustomer_Id(UUID customerId);

    Page<Pet> findByCustomer_Id(UUID customerId, Pageable pageable);

    Optional<Pet> findByIdAndCustomer_Id(UUID id, UUID customerId);

    @Query("""
            select count(p) > 0 from Pet p
            where p.customer.id = :customerId
              and lower(trim(coalesce(p.name, ''))) = lower(trim(coalesce(:name, '')))
              and lower(trim(coalesce(p.species, ''))) = lower(trim(coalesce(:species, '')))
              and lower(trim(coalesce(p.breed, ''))) = lower(trim(coalesce(:breed, '')))
            """)
    boolean existsNormalizedDuplicate(
            @Param("customerId") UUID customerId,
            @Param("name") String name,
            @Param("species") String species,
            @Param("breed") String breed
    );
}