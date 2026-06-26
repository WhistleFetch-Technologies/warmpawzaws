package com.warmpawz.delivery;

import com.warmpawz.delivery.config.PidgeProperties;
import com.warmpawz.delivery.config.MealDeliveryNotifyProperties;
import com.warmpawz.delivery.config.PidgeRiderLocationPollProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties({
		PidgeProperties.class,
		MealDeliveryNotifyProperties.class,
		PidgeRiderLocationPollProperties.class
})
public class DeliveryServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(DeliveryServiceApplication.class, args);
	}
}
