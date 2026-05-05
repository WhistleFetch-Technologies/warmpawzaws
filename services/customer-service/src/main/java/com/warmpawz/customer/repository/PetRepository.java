package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.Pet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PetRepository extends JpaRepository<Pet, UUID> {

    List<Pet> findByCustomer_Id(UUID customerId);
}