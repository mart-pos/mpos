use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogRuntime {
    pub directory: String,
    pub rotation_enabled: bool,
    pub debug_payload_capture: bool,
}

impl Default for LogRuntime {
    fn default() -> Self {
        Self {
            directory: "logs".into(),
            rotation_enabled: true,
            debug_payload_capture: false,
        }
    }
}

pub fn append_print_log(logs_directory: &str, entry: &PrintLogEntry<'_>) -> Result<(), String> {
    append_json_line(
        logs_directory,
        "print-jobs.log",
        &format!(
            "{{\"ts\":{},\"printer_id\":\"{}\",\"driver\":\"{}\",\"ok\":{},\"detail\":{}}}",
            epoch_seconds(),
            sanitize_json(entry.printer_id),
            sanitize_json(entry.driver),
            entry.ok,
            stringify_json(entry.detail)
        ),
    )
}

pub fn append_api_log(logs_directory: &str, entry: &ApiLogEntry<'_>) -> Result<(), String> {
    append_json_line(
        logs_directory,
        "api.log",
        &format!(
            "{{\"ts\":{},\"path\":\"{}\",\"status\":{},\"ok\":{},\"detail\":{}}}",
            epoch_seconds(),
            sanitize_json(entry.path),
            entry.status,
            entry.ok,
            stringify_json(entry.detail)
        ),
    )
}

pub struct PrintLogEntry<'a> {
    pub printer_id: &'a str,
    pub driver: &'a str,
    pub ok: bool,
    pub detail: &'a str,
}

pub struct ApiLogEntry<'a> {
    pub path: &'a str,
    pub status: u16,
    pub ok: bool,
    pub detail: &'a str,
}

fn append_json_line(logs_directory: &str, file_name: &str, line: &str) -> Result<(), String> {
    let directory = Path::new(logs_directory);
    fs::create_dir_all(directory)
        .map_err(|error| format!("failed to create logs directory: {error}"))?;

    let file_path = directory.join(file_name);
    rotate_if_needed(&file_path)?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|error| format!("failed to open log file: {error}"))?;

    file.write_all(line.as_bytes())
        .and_then(|_| file.write_all(b"\n"))
        .map_err(|error| format!("failed to write log file: {error}"))
}

fn rotate_if_needed(file_path: &Path) -> Result<(), String> {
    const MAX_BYTES: u64 = 512 * 1024;
    const MAX_ROTATIONS: usize = 5;

    let Ok(metadata) = fs::metadata(file_path) else {
        return Ok(());
    };

    if metadata.len() < MAX_BYTES {
        return Ok(());
    }

    for index in (1..=MAX_ROTATIONS).rev() {
        let current = rotated_path(file_path, index);
        let previous = if index == 1 {
            file_path.to_path_buf()
        } else {
            rotated_path(file_path, index - 1)
        };

        if current.exists() {
            fs::remove_file(&current)
                .map_err(|error| format!("failed to remove rotated log: {error}"))?;
        }

        if previous.exists() {
            fs::rename(&previous, &current)
                .map_err(|error| format!("failed to rotate log: {error}"))?;
        }
    }

    Ok(())
}

fn rotated_path(file_path: &Path, index: usize) -> PathBuf {
    let file_name = file_path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("log");
    file_path.with_file_name(format!("{file_name}.{index}"))
}

fn epoch_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

fn sanitize_json(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn stringify_json(value: &str) -> String {
    format!("\"{}\"", sanitize_json(value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rotates_multiple_generations() {
        let temp = std::env::temp_dir().join(format!("mpos-logs-test-{}", epoch_seconds()));
        fs::create_dir_all(&temp).expect("create temp logs dir");
        let file_path = temp.join("print-jobs.log");
        fs::write(&file_path, vec![b'x'; 600 * 1024]).expect("seed oversized log");

        rotate_if_needed(&file_path).expect("rotate");

        assert!(!file_path.exists());
        assert!(temp.join("print-jobs.log.1").exists());

        let _ = fs::remove_dir_all(temp);
    }
}
