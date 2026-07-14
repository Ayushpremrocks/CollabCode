package com.collabcode.service;

import com.collabcode.model.User;
import com.collabcode.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Auto-provisions a local User record the first time a Clerk-authenticated user
 * makes a request (WebSocket connection or REST call).
 *
 * Clerk does not store users in our database — this service bridges the gap by
 * creating a lightweight local User record keyed on the Clerk user ID (sub claim).
 *
 * Requirements for Clerk JWT Template (configure in Clerk dashboard):
 *   { "username": "{{user.username}}", "email": "{{user.primary_email_address}}" }
 * Frontend must call: getToken({ template: 'collabcode' })
 */
@Service
public class UserProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(UserProvisioningService.class);

    private final UserRepository userRepository;

    public UserProvisioningService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Gets the local User for a Clerk user ID, or creates one if it does not exist.
     *
     * @param clerkUserId The Clerk user ID from the JWT {@code sub} claim (e.g. {@code user_2abc...})
     * @param username    Display name from the JWT {@code username} claim (may be null)
     * @param email       Email from the JWT {@code email} claim (may be null)
     * @return The existing or newly created local User
     */
    @Transactional
    public User getOrCreateUser(String clerkUserId, String username, String email) {
        return userRepository.findByClerkUserId(clerkUserId)
                .orElseGet(() -> {
                    String displayName = resolveDisplayName(username, email, clerkUserId);
                    String resolvedEmail = email != null ? email : clerkUserId + "@clerk.local";

                    log.info("Auto-provisioning new local user for Clerk ID: {} (display: {})",
                            clerkUserId, displayName);

                    User newUser = User.builder()
                            .clerkUserId(clerkUserId)
                            .username(displayName)
                            .email(resolvedEmail)
                            // passwordHash intentionally null — Clerk owns the credentials
                            .build();

                    return userRepository.save(newUser);
                });
    }

    /**
     * Derives a display name in priority order: username claim → email prefix → Clerk ID prefix.
     */
    private String resolveDisplayName(String username, String email, String clerkUserId) {
        if (username != null && !username.isBlank()) {
            return username;
        }
        if (email != null && !email.isBlank()) {
            return email.split("@")[0]; // e.g. "alice" from "alice@example.com"
        }
        // Last resort: first 12 chars of Clerk ID (e.g. "user_2abc123")
        return clerkUserId.length() > 12 ? clerkUserId.substring(0, 12) : clerkUserId;
    }
}
