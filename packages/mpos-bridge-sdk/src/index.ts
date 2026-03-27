export type RealtimeEventName =
  | "snapshot"
  | "printers.changed"
  | "printer.connected"
  | "printer.disconnected"
  | "bridge.connected"
  | "bridge.forgotten"
  | "bridge.pairing"
  | "config.updated";

export interface BridgeRealtimeEvent<TPayload = unknown> {
  event: RealtimeEventName;
  payload: TPayload;
}

export interface BridgeSocketHandlers<TPayload> {
  onEvent: (event: BridgeRealtimeEvent<TPayload>) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
}

export function createBridgeHeaders(
  token: string,
  tokenHeader = "x-mpos-core-token",
) {
  return {
    [tokenHeader]: token,
  };
}

export function createBridgeEndpoint(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/")
    ? baseUrl.slice(0, -1)
    : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

export function createBridgeEventsUrl(baseUrl: string, token: string) {
  const socketBase = baseUrl
    .replace("http://", "ws://")
    .replace("https://", "wss://");

  return createBridgeEndpoint(
    socketBase,
    `/api/v1/events?token=${encodeURIComponent(token)}`,
  );
}

export function connectBridgeEvents<TPayload = unknown>(
  url: string,
  handlers: BridgeSocketHandlers<TPayload>,
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
      const payload = JSON.parse(message.data) as BridgeRealtimeEvent<TPayload>;
      handlers.onEvent(payload);
    } catch {
      // Ignore malformed payloads from incompatible bridge versions.
    }
  };

  return socket;
}

export function disconnectBridgeEvents(socket: WebSocket | null | undefined) {
  socket?.close();
}

export function applyBridgeRealtimePayload<TPayload>(payload: TPayload) {
  return payload;
}
