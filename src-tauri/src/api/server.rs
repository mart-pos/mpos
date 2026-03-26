use std::net::SocketAddr;

use axum::{
    extract::{Request, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};

use crate::{
    app::state::{
        ConfigPatch, ConfigUpdateResult, PairingExchangeResult, PairingSnapshot,
        PrinterOverridePatch, SharedAppState,
    },
    config::model::AppConfig,
    domain::{printer::ResolvedPrinter, receipt::ReceiptDocument},
    logs::service::{append_api_log, ApiLogEntry},
    printing::service::PrintResult,
};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiServerConfig {
    pub host: String,
    pub port: u16,
    pub base_url: String,
    pub version_prefix: String,
    pub scanner_active: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: String,
    pub operating_system: &'static str,
    pub port: u16,
    pub scanner_active: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiIndexResponse {
    pub name: &'static str,
    pub status: &'static str,
    pub version: String,
    pub api_base: &'static str,
    pub health: &'static str,
    pub pairing_status: &'static str,
    pub pairing_exchange: &'static str,
    pub note: &'static str,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDefaultPrinterRequest {
    pub printer_id: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintRequest {
    pub printer_id: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptPrintRequest {
    pub printer_id: Option<String>,
    pub document: ReceiptDocument,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawPrintRequest {
    pub printer_id: Option<String>,
    pub payload: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePrinterRequest {
    pub printer_id: String,
    #[serde(flatten)]
    pub patch: PrinterOverridePatch,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingExchangeRequest {
    pub code: String,
    pub origin: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMessage {
    pub message: String,
}

impl ApiServerConfig {
    pub fn from_port(port: u16) -> Self {
        Self {
            host: "127.0.0.1".into(),
            port,
            base_url: format!("http://127.0.0.1:{port}"),
            version_prefix: "/api/v1".into(),
            scanner_active: true,
        }
    }
}

pub async fn run_http_server(state: SharedAppState) -> Result<(), String> {
    let config = state.api_server_config();
    let protected_routes = Router::new()
        .route("/printers", get(get_printers))
        .route("/printers/default", get(get_default_printer).post(post_default_printer))
        .route("/printers/refresh", post(refresh_printers))
        .route("/printers/profile", post(post_update_printer_profile))
        .route("/print/test", post(post_print_test))
        .route("/print/receipt", post(post_print_receipt))
        .route("/print/raw", post(post_print_raw))
        .route("/config", get(get_config).patch(update_config))
        .with_state(state.clone())
        .route_layer(middleware::from_fn_with_state(state.clone(), require_auth));

    let router = Router::new()
        .route("/", get(get_index))
        .route("/api", get(get_api_index))
        .route("/api/v1/health", get(get_health))
        .route("/api/v1/pairing/status", get(get_pairing_status))
        .route("/api/v1/pairing/exchange", post(post_pairing_exchange))
        .nest("/api/v1", protected_routes)
        .route_layer(middleware::from_fn_with_state(state.clone(), cors_middleware))
        .with_state(state);

    let address: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|error| format!("invalid API bind address: {error}"))?;
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .map_err(|error| format!("failed to bind local API server: {error}"))?;

    axum::serve(listener, router)
        .await
        .map_err(|error| format!("local API server stopped: {error}"))
}

async fn get_health(State(state): State<SharedAppState>) -> Json<HealthResponse> {
    let config = state.api_server_config();

    Json(HealthResponse {
        status: "ok",
        version: state.app_version().into(),
        operating_system: std::env::consts::OS,
        port: config.port,
        scanner_active: config.scanner_active,
    })
}

async fn get_index(State(state): State<SharedAppState>) -> Json<ApiIndexResponse> {
    build_api_index(state)
}

async fn get_api_index(State(state): State<SharedAppState>) -> Json<ApiIndexResponse> {
    build_api_index(state)
}

fn build_api_index(state: SharedAppState) -> Json<ApiIndexResponse> {
    Json(ApiIndexResponse {
        name: "MPOS Core",
        status: "ok",
        version: state.app_version().into(),
        api_base: "/api/v1",
        health: "/api/v1/health",
        pairing_status: "/api/v1/pairing/status",
        pairing_exchange: "/api/v1/pairing/exchange",
        note: "Protected routes require Origin and local token headers.",
    })
}

async fn get_pairing_status(State(state): State<SharedAppState>) -> Json<PairingSnapshot> {
    Json(state.snapshot().pairing)
}

async fn post_pairing_exchange(
    State(state): State<SharedAppState>,
    headers: HeaderMap,
    Json(payload): Json<PairingExchangeRequest>,
) -> Result<Json<PairingExchangeResult>, ApiError> {
    let request_origin = payload.origin.or_else(|| {
        headers
            .get("origin")
            .and_then(|value| value.to_str().ok())
            .map(ToString::to_string)
    });

    state
        .consume_rate_limit("pairing_exchange")
        .map_err(ApiError::too_many_requests)?;

    state
        .exchange_pairing_code(&payload.code, request_origin.as_deref())
        .map(Json)
        .map_err(ApiError::bad_request)
}

async fn get_printers(State(state): State<SharedAppState>) -> Json<Vec<ResolvedPrinter>> {
    Json(state.printers())
}

async fn get_default_printer(
    State(state): State<SharedAppState>,
) -> Result<Json<ResolvedPrinter>, ApiError> {
    state
        .current_default_printer()
        .map(Json)
        .ok_or_else(|| ApiError::not_found("no default printer configured"))
}

async fn post_default_printer(
    State(state): State<SharedAppState>,
    Json(payload): Json<SetDefaultPrinterRequest>,
) -> Result<Json<ResolvedPrinter>, ApiError> {
    state
        .set_default_printer(&payload.printer_id)
        .map(Json)
        .map_err(ApiError::bad_request)
}

async fn refresh_printers(
    State(state): State<SharedAppState>,
) -> Result<Json<Vec<ResolvedPrinter>>, ApiError> {
    state
        .request_refresh()
        .map(|payload| Json(payload.printers))
        .map_err(ApiError::internal)
}

async fn get_config(State(state): State<SharedAppState>) -> Json<AppConfig> {
    Json(state.config())
}

async fn update_config(
    State(state): State<SharedAppState>,
    Json(payload): Json<ConfigPatch>,
) -> Result<Json<ConfigUpdateResult>, ApiError> {
    state
        .update_config(payload)
        .map(Json)
        .map_err(ApiError::bad_request)
}

async fn post_print_test(
    State(state): State<SharedAppState>,
    Json(payload): Json<PrintRequest>,
) -> Result<Json<PrintResult>, ApiError> {
    validate_printer_id(payload.printer_id.as_deref())?;
    state
        .print_test_receipt(payload.printer_id)
        .map(Json)
        .map_err(ApiError::bad_request)
}

async fn post_print_receipt(
    State(state): State<SharedAppState>,
    Json(payload): Json<ReceiptPrintRequest>,
) -> Result<Json<PrintResult>, ApiError> {
    validate_printer_id(payload.printer_id.as_deref())?;
    payload.document.validate().map_err(ApiError::bad_request)?;
    let printer_id = payload.printer_id.clone();
    let document = payload.document.clone();
    let result = state
        .print_receipt(printer_id, document.clone())
        .map_err(ApiError::bad_request)?;
    state.remember_last_receipt(&document);
    Ok(Json(result))
}

async fn post_print_raw(
    State(state): State<SharedAppState>,
    Json(payload): Json<RawPrintRequest>,
) -> Result<Json<PrintResult>, ApiError> {
    validate_printer_id(payload.printer_id.as_deref())?;
    validate_raw_payload(&payload.payload)?;
    state
        .print_raw(payload.printer_id, payload.payload)
        .map(Json)
        .map_err(ApiError::bad_request)
}

async fn post_update_printer_profile(
    State(state): State<SharedAppState>,
    Json(payload): Json<UpdatePrinterRequest>,
) -> Result<Json<ResolvedPrinter>, ApiError> {
    validate_printer_id(Some(&payload.printer_id))?;
    state
        .update_printer_override(&payload.printer_id, payload.patch)
        .map(Json)
        .map_err(ApiError::bad_request)
}

async fn require_auth(
    State(state): State<SharedAppState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let path = request.uri().path().to_string();
    if state.health_open() && request.uri().path() == "/api/v1/health" {
        return Ok(next.run(request).await);
    }

    let header_name = state.auth_header_name();
    let provided = headers.get(header_name.as_str()).and_then(|value| value.to_str().ok());
    let origin = headers.get("origin").and_then(|value| value.to_str().ok());

    if let Some(allowed_origin) = state.allow_origin() {
        if let Some(origin) = origin {
            if origin != allowed_origin {
                log_api_event(&state, &path, StatusCode::UNAUTHORIZED, "origin not allowed");
                return Err(ApiError::unauthorized("origin not allowed"));
            }
        } else {
            log_api_event(&state, &path, StatusCode::UNAUTHORIZED, "missing origin header");
            return Err(ApiError::unauthorized("missing origin header"));
        }
    }

    if state.verify_api_token(provided) {
        state
            .consume_rate_limit(&format!("local_api:{path}"))
            .map_err(ApiError::too_many_requests)?;
        state
            .note_bridge_activity(origin)
            .map_err(ApiError::internal)?;
        return Ok(next.run(request).await);
    }

    log_api_event(
        &state,
        &path,
        StatusCode::UNAUTHORIZED,
        "invalid or missing local API token",
    );
    Err(ApiError::unauthorized("invalid or missing local API token"))
}

async fn cors_middleware(
    State(state): State<SharedAppState>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Response {
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(ToString::to_string);

    if request.method() == Method::OPTIONS {
        let mut response = StatusCode::NO_CONTENT.into_response();
        if let Some(origin) = resolve_cors_origin(&state, origin.as_deref()) {
            append_cors_headers(&mut response, &origin, state.auth_header_name().as_str());
        }
        return response;
    }

    let mut response = next.run(request).await;
    if let Some(origin) = resolve_cors_origin(&state, origin.as_deref()) {
        append_cors_headers(&mut response, &origin, state.auth_header_name().as_str());
    }

    response
}

fn resolve_cors_origin(state: &SharedAppState, request_origin: Option<&str>) -> Option<String> {
    let request_origin = request_origin?;
    let configured = state.allow_origin();

    if configured.as_deref() == Some(request_origin) {
        return Some(request_origin.to_string());
    }

    if cfg!(debug_assertions) && request_origin == "http://localhost:3000" {
        return Some(request_origin.to_string());
    }

    None
}

fn append_cors_headers(response: &mut Response, origin: &str, token_header: &str) {
    let headers = response.headers_mut();
    let origin_value = HeaderValue::from_str(origin).unwrap_or_else(|_| HeaderValue::from_static("*"));
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, origin_value);
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PATCH, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_str(&format!("content-type, origin, {token_header}"))
            .unwrap_or_else(|_| HeaderValue::from_static("content-type, origin, x-mpos-core-token")),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
        HeaderValue::from_static("true"),
    );
    headers.insert(
        header::ACCESS_CONTROL_MAX_AGE,
        HeaderValue::from_static("600"),
    );
    headers.insert(header::VARY, HeaderValue::from_static("Origin"));
}

fn validate_printer_id(printer_id: Option<&str>) -> Result<(), ApiError> {
    let Some(printer_id) = printer_id else {
        return Ok(());
    };

    if printer_id.is_empty() || printer_id.len() > 128 {
        return Err(ApiError::bad_request("invalid printer_id length"));
    }

    if !printer_id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.'))
    {
        return Err(ApiError::bad_request("printer_id contains unsupported characters"));
    }

    Ok(())
}

fn validate_raw_payload(payload: &str) -> Result<(), ApiError> {
    if payload.trim().is_empty() {
        return Err(ApiError::bad_request("raw payload cannot be empty"));
    }

    if payload.len() > 65_536 {
        return Err(ApiError::bad_request("raw payload exceeds 64 KB"));
    }

    if payload
        .chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    {
        return Err(ApiError::bad_request(
            "raw payload contains unsupported control characters",
        ));
    }

    Ok(())
}

fn log_api_event(state: &SharedAppState, path: &str, status: StatusCode, detail: &str) {
    let _ = append_api_log(
        &state.logs_directory(),
        &ApiLogEntry {
            path,
            status: status.as_u16(),
            ok: status.is_success(),
            detail,
        },
    );
}

pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }

    fn internal(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: message.into(),
        }
    }

    fn too_many_requests(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::TOO_MANY_REQUESTS,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(ApiMessage { message: self.message })).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reject_invalid_printer_id_characters() {
        assert!(validate_printer_id(Some("../etc/passwd")).is_err());
        assert!(validate_printer_id(Some("printer_01")).is_ok());
    }

    #[test]
    fn reject_oversized_raw_payload() {
        let payload = "A".repeat(65_537);
        assert!(validate_raw_payload(&payload).is_err());
    }
}
