import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  stompClient: Client | null;
  connected: boolean;
  publish: (destination: string, body: unknown) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);
const STOMP_URL = `${import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8080'}/ws/stomp`;

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, getToken } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [connected, setConnected] = useState(false);

  // Read the latest getter at connect time without reconnecting when it changes.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const stomp = new Client({
      brokerURL: STOMP_URL,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // Runs before EVERY connect, including automatic reconnects. Clerk tokens
      // expire after ~60 s, so reusing the first token made every reconnect fail.
      beforeConnect: async (c) => {
        const token = await getTokenRef.current({ fresh: true }).catch(() => null);
        c.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) => console.error('[STOMP] Error:', frame.headers.message),
    });
    stomp.activate();
    // Publishing the client is a subscription to an external system.
    queueMicrotask(() => setClient(stomp));

    return () => {
      void stomp.deactivate();
      setClient((current) => (current === stomp ? null : current));
      setConnected(false);
    };
  }, [isAuthenticated]);

  const publish = useCallback((destination: string, body: unknown) => {
    if (client?.connected) client.publish({ destination, body: JSON.stringify(body) });
  }, [client]);

  const value = useMemo(() => ({
    stompClient: isAuthenticated ? client : null,
    connected: isAuthenticated && connected,
    publish,
  }), [client, connected, isAuthenticated, publish]);

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('useWebSocket must be used within a WebSocketProvider');
  return context;
}
