import { createContext, useContext, useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  stompClient: Client | null;
  connected: boolean;
  publish: (destination: string, body: unknown) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<Client | null>(null);
  const [connected, setConnected] = useState(false);
  const { isAuthenticated, getToken } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
        setConnected(false);
      }
      return;
    }

    // Clerk's getToken() is async — set up STOMP after we have a fresh token
    const setupStomp = async () => {
      const token = await getToken();
      if (!token) {
        console.warn('[STOMP] No Clerk session token — skipping STOMP connection');
        return;
      }

      const client = new Client({
        brokerURL: 'ws://localhost:8080/ws/stomp',
        connectHeaders: {
          Authorization: `Bearer ${token}`,
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          console.log('[STOMP] Connected');
          setConnected(true);
        },
        onDisconnect: () => {
          console.log('[STOMP] Disconnected');
          setConnected(false);
        },
        onStompError: (frame) => {
          console.error('[STOMP] Error:', frame.headers.message);
        },
      });

      client.activate();
      clientRef.current = client;
    };

    setupStomp();

    return () => {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
        setConnected(false);
      }
    };
  }, [isAuthenticated, getToken]);

  const publish = useCallback((destination: string, body: unknown) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({
        destination,
        body: JSON.stringify(body),
      });
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ stompClient: clientRef.current, connected, publish }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
