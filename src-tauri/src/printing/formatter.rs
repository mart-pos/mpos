use crate::domain::{
    printer::{PaperWidthMm, PrinterProfile},
    receipt::{ReceiptBlock, ReceiptDocument},
};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatterProfile {
    pub width_58_columns: u8,
    pub width_80_columns: u8,
    pub deterministic_layout: bool,
}

impl Default for FormatterProfile {
    fn default() -> Self {
        Self {
            width_58_columns: 32,
            width_80_columns: 48,
            deterministic_layout: true,
        }
    }
}

pub fn render_receipt_text(document: &ReceiptDocument, profile: &PrinterProfile) -> String {
    let columns = columns_from_profile(document.paper_width_mm, profile);
    let divider = "-".repeat(columns);
    let mut lines = Vec::new();

    for block in &document.content_blocks {
        match block {
            ReceiptBlock::Text { value, align, bold } => {
                let mut rendered = align_text(value, columns, align);
                if *bold {
                    rendered = rendered.to_uppercase();
                }
                lines.push(rendered);
            }
            ReceiptBlock::Divider => lines.push(divider.clone()),
            ReceiptBlock::Item {
                name,
                qty,
                unit_price,
                total,
            } => {
                lines.push(fit_text(name, columns));
                lines.push(format_item_line(*qty, *unit_price, *total, columns));
            }
            ReceiptBlock::Totals {
                subtotal,
                tax,
                grand_total,
            } => {
                lines.push(divider.clone());
                lines.push(format_pair("Subtotal", *subtotal, columns));
                lines.push(format_pair("Impuesto", *tax, columns));
                lines.push(format_pair("Total", *grand_total, columns));
            }
            ReceiptBlock::Qr { value } => {
                lines.push("[QR]".into());
                lines.push(fit_text(value, columns));
            }
            ReceiptBlock::Barcode { value, symbology, .. } => {
                lines.push(format!(
                    "[BARCODE {}]",
                    symbology.as_deref().unwrap_or("code128")
                ));
                lines.push(fit_text(value, columns));
            }
            ReceiptBlock::CashDrawer => {
                lines.push("[CASH DRAWER]".into());
            }
            ReceiptBlock::Cut => {
                lines.push(String::new());
                lines.push("=".repeat(columns));
            }
        }
    }

    lines.push(String::new());
    lines.join("\n")
}

pub fn render_receipt_escpos(document: &ReceiptDocument, profile: &PrinterProfile) -> Vec<u8> {
    let columns = columns_from_profile(document.paper_width_mm, profile);
    let mut bytes = Vec::new();

    bytes.extend_from_slice(&[0x1b, 0x40]);

    for block in &document.content_blocks {
        match block {
            ReceiptBlock::Text { value, align, bold } => {
                bytes.extend_from_slice(align_command(align));
                bytes.extend_from_slice(if *bold { &[0x1b, 0x45, 0x01] } else { &[0x1b, 0x45, 0x00] });
                bytes.extend_from_slice(fit_text(value, columns).as_bytes());
                bytes.push(b'\n');
            }
            ReceiptBlock::Divider => {
                bytes.extend_from_slice(divider_line(columns).as_bytes());
                bytes.push(b'\n');
            }
            ReceiptBlock::Item {
                name,
                qty,
                unit_price,
                total,
            } => {
                bytes.extend_from_slice(fit_text(name, columns).as_bytes());
                bytes.push(b'\n');
                bytes.extend_from_slice(format_item_line(*qty, *unit_price, *total, columns).as_bytes());
                bytes.push(b'\n');
            }
            ReceiptBlock::Totals {
                subtotal,
                tax,
                grand_total,
            } => {
                bytes.extend_from_slice(divider_line(columns).as_bytes());
                bytes.push(b'\n');
                bytes.extend_from_slice(format_pair("Subtotal", *subtotal, columns).as_bytes());
                bytes.push(b'\n');
                bytes.extend_from_slice(format_pair("Impuesto", *tax, columns).as_bytes());
                bytes.push(b'\n');
                bytes.extend_from_slice(format_pair("Total", *grand_total, columns).as_bytes());
                bytes.push(b'\n');
            }
            ReceiptBlock::Qr { value } => {
                bytes.extend_from_slice(align_command("center"));
                bytes.extend_from_slice(&[0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
                bytes.extend_from_slice(&[0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]);
                bytes.extend_from_slice(&[0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30]);
                let qr_data = value.as_bytes();
                let store_len = qr_data.len() + 3;
                bytes.extend_from_slice(&[
                    0x1d,
                    0x28,
                    0x6b,
                    (store_len & 0xff) as u8,
                    ((store_len >> 8) & 0xff) as u8,
                    0x31,
                    0x50,
                    0x30,
                ]);
                bytes.extend_from_slice(qr_data);
                bytes.extend_from_slice(&[0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
                bytes.push(b'\n');
            }
            ReceiptBlock::Barcode {
                value,
                symbology,
                height,
            } => {
                let barcode_type = match symbology.as_deref() {
                    Some("ean13") => 67,
                    Some("ean8") => 68,
                    Some("code39") => 69,
                    _ => 73,
                };
                bytes.extend_from_slice(align_command("center"));
                bytes.extend_from_slice(&[0x1d, 0x48, 0x02]);
                bytes.extend_from_slice(&[0x1d, 0x68, height.unwrap_or(80)]);
                if barcode_type == 73 {
                    bytes.extend_from_slice(&[0x1d, 0x6b, barcode_type, value.len() as u8]);
                    bytes.extend_from_slice(value.as_bytes());
                } else {
                    bytes.extend_from_slice(&[0x1d, 0x6b, barcode_type]);
                    bytes.extend_from_slice(value.as_bytes());
                    bytes.push(0x00);
                }
                bytes.push(b'\n');
            }
            ReceiptBlock::CashDrawer => {
                if profile.supports_cash_drawer {
                    bytes.extend_from_slice(&[0x1b, 0x70, 0x00, 0x3c, 0xff]);
                }
            }
            ReceiptBlock::Cut => {
                // Feed extra paper before cutting so the last line is not chopped.
                bytes.extend_from_slice(&[0x1b, 0x64, 0x05]);
                if profile.supports_cut {
                    bytes.extend_from_slice(&[0x1d, 0x56, 0x00]);
                }
            }
        }
    }

    bytes.extend_from_slice(&[0x1b, 0x64, 0x01]);
    bytes
}

fn columns_from_profile(document_width: u16, profile: &PrinterProfile) -> usize {
    if document_width <= 58 || profile.paper_width_mm == PaperWidthMm::Mm58 {
        profile.chars_per_line_normal as usize
    } else {
        profile.chars_per_line_normal as usize
    }
}

fn divider_line(columns: usize) -> String {
    "-".repeat(columns)
}

fn align_text(value: &str, columns: usize, align: &str) -> String {
    let trimmed = fit_text(value, columns);
    let padding = columns.saturating_sub(trimmed.chars().count());

    match align {
        "center" => {
            let left = padding / 2;
            format!("{}{}", " ".repeat(left), trimmed)
        }
        "right" => format!("{}{}", " ".repeat(padding), trimmed),
        _ => trimmed,
    }
}

fn align_command(align: &str) -> &'static [u8] {
    match align {
        "center" => &[0x1b, 0x61, 0x01],
        "right" => &[0x1b, 0x61, 0x02],
        _ => &[0x1b, 0x61, 0x00],
    }
}

fn format_pair(label: &str, value: u64, columns: usize) -> String {
    let value = value.to_string();
    let space = columns.saturating_sub(label.len() + value.len());
    format!("{label}{}{value}", " ".repeat(space))
}

fn format_item_line(qty: u32, unit_price: u64, total: u64, columns: usize) -> String {
    let left = format!("{qty} x {unit_price}");
    let right = total.to_string();
    let space = columns.saturating_sub(left.len() + right.len());
    format!("{left}{}{right}", " ".repeat(space))
}

fn fit_text(value: &str, columns: usize) -> String {
    value.chars().take(columns).collect()
}
