import type { BootstrapPayload, BridgeRealtimeEvent } from "@/types/bootstrap";

export function createBridgeEventsUrl(baseUrl: string, token: string) {
  const socketBase = baseUrl
    .replace("http://", "ws://")
    .replace("https://", "wss://");

  return `${socketBase}/api/v1/events?token=${encodeURIComponent(token)}`;
}

export function connectBridgeEvents(
  url: string,
  handlers: {
    onEvent: (event: BridgeRealtimeEvent) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: () => void;
  },
) {
  const socket = new WebSocket(url);

  socket.onopen = () => {
    handlers.onOpen?.();
  };

  socket.onclose = () => {
    handlers.onClose?.();
  };

  socket.onerror = () => {
    handlers.onError?.();
  };

  socket.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data) as BridgeRealtimeEvent;
      handlers.onEvent(payload);
    } catch {
      // Ignore malformed payloads from incompatible bridge versions.
    }
  };

  return socket;
}

export function applyBridgeRealtimePayload(payload: BootstrapPayload) {
  return payload;
}
