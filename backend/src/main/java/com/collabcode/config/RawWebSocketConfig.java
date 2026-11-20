package com.collabcode.config;

import com.collabcode.websocket.YjsWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class RawWebSocketConfig implements WebSocketConfigurer {

    /** Largest single Yjs frame accepted (full-document snapshots). Tomcat's default is only 8 KB. */
    static final int MAX_BINARY_MESSAGE_BYTES = 8 * 1024 * 1024;

    private final YjsWebSocketHandler yjsWebSocketHandler;
    private final String[] allowedOrigins;

    public RawWebSocketConfig(YjsWebSocketHandler yjsWebSocketHandler,
                              @Value("${app.cors.allowed-origins}") String allowedOrigins) {
        this.yjsWebSocketHandler = yjsWebSocketHandler;
        this.allowedOrigins = SecurityConfig.parseOrigins(allowedOrigins);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(yjsWebSocketHandler, "/ws/yjs/*")
                .setAllowedOriginPatterns(allowedOrigins);
    }

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxBinaryMessageBufferSize(MAX_BINARY_MESSAGE_BYTES);
        container.setMaxTextMessageBufferSize(512 * 1024);
        container.setMaxSessionIdleTimeout(10 * 60 * 1000L);
        return container;
    }
}
