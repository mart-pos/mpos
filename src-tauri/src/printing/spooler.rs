use std::{fs, process::Command};

use crate::{
    domain::{printer::ResolvedPrinter, receipt::ReceiptDocument},
    printing::{
        common::DriverKind,
        formatter::render_receipt_text,
        service::{write_temp_bytes, PrintResult},
    },
};

pub fn supported_drivers() -> Vec<DriverKind> {
    vec![DriverKind::SystemPrint, DriverKind::Preview]
}

pub fn print_via_system_queue(
    printer: &ResolvedPrinter,
    document: &ReceiptDocument,
) -> Result<PrintResult, String> {
    let queue = printer
        .system_queue
        .clone()
        .or_else(|| printer.system_name.clone())
        .ok_or_else(|| "selected printer has no system queue".to_string())?;

    if cfg!(target_os = "windows") {
        return Err("system queue printing is not implemented on windows yet".into());
    }

    let content = render_receipt_text(document, &printer.profile);
    let file_path = write_temp_bytes(&printer.id, "txt", content.as_bytes())?;
    let output = Command::new("/usr/bin/lp")
        .args(["-d", &queue, file_path.to_string_lossy().as_ref()])
        .output()
        .map_err(|error| format!("failed to execute lp: {error}"))?;
    let _ = fs::remove_file(&file_path);

    if output.status.success() {
        Ok(PrintResult {
            printer_id: printer.id.clone(),
            driver: "system_print".into(),
            submitted: true,
            detail: String::from_utf8_lossy(&output.stdout).trim().to_string(),
            preview_path: None,
        })
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
