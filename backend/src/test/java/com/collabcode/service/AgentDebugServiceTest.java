package com.collabcode.service;

import com.collabcode.dto.AgentDebugRequest;
import com.collabcode.dto.AgentDebugResponse;
import com.collabcode.dto.ExecuteCodeResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AgentDebugServiceTest {

    private GeminiService gemini;
    private CodeExecutionService exec;
    private AgentDebugService service;

    @BeforeEach
    void setUp() {
        gemini = mock(GeminiService.class);
        exec = mock(CodeExecutionService.class);
        service = new AgentDebugService(gemini, exec);
    }

    private static AgentDebugRequest request(String code, String language, String hint) {
        AgentDebugRequest r = new AgentDebugRequest();
        r.setCode(code);
        r.setLanguage(language);
        r.setErrorContext(hint);
        return r;
    }

    private static ExecuteCodeResponse result(int statusId, String status, String compile) {
        return ExecuteCodeResponse.builder().statusId(statusId).status(status).compileOutput(compile).build();
    }

    @Test
    void fixesCompileErrorAndPassesTheCompilerMessageToGemini() {
        when(exec.execute(any()))
                .thenReturn(result(6, "Compilation Error", "error: expected ';' before 'return'"))
                .thenReturn(result(3, "Accepted", null));
        when(gemini.generate(anyString())).thenReturn("REASONING: Missing semicolon.\n```cpp\nint main(){ return 0; }\n```");

        AgentDebugResponse r = service.debug(request("int main(){ return 0 }", "cpp", null));

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getIterations()).isEqualTo(1);
        assertThat(r.getProposedFix()).isEqualTo("int main(){ return 0; }");
        assertThat(r.getReasoning()).isEqualTo("Missing semicolon.");
        verify(gemini).generate(argThat(p -> p.contains("expected ';' before 'return'")));
    }

    @Test
    void retriesWithTheNewErrorWhenTheFirstFixStillFails() {
        when(exec.execute(any()))
                .thenReturn(result(6, "Compilation Error", "first error"))
                .thenReturn(result(6, "Compilation Error", "second error"))
                .thenReturn(result(3, "Accepted", null));
        when(gemini.generate(anyString())).thenReturn("REASONING: x\n```cpp\nfix\n```");

        AgentDebugResponse r = service.debug(request("bad", "cpp", null));

        assertThat(r.isSuccess()).isTrue();
        assertThat(r.getIterations()).isEqualTo(2);
        verify(gemini).generate(argThat(p -> p.contains("second error") && p.contains("previous fix did not")));
    }

    @Test
    void doesNotCallGeminiForLanguagesThatCannotRun() {
        AgentDebugResponse r = service.debug(request("fun main() {}", "kotlin", null));
        assertThat(r.isSuccess()).isFalse();
        assertThat(r.getAgentError()).contains("kotlin");
        verifyNoInteractions(gemini, exec);
    }

    @Test
    void doesNotRewriteCodeThatAlreadyRunsWhenNoHintIsGiven() {
        when(exec.execute(any())).thenReturn(result(3, "Accepted", null));
        AgentDebugResponse r = service.debug(request("print(1)", "python", null));
        assertThat(r.getProposedFix()).isNull();
        assertThat(r.getReasoning()).contains("nothing to fix");
        verifyNoInteractions(gemini);
    }

    @Test
    void stillHelpsWithWorkingCodeWhenTheUserDescribesTheBug() {
        when(exec.execute(any())).thenReturn(result(3, "Accepted", null));
        when(gemini.generate(anyString())).thenReturn("REASONING: off by one\n```python\nprint(2)\n```");
        AgentDebugResponse r = service.debug(request("print(1)", "python", "should print 2"));
        assertThat(r.getProposedFix()).isEqualTo("print(2)");
        verify(gemini).generate(argThat(p -> p.contains("should print 2")));
    }

    @Test
    void executionInfrastructureFailureIsReportedNotSentToGemini() {
        when(exec.execute(any())).thenReturn(ExecuteCodeResponse.builder()
                .statusId(0).status("Timeout").stderr("The execution server did not respond in time.").build());
        AgentDebugResponse r = service.debug(request("x", "python", null));
        assertThat(r.getAgentError()).contains("did not respond");
        verifyNoInteractions(gemini);
    }
}
