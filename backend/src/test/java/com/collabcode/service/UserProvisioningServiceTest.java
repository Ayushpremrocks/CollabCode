package com.collabcode.service;

import com.collabcode.model.User;
import com.collabcode.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class UserProvisioningServiceTest {

    private UserRepository users;
    private UserProvisioningService service;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        PlatformTransactionManager tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new UserProvisioningService(users, tx);
    }

    @Test
    void returnsExistingUserWithoutWriting() {
        User existing = User.builder().id(1L).clerkUserId("user_a").username("a").build();
        when(users.findByClerkUserId("user_a")).thenReturn(Optional.of(existing));
        assertThat(service.getOrCreateUser("user_a", null, null)).isSameAs(existing);
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void concurrentFirstLoginResolvesToTheRowTheOtherRequestCreated() {
        User created = User.builder().id(7L).clerkUserId("user_new").username("new").build();
        when(users.findByClerkUserId("user_new"))
                .thenReturn(Optional.empty())   // first lookup
                .thenReturn(Optional.empty())   // inside the creating transaction
                .thenReturn(Optional.of(created)); // after the unique-constraint violation
        when(users.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThat(service.getOrCreateUser("user_new", null, null)).isSameAs(created);
    }

    @Test
    void displayNameFallsBackFromUsernameToEmailToClerkId() {
        assertThat(UserProvisioningService.resolveDisplayName("neo", "a@b.c", "user_123")).isEqualTo("neo");
        assertThat(UserProvisioningService.resolveDisplayName(null, "trinity@zion.io", "user_123")).isEqualTo("trinity");
        assertThat(UserProvisioningService.resolveDisplayName(" ", null, "user_2abcdefghijk")).isEqualTo("user_2abcdef");
    }

    @Test
    void takenUsernamesGetAUniqueSuffix() {
        when(users.findByClerkUserId("user_b")).thenReturn(Optional.empty());
        when(users.existsByUsername("bob")).thenReturn(true);
        when(users.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        User u = service.getOrCreateUser("user_b", "bob", null);
        assertThat(u.getUsername()).startsWith("bob_").isNotEqualTo("bob");
        assertThat(u.getEmail()).isEqualTo("user_b@clerk.local");
    }
}
