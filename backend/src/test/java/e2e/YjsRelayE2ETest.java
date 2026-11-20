package e2e;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.io.File;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cross-stack test: starts the real Java Yjs relay and runs the frontend's real
 * CollaborationProvider + Yjs against it (frontend/e2e/collab.e2e.test.ts).
 *
 * Opt-in because it needs Node.js and frontend node_modules:
 * <pre>mvn test -Dtest=YjsRelayE2ETest -De2e=true</pre>
 */
@SpringBootTest(classes = YjsRelayE2EServer.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"spring.main.allow-bean-definition-overriding=true", "logging.level.com.collabcode=INFO"})
@EnabledIfSystemProperty(named = "e2e", matches = "true")
class YjsRelayE2ETest {

    @LocalServerPort
    int port;

    @Test
    void frontendClientsConvergeThroughTheRealRelay() throws Exception {
        File frontend = new File("../frontend").getCanonicalFile();
        boolean windows = System.getProperty("os.name").toLowerCase().contains("win");
        List<String> command = windows
                ? List.of("cmd", "/c", "npx", "vitest", "run", "--config", "vitest.e2e.config.ts")
                : List.of("npx", "vitest", "run", "--config", "vitest.e2e.config.ts");

        File log = new File("target/e2e-vitest.log").getAbsoluteFile();
        ProcessBuilder pb = new ProcessBuilder(command).directory(frontend)
                .redirectErrorStream(true)
                .redirectOutput(log);
        pb.environment().put("E2E_BASE_URL", "http://localhost:" + port);
        pb.environment().put("NO_COLOR", "1");
        Process process = pb.start();
        boolean finished = process.waitFor(5, TimeUnit.MINUTES);
        if (!finished) process.destroyForcibly();

        String output = java.nio.file.Files.readString(log.toPath());
        System.out.println(output);
        assertThat(finished).as("vitest finished in time").isTrue();
        assertThat(process.exitValue()).as("vitest exit code (see target/e2e-vitest.log)").isZero();
        assertThat(output).as("e2e suite actually ran").doesNotContain("skipped").contains("passed");
    }
}
