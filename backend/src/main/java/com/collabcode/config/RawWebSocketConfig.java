package com.collabcode.config;

import com.collabcode.websocket.YjsWebSocketHandler;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class RawWebSocketConfig implements WebSocketConfigurer {

    private static final Logger log = LoggerFactory.getLogger(RawWebSocketConfig.class);

    private final YjsWebSocketHandler yjsWebSocketHandler;

    public RawWebSocketConfig(YjsWebSocketHandler yjsWebSocketHandler) {
        log.info("[RawWebSocketConfig] Constructor called — registering Yjs WebSocket handler.");
        this.yjsWebSocketHandler = yjsWebSocketHandler;
        log.info("[RawWebSocketConfig] Constructor completed.");
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        log.info("[RawWebSocketConfig] registerWebSocketHandlers() called.");
        registry.addHandler(yjsWebSocketHandler, "/ws/yjs/*")
                .setAllowedOriginPatterns("*");
        log.info("[RawWebSocketConfig] /ws/yjs/* handler registered.");
    }
}
