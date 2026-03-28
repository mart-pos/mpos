use base64::{engine::general_purpose::STANDARD, Engine as _};
use image::{imageops::FilterType, DynamicImage, GenericImageView, ImageReader, Luma};

use crate::domain::{
    printer::{PaperWidthMm, PrinterProfile},
    receipt::{ReceiptAmount, ReceiptBlock, ReceiptDocument},
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
            ReceiptBlock::Image { .. } => lines.push("[IMAGE]".into()),
            ReceiptBlock::Divider => lines.push(divider.clone()),
            ReceiptBlock::Item {
                name,
                qty,
                unit_price,
                total,
            } => {
                lines.push(fit_text(name, columns));
                lines.push(format_item_line_display(*qty, unit_price, total, columns));
            }
            ReceiptBlock::Totals {
                subtotal,
                tax,
                grand_total,
            } => {
                lines.push(divider.clone());
                lines.push(format_pair_display("Subtotal", subtotal, columns));
                lines.push(format_pair_display("Impuesto", tax, columns));
                lines.push(format_pair_display("Total", grand_total, columns));
            }
            ReceiptBlock::Qr { value } => {
                lines.push("[QR]".into());
                lines.push(fit_text(value, columns));
            }
            ReceiptBlock::Barcode {
                value,
                symbology,
                show_text,
                ..
            } => {
                lines.push(format!(
                    "[BARCODE {}]",
                    symbology.as_deref().unwrap_or("code128")
                ));
                if !show_text {
                    continue;
                }
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
            ReceiptBlock::Image {
                data,
                align,
                max_width,
            } => {
                if let Ok(image_bytes) = render_receipt_image(
                    document.paper_width_mm,
                    data,
                    align.as_deref().unwrap_or("center"),
                    *max_width,
                ) {
                    bytes.extend_from_slice(&image_bytes);
                }
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
                bytes.extend_from_slice(
                    format_item_line_display(*qty, unit_price, total, columns).as_bytes(),
                );
                bytes.push(b'\n');
            }
            ReceiptBlock::Totals {
                subtotal,
                tax,
                grand_total,
            } => {
                bytes.extend_from_slice(divider_line(columns).as_bytes());
                bytes.push(b'\n');
                bytes.extend_from_slice(
                    format_pair_display("Subtotal", subtotal, columns).as_bytes(),
                );
                bytes.push(b'\n');
                bytes.extend_from_slice(
                    format_pair_display("Impuesto", tax, columns).as_bytes(),
                );
                bytes.push(b'\n');
                bytes.extend_from_slice(
                    format_pair_display("Total", grand_total, columns).as_bytes(),
                );
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
                show_text,
                full_width,
            } => {
                let barcode_type = match symbology.as_deref() {
                    Some("upca") => 65,
                    Some("upce") => 66,
                    Some("ean13") => 67,
                    Some("ean8") => 68,
                    Some("code39") => 69,
                    Some("itf") => 70,
                    Some("code128") | None => 73,
                    _ => 73,
                };
                bytes.extend_from_slice(align_command("center"));
                bytes.extend_from_slice(&[0x1d, 0x48, if *show_text { 0x02 } else { 0x00 }]);
                bytes.extend_from_slice(&[0x1d, 0x68, height.unwrap_or(80)]);
                bytes.extend_from_slice(&[0x1d, 0x77, barcode_width(document.paper_width_mm, *full_width)]);
                if barcode_type == 73 {
                    let payload = encode_code128(value);
                    bytes.extend_from_slice(&[0x1d, 0x6b, barcode_type, payload.len() as u8]);
                    bytes.extend_from_slice(&payload);
                } else {
                    bytes.extend_from_slice(&[0x1d, 0x6b, barcode_type]);
                    bytes.extend_from_slice(value.as_bytes());
                    bytes.push(0x00);
                }
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

fn format_pair_display(label: &str, value: &ReceiptAmount, columns: usize) -> String {
    let value = value.as_display();
    let space = columns.saturating_sub(label.len() + value.len());
    format!("{label}{}{value}", " ".repeat(space))
}

fn format_item_line_display(
    qty: u32,
    unit_price: &ReceiptAmount,
    total: &ReceiptAmount,
    columns: usize,
) -> String {
    let left = format!("{qty} x {}", unit_price.as_display());
    let right = total.as_display();
    let space = columns.saturating_sub(left.len() + right.len());
    format!("{left}{}{right}", " ".repeat(space))
}

fn fit_text(value: &str, columns: usize) -> String {
    value.chars().take(columns).collect()
}

fn encode_code128(value: &str) -> Vec<u8> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return b"{B0".to_vec();
    }

    if trimmed.starts_with("{A") || trimmed.starts_with("{B") || trimmed.starts_with("{C") {
        return trimmed.as_bytes().to_vec();
    }

    let mut payload = Vec::with_capacity(trimmed.len() + 2);
    payload.extend_from_slice(b"{B");
    payload.extend_from_slice(trimmed.as_bytes());
    payload
}

fn barcode_width(paper_width_mm: u16, full_width: bool) -> u8 {
    if !full_width {
        return 3;
    }

    if paper_width_mm <= 58 {
        4
    } else {
        5
    }
}

fn render_receipt_image(
    paper_width_mm: u16,
    data: &str,
    align: &str,
    max_width: Option<u16>,
) -> Result<Vec<u8>, String> {
    let decoded = decode_image_data(data)?;
    let image = ImageReader::new(std::io::Cursor::new(decoded))
        .with_guessed_format()
        .map_err(|error| format!("failed to detect image format: {error}"))?
        .decode()
        .map_err(|error| format!("failed to decode image: {error}"))?;
    let target_width = max_image_width(paper_width_mm).min(max_width.unwrap_or(u16::MAX));
    let raster = rasterize_image(image, target_width);
    Ok(build_raster_image_command(&raster, align))
}

fn decode_image_data(data: &str) -> Result<Vec<u8>, String> {
    let trimmed = data.trim();
    let payload = trimmed
        .split_once(',')
        .map(|(_, value)| value)
        .unwrap_or(trimmed);
    STANDARD
        .decode(payload)
        .map_err(|error| format!("failed to decode image base64: {error}"))
}

fn max_image_width(paper_width_mm: u16) -> u16 {
    if paper_width_mm <= 58 { 384 } else { 576 }
}

fn rasterize_image(image: DynamicImage, target_width: u16) -> Vec<Vec<u8>> {
    let (width, height) = image.dimensions();
    let resize_width = width.min(u32::from(target_width)).max(1);
    let resize_height = ((height as f32 * resize_width as f32) / width.max(1) as f32)
        .round()
        .max(1.0) as u32;
    let grayscale = image
        .resize(resize_width, resize_height, FilterType::Lanczos3)
        .grayscale()
        .to_luma8();

    let byte_width = grayscale.width().div_ceil(8) as usize;
    let mut raster = vec![vec![0_u8; byte_width]; grayscale.height() as usize];

    for y in 0..grayscale.height() {
        for x in 0..grayscale.width() {
            let pixel = grayscale.get_pixel(x, y);
            let Luma([luma]) = *pixel;
            if luma < 160 {
                raster[y as usize][(x / 8) as usize] |= 0x80 >> (x % 8);
            }
        }
    }

    raster
}

fn build_raster_image_command(raster: &[Vec<u8>], align: &str) -> Vec<u8> {
    let height = raster.len() as u16;
    let width_bytes = raster.first().map(|row| row.len()).unwrap_or(0) as u16;
    let mut bytes = Vec::new();
    bytes.extend_from_slice(align_command(align));
    bytes.extend_from_slice(&[
        0x1d,
        0x76,
        0x30,
        0x00,
        (width_bytes & 0xff) as u8,
        ((width_bytes >> 8) & 0xff) as u8,
        (height & 0xff) as u8,
        ((height >> 8) & 0xff) as u8,
    ]);
    for row in raster {
        bytes.extend_from_slice(row);
    }
    bytes.push(b'\n');
    bytes
}
