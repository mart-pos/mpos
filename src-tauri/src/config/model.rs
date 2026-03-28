#![allow(dead_code)]

pub const IS_DEV: bool = cfg!(debug_assertions);
pub const LOCAL_ALLOWED_ORIGIN: &str = "http://localhost:3000";
pub const PRODUCTION_ALLOWED_ORIGIN: &str = "https://martpos.app";

pub fn active_allowed_origin() -> &'static str {
    if IS_DEV {
        LOCAL_ALLOWED_ORIGIN
    } else {
        PRODUCTION_ALLOWED_ORIGIN
    }
}

pub fn active_martpos_label() -> &'static str {
    if IS_DEV {
        "MartPOS Local"
    } else {
        "MartPOS"
    }
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
#[allow(clippy::struct_excessive_bools)]
pub struct AppConfig {
    pub api_port: u16,
    pub locale: String,
    pub theme: ThemeMode,
    pub auto_default: bool,
    pub request_timeout_ms: u64,
    pub fallback_policy: String,
    pub log_level: LogLevel,
    #[serde(default)]
    pub allow_raw_printing: bool,
    #[serde(default = "default_allowed_origin")]
    pub allowed_origin: Option<String>,
    pub default_printer_id: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_port: 45123,
            locale: "es-EC".into(),
            theme: ThemeMode::Dark,
            auto_default: true,
            request_timeout_ms: 5_000,
            fallback_policy: "prefer_system_spooler".into(),
            log_level: LogLevel::Info,
            allow_raw_printing: false,
            allowed_origin: default_allowed_origin(),
            default_printer_id: None,
        }
    }
}

fn default_allowed_origin() -> Option<String> {
    Some(active_allowed_origin().into())
}

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThemeMode {
    Light,
    Dark,
    System,
}

#[derive(Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}
