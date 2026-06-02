package com.warmpawz.delivery;

import com.warmpawz.delivery.config.PidgeProperties;
import com.warmpawz.delivery.config.MealDeliveryNotifyProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({ PidgeProperties.class, MealDeliveryNotifyProperties.class })
public class DeliveryServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(DeliveryServiceApplication.class, args);
	}
}
