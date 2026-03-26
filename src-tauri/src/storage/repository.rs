use std::{
    collections::HashMap,
    fs,
    io,
    path::{Path, PathBuf},
};

use crate::{
    config::model::AppConfig,
    domain::printer::PrinterOverride,
    logs::service::LogRuntime,
    security::auth::AuthRecord,
};

#[derive(Clone)]
pub struct StoragePaths {
    pub root_dir: PathBuf,
    pub config_path: PathBuf,
    pub cache_path: PathBuf,
    pub logs_path: PathBuf,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PersistedState {
    pub config: AppConfig,
    pub auth: AuthRecord,
    pub printer_overrides: HashMap<String, PrinterOverride>,
}

impl Default for PersistedState {
    fn default() -> Self {
        Self {
            config: AppConfig::default(),
            auth: AuthRecord::new_local_token(),
            printer_overrides: HashMap::new(),
        }
    }
}

#[derive(Clone)]
pub struct StorageRepository {
    paths: StoragePaths,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageOverview {
    pub driver: String,
    pub config_path: String,
    pub cache_path: String,
    pub logs: LogRuntime,
}

impl StorageRepository {
    pub fn new(root_dir: PathBuf) -> io::Result<Self> {
        let paths = StoragePaths {
            config_path: root_dir.join("config.json"),
            cache_path: root_dir.join("cache"),
            logs_path: root_dir.join("logs"),
            root_dir,
        };

        fs::create_dir_all(&paths.root_dir)?;
        fs::create_dir_all(&paths.cache_path)?;
        fs::create_dir_all(&paths.logs_path)?;

        Ok(Self { paths })
    }

    pub fn load_or_initialize(&self) -> io::Result<PersistedState> {
        if self.paths.config_path.exists() {
            let raw = fs::read_to_string(&self.paths.config_path)?;
            let persisted = serde_json::from_str(&raw)
                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;

            return Ok(persisted);
        }

        let persisted = PersistedState {
            config: AppConfig::default(),
            auth: AuthRecord::new_local_token(),
            printer_overrides: HashMap::new(),
        };
        self.save(&persisted)?;

        Ok(persisted)
    }

    pub fn save(&self, persisted: &PersistedState) -> io::Result<()> {
        let raw = serde_json::to_string_pretty(persisted)
            .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
        fs::write(&self.paths.config_path, raw)
    }

    pub fn overview(&self) -> StorageOverview {
        StorageOverview::from_paths(&self.paths)
    }

    pub fn config_path(&self) -> &Path {
        &self.paths.config_path
    }
}

impl StorageOverview {
    pub fn from_paths(paths: &StoragePaths) -> Self {
        Self {
            driver: "json".into(),
            config_path: paths.config_path.display().to_string(),
            cache_path: paths.cache_path.display().to_string(),
            logs: LogRuntime {
                directory: paths.logs_path.display().to_string(),
                ..LogRuntime::default()
            },
        }
    }
}
