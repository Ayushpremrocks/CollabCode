package com.collabcode.controller;

import com.collabcode.model.User;
import com.collabcode.service.UserProvisioningService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class UserController {

    private final UserProvisioningService userProvisioningService;

    public UserController(UserProvisioningService userProvisioningService) {
        this.userProvisioningService = userProvisioningService;
    }

    /**
     * The backend's view of the signed-in user. The frontend uses this username to
     * recognise its own chat messages / presence entry, so both sides agree even when
     * the Clerk session token carries no username/email claims.
     */
    @GetMapping("/api/users/me")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        User user = userProvisioningService.getOrCreateUser(jwt.getSubject(),
                jwt.getClaimAsString("username"), jwt.getClaimAsString("email"));
        return Map.of(
                "id", user.getId(),
                "username", user.getUsername(),
                "clerkUserId", user.getClerkUserId());
    }

    /** Public, cheap endpoint the frontend calls on page load to wake the Render instance. */
    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
