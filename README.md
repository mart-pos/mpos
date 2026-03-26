# MPOS Core

MPOS Core is a local desktop bridge between MartPOS and printers connected to the user's machine.

It focuses on the part that web apps usually cannot solve reliably on their own:

- local printer discovery
- system queue and USB printer reconciliation
- receipt-oriented printing
- ESC/POS and raw printing
- local pairing and authenticated loopback API access

This repo currently contains the full desktop app built with Tauri, Rust, React, and TypeScript.

## Status

The project is functional but still evolving. The current focus is:

- reliable local receipt printing
- simple printer setup for non-technical users
- pairing with MartPOS
- reusable printer infrastructure that can later be extracted into a standalone Rust crate

## Features

- Discover printers from the operating system and USB devices
- Classify and reconcile printers into a unified model
- Select and persist a default printer
- Print test receipts, real receipts, and raw payloads
- Configure receipt printer overrides such as paper width and capabilities
- Expose a local authenticated HTTP API for MartPOS
- Reprint the latest real receipt received through the API

## Stack

- Tauri 2
- Rust
- React 19
- TypeScript
- Vite
- shadcn/ui

## Project Structure

- [`src-tauri/`](./src-tauri) desktop shell, local API, printer discovery, receipt formatting, and print pipeline
- [`src/`](./src) frontend for pairing, printer setup, and local admin UI
- [`docs/`](./docs) product and technical requirements

## Development

Requirements:

- Node.js
- pnpm
- Rust toolchain
- Tauri prerequisites for your operating system

Install dependencies:

```bash
pnpm install
```

Run the desktop app in development:

```bash
pnpm tauri dev
```

Build the frontend:

```bash
pnpm build
```

Check frontend types:

```bash
./node_modules/.bin/tsc --noEmit
```

Check Rust code:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## Notes

- The app is designed as a local bridge, not as a full POS.
- Pairing codes are short-lived, but the exchanged local token persists across app restarts.
- Receipt formatting uses a neutral `ReceiptDocument` model so the same payload shape can be reused by the API and local flows.

## Open Source Direction

The long-term direction is to extract the printer-specific infrastructure into a generic Rust module or crate, likely around an `mpos-printer` API, while keeping app-specific concerns such as pairing and UI in this repo.

## License

MIT
