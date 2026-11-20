package com.collabcode.service;

import com.collabcode.model.User;
import com.collabcode.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.security.SecureRandom;
import java.util.Optional;

/**
 * Auto-provisions a local User the first time a Clerk-authenticated user makes a
 * request (REST call, STOMP CONNECT or Yjs socket).
 *
 * <p>Display name priority: JWT {@code username} claim → email prefix → Clerk id prefix.
 * Clerk's default session token has neither claim; add them in
 * Clerk Dashboard → Sessions → Customize session token:
 * {@code {"username": "{{user.username}}", "email": "{{user.primary_email_address}}"}}.
 *
 * <p>Race-safe: on first login the browser fires a REST call, a STOMP CONNECT and a
 * Yjs connect at almost the same time. Creation runs in its own transaction and a
 * unique-constraint violation is resolved by re-reading the row another request created.
 */
@Service
public class UserProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(UserProvisioningService.class);
    private static final int MAX_USERNAME = 50;
    private static final int MAX_EMAIL = 100;

    private final UserRepository userRepository;
    private final TransactionTemplate newTransaction;
    private final SecureRandom random = new SecureRandom();

    public UserProvisioningService(UserRepository userRepository, PlatformTransactionManager txManager) {
        this.userRepository = userRepository;
        this.newTransaction = new TransactionTemplate(txManager);
        this.newTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public User getOrCreateUser(String clerkUserId, String username, String email) {
        if (clerkUserId == null || clerkUserId.isBlank()) {
            throw new IllegalArgumentException("Token has no subject");
        }
        Optional<User> existing = userRepository.findByClerkUserId(clerkUserId);
        if (existing.isPresent()) return existing.get();

        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                User created = newTransaction.execute(status -> createOrLink(clerkUserId, username, email));
                if (created != null) return created;
            } catch (DataIntegrityViolationException e) {
                // Another request created the user (or took the username) concurrently.
                Optional<User> raced = userRepository.findByClerkUserId(clerkUserId);
                if (raced.isPresent()) return raced.get();
                log.info("Username collision while provisioning {} — retrying", clerkUserId);
            }
        }
        return userRepository.findByClerkUserId(clerkUserId)
                .orElseThrow(() -> new IllegalStateException("Could not provision user"));
    }

    private User createOrLink(String clerkUserId, String username, String email) {
        Optional<User> again = userRepository.findByClerkUserId(clerkUserId);
        if (again.isPresent()) return again.get();

        // Link a legacy (pre-Clerk) account with the same verified email address.
        if (email != null && !email.isBlank()) {
            Optional<User> legacy = userRepository.findByEmail(email);
            if (legacy.isPresent() && legacy.get().getClerkUserId() == null) {
                User user = legacy.get();
                user.setClerkUserId(clerkUserId);
                log.info("Linked legacy user {} to Clerk id {}", user.getId(), clerkUserId);
                return userRepository.save(user);
            }
        }

        String displayName = uniqueUsername(resolveDisplayName(username, email, clerkUserId));
        String resolvedEmail = email != null && !email.isBlank() && !userRepository.existsByEmail(email)
                ? truncate(email, MAX_EMAIL)
                : truncate(clerkUserId + "@clerk.local", MAX_EMAIL);

        log.info("Provisioning local user for Clerk id {} (display: {})", clerkUserId, displayName);
        return userRepository.saveAndFlush(User.builder()
                .clerkUserId(clerkUserId)
                .username(displayName)
                .email(resolvedEmail)
                .build());
    }

    private String uniqueUsername(String base) {
        String candidate = truncate(base, MAX_USERNAME);
        while (userRepository.existsByUsername(candidate)) {
            String suffix = "_" + Integer.toString(random.nextInt(36 * 36 * 36 * 36), 36);
            candidate = truncate(base, MAX_USERNAME - suffix.length()) + suffix;
        }
        return candidate;
    }

    static String resolveDisplayName(String username, String email, String clerkUserId) {
        if (username != null && !username.isBlank()) return username.strip();
        if (email != null && email.contains("@")) {
            String prefix = email.substring(0, email.indexOf('@')).strip();
            if (!prefix.isEmpty()) return prefix;
        }
        return clerkUserId.length() > 12 ? clerkUserId.substring(0, 12) : clerkUserId;
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
