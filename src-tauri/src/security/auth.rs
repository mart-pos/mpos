use rand::{distributions::Alphanumeric, Rng};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthState {
    pub strategy: String,
    pub token_header: String,
    pub health_open: bool,
    pub rate_limit_per_minute: u16,
    pub token_preview: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthRecord {
    pub strategy: String,
    pub token_header: String,
    pub health_open: bool,
    pub rate_limit_per_minute: u16,
    pub token: String,
}

impl AuthState {
    pub fn from_record(record: &AuthRecord) -> Self {
        Self {
            strategy: record.strategy.clone(),
            token_header: record.token_header.clone(),
            health_open: record.health_open,
            rate_limit_per_minute: record.rate_limit_per_minute,
            token_preview: preview_token(&record.token),
        }
    }
}

impl AuthRecord {
    pub fn new_local_token() -> Self {
        Self {
            strategy: "local_token".into(),
            token_header: "x-mpos-core-token".into(),
            health_open: true,
            rate_limit_per_minute: 120,
            token: generate_token(),
        }
    }

    pub fn regenerate_token(&mut self) {
        self.token = generate_token();
    }

    pub fn is_valid(&self, provided: Option<&str>) -> bool {
        matches!(provided, Some(value) if value == self.token)
    }
}

fn generate_token() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}

fn preview_token(token: &str) -> String {
    if token.len() <= 8 {
        return token.into();
    }

    format!("{}…{}", &token[..4], &token[token.len() - 4..])
}

pub fn generate_pairing_code() -> String {
    let value: u32 = rand::thread_rng().gen_range(0..=999_999);
    format!("{value:06}")
}
