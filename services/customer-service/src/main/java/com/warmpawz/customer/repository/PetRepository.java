package com.warmpawz.customer.repository;

import com.warmpawz.customer.entity.Pet;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /**
     * Matches Lambda {@code DELETE /pets/:petId}: preserve booking rows, drop FK so delete can succeed.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE bookings SET pet_id = NULL, updated_at = NOW() WHERE pet_id = :petId", nativeQuery = true)
    int unlinkBookingsByPetId(@Param("petId") UUID petId);

    /**
     * Matches Lambda {@code DELETE /customer/:phone/pets/:petId} unlink scope (same customer only).
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            UPDATE bookings SET pet_id = NULL, updated_at = NOW()
            WHERE pet_id = :petId AND customer_id = :customerId
            """, nativeQuery = true)
    int unlinkBookingsByPetIdForCustomer(@Param("petId") UUID petId, @Param("customerId") UUID customerId);

    @Query(value = """
            SELECT COUNT(*) FROM bookings
            WHERE pet_id = :petId AND status IN ('confirmed', 'in_progress', 'scheduled')
            """, nativeQuery = true)
    long countActiveBookingsByPetId(@Param("petId") UUID petId);
}
