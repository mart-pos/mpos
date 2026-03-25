# MPOS Core Requirements

## 1. Overview

MPOS Core is a local desktop application built with Tauri 2 + Rust and an embedded modern web frontend. Its purpose is to act as a secure local bridge between `martpos.app` and the printers connected to the user's computer, with special focus on 58 mm and 80 mm receipt printers.

The application must not depend on high-level printing libraries to solve printer discovery, classification, reconciliation, or receipt delivery. Those responsibilities must be implemented explicitly in the application's own modules. It is acceptable to use ecosystem libraries for runtime, USB access, HTTP serving, async execution, serialization, persistence, and UI foundations.

## 2. Product Goals

1. Detect printers physically connected over USB.
2. Detect printers installed or visible to the operating system.
3. Reconcile both discovery sources into a unified printer model.
4. Expose a secure local HTTP API for `martpos.app`.
5. Persist and manage a required default printer.
6. Support deterministic receipt printing for 58 mm and 80 mm paper.
7. Provide a minimal administrative UI for discovery, default selection, correction, and test printing.

## 3. Scope

### 3.1 In Scope

- Local desktop application using Tauri 2 + Rust.
- Embedded frontend using React + Tailwind + shadcn/ui.
- Dark mode and i18n support.
- Platform-specific discovery backends for macOS, Windows, and Linux.
- USB discovery and system printer discovery.
- Local HTTP API bound only to loopback.
- Token-based or equivalent local authentication.
- Receipt-oriented print pipeline based on a neutral document format.
- Manual correction of printer type, paper width, and profile details.

### 3.2 Out of Scope

- Cloud printing.
- Direct printing from arbitrary HTML.
- Arbitrary file printing through the API.
- Executing operating system commands through the API.
- Guaranteeing perfect automatic identification of printer type or paper width from device metadata alone.

## 4. Core Functional Requirements

### 4.1 USB Device Discovery

The app must detect printers and printer-like devices connected physically over USB and retrieve, when available:

- `vendor_id`
- `product_id`
- `manufacturer`
- `product_string`
- `serial_number`
- friendly name
- inferred model
- connection type
- last seen timestamp

USB discovery must not assume every USB device exposed by the OS is printable. Devices should be filtered and scored as printer candidates.

### 4.2 System Printer Discovery

The app must detect printers registered in the operating system and retrieve, when available:

- system display name
- queue name
- backend/spooler type
- online/offline or equivalent status
- whether the OS marks it as default
- driver information
- URI or port metadata when accessible
- useful capabilities exposed by the platform

### 4.3 Reconciliation

The app must reconcile USB hardware records with system printer records into a unified `ResolvedPrinter`.

Reconciliation should use a weighted heuristic pipeline that may include:

- exact or fuzzy model match
- manufacturer match
- queue name similarity
- driver name similarity
- URI or port metadata
- hardware identifiers
- USB serial and descriptive strings

Reconciliation is not mandatory for operability. If no exact match is found, the app must still keep the best available resolved record and allow printing through the best supported route.

### 4.4 Printer Classification

Each resolved printer must expose a logical type:

- `thermal`
- `inkjet`
- `laser`
- `label`
- `unknown`

Each printer must also expose `receipt_capable` independently from type classification.

Classification must not rely exclusively on VID/PID. It must use an inference pipeline based on:

- known model matches
- manufacturer hints
- print-system metadata
- name, driver, and URI heuristics
- manual correction from the UI

### 4.5 Paper Width and Profile

Each printer must persist paper width as:

- `58`
- `80`
- `unknown`

If width cannot be inferred confidently, the app must keep `unknown` and allow user correction. A configurable policy may optionally apply a default width, but the unresolved state must still be supported.

Every printer may also store a `PrinterProfile` with fields such as:

- `paper_width_mm`
- `chars_per_line_normal`
- `chars_per_line_compressed`
- `supports_cut`
- `supports_cash_drawer`
- `supports_qr`
- `supports_barcode`
- `encoding`
- `raw_support`

### 4.6 Default Printer Rules

The application must maintain a required default printer with this exact policy:

1. If a persisted default printer exists and is still available, use it.
2. If it does not exist or is no longer available, autoselect:
   - first online thermal printer
   - otherwise first online `receipt_capable` printer
   - otherwise first online printer
3. If no printers are available, the system has no default printer and printing returns a controlled error.
4. If a new printer appears and there is no valid default, assign one automatically.
5. If a valid default already exists, do not replace it automatically.

### 4.7 Printing

The app must support:

- test ticket printing
- receipt printing from `martpos.app`
- optional raw printing behind a feature flag

The print engine must not accept HTML as its core format. It must receive a structured, neutral `ReceiptDocument`, transform it into a printer-specific representation, and send it using the selected driver.

## 5. Local HTTP API

The app must expose an HTTP server that listens only on `127.0.0.1` using a fixed but configurable port, for example `127.0.0.1:45123`.

It must not bind to `0.0.0.0`.

The API must be versioned under `/api/v1`.

### 5.1 Authentication

The API must require local authentication using one of:

- a persisted local token validated by header
- a secure initial handshake with ephemeral secret material

Requests without authentication must be rejected, except `GET /api/v1/health` if explicitly kept open for local diagnostics.

Because local exposure still has security risk, the API must run as a dedicated application server and not as an unsafe resource exposure shortcut.

### 5.2 Required Endpoints

- `GET /api/v1/health`
- `GET /api/v1/printers`
- `GET /api/v1/printers/default`
- `POST /api/v1/printers/default`
- `POST /api/v1/printers/refresh`
- `POST /api/v1/print/test`
- `POST /api/v1/print/receipt`
- `GET /api/v1/config`
- `PATCH /api/v1/config`

### 5.3 Optional Endpoint

- `POST /api/v1/print/raw`

This endpoint must be disabled by default and only enabled behind an explicit feature flag or debug configuration.

### 5.4 Health Response

`GET /api/v1/health` should return, at minimum:

- service status
- application version
- operating system
- active port
- whether printer scanning is active

### 5.5 Printers Response Shape

`GET /api/v1/printers` should return records similar to:

```json
[
  {
    "id": "printer_01",
    "name": "EPSON TM-T20III",
    "system_name": "EPSON TM-T20III",
    "model": "TM-T20III",
    "manufacturer": "EPSON",
    "vendor_id": "04b8",
    "product_id": "0e15",
    "serial_number": "ABCD1234",
    "connection_type": "usb",
    "system_backend": "cups",
    "system_queue": "EPSON_TM_T20III",
    "is_system_printer": true,
    "is_usb_device": true,
    "is_default": true,
    "type": "thermal",
    "receipt_capable": true,
    "paper_width_mm": 80,
    "status": "online",
    "driver": "raw",
    "last_seen_at": "2026-03-25T19:10:00Z"
  }
]
```

## 6. Receipt Document Contract

The core print engine must accept a structured document instead of HTML. Example:

```json
{
  "printer_id": "optional",
  "document": {
    "type": "receipt",
    "paper_width_mm": 80,
    "content": [
      { "type": "text", "value": "MartPOS", "align": "center", "bold": true },
      { "type": "text", "value": "Venta #1001", "align": "left" },
      { "type": "divider" },
      {
        "type": "item",
        "name": "Coca Cola 1.5L",
        "qty": 2,
        "unit_price": 4500,
        "total": 9000
      },
      { "type": "divider" },
      { "type": "totals", "subtotal": 9000, "tax": 0, "grand_total": 9000 },
      { "type": "qr", "value": "https://martpos.app/receipt/1001" },
      { "type": "cut" }
    ]
  }
}
```

This separation is mandatory:

1. logical receipt document
2. formatter/layout stage
3. transport/driver stage

## 7. Printing Architecture

The printing module must be owned by MPOS Core and include at least:

- `EscPosUsbDriver`
- `EscPosSystemDriver`
- `SystemPrintDriver`
- `PreviewDriver`
- `DriverResolver`
- receipt formatter/layout engine

### 7.1 Driver Selection

The `DriverResolver` must choose the route based on:

- resolved printer metadata
- availability of a raw USB path
- system queue availability
- printer type and profile
- requested operation

### 7.2 Deterministic Layout

The layout engine must be deterministic and profile-driven. It must not guess by trial printing.

Baseline targets:

- 58 mm: approximately 32 characters per line in normal mode
- 80 mm: approximately 42 to 48 characters per line depending on model/profile

These values must come from the printer profile and remain user-editable.

## 8. UI Requirements

The UI must remain intentionally simple and operationally focused.

### 8.1 Main Screen

The main screen must show:

- detected printers list
- online/offline status badge
- printer type
- paper width
- detection origin
- default marker
- quick actions

Supported actions:

- refresh discovery
- set as default
- print test ticket
- open advanced edit

### 8.2 Settings Screen

The configuration screen must allow editing:

- HTTP port
- language
- light/dark theme
- auto-default policy
- log level
- timeout and fallback policy

### 8.3 Advanced Printer Screen

Per-printer advanced settings must allow manual correction of:

- printer type
- paper width
- chars per line
- encoding
- cut support
- cash drawer support
- QR support

## 9. Platform Discovery Architecture

The application must implement platform-specific discovery backends.

Recommended module structure:

```text
mpos-core/
  src/
    app/
    api/
    config/
    discovery/
      common/
      macos/
      windows/
      linux/
    printing/
      common/
      escpos/
      spooler/
      formatter/
    domain/
    storage/
    security/
    logs/
  src-tauri/
  ui/
```

### 9.1 macOS

The macOS backend must query two sources:

- USB device tree and device properties
- CUPS/IPP system printers and destination attributes

It must retrieve printer destinations, default printer, and useful IPP/CUPS attributes where available. Thermal detection must be inferred from metadata and heuristics, not from a magical API.

### 9.2 Windows

The Windows backend must query two sources:

- printer enumeration from the Windows spooler
- USB hardware enumeration from a separate hardware path

The system printer side must use Windows printer APIs such as `EnumPrinters` and default-printer APIs such as `SetDefaultPrinter` where required. Hardware and spooler data must then be reconciled by name, port, driver, hardware ID, or equivalent signals.

### 9.3 Linux

The Linux backend must query:

- USB devices
- CUPS/IPP system printers

It must reconcile these similarly to macOS.

## 10. Domain Model

Minimum domain entities:

- `PrinterDevice`
- `SystemPrinter`
- `ResolvedPrinter`
- `PrinterCapabilities`
- `PrinterProfile`
- `PrintJob`
- `ReceiptDocument`
- `AppConfig`

## 11. Persistence

The application must persist its local state using a robust local mechanism such as:

- JSON files, or
- SQLite

Persistent state must include at least:

- app configuration
- local auth token or handshake material
- default printer ID
- manual overrides and printer profiles
- cached discovery records when useful

## 12. Security Requirements

Security is mandatory because the app exposes a local bridge.

The app must:

- listen only on loopback
- require authenticated access
- validate `Origin` and/or a proprietary token
- apply basic rate limiting
- sanitize payloads
- reject arbitrary filesystem paths
- reject arbitrary OS command execution
- keep raw printing behind explicit enablement
- version the API

## 13. Non-Functional Requirements

- Startup under 3 seconds in normal conditions.
- Initial discovery must not block the UI.
- Discovery must run asynchronously and publish progressive results.
- Hot refresh and reconnection must work without app restart.
- Logs must be stored locally with basic rotation.
- Debug mode must support inspection of discovery and print payloads.
- Explicit error handling is required for:
  - printer disconnected
  - printer offline
  - missing default printer
  - timeout
  - invalid payload
  - invalid authentication
  - unsupported driver

## 14. Integration Contract with MartPOS

`martpos.app` must use MPOS Core only through the local API.

Integration rules:

- `martpos.app` detects bridge presence via `GET /api/v1/health`
- if unavailable, the web app shows `Bridge no disponible`
- if available, the web app can list printers, request default changes, refresh discovery, and submit receipts
- the web app must not implement low-level printing logic
- the web app may suggest a printer, but persistent default state belongs to MPOS Core

## 15. Quality Expectations and Explicit Limitations

The specification must state realistic detection guarantees:

- The app should identify installed system printers reliably.
- The app should identify manufacturer and model probabilistically when USB or system metadata exists.
- The app should classify `thermal` versus `unknown` using heuristics and manual correction support.
- The app does not guarantee perfect automatic detection of paper width or thermal capability from VID/PID alone.
- Detection quality depends on the operating system, driver quality, spooler metadata, and device behavior.

These are ecosystem limitations, not necessarily implementation defects.

## 16. Acceptance Criteria

The implementation is acceptable when all of the following are true:

1. The app starts locally and shows a working printer administration UI.
2. The app discovers USB devices and system printers on supported platforms using dedicated backend code.
3. The app returns a unified printer list through `GET /api/v1/printers`.
4. The app persists and enforces default printer rules exactly as specified.
5. The app prints a test receipt using the selected default or a requested printer.
6. The app accepts structured receipt payloads from `martpos.app`.
7. The API is reachable only through `127.0.0.1` and rejects unauthenticated requests.
8. Manual override of type and paper width is available in the UI.
9. Discovery refresh works without restarting the application.
10. Failure modes are explicit and controlled rather than silent.
