export type ThemeMode = "light" | "dark" | "system";
export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";
export type PrinterStatus = "online" | "offline" | "unknown";
export type PrinterType = "thermal" | "inkjet" | "laser" | "label" | "unknown";
export type PaperWidth = "mm58" | "mm80" | "unknown";

export interface AppConfig {
  apiPort: number;
  locale: string;
  theme: ThemeMode;
  autoDefault: boolean;
  requestTimeoutMs: number;
  fallbackPolicy: string;
  logLevel: LogLevel;
  allowRawPrinting: boolean;
  allowedOrigin: string | null;
  defaultPrinterId: string | null;
}

export interface ApiServerConfig {
  host: string;
  port: number;
  baseUrl: string;
  versionPrefix: string;
  scannerActive: boolean;
}

export interface AuthState {
  strategy: string;
  tokenHeader: string;
  healthOpen: boolean;
  rateLimitPerMinute: number;
  tokenPreview: string;
}

export interface BridgeState {
  connected: boolean;
  pairedAt: string | null;
  lastSeenAt: string | null;
  lastOrigin: string | null;
}

export interface PairingState {
  active: boolean;
  code: string | null;
  expiresAt: string | null;
  allowedOrigin: string | null;
}

export interface LogRuntime {
  directory: string;
  rotationEnabled: boolean;
  debugPayloadCapture: boolean;
}

export interface StorageOverview {
  driver: string;
  configPath: string;
  cachePath: string;
  logs: LogRuntime;
}

export interface FormatterProfile {
  width58Columns: number;
  width80Columns: number;
  deterministicLayout: boolean;
}

export type DriverKind =
  | "esc_pos_usb"
  | "esc_pos_system"
  | "system_print"
  | "preview";

export interface PrintingOverview {
  formatter: FormatterProfile;
  supportedDrivers: DriverKind[];
  htmlPrintingEnabled: boolean;
}

export interface MatchReason {
  source: "usb" | "cups" | "spooler" | "unknown";
  confidence: number;
  reason: string;
}

export interface PrinterCapabilities {
  supportsCut: boolean;
  supportsCashDrawer: boolean;
  supportsQr: boolean;
  supportsBarcode: boolean;
  rawSupport: boolean;
  encoding: string;
}

export interface PrinterProfile {
  paperWidthMm: PaperWidth;
  charsPerLineNormal: number;
  charsPerLineCompressed: number;
  supportsCut: boolean;
  supportsCashDrawer: boolean;
  supportsQr: boolean;
  supportsBarcode: boolean;
  encoding: string;
  rawSupport: boolean;
  rawDevicePath: string | null;
}

export interface PrinterOverride {
  kind: PrinterType | null;
  receiptCapable: boolean | null;
  paperWidthMm: PaperWidth | null;
  charsPerLineNormal: number | null;
  charsPerLineCompressed: number | null;
  supportsCut: boolean | null;
  supportsCashDrawer: boolean | null;
  supportsQr: boolean | null;
  supportsBarcode: boolean | null;
  encoding: string | null;
  rawSupport: boolean | null;
  rawDevicePath: string | null;
}

export interface ResolvedPrinter {
  id: string;
  name: string;
  systemName: string | null;
  model: string | null;
  manufacturer: string | null;
  vendorId: string | null;
  productId: string | null;
  serialNumber: string | null;
  connectionType: string;
  systemBackend: string | null;
  systemQueue: string | null;
  isSystemPrinter: boolean;
  isUsbDevice: boolean;
  isDefault: boolean;
  type: PrinterType;
  receiptCapable: boolean;
  paperWidthMm: PaperWidth;
  status: PrinterStatus;
  driver: string;
  lastSeenAt: string;
  capabilities: PrinterCapabilities;
  profile: PrinterProfile;
  manualOverride: PrinterOverride;
  matchReasons: MatchReason[];
}

export interface BootstrapPayload {
  appName: string;
  appVersion: string;
  config: AppConfig;
  apiServer: ApiServerConfig;
  auth: AuthState;
  bridge: BridgeState;
  pairing: PairingState;
  storage: StorageOverview;
  printing: PrintingOverview;
  printers: ResolvedPrinter[];
}

export type RealtimeEventName =
  | "snapshot"
  | "printers.changed"
  | "printer.connected"
  | "printer.disconnected"
  | "bridge.connected"
  | "bridge.forgotten"
  | "bridge.pairing"
  | "config.updated";

export interface BridgeRealtimeEvent {
  event: RealtimeEventName;
  payload: BootstrapPayload;
}
