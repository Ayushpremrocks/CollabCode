package com.collabcode.repository;

import com.collabcode.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    /**
     * Looks up a user by their Clerk user ID (the {@code sub} claim in Clerk JWTs).
     * Used by UserProvisioningService, YjsWebSocketHandler, and StompAuthChannelInterceptor.
     */
    Optional<User> findByClerkUserId(String clerkUserId);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByClerkUserId(String clerkUserId);
}
