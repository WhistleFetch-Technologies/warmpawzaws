package com.warmpawz.delivery.repository;

import com.warmpawz.delivery.entity.LogisticsPartner;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LogisticsPartnerRepository extends JpaRepository<LogisticsPartner, UUID> {

	Optional<LogisticsPartner> findFirstByPartnerTypeIgnoreCaseAndEnabledTrue(String partnerType);

	List<LogisticsPartner> findByPartnerTypeIgnoreCaseAndEnabledTrueOrderByPriorityAsc(String partnerType);

	Optional<LogisticsPartner> findByPartnerId(String partnerId);
}
