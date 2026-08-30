package com.collabcode.config;

import com.collabcode.websocket.StompAuthChannelInterceptor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class StompWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(StompWebSocketConfig.class);

    private final StompAuthChannelInterceptor stompAuthChannelInterceptor;

    public StompWebSocketConfig(StompAuthChannelInterceptor stompAuthChannelInterceptor) {
        log.info("[StompWebSocketConfig] Constructor called.");
        this.stompAuthChannelInterceptor = stompAuthChannelInterceptor;
        log.info("[StompWebSocketConfig] Constructor completed.");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        log.info("[StompWebSocketConfig] configureMessageBroker() called.");
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
        log.info("[StompWebSocketConfig] Message broker configured.");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        log.info("[StompWebSocketConfig] registerStompEndpoints() called.");
        registry.addEndpoint("/ws/stomp")
                .setAllowedOriginPatterns("*");
        log.info("[StompWebSocketConfig] /ws/stomp endpoint registered.");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        log.info("[StompWebSocketConfig] configureClientInboundChannel() — registering StompAuthChannelInterceptor.");
        registration.interceptors(stompAuthChannelInterceptor);
        log.info("[StompWebSocketConfig] StompAuthChannelInterceptor registered.");
    }
}
