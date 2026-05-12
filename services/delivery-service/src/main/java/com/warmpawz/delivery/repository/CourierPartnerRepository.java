package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.CourierPartner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CourierPartnerRepository extends JpaRepository<CourierPartner, java.util.UUID> {

	Optional<CourierPartner> findByPartnerId(String partnerId);
}
