package com.collabcode;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CollabCodeApplication {

    public static void main(String[] args) {
        SpringApplication.run(CollabCodeApplication.class, args);
    }
}
