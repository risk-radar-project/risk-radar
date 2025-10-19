package risk_radar.map_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class MapServiceApplication {
	public static void main(String[] args) {
		SpringApplication.run(MapServiceApplication.class, args);
	}

}
