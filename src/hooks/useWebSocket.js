// src/hooks/useWebSocket.js
import { useEffect } from "react";

/**
 * WebSocket connection for live reload
 */
export function useWebSocket(loadFiles) {
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    let ws;

    function connect() {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[WebSocket] Connected for live reload');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'reload') {
            console.log('[WebSocket] Reload triggered');
            loadFiles();
          }
        } catch (err) {
          console.error('[WebSocket] Message parse error:', err);
        }
      };
      
      ws.onclose = () => {
        console.log('[WebSocket] Disconnected, reconnecting...');
        setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
      };
    }
    
    connect();
    
    return () => {
      if (ws) ws.close();
    };
  }, [loadFiles]);
}
