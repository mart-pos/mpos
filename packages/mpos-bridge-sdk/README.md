# `@mpos/bridge-sdk`

Helpers to connect a web app such as MartPOS to MPOS Core.

## What it includes

- HTTP header helper for the local token
- endpoint builder for local bridge routes
- WebSocket URL builder
- WebSocket connection helper for realtime bridge events

## Install from a local path

```bash
pnpm add ../mpos/packages/mpos-bridge-sdk
```

## Example

```ts
import {
  connectBridgeEvents,
  createBridgeEventsUrl,
  createBridgeHeaders,
} from "@mpos/bridge-sdk";

const token = bridge.token;
const baseUrl = bridge.baseUrl;

const headers = createBridgeHeaders(token);
const socketUrl = createBridgeEventsUrl(baseUrl, token);

const socket = connectBridgeEvents(socketUrl, {
  onEvent: (event) => {
    console.log(event.event, event.payload);
  },
});
```
