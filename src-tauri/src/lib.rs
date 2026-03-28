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
use tauri::{ActivationPolicy, Manager, RunEvent, WindowEvent};
use tokio::time::{sleep, Duration};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            let state = Arc::new(AppState::bootstrap(app.handle())?);
            let server_state = Arc::clone(&state);

            tauri::async_runtime::spawn(async move {
                if let Err(error) = api::server::run_http_server(server_state).await {
                    eprintln!("mpos-core local api server error: {error}");
                }
            });

            let refresh_state = Arc::clone(&state);
            tauri::async_runtime::spawn(async move {
                loop {
                    sleep(Duration::from_secs(4)).await;
                    let _ = refresh_state.request_refresh();
                }
            });

            app.manage(state);
            app.set_activation_policy(ActivationPolicy::Regular);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app::commands::get_bootstrap_state,
            app::commands::get_realtime_socket_url,
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    let app_handle = app.handle().clone();
    app.run(move |_handle, event| {
        if let RunEvent::Reopen { .. } = event {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }
    });
}
