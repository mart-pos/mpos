use std::{
    collections::HashMap,
    sync::{Arc, Mutex, RwLock},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager};
use tokio::sync::broadcast;

use crate::{
    api::server::ApiServerConfig,
    config::model::{AppConfig, LogLevel, ThemeMode},
    discovery::service::DiscoveryService,
    domain::printer::{
        PaperWidthMm, PrinterKind, PrinterOverride, PrinterProfile, ResolvedPrinter,
        ResolvedPrinterStatus,
    },
    domain::receipt::ReceiptDocument,
    logs::service::{append_print_log, PrintLogEntry},
    printing::{
        common::PrintMode,
        service::{build_test_receipt, dispatch_print_job, dispatch_raw_job, PrintResult, PrintingOverview},
    },
    security::auth::{generate_pairing_code, AuthRecord, AuthState},
    storage::repository::{PersistedBridgeState, PersistedState, StorageOverview, StorageRepository},
};

pub type SharedAppState = Arc<AppState>;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPayload {
    pub app_name: String,
    pub app_version: String,
    pub config: AppConfig,
    pub api_server: ApiServerConfig,
    pub auth: AuthState,
    pub bridge: BridgeSnapshot,
    pub pairing: PairingSnapshot,
    pub storage: StorageOverview,
    pub printing: PrintingOverview,
    pub printers: Vec<ResolvedPrinter>,
}

struct RuntimeState {
    config: AppConfig,
    auth: AuthRecord,
    api_server: ApiServerConfig,
    printers: Vec<ResolvedPrinter>,
    printer_overrides: HashMap<String, PrinterOverride>,
    last_receipt: Option<ReceiptDocument>,
    bridge: BridgeState,
    scanner_active: bool,
    last_refresh_error: Option<String>,
    pairing: PairingState,
}

#[derive(Clone, Default)]
struct BridgeState {
    paired_at_unix: Option<u64>,
    last_seen_at_unix: Option<u64>,
    last_origin: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeSnapshot {
    pub connected: bool,
    pub paired_at: Option<String>,
    pub last_seen_at: Option<String>,
    pub last_origin: Option<String>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingSnapshot {
    pub active: bool,
    pub code: Option<String>,
    pub expires_at: Option<String>,
    pub allowed_origin: Option<String>,
}

#[derive(Clone, Default)]
struct PairingState {
    code: Option<String>,
    expires_at_unix: Option<u64>,
}

pub struct AppState {
    app_name: String,
    app_version: String,
    discovery_service: DiscoveryService,
    storage_repository: StorageRepository,
    storage_overview: StorageOverview,
    printing: PrintingOverview,
    runtime: RwLock<RuntimeState>,
    rate_limit: Mutex<HashMap<String, RateBucket>>,
    events: broadcast::Sender<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RealtimeEvent<'a> {
    event: &'a str,
    payload: &'a BootstrapPayload,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigPatch {
    pub api_port: Option<u16>,
    pub locale: Option<String>,
    pub theme: Option<ThemeMode>,
    pub auto_default: Option<bool>,
    pub request_timeout_ms: Option<u64>,
    pub fallback_policy: Option<String>,
    pub log_level: Option<LogLevel>,
    pub allow_raw_printing: Option<bool>,
    pub allowed_origin: Option<Option<String>>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigUpdateResult {
    pub config: AppConfig,
    pub restart_required: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingExchangeResult {
    pub token: String,
    pub token_header: String,
    pub allowed_origin: Option<String>,
    pub origin_allowed: bool,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingLaunchResult {
    pub url: String,
    pub pairing: PairingSnapshot,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterOverridePatch {
    pub kind: Option<PrinterKind>,
    pub receipt_capable: Option<bool>,
    pub paper_width_mm: Option<PaperWidthMm>,
    pub chars_per_line_normal: Option<u16>,
    pub chars_per_line_compressed: Option<u16>,
    pub supports_cut: Option<bool>,
    pub supports_cash_drawer: Option<bool>,
    pub supports_qr: Option<bool>,
    pub supports_barcode: Option<bool>,
    pub encoding: Option<String>,
    pub raw_support: Option<bool>,
    pub raw_device_path: Option<String>,
}

#[derive(Clone)]
struct RateBucket {
    window_minute: u64,
    count: u16,
}

impl AppState {
    pub fn bootstrap(app_handle: &AppHandle) -> Result<Self, String> {
        let discovery_service = DiscoveryService::new();
        let storage_root = app_handle
            .path()
            .app_local_data_dir()
            .map_err(|error| error.to_string())?
            .join("core");
        let storage_repository =
            StorageRepository::new(storage_root).map_err(|error| error.to_string())?;
        let storage_overview = storage_repository.overview();

        let persisted = storage_repository
            .load_or_initialize()
            .map_err(|error| format!("failed to load persisted state: {error}"))?;

        let printers = hydrated_printers(
            discovery_service.discover_printers(),
            persisted.config.default_printer_id.clone(),
            persisted.config.auto_default,
            &persisted.printer_overrides,
        );

        let default_printer_id = determine_default_printer_id(
            persisted.config.default_printer_id.clone(),
            &printers,
            persisted.config.auto_default,
        );

        let mut config = persisted.config.clone();
        config.default_printer_id = default_printer_id;

        storage_repository
            .save(&PersistedState {
                config: config.clone(),
                auth: persisted.auth.clone(),
                bridge: persisted.bridge.clone(),
                printer_overrides: persisted.printer_overrides.clone(),
            })
            .map_err(|error| format!("failed to persist initialized state: {error}"))?;

        let (events, _) = broadcast::channel(64);

        Ok(Self {
            app_name: "MPOS Core".into(),
            app_version: env!("CARGO_PKG_VERSION").into(),
            discovery_service,
            storage_repository,
            storage_overview,
            printing: PrintingOverview::default(),
            runtime: RwLock::new(RuntimeState {
                api_server: ApiServerConfig::from_port(config.api_port),
                config,
                auth: persisted.auth,
                printers,
                printer_overrides: persisted.printer_overrides,
                last_receipt: None,
                bridge: BridgeState::from_record(&persisted.bridge),
                scanner_active: false,
                last_refresh_error: None,
                pairing: PairingState::default(),
            }),
            rate_limit: Mutex::new(HashMap::new()),
            events,
        })
    }

    pub fn snapshot(&self) -> BootstrapPayload {
        let runtime = self.runtime.read().expect("runtime lock poisoned");

        BootstrapPayload {
            app_name: self.app_name.clone(),
            app_version: self.app_version.clone(),
            config: runtime.config.clone(),
            api_server: runtime.api_server.clone(),
            auth: AuthState::from_record(&runtime.auth),
            bridge: bridge_snapshot(&runtime.bridge),
            pairing: pairing_snapshot(&runtime.pairing, runtime.config.allowed_origin.clone()),
            storage: self.storage_overview.clone(),
            printing: self.printing.clone(),
            printers: runtime.printers.clone(),
        }
    }

    pub fn refresh_snapshot(&self) -> Result<BootstrapPayload, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        runtime.scanner_active = true;
        runtime.api_server.scanner_active = true;
        drop(runtime);

        let printers = hydrated_printers(
            self.discovery_service.discover_printers(),
            self.runtime
                .read()
                .expect("runtime lock poisoned")
                .config
                .default_printer_id
                .clone(),
            self.runtime
                .read()
                .expect("runtime lock poisoned")
                .config
                .auto_default,
            &self
                .runtime
                .read()
                .expect("runtime lock poisoned")
                .printer_overrides,
        );
        self.complete_refresh(printers)
    }

    pub fn request_refresh(self: &Arc<Self>) -> Result<BootstrapPayload, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        if runtime.scanner_active {
            return Ok(self.snapshot());
        }
        runtime.scanner_active = true;
        runtime.api_server.scanner_active = true;
        runtime.last_refresh_error = None;
        drop(runtime);

        let printers = self.discovery_service.discover_printers();
        self.complete_refresh(printers)
    }

    fn complete_refresh(&self, printers: Vec<ResolvedPrinter>) -> Result<BootstrapPayload, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        let previous_printers = runtime.printers.clone();

        runtime.printers = hydrated_printers(
            printers,
            runtime.config.default_printer_id.clone(),
            runtime.config.auto_default,
            &runtime.printer_overrides,
        );
        runtime.config.default_printer_id = determine_default_printer_id(
            runtime.config.default_printer_id.clone(),
            &runtime.printers,
            runtime.config.auto_default,
        );
        runtime.printers =
            apply_default_printer_flag(runtime.printers.clone(), runtime.config.default_printer_id.as_deref());
        runtime.scanner_active = false;
        runtime.api_server.scanner_active = false;
        runtime.last_refresh_error = None;

        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )?;

        let payload = BootstrapPayload {
            app_name: self.app_name.clone(),
            app_version: self.app_version.clone(),
            config: runtime.config.clone(),
            api_server: runtime.api_server.clone(),
            auth: AuthState::from_record(&runtime.auth),
            bridge: bridge_snapshot(&runtime.bridge),
            pairing: pairing_snapshot(&runtime.pairing, runtime.config.allowed_origin.clone()),
            storage: self.storage_overview.clone(),
            printing: self.printing.clone(),
            printers: runtime.printers.clone(),
        };
        drop(runtime);
        emit_printer_status_events(self, &previous_printers, &payload.printers, &payload);
        Ok(payload)
    }

    pub fn printers(&self) -> Vec<ResolvedPrinter> {
        self.runtime
            .read()
            .expect("runtime lock poisoned")
            .printers
            .clone()
    }

    pub fn current_default_printer(&self) -> Option<ResolvedPrinter> {
        let runtime = self.runtime.read().expect("runtime lock poisoned");
        runtime
            .config
            .default_printer_id
            .as_ref()
            .and_then(|id| runtime.printers.iter().find(|printer| printer.id == *id))
            .cloned()
    }

    pub fn set_default_printer(&self, printer_id: &str) -> Result<ResolvedPrinter, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        let selected = runtime
            .printers
            .iter()
            .find(|printer| printer.id == printer_id)
            .cloned()
            .ok_or_else(|| format!("printer not found: {printer_id}"))?;

        runtime.config.default_printer_id = Some(printer_id.into());
        runtime.printers = apply_default_printer_flag(runtime.printers.clone(), Some(printer_id));
        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )?;
        drop(runtime);
        self.emit_snapshot_event("printers.changed");

        Ok(selected)
    }

    pub fn config(&self) -> AppConfig {
        self.runtime
            .read()
            .expect("runtime lock poisoned")
            .config
            .clone()
    }

    pub fn update_config(&self, patch: ConfigPatch) -> Result<ConfigUpdateResult, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        let current_port = runtime.config.api_port;

        if let Some(api_port) = patch.api_port {
            runtime.config.api_port = api_port;
        }
        if let Some(locale) = patch.locale {
            runtime.config.locale = locale;
        }
        if let Some(theme) = patch.theme {
            runtime.config.theme = theme;
        }
        if let Some(auto_default) = patch.auto_default {
            runtime.config.auto_default = auto_default;
        }
        if let Some(timeout) = patch.request_timeout_ms {
            runtime.config.request_timeout_ms = timeout;
        }
        if let Some(policy) = patch.fallback_policy {
            runtime.config.fallback_policy = policy;
        }
        if let Some(log_level) = patch.log_level {
            runtime.config.log_level = log_level;
        }
        if let Some(allow_raw_printing) = patch.allow_raw_printing {
            runtime.config.allow_raw_printing = allow_raw_printing;
        }
        if let Some(allowed_origin) = patch.allowed_origin {
            runtime.config.allowed_origin = allowed_origin;
        }

        runtime.config.default_printer_id = determine_default_printer_id(
            runtime.config.default_printer_id.clone(),
            &runtime.printers,
            runtime.config.auto_default,
        );
        runtime.printers = apply_default_printer_flag(
            runtime.printers.clone(),
            runtime.config.default_printer_id.as_deref(),
        );

        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )?;
        let config = runtime.config.clone();
        let restart_required = runtime.config.api_port != current_port;
        drop(runtime);
        self.emit_snapshot_event("config.updated");

        Ok(ConfigUpdateResult {
            config,
            restart_required,
        })
    }

    pub fn print_test_receipt(&self, printer_id: Option<String>) -> Result<PrintResult, String> {
        let printer = self.select_printer(printer_id)?;
        let document = build_test_receipt(printer.paper_width_mm);
        let result = dispatch_print_job(&printer, &document, PrintMode::Test);
        self.log_print_attempt(&printer, &result);
        result
    }

    pub fn print_receipt(
        &self,
        printer_id: Option<String>,
        document: ReceiptDocument,
    ) -> Result<PrintResult, String> {
        let printer = self.select_printer(printer_id)?;
        let result = dispatch_print_job(&printer, &document, PrintMode::Receipt);
        self.log_print_attempt(&printer, &result);
        result
    }

    pub fn remember_last_receipt(&self, document: &ReceiptDocument) {
        self.runtime
            .write()
            .expect("runtime lock poisoned")
            .last_receipt = Some(document.clone());
    }

    pub fn reprint_last_receipt(&self, printer_id: Option<String>) -> Result<PrintResult, String> {
        let document = self
            .runtime
            .read()
            .expect("runtime lock poisoned")
            .last_receipt
            .clone()
            .ok_or_else(|| "todavia no hay un recibo real enviado por MartPOS para reimprimir".to_string())?;

        self.print_receipt(printer_id, document)
    }

    pub fn print_raw(&self, printer_id: Option<String>, payload: String) -> Result<PrintResult, String> {
        let printer = self.select_printer(printer_id)?;
        let runtime = self.runtime.read().expect("runtime lock poisoned");
        if !runtime.config.allow_raw_printing {
            return Err("raw printing is disabled by configuration".into());
        }
        drop(runtime);
        let bytes = parse_raw_payload(&payload);
        let result = dispatch_raw_job(&printer, &bytes);
        self.log_print_attempt(&printer, &result);
        result
    }

    pub fn update_printer_override(
        &self,
        printer_id: &str,
        patch: PrinterOverridePatch,
    ) -> Result<ResolvedPrinter, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        if !runtime.printers.iter().any(|printer| printer.id == printer_id) {
            return Err(format!("printer not found: {printer_id}"));
        }

        let existing = runtime
            .printer_overrides
            .entry(printer_id.into())
            .or_insert_with(PrinterOverride::default);

        merge_override(existing, patch);

        runtime.printers = hydrated_printers(
            self.discovery_service.discover_printers(),
            runtime.config.default_printer_id.clone(),
            runtime.config.auto_default,
            &runtime.printer_overrides,
        );
        runtime.config.default_printer_id = determine_default_printer_id(
            runtime.config.default_printer_id.clone(),
            &runtime.printers,
            runtime.config.auto_default,
        );
        runtime.printers = apply_default_printer_flag(
            runtime.printers.clone(),
            runtime.config.default_printer_id.as_deref(),
        );

        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )?;
        let updated_printer = runtime
            .printers
            .iter()
            .find(|printer| printer.id == printer_id)
            .cloned()
            .ok_or_else(|| format!("printer not found after update: {printer_id}"))?;
        drop(runtime);
        self.emit_snapshot_event("printers.changed");
        Ok(updated_printer)
    }

    pub fn api_server_config(&self) -> ApiServerConfig {
        self.runtime
            .read()
            .expect("runtime lock poisoned")
            .api_server
            .clone()
    }

    pub fn verify_api_token(&self, provided: Option<&str>) -> bool {
        self.runtime
            .read()
            .expect("runtime lock poisoned")
            .auth
            .is_valid(provided)
    }

    pub fn auth_header_name(&self) -> String {
        self.runtime
            .read()
            .expect("runtime lock poisoned")
            .auth
            .token_header
            .clone()
    }

    pub fn health_open(&self) -> bool {
        self.runtime
            .read()
            .expect("runtime lock poisoned")
            .auth
            .health_open
    }

    pub fn app_version(&self) -> &str {
        &self.app_version
    }

    pub fn note_bridge_activity(&self, origin: Option<&str>) -> Result<(), String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        let now = unix_now();

        runtime.bridge.paired_at_unix.get_or_insert(now);
        runtime.bridge.last_seen_at_unix = Some(now);
        if let Some(origin) = origin.filter(|value| !value.trim().is_empty()) {
            runtime.bridge.last_origin = Some(origin.to_string());
        }

        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )
    }

    pub fn allow_origin(&self) -> Option<String> {
        let configured_origin = self.runtime
            .read()
            .expect("runtime lock poisoned")
            .config
            .allowed_origin
            .clone();

        match configured_origin {
            Some(origin) => Some(resolve_effective_allowed_origin(Some(&origin))),
            None => None,
        }
    }

    pub fn consume_rate_limit(&self, bucket_key: &str) -> Result<(), String> {
        let current_minute = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_secs() / 60)
            .unwrap_or_default();
        let limit = self
            .runtime
            .read()
            .expect("runtime lock poisoned")
            .auth
            .rate_limit_per_minute;

        let mut store = self.rate_limit.lock().expect("rate limit lock poisoned");
        let bucket = store.entry(bucket_key.into()).or_insert(RateBucket {
            window_minute: current_minute,
            count: 0,
        });

        if bucket.window_minute != current_minute {
            bucket.window_minute = current_minute;
            bucket.count = 0;
        }

        if bucket.count >= limit {
            return Err("rate limit exceeded".into());
        }

        bucket.count += 1;
        Ok(())
    }

    pub fn logs_directory(&self) -> String {
        self.storage_overview.logs.directory.clone()
    }

    pub fn open_pairing_session(&self) -> Result<PairingSnapshot, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        let now = unix_now();
        runtime.pairing = PairingState {
            code: Some(generate_pairing_code()),
            expires_at_unix: Some(now + 10 * 60),
        };
        let snapshot = pairing_snapshot(
            &runtime.pairing,
            runtime.config.allowed_origin.clone(),
        );
        drop(runtime);
        self.emit_snapshot_event("bridge.pairing");
        Ok(snapshot)
    }

    pub fn pairing_status(&self) -> PairingSnapshot {
        let runtime = self.runtime.read().expect("runtime lock poisoned");
        pairing_snapshot(&runtime.pairing, runtime.config.allowed_origin.clone())
    }

    pub fn ensure_pairing_session(&self) -> Result<PairingSnapshot, String> {
        let snapshot = self.pairing_status();
        if snapshot.active {
            return Ok(snapshot);
        }

        self.open_pairing_session()
    }

    pub fn regenerate_api_token(&self) -> Result<BootstrapPayload, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        self.reset_bridge_runtime(&mut runtime)?;
        let payload = BootstrapPayload {
            app_name: self.app_name.clone(),
            app_version: self.app_version.clone(),
            config: runtime.config.clone(),
            api_server: runtime.api_server.clone(),
            auth: AuthState::from_record(&runtime.auth),
            bridge: bridge_snapshot(&runtime.bridge),
            pairing: pairing_snapshot(&runtime.pairing, runtime.config.allowed_origin.clone()),
            storage: self.storage_overview.clone(),
            printing: self.printing.clone(),
            printers: runtime.printers.clone(),
        };
        drop(runtime);
        self.emit_payload_event("bridge.forgotten", &payload);
        Ok(payload)
    }

    pub fn exchange_pairing_code(
        &self,
        code: &str,
        origin: Option<&str>,
    ) -> Result<PairingExchangeResult, String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        let now = unix_now();
        let pairing = &mut runtime.pairing;

        let expected_code = pairing
            .code
            .clone()
            .ok_or_else(|| "pairing session is not active".to_string())?;
        let expires_at = pairing
            .expires_at_unix
            .ok_or_else(|| "pairing session has no expiration".to_string())?;

        if now > expires_at {
            runtime.pairing = PairingState::default();
            return Err("pairing session expired".into());
        }

        if expected_code != code.trim() {
            return Err("invalid pairing code".into());
        }

        let allowed_origin = runtime.config.allowed_origin.clone();
        let origin_allowed = is_origin_allowed(allowed_origin.as_deref(), origin);
        runtime.bridge.paired_at_unix = Some(now);
        runtime.bridge.last_seen_at_unix = Some(now);
        runtime.bridge.last_origin = origin.map(ToString::to_string);

        runtime.pairing = PairingState::default();
        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )?;
        let token = runtime.auth.token.clone();
        let token_header = runtime.auth.token_header.clone();
        drop(runtime);
        self.emit_snapshot_event("bridge.connected");

        Ok(PairingExchangeResult {
            token,
            token_header,
            allowed_origin,
            origin_allowed,
        })
    }

    pub fn forget_bridge(&self) -> Result<(), String> {
        let mut runtime = self.runtime.write().expect("runtime lock poisoned");
        self.reset_bridge_runtime(&mut runtime)?;
        drop(runtime);
        self.emit_snapshot_event("bridge.forgotten");
        Ok(())
    }

    pub fn martpos_pairing_url(&self) -> String {
        let runtime = self.runtime.read().expect("runtime lock poisoned");
        let base = resolve_martpos_base_url(runtime.config.allowed_origin.as_deref());
        let lang = runtime
            .config
            .locale
            .split(['-', '_'])
            .next()
            .filter(|entry| !entry.is_empty())
            .unwrap_or("es");
        let bridge_url = runtime.api_server.base_url.clone();

        format!(
            "{base}/{lang}/settings/printers?bridge_pair=1&bridge_url={}",
            url_encode(&bridge_url)
        )
    }

    pub fn realtime_socket_url(&self) -> String {
        let runtime = self.runtime.read().expect("runtime lock poisoned");
        let base_url = runtime
            .api_server
            .base_url
            .replace("http://", "ws://")
            .replace("https://", "wss://");

        format!(
            "{base_url}/api/v1/events?token={}",
            url_encode(&runtime.auth.token)
        )
    }

    fn persist_runtime(
        &self,
        config: &AppConfig,
        auth: &AuthRecord,
        bridge: &BridgeState,
        printer_overrides: &HashMap<String, PrinterOverride>,
    ) -> Result<(), String> {
        self.storage_repository
            .save(&PersistedState {
                config: config.clone(),
                auth: auth.clone(),
                bridge: bridge.to_record(),
                printer_overrides: printer_overrides.clone(),
            })
            .map_err(|error| {
                format!(
                    "failed to save persisted state at {}: {error}",
                    self.storage_repository.config_path().display()
                )
            })
    }

    fn reset_bridge_runtime(&self, runtime: &mut RuntimeState) -> Result<(), String> {
        runtime.auth.regenerate_token();
        runtime.pairing = PairingState::default();
        runtime.bridge = BridgeState::default();
        self.persist_runtime(
            &runtime.config,
            &runtime.auth,
            &runtime.bridge,
            &runtime.printer_overrides,
        )
    }

    pub fn subscribe_events(&self) -> broadcast::Receiver<String> {
        self.events.subscribe()
    }

    pub fn current_event_payload(&self, event: &str) -> Result<String, String> {
        let payload = self.snapshot();
        serialize_event(event, &payload)
    }

    fn emit_snapshot_event(&self, event: &str) {
        let payload = self.snapshot();
        self.emit_payload_event(event, &payload);
    }

    fn emit_payload_event(&self, event: &str, payload: &BootstrapPayload) {
        if let Ok(message) = serialize_event(event, payload) {
            let _ = self.events.send(message);
        }
    }

    fn select_printer(&self, printer_id: Option<String>) -> Result<ResolvedPrinter, String> {
        let runtime = self.runtime.read().expect("runtime lock poisoned");
        let selected_id = printer_id.or_else(|| runtime.config.default_printer_id.clone());
        let selected_id = selected_id.ok_or_else(|| "no default printer configured".to_string())?;

        runtime
            .printers
            .iter()
            .find(|printer| printer.id == selected_id)
            .cloned()
            .ok_or_else(|| format!("printer not found: {selected_id}"))
    }

    fn log_print_attempt(&self, printer: &ResolvedPrinter, result: &Result<PrintResult, String>) {
        let logs_directory = self.storage_overview.logs.directory.clone();
        let entry = match result {
            Ok(print_result) => PrintLogEntry {
                printer_id: &printer.id,
                driver: &print_result.driver,
                ok: true,
                detail: &print_result.detail,
            },
            Err(error) => PrintLogEntry {
                printer_id: &printer.id,
                driver: &printer.driver,
                ok: false,
                detail: error,
            },
        };

        let _ = append_print_log(&logs_directory, &entry);
    }
}

impl BridgeState {
    fn from_record(record: &PersistedBridgeState) -> Self {
        Self {
            paired_at_unix: record.paired_at_unix,
            last_seen_at_unix: record.last_seen_at_unix,
            last_origin: record.last_origin.clone(),
        }
    }

    fn to_record(&self) -> PersistedBridgeState {
        PersistedBridgeState {
            paired_at_unix: self.paired_at_unix,
            last_seen_at_unix: self.last_seen_at_unix,
            last_origin: self.last_origin.clone(),
        }
    }
}

fn hydrated_printers(
    printers: Vec<ResolvedPrinter>,
    persisted_default: Option<String>,
    auto_default: bool,
    overrides: &HashMap<String, PrinterOverride>,
) -> Vec<ResolvedPrinter> {
    let default_id = determine_default_printer_id(persisted_default, &printers, auto_default);
    let printers = printers
        .into_iter()
        .map(|printer| {
            let printer_id = printer.id.clone();
            apply_printer_override(printer, overrides.get(&printer_id))
        })
        .collect();
    apply_default_printer_flag(printers, default_id.as_deref())
}

fn determine_default_printer_id(
    persisted_default: Option<String>,
    printers: &[ResolvedPrinter],
    auto_default: bool,
) -> Option<String> {
    if let Some(default_id) = persisted_default {
        return Some(default_id);
    }

    if !auto_default {
        return None;
    }

    select_default_printer(printers)
}

fn apply_default_printer_flag(
    printers: Vec<ResolvedPrinter>,
    default_id: Option<&str>,
) -> Vec<ResolvedPrinter> {
    printers
        .into_iter()
        .map(|mut printer| {
            printer.is_default = default_id.is_some_and(|id| id == printer.id);
            printer
        })
        .collect()
}

fn select_default_printer(printers: &[ResolvedPrinter]) -> Option<String> {
    printers
        .iter()
        .find(|printer| {
            printer.status == ResolvedPrinterStatus::Online && printer.kind == PrinterKind::Thermal
        })
        .or_else(|| {
            printers.iter().find(|printer| {
                printer.status == ResolvedPrinterStatus::Online && printer.receipt_capable
            })
        })
        .or_else(|| {
            printers
                .iter()
                .find(|printer| printer.status == ResolvedPrinterStatus::Online)
        })
        .or_else(|| printers.iter().find(|printer| printer.kind == PrinterKind::Thermal))
        .or_else(|| printers.iter().find(|printer| printer.receipt_capable))
        .or_else(|| printers.first())
        .map(|printer| printer.id.clone())
}

#[allow(dead_code)]
fn _paper_width_label(width: PaperWidthMm) -> &'static str {
    match width {
        PaperWidthMm::Mm58 => "58 mm",
        PaperWidthMm::Mm80 => "80 mm",
        PaperWidthMm::Unknown => "Unknown",
    }
}

fn apply_printer_override(
    mut printer: ResolvedPrinter,
    manual_override: Option<&PrinterOverride>,
) -> ResolvedPrinter {
    let Some(manual_override) = manual_override.cloned() else {
        printer.profile = PrinterProfile::from_capabilities(printer.paper_width_mm, &printer.capabilities);
        printer.manual_override = PrinterOverride::default();
        return printer;
    };

    if let Some(kind) = manual_override.kind {
        printer.kind = kind;
    }
    let legacy_usb_receipt_override = printer.is_usb_device
        && printer.system_queue.is_none()
        && printer.kind == PrinterKind::Thermal
        && printer.vendor_id.is_some()
        && printer.product_id.is_some();

    if let Some(receipt_capable) = manual_override.receipt_capable {
        if !(legacy_usb_receipt_override && !receipt_capable && printer.receipt_capable) {
        printer.receipt_capable = receipt_capable;
        }
    }
    if let Some(paper_width_mm) = manual_override.paper_width_mm {
        printer.paper_width_mm = paper_width_mm;
    }
    if let Some(supports_cut) = manual_override.supports_cut {
        if !(legacy_usb_receipt_override && !supports_cut && printer.capabilities.supports_cut) {
        printer.capabilities.supports_cut = supports_cut;
        }
    }
    if let Some(supports_cash_drawer) = manual_override.supports_cash_drawer {
        if !(legacy_usb_receipt_override
            && !supports_cash_drawer
            && printer.capabilities.supports_cash_drawer)
        {
        printer.capabilities.supports_cash_drawer = supports_cash_drawer;
        }
    }
    if let Some(supports_qr) = manual_override.supports_qr {
        if !(legacy_usb_receipt_override && !supports_qr && printer.capabilities.supports_qr) {
        printer.capabilities.supports_qr = supports_qr;
        }
    }
    if let Some(supports_barcode) = manual_override.supports_barcode {
        if !(legacy_usb_receipt_override
            && !supports_barcode
            && printer.capabilities.supports_barcode)
        {
        printer.capabilities.supports_barcode = supports_barcode;
        }
    }
    if let Some(encoding) = &manual_override.encoding {
        printer.capabilities.encoding = encoding.clone();
    }
    if let Some(raw_support) = manual_override.raw_support {
        if !(legacy_usb_receipt_override && !raw_support && printer.capabilities.raw_support) {
        printer.capabilities.raw_support = raw_support;
        }
    }

    let mut profile = PrinterProfile::from_capabilities(printer.paper_width_mm, &printer.capabilities);
    if let Some(chars) = manual_override.chars_per_line_normal {
        profile.chars_per_line_normal = chars;
    }
    if let Some(chars) = manual_override.chars_per_line_compressed {
        profile.chars_per_line_compressed = chars;
    }
    if let Some(encoding) = &manual_override.encoding {
        profile.encoding = encoding.clone();
    }
    if let Some(raw_support) = manual_override.raw_support {
        if !(legacy_usb_receipt_override && !raw_support && printer.profile.raw_support) {
        profile.raw_support = raw_support;
        }
    }
    if let Some(raw_device_path) = &manual_override.raw_device_path {
        profile.raw_device_path = if raw_device_path.trim().is_empty() {
            None
        } else {
            Some(raw_device_path.clone())
        };
    }
    if let Some(supports_cut) = manual_override.supports_cut {
        if !(legacy_usb_receipt_override && !supports_cut && profile.supports_cut) {
        profile.supports_cut = supports_cut;
        }
    }
    if let Some(supports_cash_drawer) = manual_override.supports_cash_drawer {
        if !(legacy_usb_receipt_override && !supports_cash_drawer && profile.supports_cash_drawer)
        {
        profile.supports_cash_drawer = supports_cash_drawer;
        }
    }
    if let Some(supports_qr) = manual_override.supports_qr {
        if !(legacy_usb_receipt_override && !supports_qr && profile.supports_qr) {
        profile.supports_qr = supports_qr;
        }
    }
    if let Some(supports_barcode) = manual_override.supports_barcode {
        if !(legacy_usb_receipt_override && !supports_barcode && profile.supports_barcode) {
        profile.supports_barcode = supports_barcode;
        }
    }
    if let Some(width) = manual_override.paper_width_mm {
        profile.paper_width_mm = width;
    }
    printer.profile = profile;
    printer.manual_override = manual_override;
    printer
}

fn merge_override(target: &mut PrinterOverride, patch: PrinterOverridePatch) {
    if patch.kind.is_some() {
        target.kind = patch.kind;
    }
    if patch.receipt_capable.is_some() {
        target.receipt_capable = patch.receipt_capable;
    }
    if patch.paper_width_mm.is_some() {
        target.paper_width_mm = patch.paper_width_mm;
    }
    if patch.chars_per_line_normal.is_some() {
        target.chars_per_line_normal = patch.chars_per_line_normal;
    }
    if patch.chars_per_line_compressed.is_some() {
        target.chars_per_line_compressed = patch.chars_per_line_compressed;
    }
    if patch.supports_cut.is_some() {
        target.supports_cut = patch.supports_cut;
    }
    if patch.supports_cash_drawer.is_some() {
        target.supports_cash_drawer = patch.supports_cash_drawer;
    }
    if patch.supports_qr.is_some() {
        target.supports_qr = patch.supports_qr;
    }
    if patch.supports_barcode.is_some() {
        target.supports_barcode = patch.supports_barcode;
    }
    if patch.encoding.is_some() {
        target.encoding = patch.encoding;
    }
    if patch.raw_support.is_some() {
        target.raw_support = patch.raw_support;
    }
    if patch.raw_device_path.is_some() {
        target.raw_device_path = patch.raw_device_path;
    }
}

fn parse_raw_payload(payload: &str) -> Vec<u8> {
    let compact: String = payload.chars().filter(|character| !character.is_whitespace()).collect();
    let looks_hex = compact.len() >= 2
        && compact.len().is_multiple_of(2)
        && compact.chars().all(|character| character.is_ascii_hexdigit());

    if looks_hex {
        compact
            .as_bytes()
            .chunks(2)
            .filter_map(|chunk| std::str::from_utf8(chunk).ok())
            .filter_map(|hex| u8::from_str_radix(hex, 16).ok())
            .collect()
    } else {
        payload.as_bytes().to_vec()
    }
}

fn pairing_snapshot(pairing: &PairingState, allowed_origin: Option<String>) -> PairingSnapshot {
    let now = unix_now();
    let active = pairing
        .expires_at_unix
        .is_some_and(|expires_at| expires_at >= now)
        && pairing.code.is_some();
    let effective_allowed_origin = resolve_effective_allowed_origin(allowed_origin.as_deref());

    PairingSnapshot {
        active,
        code: if active { pairing.code.clone() } else { None },
        expires_at: pairing
            .expires_at_unix
            .filter(|expires_at| *expires_at >= now)
            .map(|expires_at| format!("unix:{expires_at}")),
        allowed_origin: Some(effective_allowed_origin),
    }
}

fn bridge_snapshot(bridge: &BridgeState) -> BridgeSnapshot {
    BridgeSnapshot {
        connected: bridge.paired_at_unix.is_some(),
        paired_at: bridge.paired_at_unix.map(|value| format!("unix:{value}")),
        last_seen_at: bridge.last_seen_at_unix.map(|value| format!("unix:{value}")),
        last_origin: bridge.last_origin.clone(),
    }
}

fn serialize_event(event: &str, payload: &BootstrapPayload) -> Result<String, String> {
    serde_json::to_string(&RealtimeEvent { event, payload })
        .map_err(|error| format!("failed to serialize realtime event: {error}"))
}

fn emit_printer_status_events(
    state: &AppState,
    previous: &[ResolvedPrinter],
    current: &[ResolvedPrinter],
    payload: &BootstrapPayload,
) {
    if !printers_changed(previous, current) {
        return;
    }

    state.emit_payload_event("printers.changed", payload);

    for printer in current {
        let previous_status = previous
            .iter()
            .find(|entry| entry.id == printer.id)
            .map(|entry| entry.status);

        if previous_status != Some(ResolvedPrinterStatus::Online)
            && printer.status == ResolvedPrinterStatus::Online
        {
            state.emit_payload_event("printer.connected", payload);
        }

        if previous_status == Some(ResolvedPrinterStatus::Online)
            && printer.status != ResolvedPrinterStatus::Online
        {
            state.emit_payload_event("printer.disconnected", payload);
        }
    }
}

fn printers_changed(previous: &[ResolvedPrinter], current: &[ResolvedPrinter]) -> bool {
    serde_json::to_string(previous).ok() != serde_json::to_string(current).ok()
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn url_encode(value: &str) -> String {
    let mut encoded = String::new();

    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }

    encoded
}

fn resolve_martpos_base_url(configured_origin: Option<&str>) -> String {
    resolve_effective_allowed_origin(configured_origin)
}

fn is_origin_allowed(configured_origin: Option<&str>, actual_origin: Option<&str>) -> bool {
    match (configured_origin, actual_origin) {
        (Some(allowed), Some(actual)) if allowed == actual => true,
        (Some("https://martpos.app"), Some("http://localhost:3000")) if cfg!(debug_assertions) => {
            true
        }
        (Some(_), Some(_)) => false,
        (Some(_), None) => false,
        (None, _) => true,
    }
}

fn resolve_effective_allowed_origin(configured_origin: Option<&str>) -> String {
    if cfg!(debug_assertions)
        && configured_origin.is_none_or(|origin| origin == "https://martpos.app")
    {
        return "http://localhost:3000".into();
    }

    configured_origin
        .unwrap_or("https://martpos.app")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::printer::{
        ConnectionType, PrinterCapabilities, ResolvedPrinterStatus,
    };

    fn test_printer(id: &str, kind: PrinterKind, receipt_capable: bool, status: ResolvedPrinterStatus) -> ResolvedPrinter {
        let capabilities = if receipt_capable {
            PrinterCapabilities::receipt()
        } else {
            PrinterCapabilities::label()
        };

        ResolvedPrinter {
            id: id.into(),
            name: id.into(),
            system_name: None,
            model: None,
            manufacturer: None,
            vendor_id: None,
            product_id: None,
            serial_number: None,
            connection_type: ConnectionType::Usb,
            system_backend: None,
            system_queue: None,
            is_system_printer: false,
            is_usb_device: true,
            is_default: false,
            kind,
            receipt_capable,
            paper_width_mm: PaperWidthMm::Mm80,
            status,
            driver: "escpos_usb".into(),
            last_seen_at: "unix:1".into(),
            capabilities: capabilities.clone(),
            profile: PrinterProfile::from_capabilities(PaperWidthMm::Mm80, &capabilities),
            manual_override: PrinterOverride::default(),
            match_reasons: Vec::new(),
        }
    }

    #[test]
    fn select_default_prioritizes_thermal_then_receipt_then_online() {
        let printers = vec![
            test_printer("generic", PrinterKind::Unknown, false, ResolvedPrinterStatus::Online),
            test_printer("receipt", PrinterKind::Unknown, true, ResolvedPrinterStatus::Online),
            test_printer("thermal", PrinterKind::Thermal, true, ResolvedPrinterStatus::Online),
        ];

        assert_eq!(select_default_printer(&printers).as_deref(), Some("thermal"));
    }

    #[test]
    fn parse_raw_payload_supports_hex_and_text() {
        assert_eq!(parse_raw_payload("1b40"), vec![0x1b, 0x40]);
        assert_eq!(parse_raw_payload("ABC"), b"ABC".to_vec());
    }

    #[test]
    fn pairing_snapshot_expires_when_past_deadline() {
        let pairing = PairingState {
            code: Some("123456".into()),
            expires_at_unix: Some(unix_now().saturating_sub(1)),
        };

        let snapshot = pairing_snapshot(&pairing, Some("http://localhost:3000".into()));
        assert!(!snapshot.active);
        assert!(snapshot.code.is_none());
    }
}
