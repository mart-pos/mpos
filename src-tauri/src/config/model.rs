#![allow(dead_code)]

use std::process::Command;

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
            locale: default_locale(),
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

fn default_locale() -> String {
    #[cfg(target_os = "macos")]
    {
        if let Some(locale) = run_and_read("/usr/bin/defaults", &["read", "-g", "AppleLocale"]) {
            return locale;
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(locale) = run_and_read(
            "powershell",
            &["-NoProfile", "-Command", "(Get-Culture).Name"],
        ) {
            return locale;
        }
    }

    if let Some(locale) = std::env::var("LANG").ok() {
        let normalized = locale
            .split('.')
            .next()
            .unwrap_or("en-US")
            .replace('_', "-");
        if !normalized.trim().is_empty() {
            return normalized;
        }
    }

    "en-US".into()
}

fn run_and_read(command: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(command).args(args).output().ok()?;
    if !output.status.success() {
        return None;
    }

    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    (!value.is_empty()).then_some(value)
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
