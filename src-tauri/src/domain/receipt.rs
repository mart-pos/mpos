#![allow(dead_code)]

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptDocument {
    pub paper_width_mm: u16,
    #[serde(alias = "contentBlocks", alias = "content")]
    pub content_blocks: Vec<ReceiptBlock>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReceiptBlock {
    Text { value: String, align: String, bold: bool },
    Divider,
    Item {
        name: String,
        qty: u32,
        #[serde(alias = "unitPrice")]
        unit_price: u64,
        total: u64,
    },
    Totals {
        subtotal: u64,
        tax: u64,
        #[serde(alias = "grandTotal")]
        grand_total: u64,
    },
    Qr { value: String },
    Barcode {
        value: String,
        symbology: Option<String>,
        height: Option<u8>,
    },
    CashDrawer,
    Cut,
}

impl ReceiptDocument {
    pub fn validate(&self) -> Result<(), String> {
        if !matches!(self.paper_width_mm, 58 | 80) {
            return Err("paper_width_mm must be 58 or 80".into());
        }

        if self.content_blocks.is_empty() {
            return Err("receipt content cannot be empty".into());
        }

        if self.content_blocks.len() > 256 {
            return Err("receipt content exceeds maximum block count".into());
        }

        for block in &self.content_blocks {
            match block {
                ReceiptBlock::Text { value, align, .. } => {
                    validate_text(value, 512, "text")?;
                    if !matches!(align.as_str(), "left" | "center" | "right") {
                        return Err("text align must be left, center or right".into());
                    }
                }
                ReceiptBlock::Divider | ReceiptBlock::CashDrawer | ReceiptBlock::Cut => {}
                ReceiptBlock::Item {
                    name,
                    qty,
                    unit_price,
                    total,
                } => {
                    validate_text(name, 128, "item name")?;
                    if *qty == 0 {
                        return Err("item qty must be greater than zero".into());
                    }
                    if *total < *unit_price {
                        return Err("item total cannot be lower than unit_price".into());
                    }
                }
                ReceiptBlock::Totals {
                    subtotal,
                    tax,
                    grand_total,
                } => {
                    if subtotal.saturating_add(*tax) > *grand_total {
                        return Err("grand_total cannot be lower than subtotal + tax".into());
                    }
                }
                ReceiptBlock::Qr { value } => {
                    validate_text(value, 512, "qr value")?;
                }
                ReceiptBlock::Barcode {
                    value,
                    symbology,
                    height,
                } => {
                    validate_text(value, 128, "barcode value")?;
                    if let Some(symbology) = symbology {
                        if !matches!(
                            symbology.as_str(),
                            "code128" | "code39" | "ean13" | "ean8" | "upca" | "upce" | "itf"
                        ) {
                            return Err("unsupported barcode symbology".into());
                        }
                    }
                    if let Some(height) = height {
                        if *height < 1 {
                            return Err("barcode height must be greater than zero".into());
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

fn validate_text(value: &str, max_len: usize, label: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{label} cannot be empty"));
    }

    if value.len() > max_len {
        return Err(format!("{label} exceeds maximum length"));
    }

    if value
        .chars()
        .any(|character| character.is_control() && !matches!(character, '\n' | '\r' | '\t'))
    {
        return Err(format!("{label} contains unsupported control characters"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_alignment() {
        let document = ReceiptDocument {
            paper_width_mm: 80,
            content_blocks: vec![ReceiptBlock::Text {
                value: "hola".into(),
                align: "justify".into(),
                bold: false,
            }],
        };

        assert!(document.validate().is_err());
    }
}
