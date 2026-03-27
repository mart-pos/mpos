use crate::{
    app::state::{
        AppState, BootstrapPayload, ConfigPatch, PairingExchangeResult, PairingLaunchResult,
        PairingSnapshot,
        PrinterOverridePatch,
    },
    domain::receipt::ReceiptDocument,
    printing::service::PrintResult,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDefaultPrinterPayload {
    pub printer_id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintTestPayload {
    pub printer_id: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintReceiptPayload {
    pub printer_id: Option<String>,
    pub document: ReceiptDocument,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawPrintPayload {
    pub printer_id: Option<String>,
    pub payload: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePrinterOverridePayload {
    pub printer_id: String,
    #[serde(flatten)]
    pub patch: PrinterOverridePatch,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingExchangePayload {
    pub code: String,
    pub origin: Option<String>,
}

#[tauri::command]
pub fn get_bootstrap_state(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> BootstrapPayload {
    state.snapshot()
}

#[tauri::command]
pub fn get_realtime_socket_url(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> String {
    state.realtime_socket_url()
}

#[tauri::command]
pub fn refresh_printers(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<BootstrapPayload, String> {
    state.request_refresh()
}

#[tauri::command]
pub fn set_default_printer(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: SetDefaultPrinterPayload,
) -> Result<BootstrapPayload, String> {
    state.set_default_printer(&payload.printer_id)?;
    state.refresh_snapshot()
}

#[tauri::command]
pub fn print_test_ticket(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: Option<PrintTestPayload>,
) -> Result<PrintResult, String> {
    state.print_test_receipt(payload.and_then(|entry| entry.printer_id))
}

#[tauri::command]
pub fn print_receipt_document(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: PrintReceiptPayload,
) -> Result<PrintResult, String> {
    state.print_receipt(payload.printer_id, payload.document)
}

#[tauri::command]
pub fn reprint_last_receipt(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: Option<PrintTestPayload>,
) -> Result<PrintResult, String> {
    state.reprint_last_receipt(payload.and_then(|entry| entry.printer_id))
}

#[tauri::command]
pub fn print_raw_payload(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: RawPrintPayload,
) -> Result<PrintResult, String> {
    state.print_raw(payload.printer_id, payload.payload)
}

#[tauri::command]
pub fn update_runtime_config(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: ConfigPatch,
) -> Result<BootstrapPayload, String> {
    state.update_config(payload)?;
    Ok(state.snapshot())
}

#[tauri::command]
pub fn update_printer_profile(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: UpdatePrinterOverridePayload,
) -> Result<BootstrapPayload, String> {
    state.update_printer_override(&payload.printer_id, payload.patch)?;
    Ok(state.snapshot())
}

#[tauri::command]
pub fn open_pairing_session(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<PairingSnapshot, String> {
    state.open_pairing_session()
}

#[tauri::command]
pub fn get_pairing_status(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> PairingSnapshot {
    state.pairing_status()
}

#[tauri::command]
pub fn ensure_pairing_session(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<PairingSnapshot, String> {
    state.ensure_pairing_session()
}

#[tauri::command]
pub fn regenerate_api_token(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<BootstrapPayload, String> {
    state.regenerate_api_token()
}

#[tauri::command]
pub fn exchange_pairing_code(
    state: tauri::State<'_, std::sync::Arc<AppState>>,
    payload: PairingExchangePayload,
) -> Result<PairingExchangeResult, String> {
    state.exchange_pairing_code(&payload.code, payload.origin.as_deref())
}

#[tauri::command]
pub fn launch_martpos_pairing(
    app: tauri::AppHandle,
    state: tauri::State<'_, std::sync::Arc<AppState>>,
) -> Result<PairingLaunchResult, String> {
    use tauri_plugin_opener::OpenerExt;

    let pairing = state.open_pairing_session()?;
    let url = state.martpos_pairing_url();
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|error| format!("failed to open MartPOS pairing url: {error}"))?;

    Ok(PairingLaunchResult { url, pairing })
}
