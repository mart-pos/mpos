use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    config::model::{active_allowed_origin, active_martpos_label},
    domain::{
        printer::{PaperWidthMm, PrinterKind, ResolvedPrinter},
        receipt::{ReceiptAmount, ReceiptBlock, ReceiptDocument},
    },
    printing::{
        common::{DriverKind, PrintMode},
        escpos,
        formatter::{render_receipt_escpos, FormatterProfile},
        spooler,
    },
};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintingOverview {
    pub formatter: FormatterProfile,
    pub supported_drivers: Vec<DriverKind>,
    pub html_printing_enabled: bool,
}

impl Default for PrintingOverview {
    fn default() -> Self {
        let mut supported_drivers = escpos::supported_drivers();
        supported_drivers.extend(spooler::supported_drivers());

        Self {
            formatter: FormatterProfile::default(),
            supported_drivers,
            html_printing_enabled: false,
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintResult {
    pub printer_id: String,
    pub driver: String,
    pub submitted: bool,
    pub detail: String,
    pub preview_path: Option<String>,
}

pub fn build_test_receipt(width: PaperWidthMm) -> ReceiptDocument {
    let paper_width_mm = match width {
        PaperWidthMm::Mm58 => 58,
        PaperWidthMm::Mm80 | PaperWidthMm::Unknown => 80,
    };
    let martpos_flow_label = format!("{} -> MPOS Core -> impresora", active_martpos_label());
    let martpos_receipt_url = format!("{}/receipt/A-10428", active_allowed_origin());

    ReceiptDocument {
        paper_width_mm,
        content_blocks: vec![
            ReceiptBlock::Text {
                value: "MARTPOS MARKET".into(),
                align: "center".into(),
                bold: true,
            },
            ReceiptBlock::Text {
                value: "Sucursal Centro".into(),
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Av. Principal 145 y Loja".into(),
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Quito, Ecuador".into(),
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "RUC 1790012345001".into(),
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "RECIBO DE PRUEBA".into(),
                align: "center".into(),
                bold: true,
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: "Venta #A-10428".into(),
                align: "left".into(),
                bold: true,
            },
            ReceiptBlock::Text {
                value: "Caja: Principal  ·  Turno: Tarde".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Cajero: Maria Paredes".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Cliente: Consumidor final".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "2026-03-26 14:32".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: "DETALLE".into(),
                align: "left".into(),
                bold: true,
            },
            ReceiptBlock::Item {
                name: "Coca Cola 1.5L".into(),
                qty: 2,
                unit_price: ReceiptAmount::Number(4500),
                total: ReceiptAmount::Number(9000),
            },
            ReceiptBlock::Item {
                name: "Pan artesanal integral".into(),
                qty: 1,
                unit_price: ReceiptAmount::Number(3200),
                total: ReceiptAmount::Number(3200),
            },
            ReceiptBlock::Item {
                name: "Queso mozzarella 250g".into(),
                qty: 1,
                unit_price: ReceiptAmount::Number(6850),
                total: ReceiptAmount::Number(6850),
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: "Promo aplicada: COMBO DESAYUNO".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Ahorro total: 750".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: "RESUMEN".into(),
                align: "left".into(),
                bold: true,
            },
            ReceiptBlock::Totals {
                subtotal_label: "Subtotal".into(),
                subtotal: ReceiptAmount::Number(19050),
                tax_label: "Impuesto".into(),
                tax: ReceiptAmount::Number(0),
                grand_total_label: "Total".into(),
                grand_total: ReceiptAmount::Number(19050),
            },
            ReceiptBlock::Text {
                value: "Pagado: 19050".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Cambio: 0".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: "Metodo de pago: Tarjeta credito".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Autorizacion: 728194".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Referencia: VISA •••• 2048".into(),
                align: "left".into(),
                bold: false,
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: "Gracias por comprar con nosotros".into(),
                align: "center".into(),
                bold: true,
            },
            ReceiptBlock::Text {
                value: "Conserva este comprobante".into(),
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Text {
                value: "Atencion y soporte en MartPOS".into(),
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Divider,
            ReceiptBlock::Text {
                value: martpos_flow_label,
                align: "center".into(),
                bold: false,
            },
            ReceiptBlock::Qr {
                value: martpos_receipt_url,
            },
            ReceiptBlock::Barcode {
                value: "A1042819050".into(),
                symbology: Some("code128".into()),
                height: Some(80),
                show_text: true,
                full_width: false,
            },
            ReceiptBlock::CashDrawer,
            ReceiptBlock::Cut,
        ],
    }
}

pub fn dispatch_print_job(
    printer: &ResolvedPrinter,
    document: &ReceiptDocument,
    mode: PrintMode,
) -> Result<PrintResult, String> {
    match resolve_driver(printer, mode) {
        DriverKind::EscPosUsb => escpos::print_via_usb_device(printer, document)
            .or_else(|error| preview_print(printer, document, &format!("esc_pos_usb_preview: {error}"))),
        DriverKind::EscPosSystem => escpos::print_via_system_queue(printer, document)
            .or_else(|error| preview_print(printer, document, &format!("esc_pos_system_preview: {error}"))),
        DriverKind::SystemPrint => spooler::print_via_system_queue(printer, document)
            .or_else(|error| preview_print(printer, document, &format!("system_print_preview: {error}"))),
        DriverKind::Preview => preview_print(printer, document, "preview"),
    }
}

pub fn dispatch_raw_job(printer: &ResolvedPrinter, payload: &[u8]) -> Result<PrintResult, String> {
    match resolve_driver(printer, PrintMode::Raw) {
        DriverKind::EscPosUsb => escpos::send_raw_bytes(printer, payload)
            .or_else(|_| preview_raw(printer, payload, "esc_pos_usb_preview")),
        DriverKind::EscPosSystem => preview_raw(printer, payload, "esc_pos_system_raw_preview"),
        DriverKind::SystemPrint => preview_raw(printer, payload, "system_print_raw_preview"),
        DriverKind::Preview => preview_raw(printer, payload, "preview_raw"),
    }
}

pub fn write_temp_bytes(printer_id: &str, extension: &str, payload: &[u8]) -> Result<PathBuf, String> {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| error.to_string())?;
    let path = std::env::temp_dir().join(format!("mpos-core-{printer_id}-{seconds}.{extension}"));
    fs::write(&path, payload).map_err(|error| format!("failed to write temp payload: {error}"))?;
    Ok(path)
}

fn resolve_driver(printer: &ResolvedPrinter, mode: PrintMode) -> DriverKind {
    if matches!(mode, PrintMode::Raw) {
        return if printer.profile.raw_support {
            if printer.profile.raw_device_path.is_some() {
                DriverKind::EscPosUsb
            } else if printer.system_queue.is_some() {
                DriverKind::EscPosSystem
            } else {
                DriverKind::Preview
            }
        } else {
            DriverKind::Preview
        };
    }

    if printer.kind == PrinterKind::Thermal && printer.receipt_capable {
        if printer.profile.raw_device_path.is_some() {
            DriverKind::EscPosUsb
        } else if printer.system_queue.is_some() {
            DriverKind::EscPosSystem
        } else if printer.profile.raw_support {
            DriverKind::EscPosUsb
        } else {
            DriverKind::Preview
        }
    } else if printer.system_queue.is_some() {
        DriverKind::SystemPrint
    } else {
        DriverKind::Preview
    }
}

fn preview_print(
    printer: &ResolvedPrinter,
    document: &ReceiptDocument,
    driver: &str,
) -> Result<PrintResult, String> {
    let payload = render_receipt_escpos(document, &printer.profile);
    let path = write_temp_bytes(&printer.id, "escpos", &payload)?;

    Ok(PrintResult {
        printer_id: printer.id.clone(),
        driver: driver.into(),
        submitted: false,
        detail: "preview generated locally".into(),
        preview_path: Some(path.display().to_string()),
    })
}

fn preview_raw(printer: &ResolvedPrinter, payload: &[u8], driver: &str) -> Result<PrintResult, String> {
    let path = write_temp_bytes(&printer.id, "raw", payload)?;

    Ok(PrintResult {
        printer_id: printer.id.clone(),
        driver: driver.into(),
        submitted: false,
        detail: "raw preview generated locally".into(),
        preview_path: Some(path.display().to_string()),
    })
}
