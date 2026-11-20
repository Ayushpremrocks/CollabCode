package com.collabcode.service;

import com.collabcode.dto.ExecuteCodeRequest;
import com.collabcode.dto.ExecuteCodeResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** Uses real responses captured from https://wandbox.org/api/compile.json. */
class CodeExecutionServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();

    private ExecuteCodeResponse map(String json) throws Exception {
        return CodeExecutionService.map(mapper.readValue(json, CodeExecutionService.WandboxResponse.class));
    }

    @Test
    void compileErrorIsReportedWithTheCompilerMessage() throws Exception {
        // gcc-head: int main(){ return 0 }
        ExecuteCodeResponse r = map("""
                {"status":"1","signal":"","compiler_output":"","compiler_error":"prog.cc:1:21: error: expected ';' before '}' token\\n","compiler_message":"prog.cc:1:21: error: expected ';' before '}' token\\n","program_output":"","program_error":"","program_message":""}
                """);
        assertThat(r.getStatus()).isEqualTo("Compilation Error");
        assertThat(r.getStatusId()).isEqualTo(6);
        assertThat(r.getCompileOutput()).contains("expected ';'");
    }

    @Test
    void nonZeroExitWithOutputIsARuntimeError() throws Exception {
        ExecuteCodeResponse r = map("""
                {"status":"1","signal":"","compiler_output":"","compiler_error":"","program_output":"1\\n","program_error":"Traceback...\\nValueError: boom\\n"}
                """);
        assertThat(r.getStatus()).isEqualTo("Runtime Error");
        assertThat(r.getStatusId()).isEqualTo(11);
        assertThat(r.getStderr()).contains("ValueError");
        assertThat(r.getStdout()).isEqualTo("1\n");
        assertThat(r.getCompileOutput()).isNull();
    }

    @Test
    void warningsDoNotTurnASuccessIntoAnError() throws Exception {
        ExecuteCodeResponse r = map("""
                {"status":"0","signal":"","compiler_output":"","compiler_error":"prog.cc:2:2: warning: #warning hey\\n","program_output":"ok\\n","program_error":""}
                """);
        assertThat(r.getStatus()).isEqualTo("Accepted");
        assertThat(r.getStatusId()).isEqualTo(3);
        assertThat(r.getCompileOutput()).contains("warning");
        assertThat(r.getStdout()).isEqualTo("ok\n");
    }

    @Test
    void killedProgramIsATimeLimit() throws Exception {
        ExecuteCodeResponse r = map("""
                {"status":"137","signal":"","compiler_output":"","compiler_error":"","program_output":"","program_error":""}
                """);
        assertThat(r.getStatus()).isEqualTo("Time Limit Exceeded");
        assertThat(r.getStatusId()).isEqualTo(5);
    }

    @Test
    void unsupportedLanguageIsRejectedWithoutANetworkCall() {
        ExecuteCodeResponse r = new CodeExecutionService().execute(
                ExecuteCodeRequest.builder().code("fun main() {}").language("kotlin").build());
        assertThat(r.getStatusId()).isZero();
        assertThat(r.getStatus()).isEqualTo("Not Supported");
        assertThat(CodeExecutionService.isExecutable("kotlin")).isFalse();
        assertThat(CodeExecutionService.isExecutable("cpp")).isTrue();
    }
}
