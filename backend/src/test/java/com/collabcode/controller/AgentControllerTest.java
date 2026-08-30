package com.collabcode.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AgentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    public void testAgentTestEndpoint() throws Exception {
        String requestBody = "{\"prompt\":\"Explain in one sentence what a null pointer exception is.\"}";

        MvcResult result = mockMvc.perform(post("/api/agent/test")
                        .with(jwt().jwt(builder -> builder.subject("test-user-id")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.response").isNotEmpty())
                .andReturn();

        System.out.println("==================================================");
        System.out.println("[AgentControllerTest] Status Code: " + result.getResponse().getStatus());
        System.out.println("[AgentControllerTest] Response: " + result.getResponse().getContentAsString());
        System.out.println("==================================================");
    }

    @Test
    public void testDebugEndpointWithBrokenCpp() throws Exception {
        String brokenCpp = "#include <iostream>\\n\\nint main() {\\n    std::cout << \\\"Hello, World!\\\" << std::endl\\n    return 0;\\n}";
        String requestBody = "{\"code\":\"" + brokenCpp + "\",\"language\":\"cpp\",\"errorContext\":\"Fix compiler error\"}";

        System.out.println("[AgentControllerTest] Testing Phase 2 Agentic Debugger with broken C++ code...");
        MvcResult result = mockMvc.perform(post("/api/agent/debug")
                        .with(jwt().jwt(builder -> builder.subject("test-user-id")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.proposedFix").isNotEmpty())
                .andReturn();

        System.out.println("==================================================");
        System.out.println("[AgentControllerTest] Phase 2 Debug Result:");
        System.out.println(result.getResponse().getContentAsString());
        System.out.println("==================================================");
    }
}
