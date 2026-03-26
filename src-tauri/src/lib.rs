mod api;
mod app;
mod config;
mod discovery;
mod domain;
mod logs;
mod printing;
mod security;
mod storage;

use std::sync::Arc;

use app::state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = Arc::new(AppState::bootstrap(app.handle())?);
            let server_state = Arc::clone(&state);

            tauri::async_runtime::spawn(async move {
                if let Err(error) = api::server::run_http_server(server_state).await {
                    eprintln!("mpos-core local api server error: {error}");
                }
            });

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app::commands::get_bootstrap_state,
            app::commands::refresh_printers,
            app::commands::set_default_printer,
            app::commands::print_test_ticket,
            app::commands::print_receipt_document,
            app::commands::reprint_last_receipt,
            app::commands::print_raw_payload,
            app::commands::update_runtime_config,
            app::commands::update_printer_profile,
            app::commands::open_pairing_session,
            app::commands::get_pairing_status,
            app::commands::ensure_pairing_session,
            app::commands::regenerate_api_token,
            app::commands::exchange_pairing_code,
            app::commands::launch_martpos_pairing
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
